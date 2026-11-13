import * as THREE from 'three';
import { camera } from './core.js';
import { flashTex } from './textures.js';
import {
  sfxShot,
  sfxReload,
  sfxShotVector,
  sfxReloadVector,
  sfxShotShotgun,
  sfxPumpAction,
  sfxShellInsert,
  sfxShotPistol,
  sfxReloadPistol,
  sfxWeaponSwap
} from './audio.js';
import { resolveWeaponStats, cloneAttachments } from './attachments.js';
import { applyAttachmentsToModel, disposeNonSharedGeometries } from './attachment-visuals.js';

export const GUN_HIP = new THREE.Vector3(0.28, -0.26, -0.55);
export const GUN_ADS = new THREE.Vector3(0, -0.085, -0.42);

const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45, metalness: 0.75 });
const dark2 = new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.6, metalness: 0.55 });
const grip = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, metalness: 0.1 });
const metal = new THREE.MeshStandardMaterial({ color: 0x3e4249, roughness: 0.4, metalness: 0.8 });
const matG = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.5, metalness: 0.75 });
const matM = new THREE.MeshStandardMaterial({ color: 0x424750, roughness: 0.45, metalness: 0.65 });
const matV = new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.8, metalness: 0.2 });
const metalBright = new THREE.MeshStandardMaterial({ color: 0x67707d, roughness: 0.32, metalness: 0.88 });
const protoBody = new THREE.MeshStandardMaterial({ color: 0x1e3a52, roughness: 0.35, metalness: 0.45, emissive: 0x0d3b5c, emissiveIntensity: 0.55, transparent: true, opacity: 0.86 });
const protoAccent = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.28, metalness: 0.55, emissive: 0x0ea5e9, emissiveIntensity: 0.75 });
const protoWire = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.28 });

function buildMk7Mesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.52), dark2);
  body.position.set(0, 0, -0.1);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.52);
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 12), dark);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.012, -0.72);
  muzzleBrake.userData.partRole = 'muzzle_default';
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), dark);
  mag.position.set(0, -0.14, -0.04);
  mag.rotation.x = 0.18;
  mag.userData.partRole = 'magazine_default';
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), grip);
  handle.position.set(0, -0.12, 0.12);
  handle.rotation.x = -0.25;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), dark2);
  stock.position.set(0, -0.01, 0.3);
  stock.userData.partRole = 'stock_default';
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), dark);
  sightF.position.set(0, 0.078, -0.32);
  sightF.userData.partRole = 'sight_front';
  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), dark);
  sightR.position.set(0, 0.073, 0.08);
  sightR.userData.partRole = 'optic_default';
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.3), dark);
  rail.position.set(0, 0.065, -0.15);
  const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.2), grip);
  foreGrip.position.set(0, -0.045, -0.33);

  for (const m of [body, barrel, muzzleBrake, mag, handle, stock, sightF, sightR, rail, foreGrip]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildVectorMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.15, 0.38), dark2);
  body.position.set(0, -0.02, -0.08);
  const magWell = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.18, 0.09), dark);
  magWell.position.set(0, -0.12, -0.18);
  magWell.rotation.x = -0.12;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.25, 0.065), dark);
  mag.position.set(0, -0.22, -0.16);
  mag.rotation.x = -0.12;
  mag.userData.partRole = 'magazine_default';
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.36);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.072, 0.16), dark);
  shroud.position.set(0, 0.015, -0.25);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.15, 0.068), grip);
  handle.position.set(0, -0.12, 0.07);
  handle.rotation.x = -0.28;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.075, 0.21), dark2);
  stock.position.set(0, 0.01, 0.2);
  stock.userData.partRole = 'stock_default';
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.34), dark);
  rail.position.set(0, 0.068, -0.08);
  const holoSight = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.042, 0.07), dark);
  holoSight.position.set(0, 0.096, -0.05);
  holoSight.userData.partRole = 'optic_default';

  for (const m of [body, magWell, mag, barrel, shroud, handle, stock, rail, holoSight]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildM870Mesh() {
  const g = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.125, 0.44), dark2);
  receiver.position.set(0, 0, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.60, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.038, -0.50);
  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.54, 12), dark);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, -0.008, -0.47);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.062, 0.03), dark);
  clamp.position.set(0, 0.015, -0.72);
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), grip);
  pump.rotation.x = Math.PI / 2;
  pump.position.set(0, -0.008, -0.42);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.072), grip);
  handle.position.set(0, -0.12, 0.16);
  handle.rotation.x = -0.3;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.115, 0.29), dark2);
  stock.position.set(0, -0.02, 0.36);
  stock.userData.partRole = 'stock_default';
  const bead = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.012), dark);
  bead.position.set(0, 0.068, -0.76);
  const ejector = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, 0.12), dark);
  ejector.position.set(0.026, 0.02, -0.04);

  for (const m of [receiver, barrel, magTube, clamp, pump, handle, stock, bead, ejector]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildP12Mesh() {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.065, 0.28), dark2);
  slide.position.set(0, 0.015, -0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 10), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.16);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.05, 0.22), dark);
  frame.position.set(0, -0.025, -0.03);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.065), grip);
  handle.position.set(0, -0.10, 0.04);
  handle.rotation.x = -0.28;
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.07), dark);
  triggerGuard.position.set(0, -0.065, -0.035);
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.01), dark);
  sightF.position.set(0, 0.055, -0.17);
  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.02, 0.012), dark);
  sightR.position.set(0, 0.055, 0.07);
  sightR.userData.partRole = 'optic_default';

  for (const m of [slide, barrel, frame, handle, triggerGuard, sightF, sightR]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export const WEAPONS = {
  mk7: {
    id: 'mk7',
    name: 'MK-7 CARBINE',
    category: 'ASSAULT',
    damage: 34,
    pellets: 1,
    fireRate: 0.105,
    fireMode: 'auto',
    magSize: 30,
    reserveDefault: 120,
    reserveSnd: 150,
    reloadType: 'magazine',
    reloadTime: 1.7,
    shellReload: null,
    dropoff: null,
    spreadHip: 0.011,
    spreadAds: 0.0022,
    recoilSpreadHip: 0.0035,
    recoilSpreadAds: 0.0012,
    recoilKick: 1.0,
    recoilMax: 6.0,
    recoilRecovery: 9.0,
    mobilityMultiplier: 1.0,
    adsSpeed: 12.0,
    hipPos: new THREE.Vector3(0.28, -0.26, -0.55),
    adsPos: new THREE.Vector3(0, -0.085, -0.42),
    muzzlePos: new THREE.Vector3(0, 0.012, -0.78),
    audio: {
      shot: sfxShot,
      reload: sfxReload
    },
    buildMesh: buildMk7Mesh
  },
  vector9: {
    id: 'vector9',
    name: 'VECTOR-9',
    category: 'SMG',
    damage: 22,
    pellets: 1,
    fireRate: 0.065,
    fireMode: 'auto',
    magSize: 33,
    reserveDefault: 165,
    reserveSnd: 198,
    reloadType: 'magazine',
    reloadTime: 1.35,
    shellReload: null,
    dropoff: { optimal: 16, max: 40, minMult: 0.48 },
    spreadHip: 0.016,
    spreadAds: 0.0035,
    recoilSpreadHip: 0.0040,
    recoilSpreadAds: 0.0015,
    recoilKick: 0.75,
    recoilMax: 5.2,
    recoilRecovery: 12.0,
    mobilityMultiplier: 1.08,
    adsSpeed: 16.0,
    hipPos: new THREE.Vector3(0.26, -0.25, -0.50),
    adsPos: new THREE.Vector3(0, -0.096, -0.38),
    muzzlePos: new THREE.Vector3(0, 0.018, -0.50),
    audio: {
      shot: sfxShotVector,
      reload: sfxReloadVector
    },
    buildMesh: buildVectorMesh
  },
  m870: {
    id: 'm870',
    name: 'M870 BREACHER',
    category: 'SHOTGUN',
    damage: 15,
    pellets: 8,
    fireRate: 0.80,
    fireMode: 'pump',
    magSize: 6,
    reserveDefault: 36,
    reserveSnd: 42,
    reloadType: 'shell',
    reloadTime: 0.45,
    shellReload: { start: 0.35, shell: 0.48, end: 0.35 },
    dropoff: { optimal: 8, max: 24, minMult: 0.25 },
    spreadHip: 0.048,
    spreadAds: 0.028,
    recoilSpreadHip: 0.0020,
    recoilSpreadAds: 0.0010,
    recoilKick: 4.5,
    recoilMax: 9.0,
    recoilRecovery: 7.0,
    mobilityMultiplier: 0.94,
    adsSpeed: 9.0,
    hipPos: new THREE.Vector3(0.28, -0.26, -0.56),
    adsPos: new THREE.Vector3(0, -0.072, -0.45),
    muzzlePos: new THREE.Vector3(0, 0.038, -0.80),
    audio: {
      shot: sfxShotShotgun,
      pump: sfxPumpAction,
      shell: sfxShellInsert,
      reload: sfxPumpAction
    },
    buildMesh: buildM870Mesh
  },
  p12: {
    id: 'p12',
    name: 'P-12 TACTICAL',
    category: 'PISTOL',
    slot: 'secondary',
    damage: 38,
    pellets: 1,
    fireRate: 0.18,
    fireMode: 'semi',
    magSize: 12,
    reserveDefault: 48,
    reserveSnd: 60,
    reloadType: 'magazine',
    reloadTime: 1.20,
    shellReload: null,
    dropoff: { optimal: 12, max: 32, minMult: 0.45 },
    spreadHip: 0.014,
    spreadAds: 0.0028,
    recoilSpreadHip: 0.0038,
    recoilSpreadAds: 0.0014,
    recoilKick: 1.4,
    recoilMax: 4.8,
    recoilRecovery: 11.0,
    mobilityMultiplier: 1.12,
    adsSpeed: 18.0,
    hipPos: new THREE.Vector3(0.24, -0.24, -0.44),
    adsPos: new THREE.Vector3(0, -0.058, -0.34),
    muzzlePos: new THREE.Vector3(0, 0.015, -0.42),
    audio: {
      shot: sfxShotPistol,
      reload: sfxReloadPistol
    },
    buildMesh: buildP12Mesh
  }
};

export const gunGroup = new THREE.Group();
camera.add(gunGroup);

const weaponMeshSubGroup = new THREE.Group();
gunGroup.add(weaponMeshSubGroup);

export const muzzleFlash = new THREE.PointLight(0xffa843, 0, 7, 2);
muzzleFlash.position.set(0, 0.012, -0.78);
gunGroup.add(muzzleFlash);

export const flashSprite = new THREE.Mesh(
  new THREE.PlaneGeometry(0.16, 0.16),
  new THREE.MeshBasicMaterial({
    map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
);
flashSprite.position.set(0, 0.012, -0.8);
flashSprite.visible = false;
gunGroup.add(flashSprite);

export const weapon = {
  id: 'mk7',
  name: 'MK-7 CARBINE',
  category: 'ASSAULT',
  magSize: 30,
  ammo: 30,
  reserve: 120,
  reserveDefault: 120,
  reserveSnd: 150,
  fireRate: 0.105,
  cooldown: 0,
  reloading: false,
  reloadTime: 1.7,
  reloadT: 0,
  damage: 34,
  recoil: 0,
  pellets: 1,
  fireMode: 'auto',
  dropoff: null,
  spreadHip: 0.011,
  spreadAds: 0.0022,
  recoilSpreadHip: 0.0035,
  recoilSpreadAds: 0.0012,
  recoilKick: 1.0,
  recoilMax: 6.0,
  recoilRecovery: 9.0,
  mobilityMultiplier: 1.0,
  adsSpeed: 12.0,
  adsZoomOffset: 25,
  muzzleFlashMult: 1.0,
  audioSuppressed: false,
  attachments: cloneAttachments(null),
  reloadType: 'magazine',
  shellReload: null,
  reloadStage: 'idle',
  interruptReload: false,
  pumped: true,
  audio: {
    shot: sfxShot,
    reload: sfxReload
  }
};

export function setWeapon(id, options = {}) {
  const def = WEAPONS[id] || WEAPONS.mk7;
  const isSameMesh = weapon.id === def.id && weaponMeshSubGroup.children.length > 0;
  const resolved = options.effectiveStats ? options.effectiveStats : resolveWeaponStats(def, options.attachments);
  const cleanAtt = cloneAttachments(options.attachments || resolved.attachments);

  weapon.id = def.id;
  weapon.name = def.name;
  weapon.category = def.category;
  weapon.magSize = resolved.magSize;
  if (!options.preserveState) {
    weapon.ammo = resolved.magSize;
    weapon.reserve = options.isSnd ? resolved.reserveSnd : resolved.reserveDefault;
    weapon.cooldown = 0;
    weapon.reloading = false;
    weapon.reloadT = 0;
    weapon.reloadStage = 'idle';
  }
  weapon.reserveDefault = resolved.reserveDefault;
  weapon.reserveSnd = resolved.reserveSnd;
  weapon.fireRate = resolved.fireRate;
  weapon.reloadTime = resolved.reloadTime;
  weapon.damage = resolved.damage;
  weapon.recoil = options.preserveState ? (weapon.recoil || 0) : 0;
  weapon.pellets = resolved.pellets;
  weapon.fireMode = resolved.fireMode;
  weapon.dropoff = resolved.dropoff ? { ...resolved.dropoff } : null;
  weapon.spreadHip = resolved.spreadHip;
  weapon.spreadAds = resolved.spreadAds;
  weapon.recoilSpreadHip = resolved.recoilSpreadHip;
  weapon.recoilSpreadAds = resolved.recoilSpreadAds;
  weapon.recoilKick = resolved.recoilKick;
  weapon.recoilMax = resolved.recoilMax;
  weapon.recoilRecovery = resolved.recoilRecovery;
  weapon.mobilityMultiplier = resolved.mobilityMultiplier;
  weapon.adsSpeed = resolved.adsSpeed;
  weapon.adsZoomOffset = resolved.adsZoomOffset;
  weapon.muzzleFlashMult = resolved.muzzleFlashMult;
  weapon.audioSuppressed = resolved.audioSuppressed;
  weapon.attachments = cleanAtt;
  weapon.reloadType = resolved.reloadType;
  weapon.shellReload = resolved.shellReload ? { ...resolved.shellReload } : null;
  weapon.interruptReload = false;
  weapon.pumped = true;
  weapon.audio = def.audio;

  let mesh = isSameMesh ? weaponMeshSubGroup.children[0] : null;
  if (!isSameMesh) {
    while (weaponMeshSubGroup.children.length > 0) {
      const child = weaponMeshSubGroup.children[0];
      weaponMeshSubGroup.remove(child);
      disposeHierarchyGeometries(child);
    }
    mesh = def.buildMesh();
    weaponMeshSubGroup.add(mesh);
  }
  const vis = applyAttachmentsToModel(mesh, def.id, cleanAtt);

  GUN_HIP.copy(def.hipPos);
  GUN_ADS.copy(def.adsPos);
  if (vis && Number.isFinite(vis.adsYOffset)) {
    GUN_ADS.y += vis.adsYOffset;
  }
  gunGroup.position.copy(GUN_HIP);

  if (vis && vis.muzzlePosOverride) {
    muzzleFlash.position.set(vis.muzzlePosOverride[0], vis.muzzlePosOverride[1], vis.muzzlePosOverride[2]);
  } else {
    muzzleFlash.position.copy(def.muzzlePos);
  }
  flashSprite.position.set(muzzleFlash.position.x, muzzleFlash.position.y, muzzleFlash.position.z - 0.02);

  return weapon;
}

export function getDamageWithDropoff(wpn, dist, isHeadshot) {
  const d = wpn.dropoff;
  let mult = 1.0;
  if (d && dist > d.optimal) {
    if (dist >= d.max) {
      mult = d.minMult;
    } else {
      const t = (dist - d.optimal) / (d.max - d.optimal);
      mult = 1.0 - t * (1.0 - d.minMult);
    }
  }
  const headMult = (wpn.id === 'm870' || wpn.id === 'p12') ? 1.5 : 2.2;
  const base = wpn.damage * mult;
  return isHeadshot ? base * headMult : base;
}

export function buildLobbyWeaponMesh(id, attachments = null) {
  const grp = new THREE.Group();

  if (id === 'vector9') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.38), matG);
    body.castShadow = true;
    grp.add(body);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.08), matG);
    mag.position.set(0, -0.16, 0.06);
    mag.rotation.x = 0.15;
    mag.castShadow = true;
    mag.userData.partRole = 'magazine_default';
    grp.add(mag);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 10), matM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.28);
    barrel.castShadow = true;
    grp.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), matV);
    stock.position.set(0, 0.01, -0.26);
    stock.castShadow = true;
    stock.userData.partRole = 'stock_default';
    grp.add(stock);
  } else if (id === 'm870') {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.44), matG);
    rec.castShadow = true;
    grp.add(rec);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 10), matM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.48);
    barrel.castShadow = true;
    grp.add(barrel);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 10), matM);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.01, 0.44);
    tube.castShadow = true;
    grp.add(tube);
    const slide = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), matV);
    slide.rotation.x = Math.PI / 2;
    slide.position.set(0, -0.01, 0.38);
    slide.castShadow = true;
    grp.add(slide);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.28), matV);
    stock.position.set(0, -0.02, -0.32);
    stock.castShadow = true;
    stock.userData.partRole = 'stock_default';
    grp.add(stock);
  } else if (id === 'p12') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.065, 0.28), matM);
    slide.position.set(0, 0.02, 0.05);
    slide.castShadow = true;
    grp.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 8), matM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.16);
    barrel.castShadow = true;
    grp.add(barrel);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.065), matV);
    handle.position.set(0, -0.07, -0.03);
    handle.rotation.x = -0.25;
    handle.castShadow = true;
    grp.add(handle);
  } else {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.52), matG);
    rec.castShadow = true;
    grp.add(rec);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.44, 10), matM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.46);
    barrel.castShadow = true;
    grp.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.12), matG);
    mag.position.set(0, -0.14, 0.06);
    mag.rotation.x = -0.22;
    mag.castShadow = true;
    mag.userData.partRole = 'magazine_default';
    grp.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.26), matV);
    stock.position.set(0, -0.01, -0.32);
    stock.castShadow = true;
    stock.userData.partRole = 'stock_default';
    grp.add(stock);
  }

  if (attachments && WEAPONS[id] && Object.values(attachments).some(Boolean)) {
    const attGrp = new THREE.Group();
    attGrp.rotation.y = Math.PI;
    attGrp.position.set(0, 0, 0.02);
    applyAttachmentsToModel(attGrp, id, attachments, { roleRoot: grp });
    grp.add(attGrp);
  }

  return grp;
}

const PROTO_SPECS = {
  ak12: [
    ['box', [0.072, 0.105, 0.44], [0, 0, -0.05]],
    ['box', [0.062, 0.032, 0.36], [0, 0.065, -0.03]],
    ['box', [0.026, 0.014, 0.32], [0, 0.086, -0.04], null, true],
    ['box', [0.066, 0.092, 0.27], [0, 0, -0.39]],
    ['cyl', [0.016, 0.016, 0.26, 10], [0, 0.054, -0.39], [Math.PI / 2, 0, 0]],
    ['cyl', [0.018, 0.02, 0.46, 12], [0, 0.014, -0.62], [Math.PI / 2, 0, 0]],
    ['box', [0.024, 0.068, 0.034], [0, 0.048, -0.64], null, true],
    ['cyl', [0.028, 0.026, 0.085, 10], [0, 0.014, -0.87], [Math.PI / 2, 0, 0], true],
    ['box', [0.048, 0.16, 0.092], [0, -0.11, -0.17], [0.22, 0, 0]],
    ['box', [0.046, 0.15, 0.086], [0, -0.23, -0.12], [0.54, 0, 0], true],
    ['box', [0.046, 0.145, 0.065], [0, -0.11, 0.11], [-0.28, 0, 0]],
    ['box', [0.036, 0.026, 0.26], [0, 0.03, 0.30]],
    ['box', [0.034, 0.022, 0.25], [0, -0.025, 0.30], [0.16, 0, 0]],
    ['box', [0.046, 0.115, 0.04], [0, -0.01, 0.44], null, true]
  ],
  mp5k: [
    ['cyl', [0.034, 0.034, 0.32, 12], [0, 0.025, -0.06], [Math.PI / 2, 0, 0]],
    ['box', [0.058, 0.072, 0.26], [0, -0.022, -0.02]],
    ['cyl', [0.018, 0.018, 0.16, 10], [0, 0.062, -0.16], [Math.PI / 2, 0, 0]],
    ['cyl', [0.018, 0.02, 0.12, 10], [0, 0.024, -0.26], [Math.PI / 2, 0, 0], true],
    ['cyl', [0.02, 0.02, 0.03, 10], [0, 0.078, -0.21], [Math.PI / 2, 0, 0], true],
    ['cyl', [0.02, 0.02, 0.034, 10], [0, 0.076, 0.05], [Math.PI / 2, 0, 0], true],
    ['box', [0.042, 0.115, 0.052], [0, -0.078, -0.20], [0.12, 0, 0], true],
    ['box', [0.04, 0.145, 0.068], [0, -0.10, -0.11], [-0.14, 0, 0]],
    ['box', [0.038, 0.125, 0.064], [0, -0.21, -0.08], [-0.36, 0, 0], true],
    ['box', [0.045, 0.135, 0.062], [0, -0.105, 0.07], [-0.26, 0, 0]],
    ['box', [0.056, 0.095, 0.045], [0, 0.005, 0.13]],
    ['box', [0.03, 0.032, 0.08], [0, 0.02, 0.18], null, true]
  ],
  mk48: [
    ['box', [0.098, 0.135, 0.44], [0, 0.005, -0.02]],
    ['box', [0.088, 0.042, 0.34], [0, 0.088, -0.02]],
    ['box', [0.036, 0.018, 0.28], [0, 0.116, -0.02], null, true],
    ['box', [0.092, 0.102, 0.32], [0, 0.008, -0.38]],
    ['cyl', [0.022, 0.025, 0.44, 12], [0, 0.02, -0.66], [Math.PI / 2, 0, 0]],
    ['cyl', [0.032, 0.024, 0.09, 10], [0, 0.02, -0.90], [Math.PI / 2, 0, 0], true],
    ['box', [0.145, 0.165, 0.165], [0.015, -0.13, -0.09]],
    ['box', [0.045, 0.055, 0.12], [0.072, -0.015, -0.09], [0, 0, -0.35], true],
    ['cyl', [0.012, 0.012, 0.24, 8], [-0.052, -0.045, -0.44], [Math.PI / 2, 0, 0], true],
    ['cyl', [0.012, 0.012, 0.24, 8], [0.052, -0.045, -0.44], [Math.PI / 2, 0, 0], true],
    ['box', [0.024, 0.052, 0.14], [0.04, 0.095, -0.32], [0, 0, -0.35]],
    ['box', [0.02, 0.055, 0.024], [0, 0.068, -0.74], null, true],
    ['box', [0.05, 0.15, 0.072], [0, -0.115, 0.13], [-0.28, 0, 0]],
    ['box', [0.07, 0.135, 0.27], [0, -0.015, 0.34]]
  ],
  awm338: [
    ['box', [0.064, 0.098, 0.56], [0, 0, -0.02]],
    ['cyl', [0.019, 0.023, 0.70, 12], [0, 0.024, -0.60], [Math.PI / 2, 0, 0]],
    ['box', [0.064, 0.044, 0.115], [0, 0.024, -0.97], null, true],
    ['box', [0.042, 0.055, 0.032], [0, 0.072, -0.12]],
    ['box', [0.042, 0.055, 0.032], [0, 0.072, 0.04]],
    ['cyl', [0.022, 0.022, 0.32, 12], [0, 0.106, -0.04], [Math.PI / 2, 0, 0], true],
    ['cyl', [0.036, 0.024, 0.12, 12], [0, 0.106, -0.22], [Math.PI / 2, 0, 0], true],
    ['cyl', [0.024, 0.030, 0.09, 12], [0, 0.106, 0.14], [Math.PI / 2, 0, 0]],
    ['box', [0.046, 0.095, 0.115], [0, -0.088, -0.09]],
    ['cyl', [0.012, 0.012, 0.065, 8], [0.045, 0.02, 0.05], [0, 0, Math.PI / 2], true],
    ['box', [0.058, 0.052, 0.30], [0, 0.02, 0.38]],
    ['box', [0.048, 0.036, 0.27], [0, -0.068, 0.36], [-0.14, 0, 0]],
    ['box', [0.046, 0.12, 0.065], [0, -0.055, 0.22], [-0.32, 0, 0]],
    ['box', [0.054, 0.028, 0.14], [0, 0.06, 0.41], null, true],
    ['box', [0.06, 0.135, 0.036], [0, -0.015, 0.53], null, true],
    ['cyl', [0.011, 0.011, 0.22, 8], [-0.07, -0.09, -0.46], [0.22, 0, -0.35], true],
    ['cyl', [0.011, 0.011, 0.22, 8], [0.07, -0.09, -0.46], [0.22, 0, 0.35], true]
  ],
  knife: [
    ['box', [0.011, 0.044, 0.20], [0, 0.008, -0.09]],
    ['box', [0.009, 0.032, 0.075], [0, 0.002, -0.21], [0.24, 0, 0]],
    ['box', [0.013, 0.01, 0.17], [0, -0.015, -0.09], null, true],
    ['box', [0.026, 0.088, 0.022], [0, 0.004, 0.02], null, true],
    ['box', [0.028, 0.04, 0.135], [0, 0.002, 0.10]],
    ['cyl', [0.018, 0.022, 0.03, 10], [0, 0.002, 0.18], [Math.PI / 2, 0, 0], true]
  ]
};

function buildProtoFromSpec(parts) {
  const grp = new THREE.Group();
  for (const [kind, dims, pos, rot = null, accent = false] of parts) {
    const geo = kind === 'cyl'
      ? new THREE.CylinderGeometry(...dims)
      : new THREE.BoxGeometry(...dims);
    const mesh = new THREE.Mesh(geo, accent ? protoAccent : protoBody);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    grp.add(mesh);
    const wire = new THREE.Mesh(geo, protoWire);
    wire.position.copy(mesh.position);
    wire.rotation.copy(mesh.rotation);
    grp.add(wire);
  }
  return grp;
}

export function disposeHierarchyGeometries(root) {
  return disposeNonSharedGeometries(root);
}

export function buildShowcaseWeaponMesh(id, options = {}) {
  const wrapper = new THREE.Group();
  let model;
  if (WEAPONS[id]) {
    model = WEAPONS[id].buildMesh();
  } else if (PROTO_SPECS[id]) {
    model = buildProtoFromSpec(PROTO_SPECS[id]);
  } else {
    model = buildProtoFromSpec(PROTO_SPECS.ak12);
  }
  model.rotation.y = -Math.PI / 2;
  if (options.implementation === 'PLANNED' && !WEAPONS[id] && !PROTO_SPECS[id]) {
    model.traverse(o => {
      if (o.isMesh) o.material = protoBody;
    });
  }
  if (WEAPONS[id]) {
    model.traverse(o => {
      if (o.isMesh && o.material === metal) o.material = metalBright;
    });
    if (options.attachments) {
      applyAttachmentsToModel(model, id, options.attachments);
    }
  }
  wrapper.userData.showcaseModel = model;
  wrapper.add(model);
  return wrapper;
}

setWeapon('mk7');
