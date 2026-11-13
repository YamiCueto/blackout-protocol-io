import { MAX_PLAYER_HP, INVENTORY_LIMITS, SUPPLY_CATALOG } from './supplies.js';

export function createConsumablesState() {
  return {
    inventory: {
      medkit: 0,
      stim: 0
    },
    activeUse: {
      type: null,
      elapsed: 0,
      duration: 0
    },
    stim: {
      active: false,
      remaining: 0,
      cooldownRemaining: 0
    }
  };
}

export function canAddConsumable(state, key) {
  if (!state || !state.inventory || !(key in INVENTORY_LIMITS)) return false;
  return state.inventory[key] < INVENTORY_LIMITS[key];
}

export function addConsumable(state, key, amount = 1) {
  if (!canAddConsumable(state, key) || amount <= 0) {
    return { added: 0, full: true, count: state.inventory[key] || 0 };
  }
  const max = INVENTORY_LIMITS[key];
  const before = state.inventory[key];
  const next = Math.min(max, before + amount);
  const added = next - before;
  state.inventory[key] = next;
  return { added, full: next >= max, count: next };
}

export function startMedkitUse(state, playerHp) {
  if (!state || state.inventory.medkit <= 0) {
    return { ok: false, reason: 'no_item' };
  }
  if (playerHp >= MAX_PLAYER_HP) {
    return { ok: false, reason: 'full_health' };
  }
  if (state.activeUse.type) {
    return { ok: false, reason: 'in_progress' };
  }
  state.activeUse.type = 'medkit';
  state.activeUse.elapsed = 0;
  state.activeUse.duration = SUPPLY_CATALOG.medkit.useDuration;
  return { ok: true, duration: state.activeUse.duration };
}

export function cancelMedkitUse(state) {
  if (!state || !state.activeUse.type) return false;
  state.activeUse.type = null;
  state.activeUse.elapsed = 0;
  state.activeUse.duration = 0;
  return true;
}

export function completeMedkitUse(state, playerHp) {
  if (!state || state.activeUse.type !== 'medkit') {
    return { ok: false, healAmount: 0 };
  }
  if (state.inventory.medkit <= 0) {
    cancelMedkitUse(state);
    return { ok: false, healAmount: 0 };
  }
  state.inventory.medkit--;
  state.activeUse.type = null;
  state.activeUse.elapsed = 0;
  state.activeUse.duration = 0;
  const healAmount = SUPPLY_CATALOG.medkit.healAmount;
  const newHp = Math.min(MAX_PLAYER_HP, playerHp + healAmount);
  return { ok: true, healAmount: newHp - playerHp, newHp };
}

export function useStim(state, playerHp) {
  if (!state || state.inventory.stim <= 0) {
    return { ok: false, reason: 'no_item' };
  }
  if (state.stim.active) {
    return { ok: false, reason: 'already_active' };
  }
  if (state.stim.cooldownRemaining > 0) {
    return { ok: false, reason: 'cooldown', remaining: state.stim.cooldownRemaining };
  }
  state.inventory.stim--;
  state.stim.active = true;
  state.stim.remaining = SUPPLY_CATALOG.stim.duration;
  state.stim.cooldownRemaining = 0;
  const instantHeal = SUPPLY_CATALOG.stim.instantHeal;
  const newHp = Math.min(MAX_PLAYER_HP, playerHp + instantHeal);
  return {
    ok: true,
    healAmount: newHp - playerHp,
    newHp,
    duration: state.stim.remaining,
    mobilityMult: SUPPLY_CATALOG.stim.mobilityMult
  };
}

export function updateConsumables(state, dt, playerHp) {
  const result = {
    medkitCompleted: false,
    healAmount: 0,
    newHp: playerHp,
    stimExpired: false
  };
  if (!state || dt <= 0) return result;

  if (state.stim.cooldownRemaining > 0 && !state.stim.active) {
    state.stim.cooldownRemaining = Math.max(0, state.stim.cooldownRemaining - dt);
  }

  if (state.stim.active) {
    state.stim.remaining -= dt;
    if (state.stim.remaining <= 0) {
      state.stim.active = false;
      state.stim.remaining = 0;
      state.stim.cooldownRemaining = SUPPLY_CATALOG.stim.cooldown;
      result.stimExpired = true;
    }
  }

  if (state.activeUse.type === 'medkit') {
    state.activeUse.elapsed += dt;
    if (state.activeUse.elapsed >= state.activeUse.duration) {
      const res = completeMedkitUse(state, playerHp);
      if (res.ok) {
        result.medkitCompleted = true;
        result.healAmount = res.healAmount;
        result.newHp = res.newHp;
      }
    }
  }

  return result;
}

export function getConsumableMobilityMultiplier(state) {
  if (!state || !state.stim || !state.stim.active) return 1.0;
  return SUPPLY_CATALOG.stim.mobilityMult;
}

export function resetConsumablesState(state) {
  if (!state) return;
  state.inventory.medkit = 0;
  state.inventory.stim = 0;
  state.activeUse.type = null;
  state.activeUse.elapsed = 0;
  state.activeUse.duration = 0;
  state.stim.active = false;
  state.stim.remaining = 0;
  state.stim.cooldownRemaining = 0;
}
