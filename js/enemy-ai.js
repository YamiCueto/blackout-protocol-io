import * as THREE from 'three';

export const AI_STATES = {
  PATROL: 'PATROL',
  SUSPICIOUS: 'SUSPICIOUS',
  INVESTIGATE: 'INVESTIGATE',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  TAKE_COVER: 'TAKE_COVER',
  RETREAT: 'RETREAT',
  SEARCH: 'SEARCH',
  DEAD: 'DEAD'
};

export const ARCHETYPES = {
  CHASER: {
    id: 'chaser',
    name: 'Perseguidor',
    speed: 4.2,
    hpBase: 85,
    attackRange: 2.8,
    preferredRange: 1.5,
    color: 0x992222,
    visorColor: 0xff3333,
    burstShots: 1,
    fireCooldown: 0.8,
    isMeleeOrClose: true
  },
  FLANKER: {
    id: 'flanker',
    name: 'Flanqueador',
    speed: 3.8,
    hpBase: 95,
    attackRange: 22,
    preferredRange: 9,
    color: 0x2e4a66,
    visorColor: 0x33b5e5,
    burstShots: 4,
    fireCooldown: 1.2,
    flankBias: 1.0
  },
  BRUTE: {
    id: 'brute',
    name: 'Blindado',
    speed: 2.2,
    hpBase: 240,
    attackRange: 32,
    preferredRange: 14,
    color: 0x42382e,
    visorColor: 0xff8800,
    scale: 1.15,
    burstShots: 7,
    fireCooldown: 1.6,
    resistanceMult: 0.70
  },
  SHOOTER: {
    id: 'shooter',
    name: 'Tirador',
    speed: 2.8,
    hpBase: 110,
    attackRange: 35,
    preferredRange: 16,
    color: 0x3d4435,
    visorColor: 0xaa2211,
    burstShots: 3,
    fireCooldown: 1.4,
    usesCover: true
  },
  ELITE: {
    id: 'elite',
    name: 'Élite',
    speed: 3.4,
    hpBase: 160,
    attackRange: 42,
    preferredRange: 22,
    color: 0x1a1a24,
    visorColor: 0xb026ff,
    burstShots: 2,
    fireCooldown: 1.1,
    sniperMode: true,
    usesCover: true
  }
};

export class EnemyAIBrain {
  constructor(enemy, archetype, spatialNav, perception) {
    this.enemy = enemy;
    this.archetype = archetype || ARCHETYPES.SHOOTER;
    this.spatialNav = spatialNav;
    this.perception = perception;

    this.state = AI_STATES.PATROL;
    this.stateTime = 0;
    this.minStateDuration = 0.65;

    this.lkp = null;
    this.lkpTime = -Infinity;
    this.lkpTimeout = 7.0;

    this.currentPath = [];
    this.pathTarget = null;
    this.pathIndex = 0;
    this.pathReplanTimer = 0;
    this.pathReplanInterval = 0.9;

    this.coverPoint = null;
    this.coverTimer = 0;

    this.shootTimer = 1.0 + Math.random() * 1.5;
    this.burstRemaining = 0;
    this.burstInterval = 0.12;
    this.burstTimer = 0;

    this.flankSign = Math.random() < 0.5 ? 1 : -1;
    this.stuckState = { lastPos: null, stuckTimer: 0, isStuck: false };

    this.visualFeedback = {
      actionState: 'patrol',
      targetYaw: enemy.group.rotation.y,
      turnSpeed: 6.5,
      alertT: 0
    };
  }

  setState(newState, force = false) {
    if (this.state === AI_STATES.DEAD && newState !== AI_STATES.DEAD) return;
    if (this.state === newState) return;
    if (!force && this.stateTime < this.minStateDuration && newState !== AI_STATES.DEAD) return;

    this.state = newState;
    this.stateTime = 0;

    if (newState === AI_STATES.TAKE_COVER) {
      this.coverTimer = 2.5 + Math.random() * 2.0;
    } else if (newState === AI_STATES.DEAD) {
      this.currentPath = [];
      this.pathTarget = null;
      this.burstRemaining = 0;
    }
  }

  update(dt, player, allEnemies, agentIndex, gameMode, bombPos, currentTimeSec) {
    if (!this.enemy.alive) {
      this.setState(AI_STATES.DEAD, true);
      return;
    }

    this.stateTime += dt;
    this.pathReplanTimer -= dt;

    const enemyPos = this.enemy.group.position;
    const playerPos = player.pos;

    const canSeePlayer = this.perception.checkVision(this.enemy, playerPos, this.state);
    if (canSeePlayer) {
      this.lkp = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
      this.lkpTime = currentTimeSec;
    } else if (this.lkp && (currentTimeSec - this.lkpTime > this.lkpTimeout)) {
      this.lkp = null;
    }

    const heardSounds = this.perception.getAudibleSounds(enemyPos, currentTimeSec - 0.5);
    let mostUrgentSound = null;
    if (heardSounds.length > 0) {
      let maxIntensity = -1;
      for (let i = 0; i < heardSounds.length; i++) {
        const s = heardSounds[i];
        if (s.intensity > maxIntensity) {
          maxIntensity = s.intensity;
          mostUrgentSound = s;
        }
      }
    }

    if (mostUrgentSound && !canSeePlayer && this.state === AI_STATES.PATROL) {
      this.lkp = { x: mostUrgentSound.x, y: 0, z: mostUrgentSound.z };
      this.lkpTime = currentTimeSec;
      this.setState(AI_STATES.INVESTIGATE);
    }

    const dxP = playerPos.x - enemyPos.x;
    const dzP = playerPos.z - enemyPos.z;
    const distToPlayer = Math.sqrt(dxP * dxP + dzP * dzP);

    this.updateStateTransitions(distToPlayer, canSeePlayer, gameMode, bombPos);

    this.executeBehavior(dt, player, allEnemies, agentIndex, gameMode, bombPos);

    this.updateVisuals(dt);
  }

  updateStateTransitions(distToPlayer, canSeePlayer, gameMode, bombPos) {
    if (this.enemy.defusing) return;

    switch (this.state) {
      case AI_STATES.PATROL:
        if (canSeePlayer) {
          this.setState(AI_STATES.ALERT);
        }
        break;

      case AI_STATES.SUSPICIOUS:
      case AI_STATES.INVESTIGATE:
        if (canSeePlayer) {
          this.setState(AI_STATES.ALERT);
        } else if (!this.lkp || this.stateTime > 5.0) {
          this.setState(AI_STATES.SEARCH);
        }
        break;

      case AI_STATES.SEARCH:
        if (canSeePlayer) {
          this.setState(AI_STATES.ALERT);
        } else if (this.stateTime > 4.0) {
          this.setState(AI_STATES.PATROL);
        }
        break;

      case AI_STATES.ALERT:
        if (this.stateTime >= 0.4) {
          if (canSeePlayer) {
            if (this.archetype.isMeleeOrClose || distToPlayer > this.archetype.attackRange) {
              this.setState(AI_STATES.CHASE);
            } else {
              this.setState(AI_STATES.ATTACK);
            }
          } else if (this.lkp) {
            this.setState(AI_STATES.CHASE);
          } else {
            this.setState(AI_STATES.SEARCH);
          }
        }
        break;

      case AI_STATES.CHASE:
        if (canSeePlayer) {
          if (!this.archetype.isMeleeOrClose && distToPlayer <= this.archetype.attackRange) {
            this.setState(AI_STATES.ATTACK);
          } else if (this.archetype.isMeleeOrClose && distToPlayer <= this.archetype.attackRange) {
            this.setState(AI_STATES.ATTACK);
          }
        } else if (!this.lkp) {
          this.setState(AI_STATES.SEARCH);
        }
        break;

      case AI_STATES.ATTACK:
        if (!canSeePlayer) {
          if (this.lkp) {
            this.setState(AI_STATES.CHASE);
          } else {
            this.setState(AI_STATES.SEARCH);
          }
        } else {
          if (this.archetype.usesCover && this.enemy.hp < 45 && this.stateTime > 1.2) {
            this.setState(AI_STATES.TAKE_COVER);
          } else if (distToPlayer < 4.0 && !this.archetype.isMeleeOrClose) {
            this.setState(AI_STATES.RETREAT);
          }
        }
        break;

      case AI_STATES.TAKE_COVER:
        this.coverTimer -= 0.016;
        if (this.coverTimer <= 0 || (distToPlayer < 3.5 && canSeePlayer)) {
          this.setState(canSeePlayer ? AI_STATES.ATTACK : AI_STATES.CHASE);
        }
        break;

      case AI_STATES.RETREAT:
        if (distToPlayer > 8.0 || this.stateTime > 2.0) {
          this.setState(AI_STATES.ATTACK);
        }
        break;
    }
  }

  executeBehavior(dt, player, allEnemies, agentIndex, gameMode, bombPos) {
    const enemyPos = this.enemy.group.position;
    let targetMovePos = null;
    let speedMult = 1.0;

    if (this.enemy.defusing) {
      this.visualFeedback.actionState = 'defuse';
      return;
    }

    switch (this.state) {
      case AI_STATES.PATROL:
        this.visualFeedback.actionState = 'patrol';
        speedMult = 0.45;
        if (!this.pathTarget || this.pathIndex >= this.currentPath.length) {
          const randAngle = Math.random() * Math.PI * 2;
          const randDist = 8 + Math.random() * 12;
          const px = enemyPos.x + Math.sin(randAngle) * randDist;
          const pz = enemyPos.z + Math.cos(randAngle) * randDist;
          this.setMoveTarget({ x: px, z: pz }, true);
        }
        break;

      case AI_STATES.INVESTIGATE:
      case AI_STATES.SEARCH:
        this.visualFeedback.actionState = 'investigate';
        speedMult = 0.75;
        if (this.lkp) {
          targetMovePos = this.lkp;
        }
        break;

      case AI_STATES.ALERT:
        this.visualFeedback.actionState = 'alert';
        speedMult = 0.0;
        if (this.lkp) {
          this.visualFeedback.targetYaw = Math.atan2(this.lkp.x - enemyPos.x, this.lkp.z - enemyPos.z);
        }
        break;

      case AI_STATES.CHASE:
        this.visualFeedback.actionState = 'chase';
        speedMult = 1.0;
        if (this.archetype.flankBias && this.lkp) {
          const dx = this.lkp.x - enemyPos.x;
          const dz = this.lkp.z - enemyPos.z;
          const orthoX = -dz * this.flankSign * 0.4;
          const orthoZ = dx * this.flankSign * 0.4;
          targetMovePos = { x: this.lkp.x + orthoX, z: this.lkp.z + orthoZ };
        } else if (this.lkp) {
          targetMovePos = this.lkp;
        }
        break;

      case AI_STATES.ATTACK:
        this.visualFeedback.actionState = 'attack';
        this.visualFeedback.targetYaw = Math.atan2(player.pos.x - enemyPos.x, player.pos.z - enemyPos.z);
        if (this.archetype.isMeleeOrClose) {
          targetMovePos = player.pos;
          speedMult = 1.0;
        } else {
          speedMult = 0.25;
          const dx = player.pos.x - enemyPos.x;
          const dz = player.pos.z - enemyPos.z;
          const curDist = Math.sqrt(dx * dx + dz * dz);
          if (curDist < this.archetype.preferredRange - 2) {
            targetMovePos = { x: enemyPos.x - dx * 0.5, z: enemyPos.z - dz * 0.5 };
          } else if (curDist > this.archetype.preferredRange + 3) {
            targetMovePos = player.pos;
          }
        }
        break;

      case AI_STATES.TAKE_COVER:
        this.visualFeedback.actionState = 'cover';
        speedMult = 1.05;
        if (!this.coverPoint) {
          this.coverPoint = this.spatialNav.findBestCover(enemyPos, player.pos, 5, 25);
        }
        if (this.coverPoint) {
          targetMovePos = this.coverPoint;
        }
        break;

      case AI_STATES.RETREAT:
        this.visualFeedback.actionState = 'retreat';
        speedMult = 0.95;
        const awayX = enemyPos.x - player.pos.x;
        const awayZ = enemyPos.z - player.pos.z;
        targetMovePos = { x: enemyPos.x + awayX * 2, z: enemyPos.z + awayZ * 2 };
        break;
    }

    if (gameMode === 'snd' && bombPos && this.enemy.sndRole === 'defuser') {
      targetMovePos = bombPos;
      speedMult = 1.0;
    }

    if (targetMovePos) {
      if (this.pathReplanTimer <= 0 || !this.pathTarget ||
          Math.hypot(this.pathTarget.x - targetMovePos.x, this.pathTarget.z - targetMovePos.z) > 4.5) {
        this.setMoveTarget(targetMovePos);
      }
    }

    this.followPath(dt, speedMult, allEnemies, agentIndex);
  }

  setMoveTarget(targetPos, force = false) {
    if (!targetPos) return;
    this.pathTarget = { x: targetPos.x, z: targetPos.z };
    this.pathReplanTimer = this.pathReplanInterval + Math.random() * 0.3;
    this.currentPath = this.spatialNav.findPath(this.enemy.group.position, targetPos);
    this.pathIndex = 1;
  }

  followPath(dt, speedMult, allEnemies, agentIndex) {
    if (speedMult <= 0.01) return;
    const enemyPos = this.enemy.group.position;

    if (this.currentPath && this.pathIndex < this.currentPath.length) {
      const targetWaypoint = this.currentPath[this.pathIndex];
      const dx = targetWaypoint.x - enemyPos.x;
      const dz = targetWaypoint.z - enemyPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.8) {
        this.pathIndex++;
      } else {
        const moveDir = new THREE.Vector3(dx / dist, 0, dz / dist);

        const sep = new THREE.Vector3();
        this.spatialNav.computeSeparation(enemyPos, allEnemies, agentIndex, sep);
        moveDir.addScaledVector(sep, 0.65).normalize();

        const actualSpeed = this.enemy.speed * speedMult;
        enemyPos.x += moveDir.x * actualSpeed * dt;
        enemyPos.z += moveDir.z * actualSpeed * dt;

        if (this.state !== AI_STATES.ATTACK && this.state !== AI_STATES.ALERT) {
          this.visualFeedback.targetYaw = Math.atan2(moveDir.x, moveDir.z);
        }

        const isStuck = this.spatialNav.updateStuckDetector(this.stuckState, enemyPos, dt);
        if (isStuck) {
          this.stuckState.stuckTimer = 0;
          this.pathReplanTimer = 0;
          this.flankSign *= -1;
          const escapeAngle = this.enemy.group.rotation.y + Math.PI * 0.5 * this.flankSign;
          enemyPos.x += Math.sin(escapeAngle) * 0.35;
          enemyPos.z += Math.cos(escapeAngle) * 0.35;
        }

        this.enemy.walkPhase += dt * actualSpeed * 3.4;
        this.enemy.legL.rotation.x = Math.sin(this.enemy.walkPhase) * 0.55;
        this.enemy.legR.rotation.x = -Math.sin(this.enemy.walkPhase) * 0.55;
      }
    } else {
      this.enemy.legL.rotation.x *= 0.85;
      this.enemy.legR.rotation.x *= 0.85;
    }
  }

  updateVisuals(dt) {
    let diff = this.visualFeedback.targetYaw - this.enemy.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    this.enemy.group.rotation.y += diff * Math.min(1.0, dt * this.visualFeedback.turnSpeed);
  }
}
