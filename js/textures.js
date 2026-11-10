/* Texturas procedurales generadas con canvas 2D. */
import * as THREE from 'three';
import { renderer } from './core.js';

export function makeCanvas(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  fn(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function noiseOver(ctx, s, n, alpha, bright) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.random() * bright);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export const texAsphalt = makeCanvas(512, (ctx, s) => {
  ctx.fillStyle = '#23242a'; ctx.fillRect(0, 0, s, s);
  noiseOver(ctx, s, 9000, 0.14, 90);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let x = Math.random() * s, y = Math.random() * s;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += (Math.random() - .5) * 90; y += (Math.random() - .5) * 90; ctx.lineTo(x, y); }
    ctx.stroke();
  }
});
texAsphalt.repeat.set(22, 22);

export const texConcrete = makeCanvas(512, (ctx, s) => {
  ctx.fillStyle = '#3c3a36'; ctx.fillRect(0, 0, s, s);
  noiseOver(ctx, s, 7000, 0.12, 120);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
  for (let y = 0; y < s; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let x = 0; x < s; x += 170) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  // manchas de humedad
  for (let i = 0; i < 10; i++) {
    const g = ctx.createRadialGradient(Math.random() * s, Math.random() * s, 4, Math.random() * s, Math.random() * s, 60);
    g.addColorStop(0, 'rgba(15,14,12,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
});

export const texMetal = makeCanvas(256, (ctx, s) => {
  ctx.fillStyle = '#4a4f55'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 60 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.25)`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 6, 1);
  }
  // óxido
  for (let i = 0; i < 18; i++) {
    const g = ctx.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 28);
    g.addColorStop(0, 'rgba(120,60,25,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
});

export const texCrate = makeCanvas(256, (ctx, s) => {
  ctx.fillStyle = '#6b5433'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * s;
    ctx.strokeStyle = `rgba(40,28,12,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y + (Math.random() - .5) * 14); ctx.stroke();
  }
  ctx.strokeStyle = '#2e2212'; ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, s - 10, s - 10);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
});

export const flashTex = makeCanvas(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.35, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

export const sparkTex = makeCanvas(32, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

export const decalTex = makeCanvas(48, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(10,10,10,0.95)'); g.addColorStop(0.5, 'rgba(20,20,20,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
