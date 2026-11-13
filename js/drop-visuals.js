import * as THREE from 'three';
import { scene } from './core.js';

const matAmmoCrate = new THREE.MeshStandardMaterial({ color: 0x3d4435, roughness: 0.65, metalness: 0.35 });
const matAmmoTrim = new THREE.MeshStandardMaterial({ color: 0x1f231c, roughness: 0.55, metalness: 0.55 });
const matAmmoBrass = new THREE.MeshStandardMaterial({ color: 0xd99a26, roughness: 0.32, metalness: 0.88 });
const matAmmoBeacon = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.45, side: THREE.DoubleSide });

const matMedCase = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.45, metalness: 0.25 });
const matMedCross = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.85 });
const matMedHandle = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.6, metalness: 0.5 });
const matMedBeacon = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45, side: THREE.DoubleSide });

const matStimBody = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
const matStimFluid = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.95, transparent: true, opacity: 0.85 });
const matStimCap = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.9 });
const matStimBeacon = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.45, side: THREE.DoubleSide });

const geoAmmoBody = new THREE.BoxGeometry(0.48, 0.28, 0.32);
const geoAmmoLid = new THREE.BoxGeometry(0.50, 0.08, 0.34);
const geoAmmoLatch = new THREE.BoxGeometry(0.12, 0.16, 0.04);
const geoAmmoBullet = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8);

const geoMedBody = new THREE.BoxGeometry(0.42, 0.32, 0.22);
const geoMedHandle = new THREE.BoxGeometry(0.18, 0.06, 0.04);
const geoMedCrossH = new THREE.BoxGeometry(0.20, 0.06, 0.03);
const geoMedCrossV = new THREE.BoxGeometry(0.06, 0.20, 0.03);

const geoStimCylinder = new THREE.CylinderGeometry(0.06, 0.06, 0.32, 12);
const geoStimCore = new THREE.CylinderGeometry(0.045, 0.045, 0.20, 12);
const geoStimPlunger = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8);
const geoStimRing = new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12);

const geoFloorRing = new THREE.RingGeometry(0.32, 0.44, 24);

export const SHARED_DROP_GEOMETRIES = [
  geoAmmoBody, geoAmmoLid, geoAmmoLatch, geoAmmoBullet,
  geoMedBody, geoMedHandle, geoMedCrossH, geoMedCrossV,
  geoStimCylinder, geoStimCore, geoStimPlunger, geoStimRing,
  geoFloorRing
];

for (const g of SHARED_DROP_GEOMETRIES) {
  g.userData.shared = true;
}

const activeVisuals = new Map();

function createAmmoPackMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(geoAmmoBody, matAmmoCrate);
  body.position.y = 0.14;
  body.castShadow = true;
  g.add(body);

  const lid = new THREE.Mesh(geoAmmoLid, matAmmoTrim);
  lid.position.y = 0.30;
  lid.castShadow = true;
  g.add(lid);

  const latch = new THREE.Mesh(geoAmmoLatch, matAmmoTrim);
  latch.position.set(0, 0.20, 0.17);
  g.add(latch);

  const bullet1 = new THREE.Mesh(geoAmmoBullet, matAmmoBrass);
  bullet1.rotation.z = Math.PI / 2;
  bullet1.position.set(-0.06, 0.36, 0);
  g.add(bullet1);

  const bullet2 = new THREE.Mesh(geoAmmoBullet, matAmmoBrass);
  bullet2.rotation.z = Math.PI / 2;
  bullet2.position.set(0.06, 0.36, 0);
  g.add(bullet2);

  const beacon = new THREE.Mesh(geoFloorRing, matAmmoBeacon);
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = 0.02;
  g.add(beacon);

  return g;
}

function createMedkitMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(geoMedBody, matMedCase);
  body.position.y = 0.16;
  body.castShadow = true;
  g.add(body);

  const handle = new THREE.Mesh(geoMedHandle, matMedHandle);
  handle.position.set(0, 0.34, 0);
  g.add(handle);

  const crossH = new THREE.Mesh(geoMedCrossH, matMedCross);
  crossH.position.set(0, 0.16, 0.12);
  g.add(crossH);

  const crossV = new THREE.Mesh(geoMedCrossV, matMedCross);
  crossV.position.set(0, 0.16, 0.12);
  g.add(crossV);

  const beacon = new THREE.Mesh(geoFloorRing, matMedBeacon);
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = 0.02;
  g.add(beacon);

  return g;
}

function createStimMesh() {
  const g = new THREE.Group();

  const outer = new THREE.Mesh(geoStimCylinder, matStimBody);
  outer.position.y = 0.22;
  outer.castShadow = true;
  g.add(outer);

  const core = new THREE.Mesh(geoStimCore, matStimFluid);
  core.position.y = 0.22;
  g.add(core);

  const plunger = new THREE.Mesh(geoStimPlunger, matStimCap);
  plunger.position.y = 0.40;
  g.add(plunger);

  const ring = new THREE.Mesh(geoStimRing, matStimCap);
  ring.position.y = 0.34;
  g.add(ring);

  const beacon = new THREE.Mesh(geoFloorRing, matStimBeacon);
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = 0.02;
  g.add(beacon);

  return g;
}

export function buildDropMesh(supplyId) {
  if (supplyId === 'ammo_pack') return createAmmoPackMesh();
  if (supplyId === 'medkit') return createMedkitMesh();
  if (supplyId === 'stim') return createStimMesh();
  return createAmmoPackMesh();
}

export function syncDropVisuals(dropsList) {
  const currentIds = new Set();

  for (let i = 0; i < dropsList.length; i++) {
    const drop = dropsList[i];
    currentIds.add(drop.id);

    let visual = activeVisuals.get(drop.id);
    if (!visual) {
      visual = buildDropMesh(drop.supplyId);
      scene.add(visual);
      activeVisuals.set(drop.id, visual);
    }

    const hoverY = drop.y + Math.sin(drop.age * 2.8) * 0.06;
    visual.position.set(drop.x, hoverY, drop.z);
    visual.rotation.y = drop.age * 1.6;
  }

  for (const [id, visual] of activeVisuals.entries()) {
    if (!currentIds.has(id)) {
      scene.remove(visual);
      activeVisuals.delete(id);
    }
  }
}

export function clearDropVisuals() {
  for (const [, visual] of activeVisuals.entries()) {
    scene.remove(visual);
  }
  activeVisuals.clear();
}

export function getActiveDropVisualCount() {
  return activeVisuals.size;
}

export function areSharedDropGeometriesIntact() {
  return SHARED_DROP_GEOMETRIES.every(g => g && !g._disposed && g.userData?.shared);
}
