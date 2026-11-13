import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, ROOT } from './harness.mjs';

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

async function capturePng(relPath, width, height) {
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await b.sleep(450);
  const res = await b.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
  return outPath;
}

try {
  await b.navigate(url);
  await b.sleep(3000);

  await step(1, 'catalog_declarative_contracts_and_rules', async () => {
    const res = await b.evaluate(`(() => {
      const s = window.__bp.supplies;
      const cat = s.catalog;
      return {
        keys: Object.keys(cat),
        ammo: { ...cat.ammo_pack },
        medkit: { ...cat.medkit },
        stim: { ...cat.stim }
      };
    })()`);
    if (!res.keys.includes('ammo_pack') || !res.keys.includes('medkit') || !res.keys.includes('stim')) {
      throw new Error(`Catalog missing required supplies: ${JSON.stringify(res.keys)}`);
    }
    if (res.ammo.kind !== 'ammo' || res.medkit.kind !== 'consumable' || res.stim.kind !== 'consumable') {
      throw new Error(`Supply kinds mismatch: ${JSON.stringify(res)}`);
    }
    if (res.medkit.maxCarry !== 2 || res.stim.maxCarry !== 2 || res.medkit.healAmount !== 50 || res.stim.instantHeal !== 20) {
      throw new Error(`Supply constants mismatch: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(2, 'deterministic_drop_prng_and_chances', async () => {
    const res = await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      dm.setMode('waves');
      dm.setWave(1);

      const fakePos = { x: 0, z: 0 };
      const deterministicPicks = [];
      const fixedRolls = [0.05, 0.28, 0.40, 0.95];

      for (let i = 0; i < fixedRolls.length; i++) {
        const roll = fixedRolls[i];
        const spawned = dm.onEnemyKilled(fakePos, { rng: () => roll });
        deterministicPicks.push(spawned ? spawned.supplyId : 'none');
      }

      dm.clear();
      return deterministicPicks;
    })()`);
    if (res[0] !== 'ammo_pack' || res[1] !== 'medkit' || res[2] !== 'stim' || res[3] !== 'none') {
      throw new Error(`Deterministic PRNG roll sequence failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(3, 'spatial_collision_validation_and_fallback', async () => {
    const res = await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      const blockedInsideBuilding = dm.resolveValidPosition(-34, -30, 0.55);
      const wayOutsideArena = dm.resolveValidPosition(120, 150, 0.55);
      const freeCenter = dm.resolveValidPosition(0, 0, 0.55);
      return { blockedInsideBuilding, wayOutsideArena, freeCenter };
    })()`);
    if (res.blockedInsideBuilding.x === -34 && res.blockedInsideBuilding.z === -30) {
      throw new Error(`Drop position did not evade solid building: ${JSON.stringify(res.blockedInsideBuilding)}`);
    }
    if (Math.abs(res.wayOutsideArena.x) > 56 || Math.abs(res.wayOutsideArena.z) > 56) {
      throw new Error(`Drop position did not clamp to arena bounds: ${JSON.stringify(res.wayOutsideArena)}`);
    }
    if (Math.abs(res.freeCenter.x) > 0.1 || Math.abs(res.freeCenter.z) > 0.1) {
      throw new Error(`Free center position was unexpectedly displaced: ${JSON.stringify(res.freeCenter)}`);
    }
    return res;
  });

  await step(4, 'max_active_drops_enforcement', async () => {
    const res = await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      dm.setMode('waves');
      for (let i = 0; i < 15; i++) {
        dm.spawnDrop('ammo_pack', i * 2 - 10, 0);
      }
      const countWaves = dm.getDrops().length;

      dm.clear();
      dm.setMode('snd');
      for (let i = 0; i < 10; i++) {
        dm.spawnDrop('ammo_pack', i * 2 - 10, 0);
      }
      const countSnd = dm.getDrops().length;
      dm.clear();
      return { countWaves, countSnd };
    })()`);
    if (res.countWaves > 8 || res.countSnd > 3) {
      throw new Error(`Max active drops violated: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(5, 'drop_ttl_and_simulated_time_expiration', async () => {
    const res = await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      const d1 = dm.spawnDrop('ammo_pack', 5, 5, { ttl: 10 });
      const d2 = dm.spawnDrop('medkit', 10, 10, { ttl: 20 });
      dm.update(5);
      const after5 = { len: dm.getDrops().length, ages: dm.getDrops().map(d => d.age) };
      const exp1 = dm.update(6);
      const after11 = { len: dm.getDrops().length, expired: exp1.expiredIds };
      dm.clear();
      return { after5, after11 };
    })()`);
    if (res.after5.len !== 2 || res.after11.len !== 1 || !res.after11.expired.length) {
      throw new Error(`Simulated drop TTL expiration failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(6, 'pause_stops_simulated_timers', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(300);
    const dropBefore = await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      const d = dm.spawnDrop('ammo_pack', 0, 10, { ttl: 25 });
      window.__bp.supplies.consumablesState.activeUse.type = 'medkit';
      window.__bp.supplies.consumablesState.activeUse.elapsed = 0.5;
      window.__bp.supplies.consumablesState.activeUse.duration = 1.8;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      return { age: d.age, medkitElapsed: window.__bp.supplies.consumablesState.activeUse.elapsed };
    })()`);
    await b.sleep(400);
    const dropAfter = await b.evaluate(`(() => {
      const d = window.__bp.supplies.dropsManager.getDrops()[0];
      return {
        age: d ? d.age : -1,
        medkitElapsed: window.__bp.supplies.consumablesState.activeUse.elapsed
      };
    })()`);
    await b.evaluate(`(() => {
      document.getElementById('resume-btn').click();
      window.__bp.supplies.consumablesState.activeUse.type = null;
    })()`);
    await b.sleep(200);
    if (dropAfter.age !== dropBefore.age || dropAfter.medkitElapsed !== dropBefore.medkitElapsed) {
      throw new Error(`Timers advanced while paused: before=${JSON.stringify(dropBefore)}, after=${JSON.stringify(dropAfter)}`);
    }
    return { dropBefore, dropAfter };
  });

  await step(7, 'pickup_interaction_distance_threshold', async () => {
    await b.evaluate(`(() => {
      window.__bp.supplies.dropsManager.clear();
      window.__bp.supplies.consumablesState.inventory.medkit = 0;
      window.__bp.supplies.dropsManager.spawnDrop('medkit', 100, 100);
    })()`);
    await b.sleep(150);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.sleep(150);
    const farCount = await b.evaluate(`window.__bp.supplies.consumablesState.inventory.medkit`);

    await b.evaluate(`(() => {
      window.__bp.supplies.dropsManager.clear();
      window.__bp.supplies.dropsManager.spawnDrop('medkit', 0, 40);
    })()`);
    await b.sleep(150);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.sleep(150);
    const nearCount = await b.evaluate(`window.__bp.supplies.consumablesState.inventory.medkit`);

    if (farCount !== 0 || nearCount !== 1) {
      throw new Error(`Distance threshold pickup failed: far=${farCount}, near=${nearCount}`);
    }
    return { farCount, nearCount };
  });

  await step(8, 'ammo_auto_pickup_threshold', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.combatSession.slots.primary.reserve = 20;
      window.__bp.weapon.reserve = 20;
      window.__bp.supplies.dropsManager.clear();
      const drop = window.__bp.supplies.dropsManager.spawnDrop('ammo_pack', 0, 40.5);
      return {
        dropId: drop.id,
        beforeReserve: window.__bp.combatSession.slots.primary.reserve
      };
    })()`);
    await b.sleep(300);
    const after = await b.evaluate(`(() => ({
      afterReserve: window.__bp.combatSession.slots.primary.reserve,
      remainingDrops: window.__bp.supplies.dropsManager.getDrops().length
    }))()`);
    if (after.afterReserve <= res.beforeReserve || after.remainingDrops !== 0) {
      throw new Error(`Ammo auto pickup did not trigger: before=${JSON.stringify(res)}, after=${JSON.stringify(after)}`);
    }
    return { before: res, after };
  });

  await step(9, 'inventory_limits_enforcement', async () => {
    const res = await b.evaluate(`(() => {
      const s = window.__bp.supplies.consumablesState;
      s.inventory.medkit = 2;
      s.inventory.stim = 2;
      window.__bp.supplies.dropsManager.clear();
      window.__bp.supplies.dropsManager.spawnDrop('medkit', 0, 40);
      return {
        medkitCanAdd: window.__bp.supplies.consumablesState.inventory.medkit >= 2
      };
    })()`);
    await b.sleep(150);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
    await b.sleep(150);
    const check = await b.evaluate(`(() => ({
      medkitCount: window.__bp.supplies.consumablesState.inventory.medkit,
      remainingDrops: window.__bp.supplies.dropsManager.getDrops().length,
      promptText: document.getElementById('pickup-prompt')?.textContent || ''
    }))()`);
    if (check.medkitCount > 2 || check.remainingDrops !== 1 || !check.promptText.includes('LLENO')) {
      throw new Error(`Inventory limit enforcement failed: ${JSON.stringify(check)}`);
    }
    return check;
  });

  await step(10, 'reserve_caps_and_no_duplication', async () => {
    const res = await b.evaluate(`(() => {
      const maxRes = window.__bp.supplies.getSlotMaxReserve('primary');
      window.__bp.combatSession.slots.primary.reserve = maxRes - 5;
      window.__bp.weapon.reserve = maxRes - 5;
      const initialAmmo = window.__bp.weapon.ammo;

      const fillRes = window.__bp.supplies.refillSlotReserve('primary', 50);
      const afterRes = window.__bp.combatSession.slots.primary.reserve;
      const afterAmmo = window.__bp.weapon.ammo;
      return { maxRes, fillRes, afterRes, initialAmmo, afterAmmo };
    })()`);
    if (res.fillRes.added !== 5 || res.afterRes !== res.maxRes || res.initialAmmo !== res.afterAmmo) {
      throw new Error(`Reserve cap violated or chamber ammo duplicated: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(11, 'ammo_pickup_during_weapon_switch', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.combatSession.slots.secondary.id = 'p12';
      window.__bp.combatSession.slots.secondary.ammo = 15;
      window.__bp.combatSession.slots.secondary.reserve = 10;
      window.__bp.switchWeaponSlot('secondary');
      const isSwitching = window.__bp.combatSession.switching;
      const beforeSecReserve = window.__bp.combatSession.slots.secondary.reserve;
      const refillRes = window.__bp.supplies.refillSlotReserve('secondary', 15);
      return { isSwitching, beforeSecReserve, refillRes };
    })()`);
    await b.sleep(450);
    const afterSwitch = await b.evaluate(`(() => ({
      activeSlot: window.__bp.combatSession.activeSlot,
      weaponReserve: window.__bp.weapon.reserve,
      slotReserve: window.__bp.combatSession.slots.secondary.reserve
    }))()`);
    if (!res.isSwitching || afterSwitch.activeSlot !== 'secondary' || afterSwitch.weaponReserve !== afterSwitch.slotReserve) {
      throw new Error(`Ammo pickup during weapon switch failed: ${JSON.stringify({ res, afterSwitch })}`);
    }
    return { res, afterSwitch };
  });

  await step(12, 'm870_shell_reload_interruption_immunity_with_refill', async () => {
    await b.evaluate(`window.__bp.switchWeaponSlot('primary')`);
    await b.sleep(450);
    const res = await b.evaluate(`(() => {
      window.__bp.setWeapon('m870');
      window.__bp.combatSession.slots.primary.id = 'm870';
      window.__bp.weapon.ammo = 2;
      window.__bp.weapon.reserve = 5;
      window.__bp.combatSession.slots.primary.ammo = 2;
      window.__bp.combatSession.slots.primary.reserve = 5;
      window.__bp.tryReload();
      const isReloading = window.__bp.weapon.reloading;
      const stage = window.__bp.weapon.reloadStage;
      window.__bp.supplies.refillSlotReserve('primary', 10);
      return {
        activeSlot: window.__bp.combatSession.activeSlot,
        isReloading,
        stage,
        reserveAfterRefill: window.__bp.weapon.reserve,
        stillReloading: window.__bp.weapon.reloading
      };
    })()`);
    if (!res.isReloading || !res.stillReloading || res.reserveAfterRefill < 10) {
      throw new Error(`M870 reload interrupted by ammo refill: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(13, 'absolute_ammo_exhaustion_emergency_drop', async () => {
    await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.supplies.dropsManager.clear();
      window.__bp.combatSession.slots.primary.ammo = 0;
      window.__bp.combatSession.slots.primary.reserve = 0;
      window.__bp.combatSession.slots.secondary.ammo = 0;
      window.__bp.combatSession.slots.secondary.reserve = 0;
      window.__bp.weapon.ammo = 0;
      window.__bp.weapon.reserve = 0;
    })()`);
    await b.sleep(300);
    const dropCheck = await b.evaluate(`(() => {
      const drops = window.__bp.supplies.dropsManager.getDrops();
      const emergency = drops.find(d => d.isEmergency);
      return {
        dropCount: drops.length,
        hasEmergency: !!emergency,
        emergencySupplyId: emergency ? emergency.supplyId : null
      };
    })()`);
    if (!dropCheck.hasEmergency || dropCheck.emergencySupplyId !== 'ammo_pack') {
      throw new Error(`Emergency ammo drop failed to deploy on total exhaustion: ${JSON.stringify(dropCheck)}`);
    }
    return dropCheck;
  });

  await step(14, 'medkit_channeling_healing_and_cancellation', async () => {
    const cancelTest = await b.evaluate(`(() => {
      window.__bp.setPlayerHp(35);
      const s = window.__bp.supplies.consumablesState;
      s.inventory.medkit = 1;
      const startRes = window.__bp.supplies.startMedkitUse();
      const inProgress = s.activeUse.type === 'medkit';
      window.__bp.supplies.cancelMedkitUse();
      return {
        startRes,
        inProgress,
        cancelledType: s.activeUse.type,
        inventoryRetained: s.inventory.medkit
      };
    })()`);
    if (!cancelTest.inProgress || cancelTest.cancelledType !== null || cancelTest.inventoryRetained !== 1) {
      throw new Error(`Medkit cancellation failed: ${JSON.stringify(cancelTest)}`);
    }

    const completeTest = await b.evaluate(`(() => {
      window.__bp.setPlayerHp(40);
      window.__bp.supplies.startMedkitUse();
      window.__bp.supplies.consumablesState.activeUse.elapsed = 1.85;
      return {
        beforeHp: window.__bp.getPlayerHp(),
        invBefore: window.__bp.supplies.consumablesState.inventory.medkit
      };
    })()`);
    await b.sleep(250);
    const finalHp = await b.evaluate(`(() => ({
      hp: window.__bp.getPlayerHp(),
      inv: window.__bp.supplies.consumablesState.inventory.medkit
    }))()`);
    if (finalHp.hp < 80 || finalHp.inv !== 0) {
      throw new Error(`Medkit completion healing failed: ${JSON.stringify({ completeTest, finalHp })}`);
    }
    return { cancelTest, finalHp };
  });

  await step(15, 'stim_activation_speed_buff_and_cooldown', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.setPlayerHp(60);
      const s = window.__bp.supplies.consumablesState;
      s.inventory.stim = 1;
      s.stim.active = false;
      s.stim.cooldownRemaining = 0;
      const useRes = window.__bp.supplies.useStim();
      return {
        useRes,
        hpAfterStim: window.__bp.getPlayerHp(),
        isActive: s.stim.active,
        inventoryLeft: s.inventory.stim
      };
    })()`);
    if (!res.isActive || res.hpAfterStim !== 80 || res.inventoryLeft !== 0) {
      throw new Error(`Stim activation failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(16, 'death_and_restart_cleanup_isolation', async () => {
    const res = await b.evaluate(`(() => {
      const s = window.__bp.supplies.consumablesState;
      s.inventory.medkit = 2;
      s.inventory.stim = 2;
      window.__bp.supplies.dropsManager.spawnDrop('medkit', 0, 40);
      window.__bp.killPlayer();
      const inDeath = {
        medkitAction: s.activeUse.type,
        alive: false
      };
      window.__bp.startGame('waves');
      const inRestart = {
        invMedkit: s.inventory.medkit,
        invStim: s.inventory.stim,
        dropsLen: window.__bp.supplies.dropsManager.getDrops().length
      };
      return { inDeath, inRestart };
    })()`);
    if (res.inRestart.invMedkit !== 0 || res.inRestart.dropsLen !== 0) {
      throw new Error(`Restart cleanup failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(17, 'back_to_menu_and_mode_switch_isolation', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.supplies.dropsManager.spawnDrop('ammo_pack', 0, 40);
      const visualCountBefore = window.__bp.supplies.getActiveDropVisualCount();
      window.__bp.backToMenu();
      const visualCountAfter = window.__bp.supplies.getActiveDropVisualCount();
      const dropsCountAfter = window.__bp.supplies.dropsManager.getDrops().length;
      return { visualCountBefore, visualCountAfter, dropsCountAfter };
    })()`);
    if (res.visualCountAfter !== 0 || res.dropsCountAfter !== 0) {
      throw new Error(`Menu transition left lingering drop meshes: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(18, 'snd_restrictive_economy_and_prohibitions', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('snd');
      const dm = window.__bp.supplies.dropsManager;
      dm.clear();
      const fakePos = { x: 0, z: 0 };
      const dropsList = [];
      for (let i = 0; i < 50; i++) {
        const d = dm.onEnemyKilled(fakePos, { rng: () => (i % 2 === 0 ? 0.05 : 0.95) });
        if (d) dropsList.push(d.supplyId);
      }
      const em = dm.checkEmergencyAmmo({ x: 0, y: 0, z: 0 }, true);
      const hasMedkitOrStim = dropsList.some(k => k === 'medkit' || k === 'stim');
      return {
        dropsListLen: dropsList.length,
        hasMedkitOrStim,
        hasEmergencyInSnd: !!em
      };
    })()`);
    if (res.hasMedkitOrStim || res.hasEmergencyInSnd) {
      throw new Error(`S&D mode allowed forbidden supplies: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(19, 'webgl_shared_geometries_and_leak_free_memory', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(300);
    await b.evaluate(`(() => {
      const dm = window.__bp.supplies.dropsManager;
      dm.spawnDrop('ammo_pack', 0, 40);
      dm.spawnDrop('medkit', 5, 40);
      dm.spawnDrop('stim', -5, 40);
    })()`);
    await b.sleep(150);
    await b.evaluate(`window.__bp.supplies.dropsManager.clear()`);
    await b.sleep(150);
    const baseline = await b.evaluate(`window.__bp.snapshot()`);

    for (let c = 0; c < 20; c++) {
      await b.evaluate(`(() => {
        const dm = window.__bp.supplies.dropsManager;
        dm.spawnDrop('ammo_pack', 0, 40);
        dm.spawnDrop('medkit', 5, 40);
        dm.spawnDrop('stim', -5, 40);
      })()`);
      await b.sleep(20);
      await b.evaluate(`window.__bp.supplies.dropsManager.clear()`);
    }
    await b.sleep(200);

    const endSnap = await b.evaluate(`({
      snap: window.__bp.snapshot(),
      sharedIntact: window.__bp.supplies.areSharedDropGeometriesIntact()
    })`);

    if (!endSnap.sharedIntact) {
      throw new Error(`Shared drop geometries were improperly disposed!`);
    }
    if (endSnap.snap.geometries > baseline.geometries) {
      throw new Error(`WebGL geometry leak detected: baseline=${baseline.geometries}, end=${endSnap.snap.geometries}`);
    }
    return { baseline: baseline.geometries, end: endSnap.snap.geometries, sharedIntact: endSnap.sharedIntact };
  });

  await step(20, 'responsive_hud_screenshots_and_interaction_capture', async () => {
    await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setPlayerHp(75);
      const s = window.__bp.supplies.consumablesState;
      s.inventory.medkit = 2;
      s.inventory.stim = 1;
      s.stim.active = true;
      s.stim.remaining = 6.4;
      window.__bp.supplies.dropsManager.clear();
      window.__bp.supplies.dropsManager.spawnDrop('ammo_pack', 0, 38.5);
      window.__bp.supplies.dropsManager.spawnDrop('medkit', 2.0, 38.5);
      window.__bp.supplies.dropsManager.spawnDrop('stim', -2.0, 38.5);
    })()`);
    await b.sleep(400);

    await capturePng('docs/assets/screenshots/sprint8/supplies_hud_1920x1080.png', 1920, 1080);
    await capturePng('docs/assets/screenshots/sprint8/supplies_hud_1280x720.png', 1280, 720);
    await capturePng('docs/assets/screenshots/sprint8/supplies_hud_1024x768.png', 1024, 768);

    await b.evaluate(`(() => {
      window.__bp.backToMenu();
    })()`);
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(200);
    return { captured: 3 };
  });

} finally {
  await b.close();
  srv.close();
}

const passed = results.filter(r => r.ok).length;
console.log('\n--- RESUMEN SPRINT 8 ---');
console.log(`Total steps: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${results.length - passed}`);
if (passed !== results.length) {
  process.exit(1);
}
