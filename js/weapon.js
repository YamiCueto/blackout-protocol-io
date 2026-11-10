/* Arma del jugador: modelo procedural, fogonazo y estado de munición. */
import * as THREE from 'three';
import { camera } from './core.js';
import { flashTex } from './textures.js';

export const GUN_HIP = new THREE.Vector3(0.28, -0.26, -0.55);
export const GUN_ADS = new THREE.Vector3(0, -0.168, -0.42);

export const weapon = {
  magSize: 30, ammo: 30, reserve: 120,
  fireRate: 0.105, cooldown: 0, reloading: false, reloadTime: 1.7, reloadT: 0,
  damage: 34, recoil: 0,
};

export const gunGroup = new THREE.Group();
camera.add(gunGroup);

{
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45, metalness: 0.75 });
  const dark2 = new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.6, metalness: 0.55 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.52), dark2); body.position.set(0, 0, -0.1);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.012, -0.52);
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 12), dark);
  muzzleBrake.rotation.x = Math.PI / 2; muzzleBrake.position.set(0, 0.012, -0.72);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), dark); mag.position.set(0, -0.14, -0.04); mag.rotation.x = 0.18;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), grip); handle.position.set(0, -0.12, 0.12); handle.rotation.x = -0.25;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), dark2); stock.position.set(0, -0.01, 0.3);
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), dark); sightF.position.set(0, 0.078, -0.32);
  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), dark); sightR.position.set(0, 0.073, 0.08);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.3), dark); rail.position.set(0, 0.065, -0.15);
  const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.2), grip); foreGrip.position.set(0, -0.045, -0.33);
  for (const m of [body, barrel, muzzleBrake, mag, handle, stock, sightF, sightR, rail, foreGrip]) {
    m.castShadow = true; gunGroup.add(m);
  }
  gunGroup.position.copy(GUN_HIP);
}

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
