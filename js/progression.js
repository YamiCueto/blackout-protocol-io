const STORAGE_KEY = 'bp_progression_v1';
const SCHEMA_VERSION = 1;

export const XP_REWARDS = {
  KILL: 100,
  HEADSHOT_BONUS: 50,
  WAVE_COMPLETE: 250,
  SND_VICTORY: 750,
  WEAPON_KILL: 60,
  WEAPON_HEADSHOT_BONUS: 30
};

export const MAX_PLAYER_LEVEL = 50;
export const MAX_WEAPON_LEVEL = 20;

export const WEAPON_CATEGORIES = [
  { id: 'ASSAULT', name: 'FUSILES DE ASALTO' },
  { id: 'SMG', name: 'SUBFUSILES' },
  { id: 'SHOTGUN', name: 'ESCOPETAS' },
  { id: 'LMG', name: 'AMETRALLADORAS' },
  { id: 'SNIPER', name: 'PRECISIÓN' },
  { id: 'PISTOL', name: 'PISTOLAS' },
  { id: 'MELEE', name: 'CUERPO A CUERPO' }
];

export const WEAPON_CATALOG = [
  {
    id: 'mk7',
    name: 'MK-7 CARBINE',
    category: 'ASSAULT',
    desc: 'Plataforma táctica 5.56x45mm NATO. Balance óptimo entre cadencia y control de retroceso.',
    reqLevel: 1,
    implementation: 'IMPLEMENTED',
    maxLevel: 20
  },
  {
    id: 'ak12',
    name: 'AK-12 TACTICAL',
    category: 'ASSAULT',
    desc: 'Fusil de asalto 5.45x39mm con alta pegada balística y retroceso sostenido.',
    reqLevel: 14,
    implementation: 'PLANNED',
    maxLevel: 20
  },
  {
    id: 'vector9',
    name: 'VECTOR-9',
    category: 'SMG',
    desc: 'Subfusil compacto de alta cadencia 9x19mm para combate a quemarropa.',
    reqLevel: 4,
    implementation: 'IMPLEMENTED',
    maxLevel: 20
  },
  {
    id: 'mp5k',
    name: 'MP-5K',
    category: 'SMG',
    desc: 'Arma de defensa personal de 9mm con retroceso dócil y alta maniobrabilidad.',
    reqLevel: 20,
    implementation: 'PLANNED',
    maxLevel: 20
  },
  {
    id: 'm870',
    name: 'M870 BREACHER',
    category: 'SHOTGUN',
    desc: 'Escopeta táctica corredera calibre 12 para despeje de recintos cerrados.',
    reqLevel: 8,
    implementation: 'IMPLEMENTED',
    maxLevel: 20
  },
  {
    id: 'mk48',
    name: 'MK-48 HEAVY',
    category: 'LMG',
    desc: 'Ametralladora ligera 7.62x51mm de supresión con cinta de 100 cartuchos.',
    reqLevel: 24,
    implementation: 'PLANNED',
    maxLevel: 20
  },
  {
    id: 'awm338',
    name: 'AWM-338',
    category: 'SNIPER',
    desc: 'Fusil de cerrojo calibre .338 Lapua Magnum para eliminación a larga distancia.',
    reqLevel: 30,
    implementation: 'PLANNED',
    maxLevel: 20
  },
  {
    id: 'p12',
    name: 'P-12 TACTICAL',
    category: 'PISTOL',
    desc: 'Pistola semiautomática de servicio calibre .45 ACP de alta fiabilidad.',
    reqLevel: 2,
    implementation: 'PLANNED',
    maxLevel: 20
  },
  {
    id: 'knife',
    name: 'CUCHILLO TÁCTICO',
    category: 'MELEE',
    desc: 'Hoja fija de combate de acero endurecido para neutralización silenciosa.',
    reqLevel: 1,
    implementation: 'PLANNED',
    maxLevel: 20
  }
];

const PLAYER_CUMULATIVE_XP = [0];
for (let lvl = 1; lvl < MAX_PLAYER_LEVEL; lvl++) {
  const req = 500 + (lvl - 1) * 120;
  PLAYER_CUMULATIVE_XP[lvl] = PLAYER_CUMULATIVE_XP[lvl - 1] + req;
}

const WEAPON_CUMULATIVE_XP = [0];
for (let lvl = 1; lvl < MAX_WEAPON_LEVEL; lvl++) {
  const req = 250 + (lvl - 1) * 80;
  WEAPON_CUMULATIVE_XP[lvl] = WEAPON_CUMULATIVE_XP[lvl - 1] + req;
}

export function sanitizeNumber(v, fallback = 0) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Number.isNaN(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

export function getPlayerLevelInfo(rawXp) {
  const xp = sanitizeNumber(rawXp, 0);
  if (xp >= PLAYER_CUMULATIVE_XP[MAX_PLAYER_LEVEL - 1]) {
    return {
      level: MAX_PLAYER_LEVEL,
      currentXP: xp,
      levelXP: PLAYER_CUMULATIVE_XP[MAX_PLAYER_LEVEL - 1] - PLAYER_CUMULATIVE_XP[MAX_PLAYER_LEVEL - 2],
      nextLevelXP: 0,
      totalToNext: PLAYER_CUMULATIVE_XP[MAX_PLAYER_LEVEL - 1],
      progress: 1,
      isMax: true
    };
  }
  let level = 1;
  for (let i = 1; i < MAX_PLAYER_LEVEL; i++) {
    if (xp >= PLAYER_CUMULATIVE_XP[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const currentLevelFloor = PLAYER_CUMULATIVE_XP[level - 1];
  const nextLevelCeil = PLAYER_CUMULATIVE_XP[level];
  const reqForNext = nextLevelCeil - currentLevelFloor;
  const currentInLevel = xp - currentLevelFloor;
  const progress = reqForNext > 0 ? Math.min(1, Math.max(0, currentInLevel / reqForNext)) : 1;
  return {
    level,
    currentXP: xp,
    levelXP: currentInLevel,
    nextLevelXP: reqForNext,
    totalToNext: nextLevelCeil,
    progress,
    isMax: false
  };
}

export function getWeaponLevelInfo(rawXp) {
  const xp = sanitizeNumber(rawXp, 0);
  if (xp >= WEAPON_CUMULATIVE_XP[MAX_WEAPON_LEVEL - 1]) {
    return {
      level: MAX_WEAPON_LEVEL,
      currentXP: xp,
      levelXP: WEAPON_CUMULATIVE_XP[MAX_WEAPON_LEVEL - 1] - WEAPON_CUMULATIVE_XP[MAX_WEAPON_LEVEL - 2],
      nextLevelXP: 0,
      totalToNext: WEAPON_CUMULATIVE_XP[MAX_WEAPON_LEVEL - 1],
      progress: 1,
      isMax: true
    };
  }
  let level = 1;
  for (let i = 1; i < MAX_WEAPON_LEVEL; i++) {
    if (xp >= WEAPON_CUMULATIVE_XP[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const currentFloor = WEAPON_CUMULATIVE_XP[level - 1];
  const nextCeil = WEAPON_CUMULATIVE_XP[level];
  const reqForNext = nextCeil - currentFloor;
  const currentInLevel = xp - currentFloor;
  const progress = reqForNext > 0 ? Math.min(1, Math.max(0, currentInLevel / reqForNext)) : 1;
  return {
    level,
    currentXP: xp,
    levelXP: currentInLevel,
    nextLevelXP: reqForNext,
    totalToNext: nextCeil,
    progress,
    isMax: false
  };
}

export function getWeaponStatus(weapon, playerLevel) {
  if (!weapon || weapon.implementation !== 'IMPLEMENTED') {
    return 'PLANNED';
  }
  return playerLevel >= weapon.reqLevel ? 'UNLOCKED' : 'LOCKED';
}

export function isWeaponUnlocked(weaponId, playerLevel) {
  const w = WEAPON_CATALOG.find(x => x.id === weaponId);
  if (!w || w.implementation !== 'IMPLEMENTED') return false;
  return playerLevel >= w.reqLevel;
}

function createDefaultState() {
  return {
    version: SCHEMA_VERSION,
    player: {
      xp: 0
    },
    weapons: {
      mk7: { xp: 0 }
    },
    selectedWeapon: 'mk7',
    history: {
      kills: 0,
      headshots: 0,
      wavesCleared: 0,
      sndWins: 0
    },
    updatedAt: Date.now()
  };
}

function validateAndNormalizeState(raw) {
  if (!raw || typeof raw !== 'object') return createDefaultState();
  const state = createDefaultState();
  if (raw.player && typeof raw.player === 'object') {
    state.player.xp = sanitizeNumber(raw.player.xp, 0);
  }
  if (raw.weapons && typeof raw.weapons === 'object') {
    for (const w of WEAPON_CATALOG) {
      if (raw.weapons[w.id] && typeof raw.weapons[w.id] === 'object') {
        state.weapons[w.id] = { xp: sanitizeNumber(raw.weapons[w.id].xp, 0) };
      } else {
        state.weapons[w.id] = { xp: 0 };
      }
    }
  }
  const playerInfo = getPlayerLevelInfo(state.player.xp);
  if (typeof raw.selectedWeapon === 'string' && isWeaponUnlocked(raw.selectedWeapon, playerInfo.level)) {
    state.selectedWeapon = raw.selectedWeapon;
  } else {
    state.selectedWeapon = 'mk7';
  }
  if (raw.history && typeof raw.history === 'object') {
    state.history.kills = sanitizeNumber(raw.history.kills, 0);
    state.history.headshots = sanitizeNumber(raw.history.headshots, 0);
    state.history.wavesCleared = sanitizeNumber(raw.history.wavesCleared, 0);
    state.history.sndWins = sanitizeNumber(raw.history.sndWins, 0);
  }
  state.updatedAt = Date.now();
  return state;
}

export class ProgressionManager {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    if (!this.storage) return createDefaultState();
    try {
      const item = this.storage.getItem(STORAGE_KEY);
      if (!item) return createDefaultState();
      const parsed = JSON.parse(item);
      return validateAndNormalizeState(parsed);
    } catch {
      return createDefaultState();
    }
  }

  save() {
    if (!this.storage) return false;
    try {
      this.state.updatedAt = Date.now();
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    this.state = createDefaultState();
    this.save();
    this.notify({ type: 'reset', state: this.state });
    return this.state;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event) {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {}
    }
  }

  getState() {
    return this.state;
  }

  getPlayerInfo() {
    return getPlayerLevelInfo(this.state.player.xp);
  }

  getWeaponInfo(weaponId = 'mk7') {
    const wxp = this.state.weapons[weaponId]?.xp || 0;
    return getWeaponLevelInfo(wxp);
  }

  grantPlayerXP(amount) {
    const validAmount = sanitizeNumber(amount, 0);
    if (validAmount <= 0) return null;
    const before = this.getPlayerInfo();
    this.state.player.xp += validAmount;
    const after = this.getPlayerInfo();
    const leveledUp = after.level > before.level;
    const levelsGained = Math.max(0, after.level - before.level);
    this.save();
    const result = {
      xpGained: validAmount,
      before,
      after,
      leveledUp,
      levelsGained
    };
    this.notify({ type: 'player_xp', ...result });
    return result;
  }

  grantWeaponXP(weaponId, amount) {
    const validAmount = sanitizeNumber(amount, 0);
    if (validAmount <= 0) return null;
    if (!this.state.weapons[weaponId]) {
      this.state.weapons[weaponId] = { xp: 0 };
    }
    const before = this.getWeaponInfo(weaponId);
    this.state.weapons[weaponId].xp += validAmount;
    const after = this.getWeaponInfo(weaponId);
    const leveledUp = after.level > before.level;
    const levelsGained = Math.max(0, after.level - before.level);
    this.save();
    const result = {
      weaponId,
      xpGained: validAmount,
      before,
      after,
      leveledUp,
      levelsGained
    };
    this.notify({ type: 'weapon_xp', ...result });
    return result;
  }

  recordKill(weaponId = 'mk7', isHeadshot = false) {
    const playerGain = XP_REWARDS.KILL + (isHeadshot ? XP_REWARDS.HEADSHOT_BONUS : 0);
    const weaponGain = XP_REWARDS.WEAPON_KILL + (isHeadshot ? XP_REWARDS.WEAPON_HEADSHOT_BONUS : 0);
    this.state.history.kills++;
    if (isHeadshot) this.state.history.headshots++;
    const pResult = this.grantPlayerXP(playerGain);
    const wResult = this.grantWeaponXP(weaponId, weaponGain);
    const event = {
      type: 'kill',
      weaponId,
      isHeadshot,
      playerResult: pResult,
      weaponResult: wResult
    };
    this.notify(event);
    return event;
  }

  recordWaveCleared(waveNum) {
    this.state.history.wavesCleared++;
    const pResult = this.grantPlayerXP(XP_REWARDS.WAVE_COMPLETE);
    const event = {
      type: 'wave_cleared',
      waveNum,
      playerResult: pResult
    };
    this.notify(event);
    return event;
  }

  recordSndVictory() {
    this.state.history.sndWins++;
    const pResult = this.grantPlayerXP(XP_REWARDS.SND_VICTORY);
    const event = {
      type: 'snd_victory',
      playerResult: pResult
    };
    this.notify(event);
    return event;
  }

  selectWeapon(weaponId) {
    const pInfo = this.getPlayerInfo();
    if (!isWeaponUnlocked(weaponId, pInfo.level)) {
      return false;
    }
    this.state.selectedWeapon = weaponId;
    this.save();
    this.notify({ type: 'weapon_selected', weaponId });
    return true;
  }

  getCatalogWithStatus() {
    const pInfo = this.getPlayerInfo();
    return WEAPON_CATALOG.map(w => {
      const status = getWeaponStatus(w, pInfo.level);
      const weaponInfo = this.getWeaponInfo(w.id);
      return {
        ...w,
        status,
        isUnlocked: status === 'UNLOCKED',
        isSelected: this.state.selectedWeapon === w.id,
        levelInfo: weaponInfo
      };
    });
  }
}

export const progression = new ProgressionManager();
