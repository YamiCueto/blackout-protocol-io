/* Efectos visuales: trazadoras, partículas y decals de impacto. */
import * as THREE from 'three';
import { scene } from './core.js';
import { sparkTex, decalTex } from './textures.js';

const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 });
const tracers = [];

export function spawnTracer(from, to) {
  const g = new THREE.BufferGeometry().setFromPoints([from, to]);
  const l = new THREE.Line(g, tracerMat.clone());
  l.userData.life = 0.07;
  scene.add(l); tracers.push(l);
}

const particles = [];

export function spawnBurst(pos, color, n, speed, size, life, gravity = -9) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.position.copy(pos);
    m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    m.userData = {
      vel: new THREE.Vector3((Math.random() - .5) * speed, Math.random() * speed * 0.9, (Math.random() - .5) * speed),
      life: life * (0.5 + Math.random() * 0.8), maxLife: life, g: gravity,
    };
    scene.add(m); particles.push(m);
  }
}

const decals = [];

export function spawnDecal(point, normal) {
  const d = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14),
    new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  d.position.copy(point).addScaledVector(normal, 0.012);
  d.lookAt(point.clone().add(normal));
  d.rotateZ(Math.random() * Math.PI * 2);
  scene.add(d); decals.push(d);
  if (decals.length > 60) { const old = decals.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
}

/* Escombros con física simple: trozos que salen despedidos (p. ej. la cabeza en un headshot). */
const debrisArr = [];

export function spawnDebris(mesh, vel, angVel, life = 3) {
  mesh.updateWorldMatrix(true, false);
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  mesh.getWorldPosition(wp);
  mesh.getWorldQuaternion(wq);
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.position.copy(wp);
  mesh.quaternion.copy(wq);
  scene.add(mesh);
  debrisArr.push({ mesh, vel, ang: angVel, life });
}

export function updateEffects(dt) {
  for (let i = debrisArr.length - 1; i >= 0; i--) {
    const d = debrisArr[i];
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.mesh); d.mesh.geometry.dispose(); debrisArr.splice(i, 1); continue; }
    d.vel.y -= 14 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.ang.x * dt;
    d.mesh.rotation.y += d.ang.y * dt;
    d.mesh.rotation.z += d.ang.z * dt;
    // rebote contra el suelo
    if (d.mesh.position.y < 0.12 && d.vel.y < 0) {
      d.mesh.position.y = 0.12;
      d.vel.y *= -0.35;
      d.vel.x *= 0.55; d.vel.z *= 0.55;
      d.ang.multiplyScalar(0.5);
      if (Math.abs(d.vel.y) < 0.6) d.vel.set(0, 0, 0);
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.userData.life -= dt;
    t.material.opacity = Math.max(0, t.userData.life / 0.07) * 0.9;
    if (t.userData.life <= 0) { scene.remove(t); t.geometry.dispose(); t.material.dispose(); tracers.splice(i, 1); }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const u = p.userData;
    u.life -= dt;
    if (u.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); continue; }
    u.vel.y += u.g * dt;
    p.position.addScaledVector(u.vel, dt);
    p.material.opacity = Math.max(0, u.life / u.maxLife);
  }
}

export function resetEffects() {
  for (const t of tracers) { scene.remove(t); t.geometry.dispose(); t.material.dispose(); }
  tracers.length = 0;
  for (const p of particles) { scene.remove(p); p.material.dispose(); }
  particles.length = 0;
  for (const d of debrisArr) { scene.remove(d.mesh); d.mesh.geometry.dispose(); }
  debrisArr.length = 0;
}
