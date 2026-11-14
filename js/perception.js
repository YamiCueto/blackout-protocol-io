import * as THREE from 'three';

export class PerceptionSystem {
  constructor(options = {}) {
    this.colliders = options.colliders || [];
    this.raycaster = new THREE.Raycaster();
    this.solidMeshesProvider = options.solidMeshesProvider || (() => []);
    this.soundEvents = [];
    this.maxSoundAge = options.maxSoundAge || 3.0;

    this.visionParams = {
      PATROL: { fov: 75 * (Math.PI / 180), distance: 26 },
      SUSPICIOUS: { fov: 90 * (Math.PI / 180), distance: 30 },
      INVESTIGATE: { fov: 90 * (Math.PI / 180), distance: 32 },
      ALERT: { fov: 130 * (Math.PI / 180), distance: 40 },
      CHASE: { fov: 140 * (Math.PI / 180), distance: 42 },
      ATTACK: { fov: 140 * (Math.PI / 180), distance: 42 },
      TAKE_COVER: { fov: 110 * (Math.PI / 180), distance: 35 },
      RETREAT: { fov: 100 * (Math.PI / 180), distance: 32 },
      SEARCH: { fov: 100 * (Math.PI / 180), distance: 28 },
      DEAD: { fov: 0, distance: 0 }
    };
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  setSolidMeshesProvider(fn) {
    this.solidMeshesProvider = fn;
  }

  broadcastSound(type, position, isSuppressed = false, customRadius = null) {
    let radius = 0;
    if (customRadius !== null) {
      radius = customRadius;
    } else {
      switch (type) {
        case 'shot':
          radius = isSuppressed ? 12 : 45;
          break;
        case 'sprint':
          radius = 14;
          break;
        case 'walk':
          radius = 4;
          break;
        case 'reload':
          radius = 8;
          break;
        case 'explosion':
          radius = 70;
          break;
        default:
          radius = 10;
      }
    }

    this.soundEvents.push({
      type,
      x: position.x,
      y: position.y !== undefined ? position.y : 0,
      z: position.z,
      radius,
      timestamp: performance.now() * 0.001
    });

    if (this.soundEvents.length > 30) {
      this.soundEvents.shift();
    }
  }

  update(currentTimeSec) {
    const minTime = currentTimeSec - this.maxSoundAge;
    for (let i = this.soundEvents.length - 1; i >= 0; i--) {
      if (this.soundEvents[i].timestamp < minTime) {
        this.soundEvents.splice(i, 1);
      }
    }
  }

  checkVision(enemy, targetPos, currentState = 'PATROL') {
    if (!enemy.alive) return false;

    const params = this.visionParams[currentState] || this.visionParams.PATROL;
    const enemyPos = enemy.group.position;
    const dx = targetPos.x - enemyPos.x;
    const dz = targetPos.z - enemyPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq > params.distance * params.distance) {
      return false;
    }

    const dist = Math.sqrt(distSq);
    if (dist < 1e-4) return true;

    const enemyYaw = enemy.group.rotation.y;
    const forwardX = Math.sin(enemyYaw);
    const forwardZ = Math.cos(enemyYaw);

    const toTargetX = dx / dist;
    const toTargetZ = dz / dist;

    const dot = forwardX * toTargetX + forwardZ * toTargetZ;
    const cosHalfFov = Math.cos(params.fov * 0.5);

    if (dist > 3.0 && dot < cosHalfFov) {
      return false;
    }

    return this.hasLineOfSight(enemyPos.x, enemyPos.y + 1.4, enemyPos.z, targetPos.x, targetPos.y, targetPos.z);
  }

  hasLineOfSight(fromX, fromY, fromZ, toX, toY, toZ) {
    const origin = new THREE.Vector3(fromX, fromY, fromZ);
    const target = new THREE.Vector3(toX, toY, toZ);
    const dir = target.clone().sub(origin);
    const dist = dir.length();
    if (dist < 1e-4) return true;
    dir.normalize();

    const meshes = this.solidMeshesProvider();
    if (meshes && meshes.length > 0) {
      this.raycaster.set(origin, dir);
      this.raycaster.far = dist;
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        return false;
      }
      return true;
    }

    const steps = Math.ceil(dist / 0.5);
    const stepX = (toX - fromX) / steps;
    const stepZ = (toZ - fromZ) / steps;
    for (let i = 1; i < steps; i++) {
      const px = fromX + stepX * i;
      const pz = fromZ + stepZ * i;
      for (const b of this.colliders) {
        if (b.max.y > 0.5 &&
            px > b.min.x && px < b.max.x &&
            pz > b.min.z && pz < b.max.z) {
          return false;
        }
      }
    }
    return true;
  }

  getAudibleSounds(enemyPos, minTimestamp = 0) {
    const heard = [];
    for (let i = 0; i < this.soundEvents.length; i++) {
      const s = this.soundEvents[i];
      if (s.timestamp < minTimestamp) continue;

      const dx = s.x - enemyPos.x;
      const dz = s.z - enemyPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= s.radius * s.radius) {
        heard.push({
          type: s.type,
          x: s.x,
          z: s.z,
          distance: Math.sqrt(d2),
          intensity: 1 - Math.sqrt(d2) / s.radius,
          timestamp: s.timestamp
        });
      }
    }
    return heard;
  }
}
