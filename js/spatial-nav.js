import * as THREE from 'three';

export class SpatialNavigation {
  constructor(options = {}) {
    this.arenaHalfSize = options.arenaHalfSize || 58;
    this.agentRadius = options.agentRadius || 0.55;
    this.colliders = [];
    this.nodes = [];
    this.adjacency = [];
    this.coverNodes = [];
    this.maxPathIterations = options.maxPathIterations || 200;
    this.separationDistance = options.separationDistance || 1.1;
    this.stuckThresholdTime = options.stuckThresholdTime || 1.2;
    this.stuckDistanceThreshold = options.stuckDistanceThreshold || 0.15;
    if (options.colliders) {
      this.buildGraph(options.colliders);
    }
  }

  buildGraph(colliders) {
    this.colliders = colliders || [];
    this.nodes = [];
    this.adjacency = [];
    this.coverNodes = [];

    const rawWaypoints = [];
    const minClearance = this.agentRadius + 0.35;

    for (let x = -48; x <= 48; x += 12) {
      for (let z = -48; z <= 48; z += 12) {
        rawWaypoints.push({ x, z });
      }
    }

    for (const b of this.colliders) {
      if (b.max.y < 0.5) continue;
      const xMin = b.min.x - minClearance;
      const xMax = b.max.x + minClearance;
      const zMin = b.min.z - minClearance;
      const zMax = b.max.z + minClearance;

      rawWaypoints.push({ x: xMin, z: zMin });
      rawWaypoints.push({ x: xMax, z: zMin });
      rawWaypoints.push({ x: xMin, z: zMax });
      rawWaypoints.push({ x: xMax, z: zMax });

      rawWaypoints.push({ x: (xMin + xMax) * 0.5, z: zMin });
      rawWaypoints.push({ x: (xMin + xMax) * 0.5, z: zMax });
      rawWaypoints.push({ x: xMin, z: (zMin + zMax) * 0.5 });
      rawWaypoints.push({ x: xMax, z: (zMin + zMax) * 0.5 });
    }

    const validWaypoints = [];
    const bound = this.arenaHalfSize - 2.5;

    for (const p of rawWaypoints) {
      if (Math.abs(p.x) > bound || Math.abs(p.z) > bound) continue;
      if (this.isPointBlocked(p.x, p.z, this.agentRadius + 0.1)) continue;

      let duplicate = false;
      for (const v of validWaypoints) {
        const dx = v.x - p.x;
        const dz = v.z - p.z;
        if (dx * dx + dz * dz < 1.44) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        validWaypoints.push({ id: validWaypoints.length, x: p.x, z: p.z });
      }
    }

    this.nodes = validWaypoints;
    this.adjacency = new Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      this.adjacency[i] = [];
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const b = this.nodes[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= 750) {
          if (this.isSegmentClear(a.x, a.z, b.x, b.z, this.agentRadius + 0.05)) {
            const dist = Math.sqrt(d2);
            this.adjacency[i].push({ id: j, dist });
            this.adjacency[j].push({ id: i, dist });
          }
        }
      }
    }

    this.evaluateCoverPoints();
  }

  evaluateCoverPoints() {
    this.coverNodes = [];
    for (const node of this.nodes) {
      let obstaclesNearby = 0;
      for (const b of this.colliders) {
        if (b.max.y < 0.5) continue;
        const cx = Math.max(b.min.x, Math.min(node.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(node.z, b.max.z));
        const dx = node.x - cx;
        const dz = node.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq < 9.0) {
          obstaclesNearby++;
        }
      }
      if (obstaclesNearby > 0) {
        this.coverNodes.push(node.id);
      }
    }
  }

  isPointBlocked(x, z, r = 0.5) {
    for (const b of this.colliders) {
      if (b.max.y > 0.5 &&
          x > b.min.x - r && x < b.max.x + r &&
          z > b.min.z - r && z < b.max.z + r) {
        return true;
      }
    }
    return false;
  }

  isSegmentClear(x1, z1, x2, z2, r = 0.5) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-4) return !this.isPointBlocked(x1, z1, r);

    const steps = Math.ceil(len / 0.6);
    const stepX = dx / steps;
    const stepZ = dz / steps;

    for (let i = 0; i <= steps; i++) {
      const px = x1 + stepX * i;
      const pz = z1 + stepZ * i;
      if (this.isPointBlocked(px, pz, r)) {
        return false;
      }
    }
    return true;
  }

  getNearestNode(x, z, maxDist = 30) {
    let bestId = -1;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const dx = n.x - x;
      const dz = n.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        if (this.isSegmentClear(x, z, n.x, n.z, this.agentRadius)) {
          bestDistSq = d2;
          bestId = i;
        }
      }
    }
    if (bestId === -1) {
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const dx = n.x - x;
        const dz = n.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestId = i;
        }
      }
    }
    return bestId;
  }

  findPath(startPos, targetPos) {
    const startX = startPos.x !== undefined ? startPos.x : startPos[0];
    const startZ = startPos.z !== undefined ? startPos.z : startPos[2];
    const targetX = targetPos.x !== undefined ? targetPos.x : targetPos[0];
    const targetZ = targetPos.z !== undefined ? targetPos.z : targetPos[2];

    if (this.isSegmentClear(startX, startZ, targetX, targetZ, this.agentRadius + 0.1)) {
      return [
        { x: startX, z: startZ },
        { x: targetX, z: targetZ }
      ];
    }

    const startNode = this.getNearestNode(startX, startZ);
    const targetNode = this.getNearestNode(targetX, targetZ);

    if (startNode === -1 || targetNode === -1) {
      return [{ x: startX, z: startZ }, { x: targetX, z: targetZ }];
    }

    if (startNode === targetNode) {
      return [
        { x: startX, z: startZ },
        { x: this.nodes[startNode].x, z: this.nodes[startNode].z },
        { x: targetX, z: targetZ }
      ];
    }

    const n = this.nodes.length;
    const gScore = new Float32Array(n).fill(Infinity);
    const fScore = new Float32Array(n).fill(Infinity);
    const parent = new Int32Array(n).fill(-1);
    const closedSet = new Uint8Array(n);
    const openSet = new Set([startNode]);

    gScore[startNode] = 0;
    const goalNode = this.nodes[targetNode];
    const dxg = goalNode.x - this.nodes[startNode].x;
    const dzg = goalNode.z - this.nodes[startNode].z;
    fScore[startNode] = Math.sqrt(dxg * dxg + dzg * dzg);

    let iterations = 0;
    let found = false;

    while (openSet.size > 0 && iterations++ < this.maxPathIterations) {
      let current = -1;
      let lowestF = Infinity;
      for (const id of openSet) {
        if (fScore[id] < lowestF) {
          lowestF = fScore[id];
          current = id;
        }
      }

      if (current === targetNode) {
        found = true;
        break;
      }

      openSet.delete(current);
      closedSet[current] = 1;

      const neighbors = this.adjacency[current];
      const curG = gScore[current];

      for (let i = 0; i < neighbors.length; i++) {
        const edge = neighbors[i];
        const neighborId = edge.id;
        if (closedSet[neighborId] === 1) continue;

        const tentativeG = curG + edge.dist;
        if (tentativeG < gScore[neighborId]) {
          parent[neighborId] = current;
          gScore[neighborId] = tentativeG;
          const nb = this.nodes[neighborId];
          const hdx = goalNode.x - nb.x;
          const hdz = goalNode.z - nb.z;
          fScore[neighborId] = tentativeG + Math.sqrt(hdx * hdx + hdz * hdz);
          openSet.add(neighborId);
        }
      }
    }

    if (!found) {
      return [
        { x: startX, z: startZ },
        { x: this.nodes[startNode].x, z: this.nodes[startNode].z },
        { x: targetX, z: targetZ }
      ];
    }

    const path = [];
    let curr = targetNode;
    while (curr !== -1) {
      path.push({ x: this.nodes[curr].x, z: this.nodes[curr].z });
      curr = parent[curr];
    }
    path.reverse();

    path.unshift({ x: startX, z: startZ });
    path.push({ x: targetX, z: targetZ });

    return this.smoothPath(path);
  }

  smoothPath(rawPath) {
    if (rawPath.length <= 2) return rawPath;
    const smoothed = [rawPath[0]];
    let currentIdx = 0;

    while (currentIdx < rawPath.length - 1) {
      let furthestIdx = currentIdx + 1;
      for (let i = rawPath.length - 1; i > currentIdx + 1; i--) {
        if (this.isSegmentClear(
          rawPath[currentIdx].x, rawPath[currentIdx].z,
          rawPath[i].x, rawPath[i].z,
          this.agentRadius + 0.1
        )) {
          furthestIdx = i;
          break;
        }
      }
      smoothed.push(rawPath[furthestIdx]);
      currentIdx = furthestIdx;
    }

    return smoothed;
  }

  findBestCover(enemyPos, threatPos, minDistance = 5, maxDistance = 25) {
    let bestCover = null;
    let bestScore = -Infinity;

    for (const nodeId of this.coverNodes) {
      const node = this.nodes[nodeId];
      const dThreatX = node.x - threatPos.x;
      const dThreatZ = node.z - threatPos.z;
      const distThreat = Math.sqrt(dThreatX * dThreatX + dThreatZ * dThreatZ);

      if (distThreat < minDistance || distThreat > maxDistance) continue;

      const isOccluded = !this.isSegmentClear(node.x, node.z, threatPos.x, threatPos.z, 0.2);
      if (!isOccluded) continue;

      const dEnemyX = node.x - enemyPos.x;
      const dEnemyZ = node.z - enemyPos.z;
      const distEnemy = Math.sqrt(dEnemyX * dEnemyX + dEnemyZ * dEnemyZ);

      const score = 100 - distEnemy * 2 + distThreat;
      if (score > bestScore) {
        bestScore = score;
        bestCover = { x: node.x, z: node.z };
      }
    }

    return bestCover;
  }

  computeSeparation(agentPos, allEnemies, agentIndex, outVector) {
    outVector.set(0, 0, 0);
    let count = 0;
    const sepSq = this.separationDistance * this.separationDistance;

    for (let i = 0; i < allEnemies.length; i++) {
      if (i === agentIndex) continue;
      const other = allEnemies[i];
      if (!other.alive) continue;

      const dx = agentPos.x - other.group.position.x;
      const dz = agentPos.z - other.group.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq > 1e-4 && distSq < sepSq) {
        const dist = Math.sqrt(distSq);
        const force = (this.separationDistance - dist) / dist;
        outVector.x += dx * force;
        outVector.z += dz * force;
        count++;
      }
    }

    if (count > 0) {
      outVector.x /= count;
      outVector.z /= count;
    }
    return outVector;
  }

  updateStuckDetector(agentState, currentPos, dt) {
    if (!agentState.lastPos) {
      agentState.lastPos = { x: currentPos.x, z: currentPos.z };
      agentState.stuckTimer = 0;
      agentState.isStuck = false;
      return false;
    }

    const dx = currentPos.x - agentState.lastPos.x;
    const dz = currentPos.z - agentState.lastPos.z;
    const movedDist = Math.sqrt(dx * dx + dz * dz);

    if (movedDist < this.stuckDistanceThreshold * dt) {
      agentState.stuckTimer += dt;
      if (agentState.stuckTimer >= this.stuckThresholdTime) {
        agentState.isStuck = true;
      }
    } else {
      agentState.stuckTimer = Math.max(0, agentState.stuckTimer - dt * 2);
      agentState.isStuck = false;
      agentState.lastPos.x = currentPos.x;
      agentState.lastPos.z = currentPos.z;
    }

    return agentState.isStuck;
  }
}
