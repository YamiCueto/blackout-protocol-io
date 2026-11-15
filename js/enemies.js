import * as THREE from 'three';
import { scene } from './core.js';
import { solidMeshes } from './world.js';
import { spawnBurst, spawnDebris } from './effects.js';
import { sfxHit, sfxClick } from './audio.js';
import { ARCHETYPES, EnemyAIBrain } from './enemy-ai.js';

let globalNavProvider = null;
let globalPerceptionProvider = null;
const deathListeners = new Set();

export const enemies = [];

export function setAISystems(nav, perc) {
  globalNavProvider = nav;
  globalPerceptionProvider = perc;
}

export function addEnemyDeathListener(fn) {
  if (typeof fn === 'function') deathListeners.add(fn);
  return () => deathListeners.delete(fn);
}

export function setEnemyDeathListener(fn) {
  deathListeners.clear();
  if (typeof fn === 'function') deathListeners.add(fn);
}

const bodyMatE = new THREE.MeshStandardMaterial({ color: 0x3d4435, roughness: 0.8 });
const vestMatE = new THREE.MeshStandardMaterial({ color: 0x23261f, roughness: 0.9 });
const headMatE = new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.75 });
const visorMatE = new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 0.3, metalness: 0.4, emissive: 0xaa2211, emissiveIntensity: 0.6 });
const gunMatE = new THREE.MeshStandardMaterial({ color: 0x191b1e, roughness: 0.5, metalness: 0.7 });

const geoTorso = new THREE.BoxGeometry(0.62, 0.78, 0.34);
const geoVest = new THREE.BoxGeometry(0.68, 0.5, 0.4);
const geoHead = new THREE.BoxGeometry(0.3, 0.32, 0.3);
const geoHelmet = new THREE.BoxGeometry(0.36, 0.17, 0.36);
const geoVisor = new THREE.BoxGeometry(0.26, 0.07, 0.02);
const geoLeg = new THREE.BoxGeometry(0.22, 0.8, 0.24);
const geoArm = new THREE.BoxGeometry(0.16, 0.6, 0.2);
const geoGun = new THREE.BoxGeometry(0.07, 0.1, 0.65);
const geoHeavyPlate = new THREE.BoxGeometry(0.72, 0.55, 0.14);
const geoSniperBarrel = new THREE.BoxGeometry(0.05, 0.05, 0.4);

export const CORPSE_LIFETIME = 8;
const CORPSE_SINK_TIME = 1.2;

export function makeEnemy(x, z, archetypeKey = 'SHOOTER') {
  const g = new THREE.Group();
  const archDef = ARCHETYPES[archetypeKey] || ARCHETYPES.SHOOTER;

  const archBodyMat = bodyMatE.clone();
  archBodyMat.color.setHex(archDef.color || 0x3d4435);

  const archVisorMat = visorMatE.clone();
  archVisorMat.emissive.setHex(archDef.visorColor || 0xaa2211);

  const torso = new THREE.Mesh(geoTorso, archBodyMat); torso.position.y = 1.18;
  torso.userData.hitZone = 'TORSO';
  const vest = new THREE.Mesh(geoVest, vestMatE); vest.position.y = 1.25;
  vest.userData.hitZone = 'TORSO';
  const head = new THREE.Mesh(geoHead, headMatE); head.position.y = 1.78;
  head.userData.head = true;
  head.userData.hitZone = 'HEAD';
  const helmet = new THREE.Mesh(geoHelmet, vestMatE); helmet.position.y = 1.91;
  helmet.userData.head = true;
  helmet.userData.hitZone = 'HELMET';
  const visor = new THREE.Mesh(geoVisor, archVisorMat); visor.position.set(0, 1.8, -0.16);
  visor.userData.head = true;
  visor.userData.hitZone = 'HEAD';
  const legL = new THREE.Mesh(geoLeg, vestMatE); legL.position.set(-0.16, 0.4, 0);
  legL.userData.hitZone = 'LEG_L';
  const legR = legL.clone(); legR.position.x = 0.16;
  legR.userData.hitZone = 'LEG_R';
  const armL = new THREE.Mesh(geoArm, archBodyMat); armL.position.set(-0.42, 1.2, -0.1); armL.rotation.x = -0.6;
  armL.userData.hitZone = 'ARM_L';
  const armR = armL.clone(); armR.position.x = 0.42;
  armR.userData.hitZone = 'ARM_R';
  const gun = new THREE.Mesh(geoGun, gunMatE); gun.position.set(0.12, 1.25, -0.42);
  gun.userData.hitZone = 'ARM_R';

  const parts = [torso, vest, head, helmet, visor, legL, legR, armL, armR, gun];

  if (archDef.id === 'brute') {
    const heavyPlate = new THREE.Mesh(geoHeavyPlate, vestMatE);
    heavyPlate.position.set(0, 1.25, -0.18);
    heavyPlate.userData.hitZone = 'ARMOR_PLATE';
    parts.push(heavyPlate);
  } else if (archDef.id === 'elite') {
    const sniperExt = new THREE.Mesh(geoSniperBarrel, gunMatE);
    sniperExt.position.set(0.12, 1.25, -0.85);
    sniperExt.userData.hitZone = 'ARM_R';
    parts.push(sniperExt);
  }

  for (const m of parts) {
    m.castShadow = true;
    g.add(m);
  }

  if (archDef.scale && archDef.scale !== 1.0) {
    g.scale.setScalar(archDef.scale);
  }

  g.position.set(x, 0, z);

  const enemy = {
    group: g,
    alive: true,
    hp: archDef.hpBase,
    speed: archDef.speed,
    archetype: archDef,
    fireTimer: 1 + Math.random() * 2,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 1 + Math.random() * 2,
    legL,
    legR,
    walkPhase: Math.random() * 6,
    deathT: 0,
    corpseT: 0,
    brain: null,
    defusing: false,
    flinchRot: { x: 0, y: 0, z: 0 },
    flinchOffset: { x: 0, z: 0 },
    flinchTime: 0,
    torso,
    head,
    armL,
    armR
  };

  if (globalNavProvider && globalPerceptionProvider) {
    enemy.brain = new EnemyAIBrain(enemy, archDef, globalNavProvider, globalPerceptionProvider);
  }

  g.traverse(o => { o.userData.enemy = enemy; });
  scene.add(g);
  enemies.push(enemy);
  return enemy;
}

export function damageEnemy(e, dmg, point, headshot = false, impulse = null, hitZone = null) {
  if (!e.alive) return false;
  let effectiveDmg = dmg;
  if (e.archetype && e.archetype.id === 'brute') {
    if (hitZone === 'ARMOR_PLATE' || (!hitZone && !headshot)) {
      effectiveDmg = dmg * (e.archetype.resistanceMult || 0.70);
    }
  } else if (e.archetype && e.archetype.resistanceMult && (!hitZone || hitZone === 'ARMOR_PLATE')) {
    effectiveDmg = dmg * e.archetype.resistanceMult;
  }
  e.hp -= effectiveDmg;

  const isArmorHit = hitZone === 'ARMOR_PLATE';
  if (isArmorHit) {
    spawnBurst(point, 0xffd066, 8, 3.0, 0.08, 0.35, -3);
    sfxHit('armor');
  } else if (headshot || hitZone === 'HEAD' || hitZone === 'HELMET') {
    spawnBurst(point, 0xc22222, 14, 2.6, 0.09, 0.45, -5);
    sfxHit('head');
  } else {
    spawnBurst(point, 0xc22222, 9, 2.6, 0.09, 0.45, -5);
    sfxHit('normal');
  }

  if (e.flinchRot) {
    if (headshot || hitZone === 'HEAD' || hitZone === 'HELMET') {
      e.flinchRot.x = -0.32;
      e.flinchRot.y = (Math.random() - 0.5) * 0.25;
    } else if (hitZone === 'LEG_L' || hitZone === 'LEG_R') {
      e.flinchRot.x = -0.12;
      e.flinchOffset.z = -0.08;
    } else if (hitZone === 'ARM_L') {
      e.flinchRot.z = 0.2;
    } else if (hitZone === 'ARM_R') {
      e.flinchRot.z = -0.2;
    } else {
      e.flinchRot.x = -0.18;
    }
    e.flinchTime = 0.18;
  }

  if (e.brain && e.brain.state !== 'DEAD') {
    if (e.hp < 45 && e.brain.archetype.usesCover) {
      e.brain.setState('TAKE_COVER', true);
    } else if (e.brain.state === 'PATROL' || e.brain.state === 'SEARCH' || e.brain.state === 'INVESTIGATE') {
      e.brain.setState('ALERT', true);
    }
  }

  if (e.hp <= 0) {
    e.alive = false;
    e.defusing = false;
    e.deathT = 0;
    e.deathHeadshot = headshot;
    if (e.brain) {
      e.brain.setState('DEAD', true);
    }
    if (headshot) popHead(e, impulse);
    for (const listener of deathListeners) {
      try { listener(e, headshot); } catch {}
    }
    return true;
  }
  return false;
}

function popHead(e, impulse) {
  const parts = [];
  e.group.traverse(o => { if (o.isMesh && o.userData.head) parts.push(o); });
  if (!parts.length) return;
  const neckPos = new THREE.Vector3();
  parts[0].getWorldPosition(neckPos);
  for (const m of parts) {
    const v = new THREE.Vector3((Math.random() - .5) * 2.5, 3.2 + Math.random() * 2.2, (Math.random() - .5) * 2.5);
    if (impulse) v.addScaledVector(impulse, 3.5);
    const ang = new THREE.Vector3((Math.random() - .5) * 16, (Math.random() - .5) * 16, (Math.random() - .5) * 16);
    spawnDebris(m, v, ang, 2.6 + Math.random());
  }
  spawnBurst(neckPos, 0xb01414, 22, 3.8, 0.12, 0.7, -7);
  spawnBurst(neckPos, 0x7a0c0c, 10, 1.6, 0.16, 1.0, -5);
  sfxClick(170, 0.26, 0.09);
}

const raycaster = new THREE.Raycaster();

export function enemyLOS(e, targetPos) {
  const from = e.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const dir = targetPos.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  raycaster.set(from, dir);
  raycaster.far = dist;
  return raycaster.intersectObjects(solidMeshes(), false).length === 0;
}

function releaseEnemy(e) {
  scene.remove(e.group);
  e.group.traverse(o => { o.userData.enemy = null; });
  e.removed = true;
  if (e.brain) {
    e.brain.setState('DEAD', true);
  }
}

export function updateCorpses(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.alive) continue;
    e.corpseT += dt;
    if (e.corpseT >= CORPSE_LIFETIME) {
      releaseEnemy(e);
      enemies.splice(i, 1);
    } else if (e.deathT >= 1 && e.corpseT > CORPSE_LIFETIME - CORPSE_SINK_TIME) {
      const s = (e.corpseT - (CORPSE_LIFETIME - CORPSE_SINK_TIME)) / CORPSE_SINK_TIME;
      e.group.position.y = (e.deathHeadshot ? -0.15 : -0.1) - s * 0.5;
    }
  }
}

export function clearEnemies() {
  for (const e of enemies) releaseEnemy(e);
  enemies.length = 0;
}
