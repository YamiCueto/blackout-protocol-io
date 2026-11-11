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

export const GUN_HIP = new THREE.Vector3(0.28, -0.26, -0.55);
export const GUN_ADS = new THREE.Vector3(0, -0.168, -0.42);

const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45, metalness: 0.75 });
const dark2 = new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.6, metalness: 0.55 });
const grip = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, metalness: 0.1 });
const metal = new THREE.MeshStandardMaterial({ color: 0x3e4249, roughness: 0.4, metalness: 0.8 });
const matG = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.5, metalness: 0.75 });
const matM = new THREE.MeshStandardMaterial({ color: 0x424750, roughness: 0.45, metalness: 0.65 });
const matV = new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.8, metalness: 0.2 });

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
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), dark);
  mag.position.set(0, -0.14, -0.04);
  mag.rotation.x = 0.18;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), grip);
  handle.position.set(0, -0.12, 0.12);
  handle.rotation.x = -0.25;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), dark2);
  stock.position.set(0, -0.01, 0.3);
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), dark);
  sightF.position.set(0, 0.078, -0.32);
  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), dark);
  sightR.position.set(0, 0.073, 0.08);
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
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.34), dark);
  rail.position.set(0, 0.068, -0.08);
  const holoSight = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.042, 0.07), dark);
  holoSight.position.set(0, 0.096, -0.05);

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
    adsPos: new THREE.Vector3(0, -0.168, -0.42),
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
    adsPos: new THREE.Vector3(0, -0.170, -0.38),
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
    adsPos: new THREE.Vector3(0, -0.172, -0.45),
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
    adsPos: new THREE.Vector3(0, -0.155, -0.34),
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
  weapon.id = def.id;
  weapon.name = def.name;
  weapon.category = def.category;
  weapon.magSize = def.magSize;
  if (!options.preserveState) {
    weapon.ammo = def.magSize;
    weapon.reserve = def.reserveDefault;
    weapon.cooldown = 0;
    weapon.reloading = false;
    weapon.reloadT = 0;
    weapon.reloadStage = 'idle';
  }
  weapon.reserveDefault = def.reserveDefault;
  weapon.reserveSnd = def.reserveSnd;
  weapon.fireRate = def.fireRate;
  weapon.reloadTime = def.reloadTime;
  weapon.damage = def.damage;
  weapon.recoil = options.preserveState ? (weapon.recoil || 0) : 0;
  weapon.pellets = def.pellets;
  weapon.fireMode = def.fireMode;
  weapon.dropoff = def.dropoff;
  weapon.spreadHip = def.spreadHip;
  weapon.spreadAds = def.spreadAds;
  weapon.recoilSpreadHip = def.recoilSpreadHip;
  weapon.recoilSpreadAds = def.recoilSpreadAds;
  weapon.recoilKick = def.recoilKick;
  weapon.recoilMax = def.recoilMax;
  weapon.recoilRecovery = def.recoilRecovery;
  weapon.mobilityMultiplier = def.mobilityMultiplier;
  weapon.adsSpeed = def.adsSpeed;
  weapon.reloadType = def.reloadType;
  weapon.shellReload = def.shellReload;
  weapon.interruptReload = false;
  weapon.pumped = true;
  weapon.audio = def.audio;

  GUN_HIP.copy(def.hipPos);
  GUN_ADS.copy(def.adsPos);
  gunGroup.position.copy(GUN_HIP);

  muzzleFlash.position.copy(def.muzzlePos);
  flashSprite.position.set(def.muzzlePos.x, def.muzzlePos.y, def.muzzlePos.z - 0.02);

  if (!isSameMesh) {
    while (weaponMeshSubGroup.children.length > 0) {
      const child = weaponMeshSubGroup.children[0];
      weaponMeshSubGroup.remove(child);
      child.traverse(o => {
        if (o.isMesh && o.geometry) o.geometry.dispose();
      });
    }
    const mesh = def.buildMesh();
    weaponMeshSubGroup.add(mesh);
  }
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

export function buildLobbyWeaponMesh(id) {
  const grp = new THREE.Group();

  if (id === 'vector9') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.38), matG);
    body.castShadow = true;
    grp.add(body);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.08), matG);
    mag.position.set(0, -0.16, 0.06);
    mag.rotation.x = 0.15;
    mag.castShadow = true;
    grp.add(mag);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 10), matM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.28);
    barrel.castShadow = true;
    grp.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), matV);
    stock.position.set(0, 0.01, -0.26);
    stock.castShadow = true;
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
    grp.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.26), matV);
    stock.position.set(0, -0.01, -0.32);
    stock.castShadow = true;
    grp.add(stock);
  }
  return grp;
}

setWeapon('mk7');
