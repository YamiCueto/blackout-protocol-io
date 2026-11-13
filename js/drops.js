import { getSupplyDef, getModeSupplyRules, calculateDropChances } from './supplies.js';

export class DropsManager {
  constructor(options = {}) {
    this.drops = [];
    this.nextId = 1;
    this.mode = options.mode || 'waves';
    this.wave = options.wave || 1;
    this.pityKillCounter = 0;
    this.emergencyDropsThisWave = 0;
    this.emergencyCooldownTimer = 0;
    this.isBlockedFn = options.isBlockedFn || null;
    this.bounds = options.bounds || { minX: -56, maxX: 56, minZ: -56, maxZ: 56 };
  }

  setMode(mode) {
    this.mode = mode || 'waves';
  }

  setWave(wave) {
    this.wave = Math.max(1, wave || 1);
    this.emergencyDropsThisWave = 0;
  }

  setSpatialChecker(isBlockedFn, bounds) {
    if (typeof isBlockedFn === 'function') this.isBlockedFn = isBlockedFn;
    if (bounds) this.bounds = bounds;
  }

  resolveValidPosition(targetX, targetZ, radius = 0.55) {
    const minX = (this.bounds?.minX ?? -56) + radius;
    const maxX = (this.bounds?.maxX ?? 56) - radius;
    const minZ = (this.bounds?.minZ ?? -56) + radius;
    const maxZ = (this.bounds?.maxZ ?? 56) - radius;

    const clampX = Math.max(minX, Math.min(maxX, targetX));
    const clampZ = Math.max(minZ, Math.min(maxZ, targetZ));

    const check = (x, z) => {
      if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
      if (this.isBlockedFn && this.isBlockedFn(x, z, radius)) return false;
      return true;
    };

    if (check(clampX, clampZ)) {
      return { x: clampX, y: 0.25, z: clampZ };
    }

    const testRadii = [1.2, 2.4, 3.8, 5.2];
    const anglesCount = 8;
    for (const r of testRadii) {
      for (let i = 0; i < anglesCount; i++) {
        const ang = (i / anglesCount) * Math.PI * 2;
        const candX = clampX + Math.cos(ang) * r;
        const candZ = clampZ + Math.sin(ang) * r;
        if (check(candX, candZ)) {
          return { x: candX, y: 0.25, z: candZ };
        }
      }
    }

    if (check(0, 0)) {
      return { x: 0, y: 0.25, z: 0 };
    }

    return { x: clampX, y: 0.25, z: clampZ };
  }

  spawnDrop(supplyId, x, z, options = {}) {
    const supplyDef = getSupplyDef(supplyId);
    if (!supplyDef) return null;

    const rules = getModeSupplyRules(this.mode);
    while (this.drops.length >= rules.maxActiveDrops && this.drops.length > 0) {
      const nonEmergencyIndex = this.drops.findIndex(d => !d.isEmergency);
      const removeIndex = nonEmergencyIndex >= 0 ? nonEmergencyIndex : 0;
      this.drops.splice(removeIndex, 1);
    }

    const pos = this.resolveValidPosition(x, z, 0.55);
    const drop = {
      id: this.nextId++,
      supplyId,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      age: 0,
      ttl: options.ttl || supplyDef.ttl,
      source: options.source || 'manual',
      isEmergency: !!options.isEmergency
    };

    this.drops.push(drop);
    return drop;
  }

  onEnemyKilled(pos, context = {}) {
    const rules = getModeSupplyRules(this.mode);
    if (!rules.allowEnemyDrops) return null;

    const rng = typeof context.rng === 'function' ? context.rng : Math.random;
    const playerAmmoLow = !!context.playerAmmoLow;

    if (playerAmmoLow && rules.pityKillLimit > 0) {
      this.pityKillCounter++;
      if (this.pityKillCounter >= rules.pityKillLimit) {
        this.pityKillCounter = 0;
        return this.spawnDrop('ammo_pack', pos.x, pos.z, { source: 'kill_pity' });
      }
    }

    const chances = calculateDropChances(this.mode, this.wave);
    const roll = rng();

    if (roll < chances.ammo) {
      this.pityKillCounter = 0;
      return this.spawnDrop('ammo_pack', pos.x, pos.z, { source: 'kill_drop' });
    }

    if (roll < chances.ammo + chances.medkit) {
      return this.spawnDrop('medkit', pos.x, pos.z, { source: 'kill_drop' });
    }

    if (roll < chances.ammo + chances.medkit + chances.stim) {
      return this.spawnDrop('stim', pos.x, pos.z, { source: 'kill_drop' });
    }

    return null;
  }

  checkEmergencyAmmo(playerPos, isTotalAmmoExhausted) {
    if (this.mode !== 'waves') return null;
    if (!isTotalAmmoExhausted) return null;

    const rules = getModeSupplyRules(this.mode);
    if (this.emergencyDropsThisWave >= rules.emergencyMaxPerWave) return null;
    if (this.emergencyCooldownTimer > 0) return null;

    const hasGroundAmmo = this.drops.some(d => d.supplyId === 'ammo_pack');
    if (hasGroundAmmo) return null;

    this.emergencyDropsThisWave++;
    this.emergencyCooldownTimer = rules.emergencyCooldown;

    const spawnX = playerPos ? playerPos.x + 3.0 : 0;
    const spawnZ = playerPos ? playerPos.z + 3.0 : 0;

    return this.spawnDrop('ammo_pack', spawnX, spawnZ, {
      source: 'emergency_depletion',
      isEmergency: true
    });
  }

  update(dt) {
    if (dt <= 0) return { expiredIds: [] };

    if (this.emergencyCooldownTimer > 0) {
      this.emergencyCooldownTimer = Math.max(0, this.emergencyCooldownTimer - dt);
    }

    const expiredIds = [];
    const remaining = [];

    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];
      drop.age += dt;
      if (drop.age >= drop.ttl) {
        expiredIds.push(drop.id);
      } else {
        remaining.push(drop);
      }
    }

    this.drops = remaining;
    return { expiredIds };
  }

  findNearestDrop(x, y, z, maxDist = 2.2) {
    let best = null;
    let bestDistSq = maxDist * maxDist;

    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      const dx = d.x - x;
      const dy = d.y - y;
      const dz = d.z - z;
      if (Math.abs(dy) > 2.5) continue;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = d;
      }
    }

    return best;
  }

  pickupDrop(dropId) {
    const idx = this.drops.findIndex(d => d.id === dropId);
    if (idx < 0) return null;
    const [removed] = this.drops.splice(idx, 1);
    return removed;
  }

  getDrops() {
    return this.drops;
  }

  clear() {
    this.drops = [];
    this.pityKillCounter = 0;
    this.emergencyDropsThisWave = 0;
    this.emergencyCooldownTimer = 0;
  }
}
