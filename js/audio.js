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

function playShotSynth(cfg, opts = {}) {
  const sup = !!opts?.suppressed;
  const ac = audio();
  const t = ac.currentTime;
  const dur = sup ? cfg.dur * 0.78 : cfg.dur;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, cfg.power);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(sup ? cfg.lpStart * 0.28 : cfg.lpStart, t);
  lp.frequency.exponentialRampToValueAtTime(sup ? cfg.lpEnd * 0.65 : cfg.lpEnd, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(sup ? cfg.noiseGain * 0.42 : cfg.noiseGain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp).connect(g).connect(masterGain);
  src.start(t);
  const o = ac.createOscillator();
  o.type = 'triangle';
  const od = sup ? cfg.oscDur * 0.78 : cfg.oscDur;
  o.frequency.setValueAtTime(cfg.oscStart, t);
  o.frequency.exponentialRampToValueAtTime(cfg.oscEnd, t + od);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(sup ? cfg.oscGain * 0.55 : cfg.oscGain, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + od + 0.02);
  o.connect(g2).connect(masterGain);
  o.start(t);
  o.stop(t + od + 0.03);
}

export function sfxShot(opts = {}) {
  playShotSynth({ dur: 0.22, power: 2.2, lpStart: 5000, lpEnd: 300, noiseGain: 0.5, oscStart: 140, oscEnd: 45, oscDur: 0.1, oscGain: 0.5 }, opts);
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

export function sfxShotVector(opts = {}) {
  playShotSynth({ dur: 0.14, power: 2.8, lpStart: 6500, lpEnd: 600, noiseGain: 0.42, oscStart: 220, oscEnd: 80, oscDur: 0.08, oscGain: 0.38 }, opts);
}

export function sfxReloadVector() {
  sfxClick(1100, .14, .04);
  setTimeout(() => sfxClick(800, .15, .05), 180);
  setTimeout(() => sfxClick(1600, .18, .04), 480);
}

export function sfxShotShotgun(opts = {}) {
  playShotSynth({ dur: 0.35, power: 1.8, lpStart: 3200, lpEnd: 150, noiseGain: 0.75, oscStart: 95, oscEnd: 25, oscDur: 0.18, oscGain: 0.85 }, opts);
}

export function sfxPumpAction() {
  sfxClick(750, .18, .06);
  setTimeout(() => sfxClick(1250, .22, .05), 180);
}

export function sfxShellInsert() {
  sfxClick(820, .16, .05);
}

export function sfxShotPistol(opts = {}) {
  playShotSynth({ dur: 0.16, power: 2.4, lpStart: 4200, lpEnd: 400, noiseGain: 0.55, oscStart: 160, oscEnd: 50, oscDur: 0.09, oscGain: 0.45 }, opts);
}

export function sfxReloadPistol() {
  sfxClick(1050, .14, .04);
  setTimeout(() => sfxClick(750, .16, .05), 200);
  setTimeout(() => sfxClick(1500, .18, .04), 450);
}

export function sfxWeaponSwap() {
  const ac = audio(), t = ac.currentTime;
  const dur = 0.18;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.0);
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800;
  const g = ac.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(masterGain); src.start(t);
  setTimeout(() => sfxClick(1200, .12, .03), 80);
}
