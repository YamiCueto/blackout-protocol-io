/* Mundo: iluminación, geometría del escenario y colisiones. */
import * as THREE from 'three';
import { scene } from './core.js';
import { texAsphalt, texConcrete, texMetal, texCrate } from './textures.js';

export const ARENA = 58;          // semi-tamaño jugable
export const colliders = [];      // THREE.Box3 para colisión jugador/enemigo

function addCollider(mesh, pad = 0) {
  mesh.updateWorldMatrix(true, false);
  const b = new THREE.Box3().setFromObject(mesh);
  b.expandByScalar(pad);
  colliders.push(b);
}

/* ---------------- Iluminación ---------------- */
scene.add(new THREE.HemisphereLight(0x33415c, 0x0c0a08, 0.5));

export const moon = new THREE.DirectionalLight(0x8fa8d8, 0.55);
moon.position.set(-40, 60, -25);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -70; moon.shadow.camera.right = 70;
moon.shadow.camera.top = 70; moon.shadow.camera.bottom = -70;
moon.shadow.camera.far = 180;
moon.shadow.bias = -0.0004;
scene.add(moon);

// estrellas
{
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48;
    const r = 320;
    pts.push(r * Math.cos(e) * Math.cos(a), 30 + r * Math.sin(e), r * Math.cos(e) * Math.sin(a));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcdd8ef, size: 0.7, fog: false })));
}
// luna visible
{
  const m = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8edf7, fog: false }));
  m.position.set(-160, 190, -110);
  scene.add(m);
}

/* ---------------- Geometría ---------------- */
// suelo
{
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2 + 40, ARENA * 2 + 40),
    new THREE.MeshStandardMaterial({ map: texAsphalt, roughness: 0.94, metalness: 0.02 })
  );
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  scene.add(g);
}

// muros perimetrales
{
  const mat = new THREE.MeshStandardMaterial({ map: texConcrete, roughness: 0.9 });
  const h = 7, t = 1.5, L = ARENA * 2 + 3;
  const defs = [
    [0, -ARENA - 1, L, t], [0, ARENA + 1, L, t],
    [-ARENA - 1, 0, t, L], [ARENA + 1, 0, t, L],
  ];
  for (const [x, z, sx, sz] of defs) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    w.position.set(x, h / 2, z);
    w.castShadow = w.receiveShadow = true;
    scene.add(w); addCollider(w);
  }
}

// edificios / contenedores / cajas
const matBuilding = new THREE.MeshStandardMaterial({ map: texConcrete, roughness: 0.92 });
const matContainer1 = new THREE.MeshStandardMaterial({ map: texMetal, color: 0x7a3326, roughness: 0.6, metalness: 0.45 });
const matContainer2 = new THREE.MeshStandardMaterial({ map: texMetal, color: 0x2e4a66, roughness: 0.6, metalness: 0.45 });
const matCrate = new THREE.MeshStandardMaterial({ map: texCrate, roughness: 0.85 });

function box(w, h, d, mat, x, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, h / 2, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  scene.add(m); addCollider(m);
  return m;
}

box(16, 10, 12, matBuilding, -34, -30);
box(12, 14, 12, matBuilding, 32, -34);
box(18, 8, 10, matBuilding, 30, 32, 0.12);
box(10, 12, 16, matBuilding, -36, 28);
box(12, 6, 6, matContainer1, -8, -20, 0.3);
box(12, 6, 6, matContainer2, 12, 16, -0.7);
box(12, 6, 6, matContainer1, 18, -8, 1.2);
box(6, 6, 12, matContainer2, -18, 10, 0.1);
box(3, 3, 3, matCrate, -2, 6);
box(3, 3, 3, matCrate, 1, 6.6, 0.5);
box(3, 3, 3, matCrate, -0.5, 9.4, 0.2);
box(3, 3, 3, matCrate, 22, 20, 0.8);
box(3, 3, 3, matCrate, -24, -8, 0.4);
box(3, 3, 3, matCrate, 8, -32, 1.0);
box(3, 3, 3, matCrate, -14, 34, 0.1);

// barriles (sin colisión: pequeños)
{
  const barrelMat = new THREE.MeshStandardMaterial({ map: texMetal, color: 0x5a6b3a, roughness: 0.55, metalness: 0.5 });
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 1.5, 14);
  const spots = [[-5, -14], [14, 10], [20, -14], [-20, 16], [4, 28], [-28, -18], [26, 6]];
  for (const [x, z] of spots) {
    const b = new THREE.Mesh(geo, barrelMat);
    b.position.set(x + (Math.random() - .5), 0.75, z + (Math.random() - .5));
    b.castShadow = b.receiveShadow = true;
    scene.add(b);
  }
}

// farolas con luz
{
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.7, metalness: 0.6 });
  const lampSpots = [[-22, -22], [22, 22], [22, -24], [-24, 20], [0, 0]];
  for (const [x, z] of lampSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 7, 8), poleMat);
    pole.position.set(x, 3.5, z);
    pole.castShadow = true;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xffb86b, emissiveIntensity: 2.2 }));
    head.position.set(x, 7, z);
    scene.add(head);
    const pl = new THREE.PointLight(0xffb067, 55, 30, 1.9);
    pl.position.set(x, 6.6, z);
    scene.add(pl);
  }
}

/* marcar sólidos para raycast (muros/edificios/cajas) */
scene.traverse(o => {
  if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && o.parent === scene) {
    o.userData.solid = true;
    o.material.side = THREE.DoubleSide; // el raycast de LOS bloquea también desde el interior
  }
});

/* ---------------- Colisión ---------------- */
export function pushOutCircle(p, radius, yBottom, yTop) {
  for (const b of colliders) {
    if (yBottom > b.max.y || yTop < b.min.y) continue;
    const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + dx / d * radius;
        p.z = cz + dz / d * radius;
      } else {
        // dentro del AABB: empujar por el eje de menor penetración
        const px = Math.min(p.x - b.min.x, b.max.x - p.x);
        const pz = Math.min(p.z - b.min.z, b.max.z - p.z);
        if (px < pz) p.x = (p.x - b.min.x < b.max.x - p.x) ? b.min.x - radius : b.max.x + radius;
        else p.z = (p.z - b.min.z < b.max.z - p.z) ? b.min.z - radius : b.max.z + radius;
      }
    }
  }
  p.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.x));
  p.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.z));
}

export function pointBlocked(x, z, r) {
  for (const b of colliders) {
    if (b.max.y > 0.5 && x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r) return true;
  }
  return false;
}

export function solidMeshes() {
  return scene.children.filter(o => o.isMesh && o.userData.solid);
}
