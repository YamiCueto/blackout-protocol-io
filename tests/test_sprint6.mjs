import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const url = `http://127.0.0.1:${port}/index.html?debug&nolock`;
const b = await launch(url);
const results = [];

async function step(num, name, fn) {
  try {
    const detail = await fn();
    results.push({ num, name, ok: true, detail });
    console.log(`PASS [${num}_${name}]`);
  } catch (err) {
    results.push({ num, name, ok: false, err: err.message });
    console.error(`FAIL [${num}_${name}]: ${err.message}`);
  }
}

try {
  await b.navigate(url);
  await b.sleep(3500);

  await b.evaluate(`window.__bp.progression.reset()`);
  await b.sleep(300);

  await step(1, 'create_five_loadouts', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const loadouts = window.__bp.progression.getLoadouts();
      const active = window.__bp.progression.getActiveLoadout();
      return {
        count: loadouts.length,
        ids: loadouts.map(l => l.id),
        activeId: active.id,
        primary: active.primary,
        secondary: active.secondary
      };
    })()`);
    if (res.count !== 5) throw new Error(`Expected 5 loadouts, got ${res.count}`);
    const expectedIds = ['loadout_1', 'loadout_2', 'loadout_3', 'loadout_4', 'loadout_5'];
    for (let i = 0; i < 5; i++) {
      if (res.ids[i] !== expectedIds[i]) throw new Error(`Expected id ${expectedIds[i]}, got ${res.ids[i]}`);
    }
    if (res.activeId !== 'loadout_1') throw new Error(`Expected active loadout_1, got ${res.activeId}`);
    if (res.primary !== 'mk7') throw new Error(`Expected primary mk7, got ${res.primary}`);
    if (res.secondary !== null) throw new Error(`Expected secondary null at level 1, got ${res.secondary}`);
    return res;
  });

  await step(2, 'migration_v1_to_v2', async () => {
    const res = await b.evaluate(`(() => {
      const v1Data = {
        version: 1,
        player: { xp: 1200 },
        weapons: { mk7: { xp: 350 }, vector9: { xp: 100 } },
        selectedWeapon: 'mk7',
        history: { kills: 12, headshots: 4, wavesCleared: 2, sndWins: 1 },
        updatedAt: Date.now() - 10000
      };
      localStorage.setItem('bp_progression_v1', JSON.stringify(v1Data));
      window.__bp.progression.init();
      const state = window.__bp.progression.getState();
      const loadouts = window.__bp.progression.getLoadouts();
      return {
        version: state.version,
        playerXp: state.player.xp,
        mk7Xp: state.weapons.mk7.xp,
        loadoutCount: loadouts.length,
        primary: loadouts[0].primary,
        historyKills: state.history.kills
      };
    })()`);
    if (res.version !== 3) throw new Error(`Expected schema version 3 after migration, got ${res.version}`);
    if (res.playerXp !== 1200) throw new Error(`Expected playerXp 1200, got ${res.playerXp}`);
    if (res.mk7Xp !== 350) throw new Error(`Expected mk7Xp 350, got ${res.mk7Xp}`);
    if (res.loadoutCount !== 5) throw new Error(`Expected 5 loadouts, got ${res.loadoutCount}`);
    if (res.primary !== 'mk7') throw new Error(`Expected primary mk7, got ${res.primary}`);
    if (res.historyKills !== 12) throw new Error(`Expected historyKills 12, got ${res.historyKills}`);
    return res;
  });

  await step(3, 'persistence_reload', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.renameLoadout('loadout_1', 'CLASE ALFA');
      window.__bp.progression.selectLoadout('loadout_2');
      window.__bp.progression.init();
      const active = window.__bp.progression.getActiveLoadout();
      const l1 = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_1');
      return {
        activeId: active.id,
        l1Name: l1 ? l1.name : null
      };
    })()`);
    if (res.activeId !== 'loadout_2') throw new Error(`Expected active loadout_2 after reload, got ${res.activeId}`);
    if (res.l1Name !== 'CLASE ALFA') throw new Error(`Expected loadout_1 name CLASE ALFA, got ${res.l1Name}`);
    return res;
  });

  await step(4, 'rename_loadout', async () => {
    const res = await b.evaluate(`(() => {
      const okValid = window.__bp.progression.renameLoadout('loadout_3', 'RECON TÁCTICO');
      const okEmpty = window.__bp.progression.renameLoadout('loadout_3', '   ');
      const l3 = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_3');
      return { okValid, okEmpty, name: l3 ? l3.name : null };
    })()`);
    if (res.okValid !== true) throw new Error(`Expected true for valid rename, got ${res.okValid}`);
    if (res.okEmpty !== false) throw new Error(`Expected false for empty rename, got ${res.okEmpty}`);
    if (res.name !== 'RECON TÁCTICO') throw new Error(`Expected RECON TÁCTICO, got ${res.name}`);
    return res;
  });

  await step(5, 'primary_slot_valid_weapons', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(10000);
      const okVector = window.__bp.progression.setLoadoutPrimary('loadout_1', 'vector9');
      const okM870 = window.__bp.progression.setLoadoutPrimary('loadout_1', 'm870');
      const okP12 = window.__bp.progression.setLoadoutPrimary('loadout_1', 'p12');
      const okKnife = window.__bp.progression.setLoadoutPrimary('loadout_1', 'knife');
      const curPrimary = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_1').primary;
      return { okVector, okM870, okP12, okKnife, curPrimary };
    })()`);
    if (res.okVector !== true) throw new Error(`Expected true setting vector9 as primary, got ${res.okVector}`);
    if (res.okM870 !== true) throw new Error(`Expected true setting m870 as primary, got ${res.okM870}`);
    if (res.okP12 !== false) throw new Error(`Expected false setting p12 as primary, got ${res.okP12}`);
    if (res.okKnife !== false) throw new Error(`Expected false setting knife as primary, got ${res.okKnife}`);
    if (res.curPrimary !== 'm870') throw new Error(`Expected current primary m870, got ${res.curPrimary}`);
    return res;
  });

  await step(6, 'secondary_slot_locked_at_lvl_1', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const okP12 = window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      const curSecondary = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_1').secondary;
      return { okP12, curSecondary };
    })()`);
    if (res.okP12 !== false) throw new Error(`Expected false setting locked p12 as secondary, got ${res.okP12}`);
    if (res.curSecondary !== null) throw new Error(`Expected secondary null, got ${res.curSecondary}`);
    return res;
  });

  await step(7, 'p12_unlocks_at_lvl_2', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const beforeLvl = window.__bp.progression.getPlayerInfo().level;
      const beforeUnlock = window.__bp.progression.isWeaponUnlocked('p12');
      window.__bp.progression.grantPlayerXP(500);
      const afterLvl = window.__bp.progression.getPlayerInfo().level;
      const afterUnlock = window.__bp.progression.isWeaponUnlocked('p12');
      const okSet = window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      const curSec = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_1').secondary;
      return { beforeLvl, beforeUnlock, afterLvl, afterUnlock, okSet, curSec };
    })()`);
    if (res.beforeLvl !== 1) throw new Error(`Expected before level 1, got ${res.beforeLvl}`);
    if (res.beforeUnlock !== false) throw new Error(`Expected p12 locked before, got ${res.beforeUnlock}`);
    if (res.afterLvl !== 2) throw new Error(`Expected level 2 after 500 XP, got ${res.afterLvl}`);
    if (res.afterUnlock !== true) throw new Error(`Expected p12 unlocked at level 2, got ${res.afterUnlock}`);
    if (res.okSet !== true) throw new Error(`Expected okSet true, got ${res.okSet}`);
    if (res.curSec !== 'p12') throw new Error(`Expected curSec p12, got ${res.curSec}`);
    return res;
  });

  await step(8, 'p12_semi_automatic_behavior', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.startGame('waves');
      window.__bp.switchWeaponSlot('secondary');
    })()`);
    await b.sleep(450);

    const res = await b.evaluate(`(() => {
      let switchSafety = 0;
      while (window.__bp.combatSession.switching && switchSafety++ < 50) window.__bp.stepSim(0.016);
      const isSwitching = window.__bp.combatSession.switching;
      const weaponId = window.__bp.weapon.id;
      const activeSlot = window.__bp.combatSession.activeSlot;
      window.__bp.weapon.cooldown = 0;
      window.__bp.weapon.semiFired = false;

      window.__bp.shoot();
      const ammoAfterFirst = window.__bp.weapon.ammo;
      const semiFiredFirst = window.__bp.weapon.semiFired;

      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();
      const ammoAfterSecondWithoutRelease = window.__bp.weapon.ammo;

      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();
      const ammoAfterReleaseAndThird = window.__bp.weapon.ammo;

      window.__bp.backToMenu();
      return {
        isSwitching,
        weaponId,
        activeSlot,
        ammoAfterFirst,
        semiFiredFirst,
        ammoAfterSecondWithoutRelease,
        ammoAfterReleaseAndThird
      };
    })()`);
    if (res.isSwitching) throw new Error('Weapon switch failed to complete within safety limit');
    if (res.weaponId !== 'p12' || res.activeSlot !== 'secondary') throw new Error(`Expected secondary p12 active, got ${res.activeSlot} ${res.weaponId}`);
    if (res.ammoAfterFirst !== 11) throw new Error(`Expected ammo 11 after first shot, got ${res.ammoAfterFirst}`);
    if (res.semiFiredFirst !== true) throw new Error(`Expected semiFired true, got ${res.semiFiredFirst}`);
    if (res.ammoAfterSecondWithoutRelease !== 11) throw new Error(`Semi-auto failed: fired without release, ammo: ${res.ammoAfterSecondWithoutRelease}`);
    if (res.ammoAfterReleaseAndThird !== 10) throw new Error(`Expected ammo 10 after trigger release, got ${res.ammoAfterReleaseAndThird}`);
    return res;
  });

  await step(9, 'combat_switch_primary_secondary', async () => {
    const startState = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.startGame('waves');
      const initialSlot = window.__bp.combatSession.activeSlot;
      const initialWeapon = window.__bp.weapon.id;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
      const switchingAfter2 = window.__bp.combatSession.switching;
      const targetAfter2 = window.__bp.combatSession.targetSlot;
      return { initialSlot, initialWeapon, switchingAfter2, targetAfter2 };
    })()`);

    await b.sleep(450);

    const midState = await b.evaluate(`(() => {
      const midSlot = window.__bp.combatSession.activeSlot;
      const midWeapon = window.__bp.weapon.id;
      const midSwitching = window.__bp.combatSession.switching;
      const badgeText = document.getElementById('weapon-slot-badge').textContent;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
      return { midSlot, midWeapon, midSwitching, badgeText };
    })()`);

    await b.sleep(450);

    const endState = await b.evaluate(`(() => {
      const finalSlot = window.__bp.combatSession.activeSlot;
      const finalWeapon = window.__bp.weapon.id;
      const badgeText = document.getElementById('weapon-slot-badge').textContent;
      window.__bp.backToMenu();
      return { finalSlot, finalWeapon, badgeText };
    })()`);

    if (startState.initialSlot !== 'primary' || startState.initialWeapon !== 'mk7') throw new Error(`Expected initial primary mk7`);
    if (startState.switchingAfter2 !== true || startState.targetAfter2 !== 'secondary') throw new Error(`Expected switch triggered to secondary`);
    if (midState.midSlot !== 'secondary' || midState.midWeapon !== 'p12' || midState.midSwitching !== false) throw new Error(`Expected midSlot secondary p12 finished`);
    if (!midState.badgeText.includes('SECUNDARIA')) throw new Error(`Expected HUD badge SECUNDARIA, got ${midState.badgeText}`);
    if (endState.finalSlot !== 'primary' || endState.finalWeapon !== 'mk7') throw new Error(`Expected finalSlot primary mk7`);
    if (!endState.badgeText.includes('PRINCIPAL')) throw new Error(`Expected HUD badge PRINCIPAL, got ${endState.badgeText}`);
    return { startState, midState, endState };
  });

  await step(10, 'switch_cancels_reload_safely', async () => {
    const pre = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.startGame('waves');

      window.__bp.weapon.ammo = 25;
      window.__bp.combatSession.slots.primary.ammo = 25;
      window.__bp.tryReload();
      const isReloading = window.__bp.weapon.reloading;
      window.__bp.switchWeaponSlot('secondary');
      const reloadCancelledImmediately = !window.__bp.weapon.reloading;
      return { isReloading, reloadCancelledImmediately };
    })()`);

    await b.sleep(450);
    await b.evaluate(`window.__bp.switchWeaponSlot('primary')`);
    await b.sleep(450);

    const post = await b.evaluate(`(() => {
      const finalPrimaryAmmo = window.__bp.weapon.ammo;
      const stillReloading = window.__bp.weapon.reloading;
      window.__bp.backToMenu();
      return { finalPrimaryAmmo, stillReloading };
    })()`);

    if (pre.isReloading !== true) throw new Error(`Expected isReloading true before switch`);
    if (pre.reloadCancelledImmediately !== true) throw new Error(`Expected reloadCancelledImmediately true`);
    if (post.finalPrimaryAmmo !== 25) throw new Error(`Expected primary ammo 25 without free reload, got ${post.finalPrimaryAmmo}`);
    if (post.stillReloading !== false) throw new Error(`Expected reloading false on return`);
    return { pre, post };
  });

  await step(11, 'independent_ammo_retention', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.startGame('waves');
      for (let i = 0; i < 5; i++) {
        window.__bp.weapon.cooldown = 0;
        window.__bp.shoot();
      }
      window.__bp.switchWeaponSlot('secondary');
    })()`);
    await b.sleep(450);

    await b.evaluate(`(() => {
      for (let i = 0; i < 3; i++) {
        window.__bp.weapon.cooldown = 0;
        window.__bp.weapon.semiFired = false;
        window.__bp.shoot();
      }
      window.__bp.switchWeaponSlot('primary');
    })()`);
    await b.sleep(450);

    const primCheck = await b.evaluate(`(() => {
      const primAmmo = window.__bp.weapon.ammo;
      const secPreviewAmmo = document.getElementById('sec-slot-ammo').textContent;
      window.__bp.switchWeaponSlot('secondary');
      return { primAmmo, secPreviewAmmo };
    })()`);
    await b.sleep(450);

    const secCheck = await b.evaluate(`(() => {
      const secAmmo = window.__bp.weapon.ammo;
      window.__bp.backToMenu();
      return { secAmmo };
    })()`);

    if (primCheck.primAmmo !== 25) throw new Error(`Expected primary ammo 25, got ${primCheck.primAmmo}`);
    if (secCheck.secAmmo !== 9) throw new Error(`Expected secondary ammo 9, got ${secCheck.secAmmo}`);
    if (!primCheck.secPreviewAmmo.startsWith('9')) throw new Error(`Expected preview ammo 9 / ..., got ${primCheck.secPreviewAmmo}`);
    return { primCheck, secCheck };
  });

  await step(12, 'independent_cooldowns', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');

      window.__bp.shoot();
      const cdPrimary = window.__bp.weapon.cooldown;
      window.__bp.switchWeaponSlot('secondary');
      const slotPrimCd = window.__bp.combatSession.slots.primary.cooldown;
      const isSwitching = window.__bp.combatSession.switching;

      window.__bp.backToMenu();
      return { cdPrimary, slotPrimCd, isSwitching };
    })()`);
    if (res.cdPrimary <= 0) throw new Error(`Expected cooldown > 0 after shoot, got ${res.cdPrimary}`);
    if (res.slotPrimCd <= 0) throw new Error(`Expected saved primary cooldown > 0, got ${res.slotPrimCd}`);
    if (res.isSwitching !== true) throw new Error(`Expected isSwitching true`);
    return res;
  });

  await step(13, 'switch_cancels_ads', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');

      window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
      const adsBefore = window.__bp.getAdsState();
      window.__bp.switchWeaponSlot('secondary');
      const adsAfter = window.__bp.getAdsState();

      window.__bp.backToMenu();
      return { adsBefore, adsAfter };
    })()`);
    if (res.adsBefore.adsDown !== true) throw new Error(`Expected adsDown true before switch`);
    if (res.adsAfter.adsDown !== false || res.adsAfter.adsAmount !== 0) throw new Error(`Expected ADS cancelled on switch, got ${JSON.stringify(res.adsAfter)}`);
    return res;
  });

  await step(14, 'block_fire_during_switch', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');

      const ammoBefore = window.__bp.weapon.ammo;
      window.__bp.switchWeaponSlot('secondary');
      window.__bp.shoot();
      const ammoDuringSwitch = window.__bp.weapon.ammo;

      window.__bp.backToMenu();
      return { ammoBefore, ammoDuringSwitch };
    })()`);
    if (res.ammoBefore !== res.ammoDuringSwitch) throw new Error(`Fired during switch: before ${res.ammoBefore}, during ${res.ammoDuringSwitch}`);
    return res;
  });

  await step(15, 'prohibit_switch_in_pause', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');

      window.__bp.pause();
      const pausePhase = window.__bp.snapshot().phase;
      const switchInPause = window.__bp.switchWeaponSlot('secondary');
      window.__bp.resumeGame();
      const switchInPlay = window.__bp.switchWeaponSlot('secondary');

      window.__bp.backToMenu();
      return { pausePhase, switchInPause, switchInPlay };
    })()`);
    if (res.pausePhase !== 'PAUSED') throw new Error(`Expected PAUSED phase, got ${res.pausePhase}`);
    if (res.switchInPause !== false) throw new Error(`Expected switchInPause false, got ${res.switchInPause}`);
    if (res.switchInPlay !== true) throw new Error(`Expected switchInPlay true, got ${res.switchInPlay}`);
    return res;
  });

  await step(16, 'prohibit_switch_on_death', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');

      window.__bp.killPlayer();
      const switchOnDeath = window.__bp.switchWeaponSlot('secondary');

      window.__bp.backToMenu();
      return { switchOnDeath };
    })()`);
    if (res.switchOnDeath !== false) throw new Error(`Expected switchOnDeath false, got ${res.switchOnDeath}`);
    return res;
  });

  await step(17, 'xp_attributed_to_firing_weapon', async () => {
    const baseXp = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      const mk7Before = window.__bp.progression.getWeaponInfo('mk7').xp;
      const p12Before = window.__bp.progression.getWeaponInfo('p12').xp;
      window.__bp.startGame('waves');
      return { mk7Before, p12Before };
    })()`);

    await b.sleep(3000);

    const afterPrim = await b.evaluate(`(() => {
      window.__bp.killAllEnemies();
      const mk7AfterPrim = window.__bp.progression.getWeaponInfo('mk7').xp;
      const p12AfterPrim = window.__bp.progression.getWeaponInfo('p12').xp;
      window.__bp.startGame('waves');
      window.__bp.switchWeaponSlot('secondary');
      return { mk7AfterPrim, p12AfterPrim };
    })()`);

    await b.sleep(3000);

    const afterSec = await b.evaluate(`(() => {
      const slot = window.__bp.combatSession.activeSlot;
      const wId = window.__bp.weapon.id;
      window.__bp.killAllEnemies();
      const mk7AfterSec = window.__bp.progression.getWeaponInfo('mk7').xp;
      const p12AfterSec = window.__bp.progression.getWeaponInfo('p12').xp;
      window.__bp.backToMenu();
      return { slot, wId, mk7AfterSec, p12AfterSec };
    })()`);

    if (afterPrim.mk7AfterPrim <= baseXp.mk7Before) throw new Error(`Expected mk7 XP increase on primary kill (${baseXp.mk7Before} -> ${afterPrim.mk7AfterPrim})`);
    if (afterPrim.p12AfterPrim !== baseXp.p12Before) throw new Error(`Expected p12 XP unchanged on primary kill`);
    if (afterSec.slot !== 'secondary' || afterSec.wId !== 'p12') throw new Error(`Expected secondary p12 active before second wave kill`);
    if (afterSec.p12AfterSec <= afterPrim.p12AfterPrim) throw new Error(`Expected p12 XP increase on secondary kill (${afterPrim.p12AfterPrim} -> ${afterSec.p12AfterSec})`);
    if (afterSec.mk7AfterSec !== afterPrim.mk7AfterPrim) throw new Error(`Expected mk7 XP unchanged on secondary kill`);
    return { baseXp, afterPrim, afterSec };
  });

  await step(18, 'lobby_operator_weapon_sync', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(5000);
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.selectLoadout('loadout_1');
      const lobbyW1 = window.__bp.getLobbyWeaponId();

      window.__bp.progression.setLoadoutPrimary('loadout_2', 'vector9');
      window.__bp.progression.selectLoadout('loadout_2');
      const lobbyW2 = window.__bp.getLobbyWeaponId();

      window.__bp.progression.selectLoadout('loadout_1');
      return { lobbyW1, lobbyW2 };
    })()`);
    if (res.lobbyW1 !== 'mk7') throw new Error(`Expected lobby weapon mk7, got ${res.lobbyW1}`);
    if (res.lobbyW2 !== 'vector9') throw new Error(`Expected lobby weapon vector9, got ${res.lobbyW2}`);
    return res;
  });

  await step(19, 'ten_weapon_swaps_memory_stability', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');
    })()`);
    await b.sleep(200);

    const combatBefore = await b.evaluate(`window.__bp.snapshot()`);

    for (let i = 0; i < 4; i++) {
      const target = i % 2 === 0 ? 'secondary' : 'primary';
      await b.evaluate(`window.__bp.switchWeaponSlot('${target}')`);
      await b.sleep(400);
    }

    const combatMid = await b.evaluate(`window.__bp.snapshot()`);

    await b.evaluate(`(() => {
      for (let i = 0; i < 20; i++) {
        window.__bp.setWeapon(i % 2 === 0 ? 'p12' : 'mk7', { preserveState: true });
      }
    })()`);
    await b.sleep(100);
    const combatEnd = await b.evaluate(`window.__bp.snapshot()`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(200);
    const menu1 = await b.evaluate(`window.__bp.snapshot()`);

    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(200);
    await b.evaluate(`window.__bp.switchWeaponSlot('secondary')`);
    await b.sleep(400);
    await b.evaluate(`window.__bp.switchWeaponSlot('primary')`);
    await b.sleep(400);
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(200);
    const menu2 = await b.evaluate(`window.__bp.snapshot()`);

    if (combatMid.geometries > combatBefore.geometries) throw new Error(`Geometries leaked during timed swaps: ${combatBefore.geometries} -> ${combatMid.geometries}`);
    if (combatEnd.geometries > combatBefore.geometries) throw new Error(`Geometries leaked during 20 swaps: ${combatBefore.geometries} -> ${combatEnd.geometries}`);
    if (combatEnd.textures > combatBefore.textures) throw new Error(`Textures leaked during combat swaps: ${combatBefore.textures} -> ${combatEnd.textures}`);
    if (menu2.geometries > menu1.geometries) throw new Error(`Menu geometries leaked between cycles: ${menu1.geometries} -> ${menu2.geometries}`);
    if (menu2.textures > menu1.textures) throw new Error(`Menu textures leaked between cycles: ${menu1.textures} -> ${menu2.textures}`);
    return {
      combatGeo: `${combatBefore.geometries}->${combatMid.geometries}->${combatEnd.geometries}`,
      menuGeo: `${menu1.geometries}->${menu2.geometries}`,
      tex: `${combatBefore.textures}->${combatEnd.textures}`
    };
  });

  await step(20, 'waves_mode_regression', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('waves');
    })()`);
    const p1 = await b.evaluate(`window.__bp.snapshot().phase`);
    await b.sleep(3000);
    await b.evaluate(`window.__bp.killAllEnemies()`);
    await b.sleep(400);
    const pSummary = await b.evaluate(`window.__bp.snapshot().phase`);
    await b.evaluate(`window.__bp.backToMenu()`);
    const p2 = await b.evaluate(`window.__bp.snapshot().phase`);

    if (p1 !== 'PLAYING') throw new Error(`Expected phase PLAYING, got ${p1}`);
    if (pSummary !== 'SUMMARY') throw new Error(`Expected phase SUMMARY after clearing wave, got ${pSummary}`);
    if (p2 !== 'MENU') throw new Error(`Expected phase MENU, got ${p2}`);
    return { p1, pSummary, p2 };
  });

  await step(21, 'snd_mode_regression', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.startGame('snd');
    })()`);
    const check1 = await b.evaluate(`({
      phase: window.__bp.snapshot().phase,
      mode: window.__bp.snapshot().mode,
      secReserve: window.__bp.combatSession.slots.secondary.reserve,
      expectedReserve: window.__bp.WEAPONS.p12.reserveSnd
    })`);
    await b.evaluate(`window.__bp.setSndTime(0.05)`);
    await b.sleep(2000);
    const check2 = await b.evaluate(`window.__bp.snapshot().phase`);
    await b.evaluate(`window.__bp.backToMenu()`);
    const check3 = await b.evaluate(`window.__bp.snapshot().phase`);

    if (check1.phase !== 'PLAYING' || check1.mode !== 'snd') throw new Error(`Expected PLAYING snd, got ${JSON.stringify(check1)}`);
    if (check1.secReserve !== check1.expectedReserve) throw new Error(`Expected reserveSnd ${check1.expectedReserve}, got ${check1.secReserve}`);
    if (check2 !== 'RESULTS') throw new Error(`Expected RESULTS after bomb detonation, got ${check2}`);
    if (check3 !== 'MENU') throw new Error(`Expected MENU after quit, got ${check3}`);
    return { check1, check2, check3 };
  });

  await step(22, 'zero_javascript_errors', async () => {
    const errCount = b.errors ? b.errors.length : 0;
    if (errCount > 0) throw new Error(`Encountered ${errCount} uncaught JavaScript errors: ${JSON.stringify(b.errors)}`);
    return { errCount };
  });

} catch (e) {
  console.log('CRITICAL SUITE ERROR:', e.message);
} finally {
  await b.close();
  srv.close();
}

console.log('\n--- RESUMEN SPRINT 6 ---');
console.log(`Total steps: ${results.length}`);
console.log(`Passed: ${results.filter(r => r.ok).length}`);
console.log(`Failed: ${results.filter(r => !r.ok).length}`);

if (results.some(r => !r.ok)) {
  process.exit(1);
}
