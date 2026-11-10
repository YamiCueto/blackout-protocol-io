/* Enemigos: modelo, daño y línea de visión. La IA de movimiento vive en main.js. */
import * as THREE from 'three';
import { scene } from './core.js';
import { solidMeshes } from './world.js';
import { spawnBurst, spawnDebris } from './effects.js';
import { sfxHit, sfxClick } from './audio.js';

export const enemies = [];

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

export const CORPSE_LIFETIME = 8;
const CORPSE_SINK_TIME = 1.2;

export function makeEnemy(x, z) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(geoTorso, bodyMatE); torso.position.y = 1.18;
  const vest = new THREE.Mesh(geoVest, vestMatE); vest.position.y = 1.25;
  const head = new THREE.Mesh(geoHead, headMatE); head.position.y = 1.78;
  head.userData.head = true;
  const helmet = new THREE.Mesh(geoHelmet, vestMatE); helmet.position.y = 1.91;
  helmet.userData.head = true;
  const visor = new THREE.Mesh(geoVisor, visorMatE); visor.position.set(0, 1.8, -0.16);
  visor.userData.head = true;
  const legL = new THREE.Mesh(geoLeg, vestMatE); legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.16;
  const armL = new THREE.Mesh(geoArm, bodyMatE); armL.position.set(-0.42, 1.2, -0.1); armL.rotation.x = -0.6;
  const armR = armL.clone(); armR.position.x = 0.42;
  const gun = new THREE.Mesh(geoGun, gunMatE); gun.position.set(0.12, 1.25, -0.42);
  for (const m of [torso, vest, head, helmet, visor, legL, legR, armL, armR, gun]) {
    m.castShadow = true; g.add(m);
  }
  g.position.set(x, 0, z);
  const enemy = {
    group: g, alive: true, hp: 100,
    speed: 2.4 + Math.random() * 1.2,
    fireTimer: 1 + Math.random() * 2,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 1 + Math.random() * 2,
    legL, legR, walkPhase: Math.random() * 6,
    deathT: 0, corpseT: 0,
  };
  g.traverse(o => { o.userData.enemy = enemy; });
  scene.add(g);
  enemies.push(enemy);
  return enemy;
}

/* Devuelve true si el impacto lo mata. `impulse` es la dirección de la bala. */
export function damageEnemy(e, dmg, point, headshot = false, impulse = null) {
  if (!e.alive) return false;
  e.hp -= dmg;
  spawnBurst(point, 0xc22222, headshot ? 14 : 9, 2.6, 0.09, 0.45, -5);
  sfxHit();
  if (e.hp <= 0) {
    e.alive = false; e.deathT = 0;
    e.deathHeadshot = headshot;
    if (headshot) popHead(e, impulse);
    return true;
  }
  return false;
}

/* Headshot letal: la cabeza, el casco y el visor salen despedidos con física. */
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
  // erupción de sangre en el cuello
  spawnBurst(neckPos, 0xb01414, 22, 3.8, 0.12, 0.7, -7);
  spawnBurst(neckPos, 0x7a0c0c, 10, 1.6, 0.16, 1.0, -5);
  sfxClick(170, 0.26, 0.09); // golpe sordo
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
