import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const progPath = path.resolve(__dirname, '../js/progression.js');
const code = fs.readFileSync(progPath, 'utf8');
const context = vm.createContext({
  Math,
  Date,
  JSON,
  Number,
  Set,
  console
});
const mod = new vm.SourceTextModule(code, { context });
await mod.link(() => {});
await mod.evaluate();

const {
  XP_REWARDS,
  MAX_PLAYER_LEVEL,
  MAX_WEAPON_LEVEL,
  WEAPON_CATEGORIES,
  WEAPON_CATALOG,
  getPlayerLevelInfo,
  getWeaponLevelInfo,
  isWeaponUnlocked,
  getWeaponStatus,
  ProgressionManager,
  sanitizeNumber
} = mod.namespace;

class MockStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] ?? null; }
  setItem(key, val) { this.store[key] = String(val); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}

console.log('--- TEST 1: XP Rewards Constants ---');
assert.strictEqual(XP_REWARDS.KILL, 100);
assert.strictEqual(XP_REWARDS.HEADSHOT_BONUS, 50);
assert.strictEqual(XP_REWARDS.WAVE_COMPLETE, 250);
assert.strictEqual(XP_REWARDS.SND_VICTORY, 750);
assert.strictEqual(XP_REWARDS.WEAPON_KILL, 60);
assert.strictEqual(XP_REWARDS.WEAPON_HEADSHOT_BONUS, 30);
console.log('PASS: XP Rewards constants');

console.log('--- TEST 2: Player Level Curve ---');
const p1 = getPlayerLevelInfo(0);
assert.strictEqual(p1.level, 1);
assert.strictEqual(p1.levelXP, 0);
assert.strictEqual(p1.nextLevelXP, 500);
assert.strictEqual(p1.progress, 0);
assert.strictEqual(p1.isMax, false);

const p2 = getPlayerLevelInfo(500);
assert.strictEqual(p2.level, 2);
assert.strictEqual(p2.levelXP, 0);
assert.strictEqual(p2.nextLevelXP, 620);
assert.strictEqual(p2.progress, 0);

const p2Mid = getPlayerLevelInfo(810);
assert.strictEqual(p2Mid.level, 2);
assert.strictEqual(p2Mid.levelXP, 310);
assert.strictEqual(p2Mid.nextLevelXP, 620);
assert.strictEqual(p2Mid.progress, 0.5);

const pBeforeMax = getPlayerLevelInfo(165619);
assert.strictEqual(pBeforeMax.level, 49);
assert.strictEqual(pBeforeMax.isMax, false);

const pExactMax = getPlayerLevelInfo(165620);
assert.strictEqual(pExactMax.level, MAX_PLAYER_LEVEL);
assert.strictEqual(pExactMax.isMax, true);
assert.strictEqual(pExactMax.progress, 1);
assert.strictEqual(pExactMax.nextLevelXP, 0);

const pMax = getPlayerLevelInfo(200000);
assert.strictEqual(pMax.level, MAX_PLAYER_LEVEL);
assert.strictEqual(pMax.isMax, true);
assert.strictEqual(pMax.progress, 1);
assert.strictEqual(pMax.nextLevelXP, 0);
console.log('PASS: Player Level Curve (1 to 50, progressive slope, exact threshold 165620 XP, max clamp)');

console.log('--- TEST 3: Weapon Level Curve ---');
const w1 = getWeaponLevelInfo(0);
assert.strictEqual(w1.level, 1);
assert.strictEqual(w1.levelXP, 0);
assert.strictEqual(w1.nextLevelXP, 250);
assert.strictEqual(w1.progress, 0);
assert.strictEqual(w1.isMax, false);

const w2 = getWeaponLevelInfo(250);
assert.strictEqual(w2.level, 2);
assert.strictEqual(w2.levelXP, 0);
assert.strictEqual(w2.nextLevelXP, 330);

const wBeforeMax = getWeaponLevelInfo(18429);
assert.strictEqual(wBeforeMax.level, 19);
assert.strictEqual(wBeforeMax.isMax, false);

const wExactMax = getWeaponLevelInfo(18430);
assert.strictEqual(wExactMax.level, MAX_WEAPON_LEVEL);
assert.strictEqual(wExactMax.isMax, true);
assert.strictEqual(wExactMax.progress, 1);
assert.strictEqual(wExactMax.nextLevelXP, 0);

const wMax = getWeaponLevelInfo(50000);
assert.strictEqual(wMax.level, MAX_WEAPON_LEVEL);
assert.strictEqual(wMax.isMax, true);
assert.strictEqual(wMax.progress, 1);
assert.strictEqual(wMax.nextLevelXP, 0);
console.log('PASS: Weapon Level Curve (1 to 20, max clamp)');

console.log('--- TEST 4: Weapon Catalog & Unlock Rules ---');
assert.strictEqual(WEAPON_CATEGORIES.length, 7);
const expectedCats = ['ASSAULT', 'SMG', 'SHOTGUN', 'LMG', 'SNIPER', 'PISTOL', 'MELEE'];
expectedCats.forEach(c => assert(WEAPON_CATEGORIES.some(cat => cat.id === c)));

assert.strictEqual(isWeaponUnlocked('mk7', 1), true);
assert.strictEqual(isWeaponUnlocked('mk7', 50), true);

assert.strictEqual(isWeaponUnlocked('vector9', 1), false);
assert.strictEqual(isWeaponUnlocked('vector9', 3), false);
assert.strictEqual(isWeaponUnlocked('vector9', 4), true);
assert.strictEqual(isWeaponUnlocked('vector9', 50), true);
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'vector9'), 1), 'LOCKED');
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'vector9'), 4), 'UNLOCKED');

assert.strictEqual(isWeaponUnlocked('m870', 1), false);
assert.strictEqual(isWeaponUnlocked('m870', 7), false);
assert.strictEqual(isWeaponUnlocked('m870', 8), true);
assert.strictEqual(isWeaponUnlocked('m870', 50), true);
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'm870'), 1), 'LOCKED');
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'm870'), 8), 'UNLOCKED');

assert.strictEqual(isWeaponUnlocked('ak12', 1), false);
assert.strictEqual(isWeaponUnlocked('ak12', 14), true);
assert.strictEqual(isWeaponUnlocked('ak12', 50), true);
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'ak12'), 1), 'LOCKED');
assert.strictEqual(getWeaponStatus(WEAPON_CATALOG.find(x => x.id === 'ak12'), 14), 'UNLOCKED');

const mk7 = WEAPON_CATALOG.find(x => x.id === 'mk7');
assert.strictEqual(getWeaponStatus(mk7, 1), 'UNLOCKED');
console.log('PASS: Catalog & Unlock rules');

console.log('--- TEST 5: ProgressionManager Combat Recording & Decoupling ---');
const storage = new MockStorage();
const mgr = new ProgressionManager(storage);

const k1 = mgr.recordKill('mk7', false);
assert.strictEqual(k1.playerResult.xpGained, 100);
assert.strictEqual(k1.weaponResult.xpGained, 60);
assert.strictEqual(mgr.getPlayerInfo().currentXP, 100);
assert.strictEqual(mgr.getWeaponInfo('mk7').currentXP, 60);

const k2 = mgr.recordKill('mk7', true);
assert.strictEqual(k2.playerResult.xpGained, 150);
assert.strictEqual(k2.weaponResult.xpGained, 90);
assert.strictEqual(mgr.getPlayerInfo().currentXP, 250);
assert.strictEqual(mgr.getWeaponInfo('mk7').currentXP, 150);

const wEvent = mgr.recordWaveCleared(1);
assert.strictEqual(wEvent.playerResult.xpGained, 250);
assert.strictEqual(mgr.getPlayerInfo().currentXP, 500);
assert.strictEqual(mgr.getPlayerInfo().level, 2);
assert.strictEqual(mgr.getWeaponInfo('mk7').currentXP, 150);

const sEvent = mgr.recordSndVictory();
assert.strictEqual(sEvent.playerResult.xpGained, 750);
assert.strictEqual(mgr.getPlayerInfo().currentXP, 1250);
assert.strictEqual(mgr.getWeaponInfo('mk7').currentXP, 150);

assert.strictEqual(mgr.selectWeapon('vector9'), false);
assert.strictEqual(mgr.getState().selectedWeapon, 'mk7');
assert.strictEqual(mgr.selectWeapon('mk7'), true);
console.log('PASS: Combat recording & XP decoupling');

console.log('--- TEST 6: Persistence & Corruption Recovery ---');
const stateJson = storage.getItem('bp_progression_v1');
assert(stateJson !== null);
const parsed = JSON.parse(stateJson);
assert.strictEqual(parsed.player.xp, 1250);
assert.strictEqual(parsed.weapons.mk7.xp, 150);

storage.setItem('bp_progression_v1', '{corrupt json!!!');
const mgrCorrupt = new ProgressionManager(storage);
assert.strictEqual(mgrCorrupt.getPlayerInfo().level, 1);
assert.strictEqual(mgrCorrupt.getPlayerInfo().currentXP, 0);

storage.setItem('bp_progression_v1', JSON.stringify({
  version: 1,
  player: { xp: -500 },
  weapons: { mk7: { xp: 'invalid' } },
  selectedWeapon: 'non_existent_gun'
}));
const mgrSanitized = new ProgressionManager(storage);
assert.strictEqual(mgrSanitized.getPlayerInfo().currentXP, 0);
assert.strictEqual(mgrSanitized.getWeaponInfo('mk7').currentXP, 0);
assert.strictEqual(mgrSanitized.getState().selectedWeapon, 'mk7');

mgrSanitized.reset();
assert.strictEqual(mgrSanitized.getPlayerInfo().currentXP, 0);
assert.strictEqual(mgrSanitized.getState().history.kills, 0);
console.log('PASS: Persistence & corruption recovery');

console.log('\n=======================================');
console.log('ALL 6 UNIT TEST SUITES PASSED (100% OK)');
console.log('=======================================');
