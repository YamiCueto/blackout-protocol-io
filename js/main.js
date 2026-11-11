/* Orquestador: jugador, entrada, disparo, oleadas, HUD, estados y bucle. */
import * as THREE from 'three';
import { $, renderer, scene, camera } from './core.js';
import { settings, SETTINGS_DEFAULTS, saveSettings } from './settings.js';
import { audio, applyVolume, sfxShot, sfxClick, sfxReload, sfxHurt, sfxEnemyShot, sfxExplosion } from './audio.js';
import { ARENA, moon, pushOutCircle, pointBlocked, solidMeshes } from './world.js';
import { spawnTracer, spawnBurst, spawnDecal, updateEffects, resetEffects } from './effects.js';
import { weapon, gunGroup, muzzleFlash, flashSprite, GUN_HIP, GUN_ADS } from './weapon.js';
import { enemies, makeEnemy, damageEnemy, enemyLOS, clearEnemies, updateCorpses } from './enemies.js';
import { createDiagnostics } from './diagnostics.js';
import { lobbyScene, lobbyCamera, updateLobby, setLobbyView, setOperatorCamo } from './lobby.js';
import { progression, WEAPON_CATEGORIES } from './progression.js';

/* ---------------- Ajustes: aplicación y UI ---------------- */
function applySettings() {
  renderer.toneMappingExposure = 1.15 * settings.brightness / 100;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  moon.castShadow = settings.shadows !== 'off';
  const size = settings.shadows === 'high' ? 2048 : 1024;
  if (moon.shadow.mapSize.x !== size) {
    moon.shadow.mapSize.set(size, size);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
  }
  applyVolume();
}

function refreshSettingsUI() {
  $('set-brightness').value = settings.brightness;
  $('val-brightness').textContent = settings.brightness + '%';
  $('set-fov').value = settings.fov;
  $('val-fov').textContent = settings.fov + '°';
  $('set-shadows').value = settings.shadows;
  $('set-volume').value = settings.volume;
  $('val-volume').textContent = settings.volume + '%';
}

$('set-brightness').oninput = e => {
  settings.brightness = +e.target.value;
  $('val-brightness').textContent = settings.brightness + '%';
  applySettings(); saveSettings();
};
$('set-fov').oninput = e => {
  settings.fov = +e.target.value;
  $('val-fov').textContent = settings.fov + '°';
  applySettings(); saveSettings();
};
$('set-shadows').onchange = e => {
  settings.shadows = e.target.value;
  applySettings(); saveSettings();
};
$('set-volume').oninput = e => {
  settings.volume = +e.target.value;
  applySettings(); saveSettings();
  sfxClick(1200, 0.12, 0.04);
};

let activeArmoryCat = 'ASSAULT';
let activeInspectedWeaponId = 'mk7';

function updatePlayerHeaderUI() {
  const pInfo = progression.getPlayerInfo();
  const lvlEl = $('player-level-badge');
  const fillEl = $('player-xp-fill');
  const txtEl = $('player-xp-text');
  if (lvlEl) lvlEl.textContent = 'NVL ' + pInfo.level;
  if (fillEl) fillEl.style.width = Math.round(pInfo.progress * 100) + '%';
  if (txtEl) {
    txtEl.textContent = pInfo.isMax ? 'MÁXIMO' : `${pInfo.levelXP} / ${pInfo.nextLevelXP} XP`;
  }
}

function initArmoryUI() {
  const catNav = $('armory-cat-nav');
  if (!catNav) return;
  catNav.innerHTML = '';
  WEAPON_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'armory-cat-btn' + (cat.id === activeArmoryCat ? ' active' : '');
    btn.dataset.cat = cat.id;
    btn.textContent = cat.name;
    btn.onclick = () => {
      activeArmoryCat = cat.id;
      document.querySelectorAll('.armory-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === activeArmoryCat);
      });
      renderArmoryWeapons();
    };
    catNav.appendChild(btn);
  });
  renderArmoryWeapons();
}

function renderArmoryWeapons() {
  const strip = $('armory-weapon-strip');
  if (!strip) return;
  strip.innerHTML = '';
  const catalog = progression.getCatalogWithStatus();
  const filtered = catalog.filter(w => w.category === activeArmoryCat);
  if (!filtered.some(w => w.id === activeInspectedWeaponId)) {
    if (filtered.length > 0) activeInspectedWeaponId = filtered[0].id;
  }
  filtered.forEach(w => {
    const card = document.createElement('div');
    card.className = 'weapon-card' + (w.id === activeInspectedWeaponId ? ' selected' : '');
    card.dataset.id = w.id;

    let statusClass = 'status-planned';
    let statusLabel = 'PRÓXIMO';
    if (w.isSelected) {
      statusClass = 'status-equipped';
      statusLabel = 'EQUIPADA';
    } else if (w.status === 'UNLOCKED') {
      statusClass = 'status-unlocked';
      statusLabel = 'DESBLOQ';
    } else if (w.status === 'LOCKED') {
      statusClass = 'status-locked';
      statusLabel = 'NVL ' + w.reqLevel;
    }

    card.innerHTML = `
      <div class="wc-name">${w.name}</div>
      <div class="wc-badge-row">
        <span class="wc-lvl">NVL ${w.levelInfo.level}</span>
        <span class="wc-status ${statusClass}">${statusLabel}</span>
      </div>
    `;
    card.onclick = () => {
      activeInspectedWeaponId = w.id;
      document.querySelectorAll('.weapon-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.id === activeInspectedWeaponId);
      });
      renderInspectedWeapon();
    };
    strip.appendChild(card);
  });
  renderInspectedWeapon();
}

function renderInspectedWeapon() {
  const catalog = progression.getCatalogWithStatus();
  const w = catalog.find(x => x.id === activeInspectedWeaponId) || catalog[0];
  if (!w) return;

  const nameEl = $('loadout-weapon-name');
  const typeEl = $('loadout-weapon-type');
  const lvlEl = $('loadout-weapon-level');
  const xpFill = $('loadout-weapon-xp-fill');
  const xpTxt = $('loadout-weapon-xp-text');
  const descEl = $('loadout-weapon-desc');
  const btnEquip = $('btn-equip-weapon');
  const statusTag = $('loadout-status-tag');

  if (nameEl) nameEl.textContent = w.name;
  if (typeEl) {
    const cat = WEAPON_CATEGORIES.find(c => c.id === w.category);
    typeEl.textContent = (cat ? cat.name : w.category) + (w.stats ? ' • 5.56 NATO' : ' • CLASIFICADO');
  }
  if (lvlEl) lvlEl.textContent = `NVL ${w.levelInfo.level}/${w.maxLevel}`;
  if (xpFill) xpFill.style.width = Math.round(w.levelInfo.progress * 100) + '%';
  if (xpTxt) {
    xpTxt.textContent = w.levelInfo.isMax ? 'MÁXIMO' : `${w.levelInfo.levelXP} / ${w.levelInfo.nextLevelXP} XP`;
  }
  if (descEl) descEl.textContent = w.desc;

  if (w.stats) {
    $('bar-dmg').style.width = Math.round(w.stats.damage / 50 * 100) + '%';
    $('val-dmg').textContent = w.stats.damage;
    $('bar-rpm').style.width = Math.round(w.stats.rpm / 800 * 100) + '%';
    $('val-rpm').textContent = w.stats.rpm + ' RPM';
    $('bar-ads').style.width = w.stats.ads + '%';
    $('val-ads').textContent = w.stats.ads + '%';
    $('bar-mob').style.width = w.stats.mobility + '%';
    $('val-mob').textContent = w.stats.mobility + '%';
    $('bar-mag').style.width = Math.round(w.stats.mag / 50 * 100) + '%';
    $('val-mag').textContent = w.stats.mag + ' / 120';
  } else {
    $('bar-dmg').style.width = '0%'; $('val-dmg').textContent = '--';
    $('bar-rpm').style.width = '0%'; $('val-rpm').textContent = '--';
    $('bar-ads').style.width = '0%'; $('val-ads').textContent = '--';
    $('bar-mob').style.width = '0%'; $('val-mob').textContent = '--';
    $('bar-mag').style.width = '0%'; $('val-mag').textContent = '--';
  }

  if (btnEquip && statusTag) {
    btnEquip.onclick = null;
    if (w.isSelected) {
      btnEquip.textContent = 'EQUIPADA';
      btnEquip.className = 'btn-armory equipped';
      btnEquip.disabled = true;
      statusTag.textContent = 'EN SERVICIO';
    } else if (w.status === 'UNLOCKED') {
      btnEquip.textContent = 'EQUIPAR';
      btnEquip.className = 'btn-armory';
      btnEquip.disabled = false;
      statusTag.textContent = 'LISTA';
      btnEquip.onclick = () => {
        progression.selectWeapon(w.id);
        renderArmoryWeapons();
      };
    } else if (w.status === 'LOCKED') {
      btnEquip.textContent = 'BLOQUEADA';
      btnEquip.className = 'btn-armory';
      btnEquip.disabled = true;
      statusTag.textContent = `REQUIERE NVL ${w.reqLevel}`;
    } else {
      btnEquip.textContent = 'EN DESARROLLO';
      btnEquip.className = 'btn-armory';
      btnEquip.disabled = true;
      statusTag.textContent = `DESBLOQUEO NVL ${w.reqLevel}`;
    }
  }
}

let currentTab = 'play';
const TABS = ['play', 'operator', 'loadout', 'settings'];

function switchTab(tab) {
  if (tab === 'settings') {
    $('menu').style.display = 'none';
    $('settings-screen').style.display = 'flex';
    refreshSettingsUI();
    return;
  }
  currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.lobby-view').forEach(v => {
    v.style.display = 'none';
    v.classList.remove('active');
  });
  const view = $('tab-' + tab);
  if (view) {
    view.style.display = 'block';
    view.classList.add('active');
  }
  setLobbyView(tab);
  if (tab === 'loadout') {
    renderArmoryWeapons();
    renderInspectedWeapon();
  }
}

let selectedMode = 'waves';
const MODE_INTEL = {
  waves: {
    title: 'OLEADAS',
    badge: 'SUPERVIVENCIA TÁCTICA // HOSTILES CRECIENTES',
    desc: 'Supervivencia pura. Oleadas de hostiles cada vez más numerosas y agresivas. Aguanta cuanto puedas.',
    params: '<div class="param-row"><span>RECOMPENSA DE RONDA</span><b>+60 MUNIC IÓN • +35 SALUD</b></div><div class="param-row"><span>CONDICIÓN</span><b>ELIMINACIÓN TOTAL DE ESCUADRA</b></div>',
  },
  snd: {
    title: 'BUSCAR Y DESTRUIR',
    badge: 'DEFENSA DE OBJETIVO // DETONACIÓN A 90s',
    desc: 'La bomba está armada en el patio central. Los bots intentarán desactivarla en 10s acumulados y eliminarte. Defiéndela.',
    params: '<div class="param-row"><span>TEMPORIZADOR</span><b>90 SEGUNDOS HASTA DETONAR</b></div><div class="param-row"><span>DESACTIVACIÓN</span><b>10s ACUMULADOS POR BOTS</b></div>',
  },
};

function selectMode(mode) {
  selectedMode = mode;
  const info = MODE_INTEL[mode];
  if (!info) return;
  const titleEl = $('selected-title');
  const badgeEl = $('selected-badge');
  const descEl = $('selected-desc');
  const paramsEl = $('selected-params');
  if (titleEl) titleEl.textContent = info.title;
  if (badgeEl) badgeEl.textContent = info.badge;
  if (descEl) descEl.textContent = info.desc;
  if (paramsEl) paramsEl.innerHTML = info.params;
  $('mode-waves').classList.toggle('selected', mode === 'waves');
  $('mode-snd').classList.toggle('selected', mode === 'snd');
  const wGo = $('mode-waves').querySelector('.mode-go');
  const sGo = $('mode-snd').querySelector('.mode-go');
  if (wGo) wGo.textContent = mode === 'waves' ? 'SELECCIONADO • [ ESPACIO / CLIC ]' : 'SELECCIONAR »';
  if (sGo) sGo.textContent = mode === 'snd' ? 'SELECCIONADO • [ ESPACIO / CLIC ]' : 'SELECCIONAR »';
}

$('settings-btn').onclick = () => {
  $('menu').style.display = 'none';
  $('settings-screen').style.display = 'flex';
  refreshSettingsUI();
};
$('settings-back').onclick = () => {
  $('settings-screen').style.display = 'none';
  if (phase === 'PAUSED') {
    $('menu').classList.add('paused');
    $('pause-box').style.display = 'flex';
    $('menu').style.display = 'flex';
  } else {
    $('menu').classList.remove('paused');
    $('menu').style.display = 'flex';
    switchTab(currentTab || 'play');
  }
};
$('settings-reset').onclick = () => {
  Object.assign(settings, SETTINGS_DEFAULTS);
  applySettings(); saveSettings(); refreshSettingsUI();
};

/* ---------------- Jugador y entrada ---------------- */
const player = {
  pos: new THREE.Vector3(0, 1.7, 40),
  vel: new THREE.Vector3(),
  yaw: Math.PI, pitch: 0,
  hp: 100, grounded: true,
  radius: 0.45, eye: 1.7,
  alive: false,
};
const keys = {};
let locked = false, phase = 'MENU';
let mouseDown = false, adsDown = false, adsAmount = 0;
let matchTime = 0, endDelay = 0;

function clearInput() {
  for (const k in keys) keys[k] = false;
  mouseDown = false;
  adsDown = false;
}

function requestLock() {
  if (new URLSearchParams(location.search).has('nolock')) { locked = true; return; }
  const r = renderer.domElement.requestPointerLock();
  if (r && typeof r.catch === 'function') r.catch(onLockFailed);
}

function onLockFailed() {
  if (new URLSearchParams(location.search).has('nolock')) return;
  if (phase === 'PLAYING' && !locked) showMenuPause();
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && phase === 'PLAYING') tryReload();
  if (e.code === 'Escape') {
    if (phase === 'PLAYING') showMenuPause();
    else if ($('settings-screen').style.display === 'flex') $('settings-back').onclick();
  } else if (phase === 'MENU' && $('settings-screen').style.display !== 'flex') {
    if (e.code === 'KeyQ') {
      const idx = TABS.indexOf(currentTab);
      const nextIdx = (idx - 1 + TABS.length) % TABS.length;
      switchTab(TABS[nextIdx]);
    } else if (e.code === 'KeyE') {
      const idx = TABS.indexOf(currentTab);
      const nextIdx = (idx + 1) % TABS.length;
      switchTab(TABS[nextIdx]);
    } else if (e.code === 'Digit1' || (currentTab === 'play' && e.code === 'ArrowLeft')) {
      selectMode('waves');
    } else if (e.code === 'Digit2' || (currentTab === 'play' && e.code === 'ArrowRight')) {
      selectMode('snd');
    } else if ((e.code === 'Space' || e.code === 'Enter') && currentTab === 'play') {
      startGame(selectedMode);
    }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => {
  clearInput();
  if (phase === 'PLAYING') showMenuPause();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  clearInput();
  if (phase === 'PLAYING') showMenuPause();
});

document.addEventListener('pointerlockchange', () => {
  if (new URLSearchParams(location.search).has('nolock')) return;
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && phase === 'PLAYING') showMenuPause();
});
document.addEventListener('pointerlockerror', onLockFailed);
addEventListener('mousemove', e => {
  if (!locked) return;
  player.yaw -= e.movementX * 0.0021;
  player.pitch -= e.movementY * 0.0021;
  player.pitch = Math.max(-1.52, Math.min(1.52, player.pitch));
});
addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsDown = true;
});
addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsDown = false;
});
addEventListener('contextmenu', e => e.preventDefault());

function collidePlayer(p) {
  pushOutCircle(p, player.radius, p.y - 1.7, p.y);
}

/* ---------------- Hitbox del jugador ----------------
   Cápsula aproximada con 3 esferas (cabeza, torso, piernas),
   contra la que se traza la bala real del enemigo. */
const PLAYER_HITBOX = [
  { oy: 0.0, r: 0.30, mult: 1.5, zone: 'head' },   // cabeza (a la altura del ojo)
  { oy: -0.55, r: 0.42, mult: 1.0, zone: 'torso' },
  { oy: -1.2, r: 0.38, mult: 0.7, zone: 'legs' },
];
const _ray = new THREE.Ray();
const _sph = new THREE.Sphere();

function rayHitsPlayer(from, dir) {
  _ray.set(from, dir);
  let best = null;
  for (const part of PLAYER_HITBOX) {
    _sph.center.set(player.pos.x, player.pos.y + part.oy, player.pos.z);
    _sph.radius = part.r;
    const p = _ray.intersectSphere(_sph, new THREE.Vector3());
    if (p) {
      const d = p.distanceTo(from);
      if (!best || d < best.dist) best = { point: p, dist: d, mult: part.mult, zone: part.zone };
    }
  }
  return best;
}

/* ---------------- Indicadores direccionales de daño ---------------- */
const dmgIndicators = [];

function addDamageIndicator(fromPos) {
  const el = document.createElement('div');
  el.className = 'dmg-ind';
  $('dmg-indicators').appendChild(el);
  dmgIndicators.push({ el, x: fromPos.x, z: fromPos.z, life: 1.5 });
}

function updateDamageIndicators(dt) {
  for (let i = dmgIndicators.length - 1; i >= 0; i--) {
    const ind = dmgIndicators[i];
    ind.life -= dt;
    if (ind.life <= 0) { ind.el.remove(); dmgIndicators.splice(i, 1); continue; }
    // rumbo al atacante relativo a la vista actual (gira con el jugador)
    const dx = ind.x - player.pos.x, dz = ind.z - player.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const rel = Math.atan2(fx * (dz / len) - fz * (dx / len), fx * (dx / len) + fz * (dz / len));
    ind.el.style.transform = `rotate(${rel}rad)`;
    ind.el.style.opacity = Math.min(1, ind.life / 0.5) * 0.9;
  }
}

function clearDamageIndicators() {
  for (const ind of dmgIndicators) ind.el.remove();
  dmgIndicators.length = 0;
}

/* ---------------- Disparo ---------------- */
const raycaster = new THREE.Raycaster();
raycaster.far = 300;
let flashTimer = 0;

function shoot() {
  if (weapon.ammo <= 0) { sfxClick(500, .1, .06); weapon.cooldown = 0.25; return; }
  weapon.ammo--;
  waveStats.shots++;
  weapon.cooldown = weapon.fireRate;
  weapon.recoil = Math.min(weapon.recoil + 1, 6);
  flashTimer = 0.045;
  sfxShot();

  // dispersión
  const ads = adsAmount > 0.6;
  const spread = (ads ? 0.0022 : 0.011) + weapon.recoil * (ads ? 0.0012 : 0.0035);
  const dir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(camera.quaternion)
    .add(new THREE.Vector3((Math.random() - .5) * spread * 2, (Math.random() - .5) * spread * 2, 0).applyQuaternion(camera.quaternion))
    .normalize();

  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);
  const targets = [];
  for (const e of enemies) if (e.alive) targets.push(e.group);
  const hitsE = raycaster.intersectObjects(targets, true);
  const hitsW = raycaster.intersectObjects(solidMeshes(), false);

  const muzzleWorld = new THREE.Vector3();
  flashSprite.getWorldPosition(muzzleWorld);

  let end = raycaster.ray.at(120, new THREE.Vector3());
  const eDist = hitsE.length ? hitsE[0].distance : Infinity;
  const wDist = hitsW.length ? hitsW[0].distance : Infinity;

  if (eDist < wDist) {
    const h = hitsE[0];
    end = h.point;
    let enemy = null, o = h.object;
    while (o && !enemy) { if (o.userData.enemy) enemy = o.userData.enemy; o = o.parent; }
    if (enemy) {
      const headshot = h.object.userData.head === true;
      const dmg = headshot ? weapon.damage * 2.2 : weapon.damage;
      const killed = damageEnemy(enemy, dmg, h.point, headshot, dir);
      waveStats.hits++;
      waveStats.dealt += Math.round(dmg);
      if (killed) {
        kills++; $('kills').textContent = kills;
        waveStats.kills++;
        if (headshot) { waveStats.headshots++; showHeadshotBanner(); }
        const curWeapon = progression.getState().selectedWeapon || 'mk7';
        const kRes = progression.recordKill(curWeapon, headshot);
        updatePlayerHeaderUI();
        if (kRes && kRes.playerResult) {
          flashMsg(headshot ? `+${kRes.playerResult.xpGained} XP (HEADSHOT)` : `+${kRes.playerResult.xpGained} XP`);
        }
      }
      showHitmarker(headshot);
    }
  } else if (wDist < Infinity) {
    const h = hitsW[0];
    end = h.point;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    spawnBurst(h.point, 0xffc36b, 7, 3.2, 0.1, 0.4);
    spawnDecal(h.point, n);
  }
  spawnTracer(muzzleWorld, end);
}

function tryReload() {
  if (!player.alive || weapon.reloading || weapon.ammo >= weapon.magSize || weapon.reserve <= 0) return;
  weapon.reloading = true; weapon.reloadT = 0;
  sfxReload();
}

/* ---------------- Oleadas y estadísticas ---------------- */
let wave = 0, kills = 0, waveDelay = 0, betweenWaves = true;

let waveStats = null, waveStartT = 0;
function resetWaveStats() {
  waveStats = { shots: 0, hits: 0, kills: 0, headshots: 0, dealt: 0, taken: 0 };
  waveStartT = matchTime;
}
resetWaveStats();

/* ---------------- Buscar y Destruir ---------------- */
let gameMode = 'waves';
const SND_DURATION = 90;       // segundos hasta la detonación
const SND_DEFUSE_TIME = 10;    // segundos de desactivación acumulada para perder
const bombPos = new THREE.Vector3(0, 0, -6);
let snd = null, bombGroup = null, bombLight = null;

function createBomb() {
  bombGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x23261f, metalness: 0.5, roughness: 0.45 }));
  body.position.y = 0.15;
  body.castShadow = true;
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2211, emissiveIntensity: 1.6 }));
  screen.position.set(0.1, 0.32, 0);
  const wires = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a1a1a }));
  wires.rotation.z = Math.PI / 2; wires.position.set(-0.1, 0.31, 0.09);
  bombLight = new THREE.PointLight(0xff2211, 2.5, 7, 2);
  bombLight.position.y = 0.6;
  bombGroup.add(body, screen, wires, bombLight);
  bombGroup.position.copy(bombPos);
  scene.add(bombGroup);
}

function removeBomb() {
  if (!bombGroup) return;
  scene.remove(bombGroup);
  bombGroup.traverse(o => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
  bombGroup = null; bombLight = null;
}

function spawnSndEnemy() {
  let x, z, tries = 0;
  do {
    const edge = Math.floor(Math.random() * 4);
    const t = (Math.random() * 2 - 1) * (ARENA - 6);
    if (edge === 0) { x = t; z = -ARENA + 4; }
    else if (edge === 1) { x = t; z = ARENA - 4; }
    else if (edge === 2) { x = -ARENA + 4; z = t; }
    else { x = ARENA - 4; z = t; }
    tries++;
  } while ((pointBlocked(x, z, 0.8) || player.pos.distanceTo(new THREE.Vector3(x, 0, z)) < 16) && tries < 24);
  const e = makeEnemy(x, z);
  const elapsed = matchTime - snd.startT;
  e.hp = 100 + elapsed * 0.8;
  e.speed += Math.min(elapsed * 0.02, 1.2);
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function detonateBomb() {
  const p = bombPos.clone().setY(0.6);
  spawnBurst(p, 0xffc36b, 60, 14, 0.5, 1.2, -6);
  spawnBurst(p, 0xff5a1e, 40, 9, 0.8, 1.5, -4);
  spawnBurst(p, 0x444444, 25, 5, 1.3, 2.0, -1);
  removeBomb();
  sfxExplosion();
  shake = 1;
  hitFlash = 0.8;
  progression.recordSndVictory();
  updatePlayerHeaderUI();
  for (const e of enemies) {
    if (e.alive && e.group.position.distanceTo(bombPos) < 30) { e.alive = false; e.deathT = 0; }
  }
  endDelay = 1.6;
}

function spawnWave() {
  wave++;
  $('wave-num').textContent = 'OLEADA ' + wave;
  flashMsg('OLEADA ' + wave);
  resetWaveStats();
  const n = 3 + wave * 2;
  for (let i = 0; i < n; i++) {
    let x, z, tries = 0;
    do {
      const edge = Math.floor(Math.random() * 4);
      const t = (Math.random() * 2 - 1) * (ARENA - 6);
      if (edge === 0) { x = t; z = -ARENA + 4; }
      else if (edge === 1) { x = t; z = ARENA - 4; }
      else if (edge === 2) { x = -ARENA + 4; z = t; }
      else { x = ARENA - 4; z = t; }
      tries++;
    } while ((pointBlocked(x, z, 0.8) || player.pos.distanceTo(new THREE.Vector3(x, 0, z)) < 20) && tries < 24);
    const e = makeEnemy(x, z);
    e.hp = 100 + (wave - 1) * 12;
    e.speed += Math.min(wave * 0.12, 1.4);
  }
  betweenWaves = false;
}

function showWaveSummary() {
  phase = 'SUMMARY';
  clearInput();
  document.exitPointerLock();
  progression.recordWaveCleared(wave);
  updatePlayerHeaderUI();
  const secs = Math.round(matchTime - waveStartT);
  const acc = waveStats.shots ? Math.round(waveStats.hits / waveStats.shots * 100) : 0;
  $('ws-title').textContent = 'OLEADA ' + wave + ' SUPERADA';
  $('ws-kills').textContent = waveStats.kills;
  $('ws-headshots').textContent = waveStats.headshots;
  $('ws-shots').textContent = waveStats.shots;
  $('ws-accuracy').textContent = acc + '%';
  $('ws-dmg-dealt').textContent = waveStats.dealt;
  $('ws-dmg-taken').textContent = waveStats.taken;
  $('ws-time').textContent = secs + 's';
  $('ws-reward').textContent = '+60 MUNICIÓN \u00A0\u00B7\u00A0 +35 SALUD \u00A0\u00B7\u00A0 +250 XP';
  $('hud').style.display = 'none';
  $('wave-summary').style.display = 'flex';
}

$('continue-btn').onclick = () => {
  if (phase !== 'SUMMARY') return;
  $('wave-summary').style.display = 'none';
  $('hud').style.display = 'block';
  phase = 'PLAYING';
  waveDelay = 1.5; // la siguiente oleada entra enseguida
  requestLock();
};

function flashMsg(text) {
  const el = $('msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(flashMsg._t);
  flashMsg._t = setTimeout(() => el.style.opacity = 0, 1800);
}

/* ---------------- HUD ---------------- */
function showHeadshotBanner() {
  const el = $('headshot-banner');
  el.classList.remove('show');
  void el.offsetWidth; // reinicia la animación CSS si ya estaba en curso
  el.classList.add('show');
  clearTimeout(showHeadshotBanner._t);
  showHeadshotBanner._t = setTimeout(() => el.classList.remove('show'), 1450);
}

function showHitmarker(head) {
  const el = $('hitmarker');
  el.style.opacity = 1;
  el.querySelectorAll('span').forEach(s => s.style.background = head ? '#ffd000' : '#ff3b30');
  clearTimeout(showHitmarker._t);
  showHitmarker._t = setTimeout(() => el.style.opacity = 0, 90);
}

function updateHUD() {
  $('health-num').textContent = Math.max(0, Math.ceil(player.hp));
  $('health-fill').style.width = Math.max(0, player.hp) + '%';
  $('health-fill').style.background = player.hp > 40
    ? 'linear-gradient(90deg,#b7ff4a,#4caf50)'
    : 'linear-gradient(90deg,#ff5a3c,#c62828)';
  $('ammo-num').textContent = weapon.reloading ? '--' : weapon.ammo;
  $('ammo-reserve').textContent = '/ ' + weapon.reserve;
  $('reload-hint').style.opacity = (!weapon.reloading && weapon.ammo === 0 && weapon.reserve > 0) ? 1 : 0;
  const alive = enemies.filter(e => e.alive).length;
  $('enemies-left').textContent = 'ENEMIGOS: ' + alive;
  $('damage-vignette').style.opacity = player.hp < 100 ? Math.min(0.9, (100 - player.hp) / 100 * (player.hp < 30 ? 1.2 : 0.7)) : 0;
}

function damagePlayer(dmg, fromPos) {
  if (!player.alive) return;
  player.hp -= dmg;
  waveStats.taken += Math.round(dmg);
  sfxHurt();
  shake = Math.min(shake + 0.35, 1);
  hitFlash = 1;
  player.pitch = Math.min(1.52, player.pitch + 0.012 + Math.random() * 0.012); // flinch
  if (fromPos) addDamageIndicator(fromPos);
  if (player.hp <= 0) die();
}

/* ---------------- Estados de juego ---------------- */
function startGame(mode) {
  gameMode = mode;
  clearEnemies();
  resetEffects();
  clearDamageIndicators();
  removeBomb();
  clearInput();
  hitFlash = 0; shake = 0; bobT = 0; flashTimer = 0;
  adsAmount = 0; matchTime = 0; endDelay = 0;
  $('hit-flash').style.opacity = 0;
  $('headshot-banner').classList.remove('show');
  $('wave-summary').style.display = 'none';
  $('defuse-panel').style.display = 'none';
  $('quit-btn').style.display = 'none';
  $('resume-btn').style.display = 'none';
  $('pause-box').style.display = 'none';
  $('menu').classList.remove('paused');
  resetWaveStats();

  player.vel.set(0, 0, 0);
  player.pitch = 0;
  player.hp = 100; player.alive = true;
  weapon.ammo = weapon.magSize; weapon.reserve = 120;
  weapon.reloading = false; weapon.recoil = 0;
  weapon.cooldown = 0; weapon.reloadT = 0;
  gunGroup.rotation.set(0, 0, 0);
  gunGroup.position.copy(GUN_HIP);
  muzzleFlash.intensity = 0;
  flashSprite.visible = false;
  wave = 0; kills = 0; $('kills').textContent = 0;

  if (gameMode === 'snd') {
    player.pos.set(0, 1.7, 18);
    player.yaw = 0; // mirando hacia la bomba
    snd = { timeLeft: SND_DURATION, defuse: 0, spawnTimer: 1, beepT: 0, sparkT: 0, startT: matchTime, ended: false, spawned: 0 };
    createBomb();
    betweenWaves = false;
    weapon.reserve = 150;
    $('wave-num').textContent = 'DETONACIÓN ' + fmtTime(SND_DURATION);
    flashMsg('DEFIENDE LA BOMBA');
  } else {
    player.pos.set(0, 1.7, 40);
    player.yaw = Math.PI;
    snd = null;
    betweenWaves = true; waveDelay = 2.5;
  }

  $('menu').style.display = 'none';
  $('death-screen').style.display = 'none';
  $('hud').style.display = 'block';
  phase = 'PLAYING';
  requestLock();
  audio();
}

function showEndScreen(victory, title, statsHtml) {
  player.alive = false;
  phase = 'RESULTS';
  endDelay = 0;
  clearInput();
  document.exitPointerLock();
  $('death-title').textContent = title;
  $('death-screen').classList.toggle('victory', victory);
  $('death-stats').innerHTML = statsHtml;
  $('hud').style.display = 'none';
  $('death-screen').style.display = 'flex';
}

function die() {
  const stats = gameMode === 'snd'
    ? `BAJAS: ${kills} &nbsp;&middot;&nbsp; AGUANTASTE: ${fmtTime(matchTime - snd.startT)}`
    : `OLEADA ALCANZADA: ${wave} &nbsp;&middot;&nbsp; BAJAS: ${kills}`;
  showEndScreen(false, 'K.I.A.', stats);
}

function showMenuPause() {
  phase = 'PAUSED';
  clearInput();
  document.exitPointerLock();
  $('modes').style.display = 'none';
  $('pause-box').style.display = 'flex';
  $('resume-btn').style.display = 'inline-block';
  $('quit-btn').style.display = 'inline-block';
  $('menu').classList.add('paused');
  $('menu').style.display = 'flex';
  $('hud').style.display = 'none';
}
function resumeGame() {
  if (phase !== 'PAUSED') return;
  $('menu').classList.remove('paused');
  $('pause-box').style.display = 'none';
  $('resume-btn').style.display = 'none';
  $('quit-btn').style.display = 'none';
  $('menu').style.display = 'none';
  $('hud').style.display = 'block';
  phase = 'PLAYING';
  requestLock();
}
function backToMenu() {
  phase = 'MENU';
  player.alive = false;
  endDelay = 0;
  clearInput();
  document.exitPointerLock();
  clearEnemies();
  resetEffects();
  clearDamageIndicators();
  removeBomb();
  $('death-screen').style.display = 'none';
  $('wave-summary').style.display = 'none';
  $('hud').style.display = 'none';
  $('menu').classList.remove('paused');
  $('pause-box').style.display = 'none';
  $('resume-btn').style.display = 'none';
  $('quit-btn').style.display = 'none';
  $('modes').style.display = 'flex';
  switchTab('play');
  selectMode(selectedMode || 'waves');
  updatePlayerHeaderUI();
  renderArmoryWeapons();
  renderInspectedWeapon();
  $('menu').style.display = 'flex';
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

document.querySelectorAll('.btn-camo').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.btn-camo').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setOperatorCamo(btn.dataset.camo);
  };
});

$('mode-waves').onmouseenter = () => selectMode('waves');
$('mode-snd').onmouseenter = () => selectMode('snd');
$('mode-waves').onclick = () => startGame('waves');
$('mode-snd').onclick = () => startGame('snd');
if ($('deploy-btn')) $('deploy-btn').onclick = () => startGame(selectedMode);
$('retry-btn').onclick = () => startGame(gameMode);
$('resume-btn').onclick = resumeGame;
$('quit-btn').onclick = backToMenu;
$('menu-btn').onclick = backToMenu;

/* ---------------- Bucle principal ---------------- */
const clock = new THREE.Clock();
let bobT = 0, shake = 0, hitFlash = 0;
const tmpV = new THREE.Vector3();
const MAX_STEP = 0.05, MAX_FRAME = 0.25;

function stepSim(dt) {
  if (phase === 'PLAYING' && player.alive) {
    matchTime += dt;
    /* --- movimiento --- */
    const sprint = keys['ShiftLeft'] && !adsDown;
    const speed = sprint ? 8.2 : 5.2;
    const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (keys['KeyW']) wish.add(f);
    if (keys['KeyS']) wish.sub(f);
    if (keys['KeyD']) wish.add(r);
    if (keys['KeyA']) wish.sub(r);
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize().multiplyScalar(speed);
    // aceleración suave
    player.vel.x += (wish.x - player.vel.x) * Math.min(1, dt * 11);
    player.vel.z += (wish.z - player.vel.z) * Math.min(1, dt * 11);

    // salto / gravedad
    if (keys['Space'] && player.grounded) { player.vel.y = 6.5; player.grounded = false; }
    player.vel.y -= 19 * dt;
    player.pos.addScaledVector(player.vel, dt);
    if (player.pos.y <= player.eye) { player.pos.y = player.eye; player.vel.y = 0; player.grounded = true; }
    collidePlayer(player.pos);

    /* --- ADS / FOV --- */
    adsAmount += ((adsDown ? 1 : 0) - adsAmount) * Math.min(1, dt * 12);
    camera.fov = settings.fov - 25 * adsAmount;
    camera.updateProjectionMatrix();

    /* --- disparo --- */
    weapon.cooldown -= dt;
    if (mouseDown && !weapon.reloading && weapon.cooldown <= 0) shoot();
    weapon.recoil = Math.max(0, weapon.recoil - dt * 9);
    if (weapon.reloading) {
      weapon.reloadT += dt;
      if (weapon.reloadT >= weapon.reloadTime) {
        const need = weapon.magSize - weapon.ammo;
        const take = Math.min(need, weapon.reserve);
        weapon.ammo += take; weapon.reserve -= take;
        weapon.reloading = false;
      }
    }

    /* --- cámara --- */
    camera.position.copy(player.pos);
    if (moving && player.grounded) bobT += dt * (sprint ? 13 : 9);
    const bobY = Math.sin(bobT * 2) * 0.017 * (1 - adsAmount * 0.8);
    const bobX = Math.cos(bobT) * 0.012 * (1 - adsAmount * 0.8);
    camera.position.y += bobY;
    shake = Math.max(0, shake - dt * 2.5);
    const shk = shake * 0.03;
    camera.rotation.set(
      player.pitch + weapon.recoil * 0.004 + (Math.random() - .5) * shk,
      player.yaw + (Math.random() - .5) * shk,
      Math.cos(bobT) * 0.004 * (1 - adsAmount),
      'YXZ'
    );

    /* --- arma: posición, sway, retroceso, recarga --- */
    const target = tmpV.copy(GUN_HIP).lerp(GUN_ADS, adsAmount);
    target.x += bobX * 0.6;
    target.y += bobY * 0.6;
    target.z += weapon.recoil * 0.013;
    if (weapon.reloading) {
      const t = weapon.reloadT / weapon.reloadTime;
      target.y -= Math.sin(t * Math.PI) * 0.22;
      gunGroup.rotation.x = -Math.sin(t * Math.PI) * 0.8;
    } else {
      gunGroup.rotation.x += (weapon.recoil * 0.02 - gunGroup.rotation.x) * Math.min(1, dt * 14);
    }
    gunGroup.rotation.z = (sprint && moving && !adsDown ? 0.25 : 0) + Math.cos(bobT) * 0.006;
    gunGroup.rotation.y = sprint && moving && !adsDown ? 0.3 : 0;
    gunGroup.position.lerp(target, Math.min(1, dt * 16));

    /* --- fogonazo --- */
    flashTimer -= dt;
    const flashOn = flashTimer > 0;
    muzzleFlash.intensity = flashOn ? 14 : 0;
    flashSprite.visible = flashOn;
    if (flashOn) {
      flashSprite.rotation.z = Math.random() * Math.PI * 2;
      flashSprite.scale.setScalar(0.7 + Math.random() * 0.7);
    }

    /* --- enemigos --- */
    let anyAlive = false;
    for (const e of enemies) {
      if (!e.alive) {
        // animación de muerte
        if (e.deathT < 1) {
          e.deathT += dt * (e.deathHeadshot ? 2.8 : 2.2);
          const t = Math.min(1, e.deathT);
          if (e.deathHeadshot) {
            // headshot: se desploma de espaldas con un giro seco
            e.group.rotation.x = Math.PI / 2 * (t * t);
            e.group.rotation.y += dt * 3.5 * (1 - t);
            e.group.position.y = -0.15 * t;
          } else {
            // muerte normal: cae de bruces
            e.group.rotation.x = -Math.PI / 2 * t;
            e.group.position.y = -0.1 * t;
          }
        }
        continue;
      }
      anyAlive = true;
      const toP = player.pos.clone().sub(e.group.position); toP.y = 0;
      const dist = toP.length();
      toP.normalize();

      // objetivo de navegación: el jugador (oleadas) o la bomba (buscar y destruir)
      e.defusing = false;
      let navDir = toP, retreat = dist < 6, strafeAmt = 0.6, advance = dist > 11;
      if (gameMode === 'snd' && bombGroup) {
        const toB = bombPos.clone().sub(e.group.position); toB.y = 0;
        const distB = toB.length();
        if (distB < 2.3) {
          // en la bomba: desactivar (quieto, indefenso mientras trabaja)
          e.defusing = true;
          e.group.rotation.y = Math.atan2(toB.x, toB.z);
          e.legL.rotation.x = e.legR.rotation.x = 0;
        } else {
          navDir = toB.normalize();
          retreat = false; advance = true; strafeAmt = 0.3;
        }
      }

      if (!e.defusing) {
        e.group.rotation.y = Math.atan2(navDir.x, navDir.z);
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) { e.strafeDir *= -1; e.strafeTimer = 1.2 + Math.random() * 2; }
        const move = new THREE.Vector3();
        if (advance) move.add(navDir);
        else if (retreat) move.sub(navDir);
        move.add(new THREE.Vector3(-navDir.z, 0, navDir.x).multiplyScalar(e.strafeDir * strafeAmt));
        move.normalize().multiplyScalar(e.speed * dt);
        e.group.position.add(move);
        // misma resolución de colisión que el jugador: nunca puede acabar dentro de un AABB
        pushOutCircle(e.group.position, 0.5, 0.1, 1.9);

        // animación piernas
        e.walkPhase += dt * e.speed * 3.2;
        e.legL.rotation.x = Math.sin(e.walkPhase) * 0.6;
        e.legR.rotation.x = -Math.sin(e.walkPhase) * 0.6;
      }

      // disparar (nunca mientras desactiva)
      e.fireTimer -= dt;
      if (!e.defusing && e.fireTimer <= 0 && dist < 38) {
        e.fireTimer = 0.9 + Math.random() * 1.6 - Math.min(wave * 0.04, 0.5);
        if (enemyLOS(e, player.pos)) {
          sfxEnemyShot();
          const from = e.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
          // error de puntería: crece con distancia y con el movimiento del jugador, baja con la dificultad
          const lvl = gameMode === 'snd' ? Math.min((matchTime - snd.startT) / 20, 4) : wave;
          const err = Math.max(0.12,
            0.30 + dist * 0.026 + (moving ? 0.45 : 0) + (sprint ? 0.35 : 0) - Math.min(lvl * 0.05, 0.45));
          const aim = new THREE.Vector3(
            player.pos.x + (Math.random() - .5) * 2 * err,
            player.pos.y - 0.5 + (Math.random() - .5) * 2 * err * 0.6,
            player.pos.z + (Math.random() - .5) * 2 * err);
          const dir = aim.sub(from).normalize();

          // la bala es un raycast real: primero paredes, luego hitbox del jugador
          raycaster.set(from, dir);
          raycaster.far = 80;
          const wh = raycaster.intersectObjects(solidMeshes(), false);
          raycaster.far = 300;
          const wallD = wh.length ? wh[0].distance : Infinity;
          const hit = rayHitsPlayer(from, dir);

          if (hit && hit.dist < wallD) {
            spawnTracer(from, hit.point);
            spawnBurst(hit.point, 0xb01818, 6, 2.2, 0.08, 0.4, -4);
            damagePlayer((7 + Math.random() * 6 + lvl) * hit.mult, e.group.position);
          } else if (wallD < Infinity) {
            const h = wh[0];
            spawnTracer(from, h.point);
            const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            spawnBurst(h.point, 0xffc36b, 4, 2.5, 0.08, 0.3);
            spawnDecal(h.point, n);
          } else {
            spawnTracer(from, from.clone().addScaledVector(dir, 60));
          }
        }
      }
    }

    /* --- modo oleadas --- */
    if (gameMode === 'waves') {
      if (!betweenWaves && !anyAlive) {
        betweenWaves = true;
        // recompensa
        weapon.reserve += 60;
        player.hp = Math.min(100, player.hp + 35);
        showWaveSummary();
      }
      if (betweenWaves) {
        waveDelay -= dt;
        if (waveDelay <= 0) spawnWave();
      }
    }

    /* --- modo buscar y destruir --- */
    else if (snd && !snd.ended) {
      // temporizador de detonación
      snd.timeLeft -= dt;
      $('wave-num').textContent = 'DETONACIÓN ' + fmtTime(snd.timeLeft);
      // pitido que se acelera
      snd.beepT -= dt;
      if (snd.beepT <= 0) {
        sfxClick(1700, 0.07, 0.03);
        snd.beepT = 0.15 + Math.max(0, snd.timeLeft / SND_DURATION) * 0.85;
      }
      if (bombLight) bombLight.intensity = Math.sin(matchTime * 20) > 0 ? 3 : 0.4;

      // llegada continua de hostiles
      snd.spawnTimer -= dt;
      const aliveCount = enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      if (snd.spawnTimer <= 0 && aliveCount < 9) {
        const n = snd.spawned === 0 ? 4 : (Math.random() < 0.35 ? 2 : 1);
        for (let i = 0; i < n; i++) spawnSndEnemy();
        snd.spawned += n;
        snd.spawnTimer = 4.5 + Math.random() * 3;
      }

      // progreso de desactivación
      let defusers = 0;
      for (const e of enemies) if (e.alive && e.defusing) defusers++;
      if (defusers > 0) {
        snd.defuse += dt * (1 + (defusers - 1) * 0.5);
        snd.sparkT -= dt;
        if (snd.sparkT <= 0) {
          spawnBurst(bombPos.clone().setY(0.4), 0x7fc4ff, 4, 1.6, 0.07, 0.3);
          snd.sparkT = 0.25;
        }
      } else {
        snd.defuse = Math.max(0, snd.defuse - dt * 0.6);
      }
      if (snd.defuse > 0.05) {
        $('defuse-panel').style.display = 'block';
        $('defuse-fill').style.width = Math.min(100, snd.defuse / SND_DEFUSE_TIME * 100) + '%';
      } else {
        $('defuse-panel').style.display = 'none';
      }

      // derrota: bomba desactivada
      if (snd.defuse >= SND_DEFUSE_TIME) {
        snd.ended = true;
        removeBomb();
        showEndScreen(false, 'BOMBA DESACTIVADA',
          `MISIÓN FALLIDA &nbsp;&middot;&nbsp; BAJAS: ${kills}`);
      }
      // victoria: detonación
      else if (snd.timeLeft <= 0) {
        snd.ended = true;
        detonateBomb();
      }
    }

    updateCorpses(dt);
    if (endDelay > 0) {
      endDelay -= dt;
      if (endDelay <= 0) showEndScreen(true, 'OBJETIVO CUMPLIDO',
        `BOMBA DETONADA &nbsp;&middot;&nbsp; BAJAS: ${kills}`);
    }

    updateDamageIndicators(dt);
    hitFlash = Math.max(0, hitFlash - dt * 3);
    $('hit-flash').style.opacity = hitFlash * 0.85;

    updateHUD();
  }
}

function tick() {
  requestAnimationFrame(tick);
  const frameDt = Math.min(clock.getDelta(), MAX_FRAME);
  if (phase === 'PLAYING') {
    const steps = Math.max(1, Math.ceil(frameDt / MAX_STEP));
    for (let i = 0; i < steps; i++) stepSim(frameDt / steps);
    updateEffects(Math.min(frameDt, MAX_STEP));
    renderer.render(scene, camera);
  } else if (phase === 'MENU') {
    updateLobby(frameDt);
    renderer.render(lobbyScene, lobbyCamera);
  } else {
    renderer.render(scene, camera);
  }
  diagnostics.frame();
}

const diagnostics = createDiagnostics(renderer, scene, () => {
  let alive = 0;
  for (const e of enemies) if (e.alive) alive++;
  const activeScene = phase === 'MENU' ? lobbyScene : scene;
  return {
    phase, mode: gameMode, enemiesAlive: alive, enemiesTotal: enemies.length, matchTime,
    sceneChildren: activeScene.children.length,
  };
}, {
  killPlayer: () => damagePlayer(1e6),
  killAllEnemies: () => { for (const e of enemies.slice()) if (e.alive) damageEnemy(e, 1e6, e.group.position, Math.random() < 0.5, null); },
  heal: () => { player.hp = 100; },
  setSndTime: s => { if (snd) snd.timeLeft = s; },
  setSndDefuse: s => { if (snd) snd.defuse = s; },
  startGame,
  backToMenu,
  resumeGame,
  pause: () => { if (phase === 'PLAYING') showMenuPause(); },
  switchTab,
  selectMode,
  progression,
});

window.__bp = window.__bp || {};
window.__bp.progression = progression;

applySettings();
refreshSettingsUI();
initArmoryUI();
updatePlayerHeaderUI();
progression.subscribe(() => {
  updatePlayerHeaderUI();
  if (currentTab === 'loadout') {
    renderArmoryWeapons();
    renderInspectedWeapon();
  }
});
$('loading').style.display = 'none';
tick();
