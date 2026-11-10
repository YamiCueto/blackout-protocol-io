/* Sonido 100% procedural vía WebAudio, con bus maestro de volumen. */
import { settings } from './settings.js';

let AC = null, masterGain = null;

export function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = settings.volume / 100;
    masterGain.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

export function applyVolume() {
  if (masterGain) masterGain.gain.value = settings.volume / 100;
}

export function sfxShot() {
  const ac = audio(), t = ac.currentTime;
  const dur = 0.22;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(300, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp).connect(g).connect(masterGain); src.start(t);
  // golpe grave
  const o = ac.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g2).connect(masterGain); o.start(t); o.stop(t + 0.13);
}

export function sfxClick(freq = 2200, vol = 0.12, dur = 0.04) {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(masterGain); o.start(t); o.stop(t + dur);
}

export function sfxReload() {
  sfxClick(900, .15, .05);
  setTimeout(() => sfxClick(600, .15, .06), 220);
  setTimeout(() => sfxClick(1400, .18, .05), 650);
}

export function sfxHit() { sfxClick(3000, .14, .05); }

export function sfxHurt() {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  const g = ac.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(masterGain); o.start(t); o.stop(t + 0.3);
}

export function sfxExplosion() {
  const ac = audio(), t = ac.currentTime, dur = 1.4;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.7);
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(60, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp).connect(g).connect(masterGain); src.start(t);
  // onda sub grave
  const o = ac.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(24, t + 0.8);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(0.8, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  o.connect(g2).connect(masterGain); o.start(t); o.stop(t + 0.95);
}

export function sfxEnemyShot() {
  const ac = audio(), t = ac.currentTime, dur = 0.14;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900;
  const g = ac.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(masterGain); src.start(t);
}
