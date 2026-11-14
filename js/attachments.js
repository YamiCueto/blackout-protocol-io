import {
  registerAttachmentRules,
  ATTACHMENT_SLOT_KEYS,
  createEmptyAttachmentMap
} from './progression.js';

export { ATTACHMENT_SLOT_KEYS, createEmptyAttachmentMap };

export const ATTACHMENT_SLOTS = [
  { id: 'optic', label: 'ÓPTICA', shortLabel: 'ÓPTICA', order: 1 },
  { id: 'muzzle', label: 'BOCACHA', shortLabel: 'BOCACHA', order: 2 },
  { id: 'magazine', label: 'CARGADOR', shortLabel: 'CARGADOR', order: 3 },
  { id: 'underbarrel', label: 'EMPUÑADURA', shortLabel: 'EMPUÑAD.', order: 4 },
  { id: 'stock', label: 'CULATA', shortLabel: 'CULATA', order: 5 }
];

export const STAT_CONTRACTS = {
  spreadHipMult: {
    target: 'spreadHip',
    label: 'Dispersión cadera',
    unit: 'rad',
    quantity: 'spread',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  },
  spreadAdsMult: {
    target: 'spreadAds',
    label: 'Dispersión ADS',
    unit: 'rad',
    quantity: 'spread',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  },
  recoilKickMult: {
    target: 'recoilKick',
    label: 'Retroceso vertical',
    unit: 'pts',
    quantity: 'kick',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  },
  recoilMaxMult: {
    target: 'recoilMax',
    label: 'Techo retroceso',
    unit: 'pts',
    quantity: 'cap',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  },
  recoilRecoveryMult: {
    target: 'recoilRecovery',
    label: 'Recuperación retroceso',
    unit: 'pts/s',
    quantity: 'rate',
    direction: 'higher_is_better',
    combine: 'multiplicative'
  },
  reloadDurationMult: {
    target: 'reloadTime',
    label: 'Tiempo recarga',
    unit: 's',
    quantity: 'duration',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  },
  adsSpeedMult: {
    target: 'adsSpeed',
    label: 'Velocidad ADS',
    unit: '1/s',
    quantity: 'rate',
    direction: 'higher_is_better',
    combine: 'multiplicative'
  },
  mobilityMult: {
    target: 'mobilityMultiplier',
    label: 'Movilidad',
    unit: 'x',
    quantity: 'speed',
    direction: 'higher_is_better',
    combine: 'multiplicative'
  },
  rangeMult: {
    target: 'dropoff',
    label: 'Alcance efectivo',
    unit: 'm',
    quantity: 'distance',
    direction: 'higher_is_better',
    combine: 'multiplicative'
  },
  adsZoomOffset: {
    target: 'adsZoomOffset',
    label: 'Aumento óptico',
    unit: '°',
    quantity: 'fov_offset',
    direction: 'higher_is_better',
    combine: 'override_max'
  },
  muzzleFlashMult: {
    target: 'muzzleFlashMult',
    label: 'Fogonazo',
    unit: 'x',
    quantity: 'intensity',
    direction: 'lower_is_better',
    combine: 'multiplicative'
  }
};

const WEAPON_HAS_DROPOFF = {
  mk7: false,
  ak12: true,
  vector9: true,
  mp5k: true,
  m870: true,
  mk48: true,
  awm338: true,
  p12: true,
  knife: false
};

export const ATTACHMENT_CATALOG = [
  {
    id: 'optic_reddot',
    slot: 'optic',
    name: 'MIRA PUNTO ROJO',
    shortName: 'PUNTO ROJO',
    unlockWeaponLevel: 3,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12'],
    visualId: 'optic_reddot',
    description: 'Óptica refleja ligera con retícula iluminada que agiliza el encarado y mejora la precisión al apuntar.',
    modifiers: {
      adsSpeedMult: 1.06,
      spreadAdsMult: 0.85,
      adsZoomOffset: 26,
      spreadHipMult: 1.04
    }
  },
  {
    id: 'optic_holo',
    slot: 'optic',
    name: 'MIRA HOLOGRÁFICA',
    shortName: 'HOLOGRÁFICA',
    unlockWeaponLevel: 16,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338'],
    visualId: 'optic_holo',
    description: 'Carcasa blindada de amplio campo visual que maximiza la precisión ADS y modera la dispersión sostenida.',
    modifiers: {
      spreadAdsMult: 0.76,
      recoilMaxMult: 0.92,
      adsZoomOffset: 28,
      adsSpeedMult: 0.93
    }
  },
  {
    id: 'muzzle_compensator',
    slot: 'muzzle',
    name: 'COMPENSADOR TÁCTICO',
    shortName: 'COMPENSADOR',
    unlockWeaponLevel: 5,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12'],
    visualId: 'muzzle_compensator',
    description: 'Freno de boca ranurado que redirige gases hacia arriba para reducir el retroceso vertical en ráfagas.',
    modifiers: {
      recoilKickMult: 0.82,
      recoilMaxMult: 0.85,
      adsSpeedMult: 0.96,
      spreadHipMult: 1.05
    }
  },
  {
    id: 'muzzle_suppressor',
    slot: 'muzzle',
    name: 'SUPRESOR MONOLÍTICO',
    shortName: 'SUPRESOR',
    unlockWeaponLevel: 20,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12'],
    visualId: 'muzzle_suppressor',
    description: 'Supresor sellado de grado maestría: atenúa el disparo y fogonazo, estabiliza el cañón y extiende la distancia efectiva.',
    modifiers: {
      audioSuppressed: true,
      muzzleFlashMult: 0.22,
      recoilKickMult: 0.88,
      spreadAdsMult: 0.88,
      rangeMult: 1.15,
      adsSpeedMult: 0.91,
      mobilityMult: 0.97
    }
  },
  {
    id: 'magazine_extended',
    slot: 'magazine',
    name: 'CARGADOR AMPLIADO',
    shortName: 'AMPLIADO',
    unlockWeaponLevel: 10,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'p12'],
    visualId: 'magazine_extended',
    description: 'Aumenta la capacidad del cargador y la reserva proporcionalmente a costa de recarga y manejo algo más lentos.',
    modifiers: {
      magDeltaByWeapon: { mk7: 10, ak12: 10, vector9: 12, mp5k: 10, p12: 4 },
      reloadDurationMult: 1.15,
      mobilityMult: 0.97
    }
  },
  {
    id: 'magazine_fast',
    slot: 'magazine',
    name: 'CARGADOR RÁPIDO',
    shortName: 'RÁPIDO',
    unlockWeaponLevel: 16,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'p12'],
    visualId: 'magazine_fast',
    description: 'Pestaña de extracción rápida y pozo biselado para reducir drásticamente el tiempo de recarga.',
    modifiers: {
      reloadDurationMult: 0.74,
      adsSpeedMult: 1.04,
      spreadHipMult: 1.04
    }
  },
  {
    id: 'underbarrel_vertical',
    slot: 'underbarrel',
    name: 'EMPUÑADURA VERTICAL',
    shortName: 'VERTICAL',
    unlockWeaponLevel: 7,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'mk48'],
    visualId: 'underbarrel_vertical',
    description: 'Agarre vertical estriado que absorbe el levantamiento del cañón y acelera la recuperación del retroceso.',
    modifiers: {
      recoilKickMult: 0.83,
      recoilRecoveryMult: 1.12,
      adsSpeedMult: 0.95
    }
  },
  {
    id: 'underbarrel_angled',
    slot: 'underbarrel',
    name: 'EMPUÑADURA ANGULADA',
    shortName: 'ANGULADA',
    unlockWeaponLevel: 16,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k'],
    visualId: 'underbarrel_angled',
    description: 'Tope ergonómico inclinado que acelera el apuntado rápido y cierra la dispersión desde la cadera.',
    modifiers: {
      adsSpeedMult: 1.12,
      spreadHipMult: 0.86,
      recoilKickMult: 1.06
    }
  },
  {
    id: 'stock_light',
    slot: 'stock',
    name: 'CULATA LIGERA',
    shortName: 'LIGERA',
    unlockWeaponLevel: 13,
    compatibleWeapons: ['mk7', 'ak12', 'vector9', 'mp5k', 'm870'],
    visualId: 'stock_light',
    description: 'Armazón esquelético minimalista que mejora la velocidad de desplazamiento y transición ADS.',
    modifiers: {
      mobilityMult: 1.06,
      adsSpeedMult: 1.09,
      recoilKickMult: 1.10
    }
  },
  {
    id: 'stock_tactical',
    slot: 'stock',
    name: 'CULATA TÁCTICA',
    shortName: 'TÁCTICA',
    unlockWeaponLevel: 16,
    compatibleWeapons: ['mk7', 'ak12', 'm870', 'awm338'],
    visualId: 'stock_tactical',
    description: 'Culata pesada con apoyo de mejilla y cantonera amortiguada para máximo control y recuperación.',
    modifiers: {
      recoilKickMult: 0.85,
      recoilRecoveryMult: 1.14,
      spreadAdsMult: 0.88,
      mobilityMult: 0.96
    }
  }
];

const ATTACHMENT_BY_ID = new Map(ATTACHMENT_CATALOG.map(a => [a.id, a]));

export function getAttachmentById(attachmentId) {
  if (!attachmentId || typeof attachmentId !== 'string') return null;
  return ATTACHMENT_BY_ID.get(attachmentId) || null;
}

export function getSlotMeta(slotId) {
  return ATTACHMENT_SLOTS.find(s => s.id === slotId) || null;
}

export function getAttachmentsForWeapon(weaponId, slot = null) {
  return ATTACHMENT_CATALOG.filter(att => {
    if (!att.compatibleWeapons.includes(weaponId)) return false;
    if (slot && att.slot !== slot) return false;
    return true;
  });
}

export function isSlotCompatibleWithWeapon(weaponId, slot) {
  return ATTACHMENT_CATALOG.some(att => att.slot === slot && att.compatibleWeapons.includes(weaponId));
}

export function isAttachmentCompatible(weaponId, attachmentId, slot = null) {
  const att = getAttachmentById(attachmentId);
  if (!att) return false;
  if (slot && att.slot !== slot) return false;
  return att.compatibleWeapons.includes(weaponId);
}

export function isAttachmentUnlocked(attachmentOrId, weaponLevel = 1) {
  const att = typeof attachmentOrId === 'string' ? getAttachmentById(attachmentOrId) : attachmentOrId;
  if (!att) return false;
  const lvl = Number.isFinite(weaponLevel) ? weaponLevel : 1;
  return lvl >= att.unlockWeaponLevel;
}

export function canEquipAttachment(weaponId, slot, attachmentId, weaponLevel = 1) {
  if (!ATTACHMENT_SLOT_KEYS.includes(slot)) {
    return { ok: false, reason: 'invalid_slot' };
  }
  const att = getAttachmentById(attachmentId);
  if (!att) {
    return { ok: false, reason: 'unknown_attachment' };
  }
  if (att.slot !== slot) {
    return { ok: false, reason: 'slot_mismatch' };
  }
  if (!att.compatibleWeapons.includes(weaponId)) {
    return { ok: false, reason: 'incompatible_weapon' };
  }
  if (!isAttachmentUnlocked(att, weaponLevel)) {
    return { ok: false, reason: 'weapon_level_locked', requiredLevel: att.unlockWeaponLevel };
  }
  return { ok: true };
}

export function validateAttachment(weaponId, slot, attachmentId, weaponLevel = 1) {
  return canEquipAttachment(weaponId, slot, attachmentId, weaponLevel).ok;
}

export function cloneAttachments(attachmentMap) {
  const out = createEmptyAttachmentMap();
  if (!attachmentMap || typeof attachmentMap !== 'object') return out;
  for (const slot of ATTACHMENT_SLOT_KEYS) {
    const val = attachmentMap[slot];
    out[slot] = typeof val === 'string' && val ? val : null;
  }
  return out;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function roundTo(val, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function resolveWeaponStats(baseDef, attachmentMap = null) {
  const cleanMap = cloneAttachments(attachmentMap);
  const equipped = [];
  for (const slot of ATTACHMENT_SLOT_KEYS) {
    const attId = cleanMap[slot];
    if (!attId) continue;
    const att = getAttachmentById(attId);
    if (!att || att.slot !== slot || !att.compatibleWeapons.includes(baseDef.id)) continue;
    equipped.push(att);
  }

  let spreadHipMult = 1;
  let spreadAdsMult = 1;
  let recoilKickMult = 1;
  let recoilMaxMult = 1;
  let recoilRecoveryMult = 1;
  let reloadDurationMult = 1;
  let adsSpeedMult = 1;
  let mobilityMult = 1;
  let rangeMult = 1;
  let muzzleFlashMult = 1;
  let magDelta = 0;
  let adsZoomOffset = 25;
  let audioSuppressed = false;

  for (const att of equipped) {
    const m = att.modifiers || {};
    if (Number.isFinite(m.spreadHipMult)) spreadHipMult *= m.spreadHipMult;
    if (Number.isFinite(m.spreadAdsMult)) spreadAdsMult *= m.spreadAdsMult;
    if (Number.isFinite(m.recoilKickMult)) recoilKickMult *= m.recoilKickMult;
    if (Number.isFinite(m.recoilMaxMult)) recoilMaxMult *= m.recoilMaxMult;
    if (Number.isFinite(m.recoilRecoveryMult)) recoilRecoveryMult *= m.recoilRecoveryMult;
    if (Number.isFinite(m.reloadDurationMult)) reloadDurationMult *= m.reloadDurationMult;
    if (Number.isFinite(m.adsSpeedMult)) adsSpeedMult *= m.adsSpeedMult;
    if (Number.isFinite(m.mobilityMult)) mobilityMult *= m.mobilityMult;
    if (Number.isFinite(m.rangeMult)) rangeMult *= m.rangeMult;
    if (Number.isFinite(m.muzzleFlashMult)) muzzleFlashMult *= m.muzzleFlashMult;
    if (m.magDeltaByWeapon && Number.isFinite(m.magDeltaByWeapon[baseDef.id])) {
      magDelta += m.magDeltaByWeapon[baseDef.id];
    }
    if (Number.isFinite(m.adsZoomOffset)) {
      adsZoomOffset = Math.max(adsZoomOffset, m.adsZoomOffset);
    }
    if (m.audioSuppressed) audioSuppressed = true;
  }

  const baseMag = baseDef.magSize;
  const effMag = baseMag <= 0 ? 0 : Math.max(1, Math.round(baseMag + magDelta));
  const magRatio = baseMag > 0 ? (effMag / baseMag) : 1;
  const effReserveDefault = baseMag <= 0 ? 0 : (magDelta === 0
    ? baseDef.reserveDefault
    : Math.max(effMag, Math.round(baseDef.reserveDefault * magRatio)));
  const effReserveSnd = baseMag <= 0 ? 0 : (magDelta === 0
    ? baseDef.reserveSnd
    : Math.max(effMag, Math.round(baseDef.reserveSnd * magRatio)));

  let effDropoff = null;
  if (baseDef.dropoff && typeof baseDef.dropoff === 'object') {
    effDropoff = {
      optimal: roundTo(baseDef.dropoff.optimal * rangeMult, 2),
      max: roundTo(baseDef.dropoff.max * rangeMult, 2),
      minMult: baseDef.dropoff.minMult
    };
  }

  const effSpreadHip = roundTo(clamp(baseDef.spreadHip * spreadHipMult, 0.0005, 0.2), 5);
  const effSpreadAds = roundTo(clamp(baseDef.spreadAds * spreadAdsMult, 0.0002, 0.2), 5);
  const effRecoilKick = roundTo(clamp(baseDef.recoilKick * recoilKickMult, 0.15, 20), 4);
  const effRecoilMax = roundTo(clamp(baseDef.recoilMax * recoilMaxMult, 0.5, 30), 4);
  const effRecoilRecovery = roundTo(clamp(baseDef.recoilRecovery * recoilRecoveryMult, 1, 40), 4);
  const effReloadTime = roundTo(clamp(baseDef.reloadTime * reloadDurationMult, 0.35, 10), 4);
  const effAdsSpeed = roundTo(clamp(baseDef.adsSpeed * adsSpeedMult, 4, 30), 4);
  const effMobility = roundTo(clamp(baseDef.mobilityMultiplier * mobilityMult, 0.65, 1.35), 4);

  return {
    id: baseDef.id,
    name: baseDef.name,
    category: baseDef.category,
    damage: baseDef.damage,
    pellets: baseDef.pellets,
    fireRate: baseDef.fireRate,
    fireMode: baseDef.fireMode,
    magSize: effMag,
    reserveDefault: effReserveDefault,
    reserveSnd: effReserveSnd,
    reloadType: baseDef.reloadType,
    reloadTime: effReloadTime,
    shellReload: baseDef.shellReload ? { ...baseDef.shellReload } : null,
    dropoff: effDropoff,
    spreadHip: effSpreadHip,
    spreadAds: effSpreadAds,
    recoilSpreadHip: baseDef.recoilSpreadHip,
    recoilSpreadAds: baseDef.recoilSpreadAds,
    recoilKick: effRecoilKick,
    recoilMax: effRecoilMax,
    recoilRecovery: effRecoilRecovery,
    mobilityMultiplier: effMobility,
    adsSpeed: effAdsSpeed,
    adsZoomOffset: roundTo(clamp(adsZoomOffset, 15, 35), 2),
    muzzleFlashMult: roundTo(clamp(muzzleFlashMult, 0.1, 2.0), 3),
    audioSuppressed,
    equippedIds: equipped.map(a => a.id),
    attachments: cleanMap
  };
}

export function getArmoryRatings(stats) {
  const totalDmg = stats.damage * (stats.pellets || 1);
  const damageScore = Math.min(100, Math.round((totalDmg / 120) * 100));
  const rpm = 60 / stats.fireRate;
  const fireRateScore = Math.min(100, Math.round((rpm / 950) * 100));
  const adsSpreadPenalty = stats.spreadAds * 1700;
  const recoilPenalty = stats.recoilKick * 3.8;
  const accuracyScore = Math.round(clamp(100 - adsSpreadPenalty - recoilPenalty, 15, 98));
  const optRange = stats.dropoff ? stats.dropoff.max : 85;
  const rangeScore = Math.min(100, Math.round((optRange / 85) * 100));
  const mobilityScore = Math.round(clamp(((stats.mobilityMultiplier - 0.8) / 0.4) * 55 + (stats.adsSpeed / 22) * 35, 18, 99));
  return {
    damage: damageScore,
    fireRate: fireRateScore,
    accuracy: accuracyScore,
    range: rangeScore,
    mobility: mobilityScore
  };
}

export function getAttachmentProsCons(attachmentDef, weaponId = null) {
  if (!attachmentDef || !attachmentDef.modifiers) {
    return { pros: [], cons: [] };
  }
  const m = attachmentDef.modifiers;
  const pros = [];
  const cons = [];
  const pushPct = (mult, label, lowerIsBetter) => {
    if (!Number.isFinite(mult) || Math.abs(mult - 1) < 0.001) return;
    const pct = Math.round(Math.abs(mult - 1) * 100);
    const isGood = lowerIsBetter ? mult < 1 : mult > 1;
    const sign = mult > 1 ? '+' : '-';
    const text = `${sign}${pct}% ${label}`;
    if (isGood) pros.push(text);
    else cons.push(text);
  };

  if (m.magDeltaByWeapon) {
    const delta = weaponId && Number.isFinite(m.magDeltaByWeapon[weaponId])
      ? m.magDeltaByWeapon[weaponId]
      : null;
    if (delta !== null && delta > 0) {
      pros.push(`+${delta} balas por cargador`);
    } else if (!weaponId) {
      pros.push('+Capacidad de cargador');
    }
  }
  if (m.audioSuppressed) {
    pros.push('Sonido de disparo atenuado');
  }
  pushPct(m.muzzleFlashMult, 'fogonazo visible', true);
  pushPct(m.spreadAdsMult, 'dispersión al apuntar', true);
  pushPct(m.spreadHipMult, 'dispersión desde cadera', true);
  pushPct(m.recoilKickMult, 'retroceso vertical', true);
  pushPct(m.recoilMaxMult, 'retroceso máximo', true);
  pushPct(m.recoilRecoveryMult, 'recuperación retroceso', false);
  if (Number.isFinite(m.rangeMult) && (weaponId === null || WEAPON_HAS_DROPOFF[weaponId] !== false)) {
    pushPct(m.rangeMult, 'alcance efectivo', false);
  }
  pushPct(m.reloadDurationMult, 'tiempo de recarga', true);
  pushPct(m.adsSpeedMult, 'velocidad ADS', false);
  pushPct(m.mobilityMult, 'movilidad', false);
  if (Number.isFinite(m.adsZoomOffset) && m.adsZoomOffset > 25) {
    pros.push(`+${m.adsZoomOffset - 25}° aumento óptico`);
  }

  return { pros, cons };
}

export function compareWeaponStats(baseStats, targetStats) {
  const baseRatings = getArmoryRatings(baseStats);
  const targetRatings = getArmoryRatings(targetStats);
  const rows = [
    {
      key: 'magSize',
      label: 'CARGADOR',
      base: baseStats.magSize,
      target: targetStats.magSize,
      unit: '',
      higherIsBetter: true,
      format: v => `${v}`
    },
    {
      key: 'reloadTime',
      label: 'RECARGA',
      base: baseStats.reloadTime,
      target: targetStats.reloadTime,
      unit: 's',
      higherIsBetter: false,
      format: v => `${v.toFixed(2)}s`
    },
    {
      key: 'adsSpeed',
      label: 'VEL. ADS',
      base: baseStats.adsSpeed,
      target: targetStats.adsSpeed,
      unit: '',
      higherIsBetter: true,
      format: v => `${v.toFixed(1)}`
    },
    {
      key: 'spreadAds',
      label: 'DISP. ADS',
      base: baseStats.spreadAds,
      target: targetStats.spreadAds,
      unit: 'mrad',
      higherIsBetter: false,
      format: v => `${(v * 1000).toFixed(1)}`
    },
    {
      key: 'recoilKick',
      label: 'RETROCESO',
      base: baseStats.recoilKick,
      target: targetStats.recoilKick,
      unit: '',
      higherIsBetter: false,
      format: v => `${v.toFixed(2)}`
    },
    {
      key: 'mobilityMultiplier',
      label: 'MOVILIDAD',
      base: baseStats.mobilityMultiplier,
      target: targetStats.mobilityMultiplier,
      unit: '%',
      higherIsBetter: true,
      format: v => `${Math.round(v * 100)}%`
    }
  ];

  if (baseStats.dropoff || targetStats.dropoff) {
    rows.push({
      key: 'dropoffMax',
      label: 'ALCANCE MÁX.',
      base: baseStats.dropoff ? baseStats.dropoff.max : 0,
      target: targetStats.dropoff ? targetStats.dropoff.max : 0,
      unit: 'm',
      higherIsBetter: true,
      format: v => `${Math.round(v)}m`
    });
  }

  for (const r of rows) {
    const diff = r.target - r.base;
    r.changed = Math.abs(diff) > 0.0005;
    r.improved = r.changed && (r.higherIsBetter ? diff > 0 : diff < 0);
    r.degraded = r.changed && (r.higherIsBetter ? diff < 0 : diff > 0);
  }

  return {
    baseRatings,
    targetRatings,
    rows
  };
}

registerAttachmentRules({
  validateAttachment,
  canEquip: canEquipAttachment
});
