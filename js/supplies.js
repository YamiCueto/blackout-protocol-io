export const MAX_PLAYER_HP = 100;

export const INVENTORY_LIMITS = {
  medkit: 2,
  stim: 2
};

export const SUPPLY_CATALOG = {
  ammo_pack: {
    id: 'ammo_pack',
    kind: 'ammo',
    label: 'CAJA DE MUNICIÓN',
    shortLabel: 'MUNICIÓN',
    magFractionByCategory: {
      ASSAULT: 0.65,
      SMG: 0.75,
      SHOTGUN: 1.0,
      PISTOL: 1.0
    },
    defaultMagFraction: 0.75,
    ttl: 30,
    accentColor: 0xffa149
  },
  medkit: {
    id: 'medkit',
    kind: 'consumable',
    inventoryKey: 'medkit',
    label: 'BOTIQUÍN TÁCTICO',
    shortLabel: 'BOTIQUÍN',
    maxCarry: 2,
    healAmount: 50,
    useDuration: 1.8,
    ttl: 32,
    accentColor: 0x4ade80
  },
  stim: {
    id: 'stim',
    kind: 'consumable',
    inventoryKey: 'stim',
    label: 'ESTIMULANTE DE COMBATE',
    shortLabel: 'ESTIMULANTE',
    maxCarry: 2,
    instantHeal: 20,
    mobilityMult: 1.22,
    duration: 8.0,
    cooldown: 12.0,
    ttl: 30,
    accentColor: 0x38bdf8
  }
};

export const MODE_SUPPLY_RULES = {
  waves: {
    allowEnemyDrops: true,
    baseAmmoChance: 0.24,
    waveAmmoChanceBonus: 0.015,
    maxAmmoChance: 0.38,
    baseMedkitChance: 0.10,
    waveMedkitChanceBonus: 0.005,
    maxMedkitChance: 0.16,
    baseStimChance: 0.08,
    waveStimChanceBonus: 0.005,
    maxStimChance: 0.14,
    maxActiveDrops: 8,
    pityKillLimit: 3,
    emergencyMaxPerWave: 2,
    emergencyCooldown: 25.0
  },
  snd: {
    allowEnemyDrops: true,
    baseAmmoChance: 0.10,
    waveAmmoChanceBonus: 0,
    maxAmmoChance: 0.10,
    baseMedkitChance: 0,
    waveMedkitChanceBonus: 0,
    maxMedkitChance: 0,
    baseStimChance: 0,
    waveStimChanceBonus: 0,
    maxStimChance: 0,
    maxActiveDrops: 3,
    pityKillLimit: 0,
    emergencyMaxPerWave: 0,
    emergencyCooldown: 999.0
  }
};

export function getSupplyDef(supplyId) {
  return SUPPLY_CATALOG[supplyId] || null;
}

export function getModeSupplyRules(mode) {
  return MODE_SUPPLY_RULES[mode] || MODE_SUPPLY_RULES.waves;
}

export function calculateDropChances(mode, wave = 1) {
  const rules = getModeSupplyRules(mode);
  const w = Math.max(1, wave);
  const ammo = Math.min(rules.maxAmmoChance, rules.baseAmmoChance + (w - 1) * rules.waveAmmoChanceBonus);
  const medkit = Math.min(rules.maxMedkitChance, rules.baseMedkitChance + (w - 1) * rules.waveMedkitChanceBonus);
  const stim = Math.min(rules.maxStimChance, rules.baseStimChance + (w - 1) * rules.waveStimChanceBonus);
  return { ammo, medkit, stim };
}
