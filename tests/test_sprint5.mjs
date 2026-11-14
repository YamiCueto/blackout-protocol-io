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

  await step(1, 'mk7_regression_baseline', async () => {
    const w = await b.evaluate(`(() => {
      const def = window.__bp.WEAPONS.mk7;
      return {
        id: def.id,
        damage: def.damage,
        fireRate: def.fireRate,
        magSize: def.magSize,
        reserveDefault: def.reserveDefault,
        reserveSnd: def.reserveSnd,
        mobility: def.mobilityMultiplier,
        adsSpeed: def.adsSpeed,
        dropoff: def.dropoff,
        spreadHip: def.spreadHip,
        spreadAds: def.spreadAds
      };
    })()`);
    if (w.damage !== 34) throw new Error(`MK-7 damage expected 34, got ${w.damage}`);
    if (w.fireRate !== 0.105) throw new Error(`MK-7 fireRate expected 0.105, got ${w.fireRate}`);
    if (w.magSize !== 30) throw new Error(`MK-7 magSize expected 30, got ${w.magSize}`);
    if (w.reserveDefault !== 120) throw new Error(`MK-7 reserveDefault expected 120, got ${w.reserveDefault}`);
    if (w.reserveSnd !== 150) throw new Error(`MK-7 reserveSnd expected 150, got ${w.reserveSnd}`);
    if (w.mobility !== 1.0) throw new Error(`MK-7 mobility expected 1.0, got ${w.mobility}`);
    if (w.adsSpeed !== 12.0) throw new Error(`MK-7 adsSpeed expected 12.0, got ${w.adsSpeed}`);
    if (w.dropoff !== null) throw new Error(`MK-7 dropoff expected null, got ${JSON.stringify(w.dropoff)}`);
    return w;
  });

  await step(2, 'vector9_unlock_curve', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const p1 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'vector9').status;
      window.__bp.progression.grantPlayerXP(1200);
      const p2 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'vector9').status;
      window.__bp.progression.grantPlayerXP(2500);
      const p3 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'vector9').status;
      return { p1, p2, p3, lvl: window.__bp.progression.getPlayerInfo().level };
    })()`);
    if (res.p1 !== 'LOCKED') throw new Error(`Expected LOCKED at lvl 1, got ${res.p1}`);
    if (res.p3 !== 'UNLOCKED') throw new Error(`Expected UNLOCKED at lvl >= 4, got ${res.p3}`);
    return res;
  });

  await step(3, 'm870_unlock_curve', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const s1 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'm870').status;
      window.__bp.progression.grantPlayerXP(3000);
      const s4 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'm870').status;
      window.__bp.progression.grantPlayerXP(5000);
      const s8 = window.__bp.progression.getCatalogWithStatus().find(x => x.id === 'm870').status;
      return { s1, s4, s8, lvl: window.__bp.progression.getPlayerInfo().level };
    })()`);
    if (res.s1 !== 'LOCKED') throw new Error(`Expected LOCKED at lvl 1, got ${res.s1}`);
    if (res.s4 !== 'LOCKED') throw new Error(`Expected LOCKED at lvl 4, got ${res.s4}`);
    if (res.s8 !== 'UNLOCKED') throw new Error(`Expected UNLOCKED at lvl >= 8, got ${res.s8}`);
    return res;
  });

  await step(4, 'locked_weapons_not_equippable', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const okVector = window.__bp.progression.selectWeapon('vector9');
      const okM870 = window.__bp.progression.selectWeapon('m870');
      const current = window.__bp.progression.getState().selectedWeapon;
      return { okVector, okM870, current };
    })()`);
    if (res.okVector !== false) throw new Error(`Expected false selecting locked vector9, got ${res.okVector}`);
    if (res.okM870 !== false) throw new Error(`Expected false selecting locked m870, got ${res.okM870}`);
    if (res.current !== 'mk7') throw new Error(`Selected weapon should remain mk7, got ${res.current}`);
    return res;
  });

  await step(5, 'planned_weapons_not_equippable', async () => {
    const res = await b.evaluate(`(() => {
      const okAk12 = window.__bp.progression.selectWeapon('ak12');
      const okMp5k = window.__bp.progression.selectWeapon('mp5k');
      const okMk48 = window.__bp.progression.selectWeapon('mk48');
      const okInvalid = window.__bp.progression.selectWeapon('invalid_gun');
      const current = window.__bp.progression.getState().selectedWeapon;
      return { okAk12, okMp5k, okMk48, okInvalid, current };
    })()`);
    if (res.okAk12 !== false) throw new Error(`Locked weapon ak12 must return false`);
    if (res.okMp5k !== false) throw new Error(`Locked weapon mp5k must return false`);
    if (res.okMk48 !== false) throw new Error(`Locked weapon mk48 must return false`);
    if (res.okInvalid !== false) throw new Error(`Invalid weapon must return false`);
    return res;
  });

  await step(6, 'weapon_selection_persistence', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(100000);
      window.__bp.progression.selectWeapon('vector9');
    })()`);
    await b.sleep(300);

    await b.navigate(url);
    await b.sleep(3500);

    const reloaded = await b.evaluate(`(() => {
      return {
        selected: window.__bp.progression.getState().selectedWeapon,
        activeWeaponId: window.__bp.weapon.id
      };
    })()`);
    if (reloaded.selected !== 'vector9') throw new Error(`Expected persistent selection vector9, got ${reloaded.selected}`);
    if (reloaded.activeWeaponId !== 'vector9') throw new Error(`Expected active weapon vector9, got ${reloaded.activeWeaponId}`);
    return reloaded;
  });

  await step(7, 'spawn_waves_vector9', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(1500);

    const state = await b.evaluate(`(() => {
      return {
        id: window.__bp.weapon.id,
        ammo: window.__bp.weapon.ammo,
        magSize: window.__bp.weapon.magSize,
        reserve: window.__bp.weapon.reserve,
        fireRate: window.__bp.weapon.fireRate,
        pellets: window.__bp.weapon.pellets
      };
    })()`);
    if (state.id !== 'vector9') throw new Error(`Expected vector9 in waves, got ${state.id}`);
    if (state.ammo !== 33) throw new Error(`Expected 33 ammo, got ${state.ammo}`);
    if (state.reserve !== 165) throw new Error(`Expected 165 reserve, got ${state.reserve}`);
    if (state.pellets !== 1) throw new Error(`Expected 1 pellet, got ${state.pellets}`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    return state;
  });

  await step(8, 'spawn_snd_m870', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.selectWeapon('m870');
      window.__bp.startGame('snd');
    })()`);
    await b.sleep(1500);

    const state = await b.evaluate(`(() => {
      return {
        id: window.__bp.weapon.id,
        ammo: window.__bp.weapon.ammo,
        magSize: window.__bp.weapon.magSize,
        reserve: window.__bp.weapon.reserve,
        fireRate: window.__bp.weapon.fireRate,
        pellets: window.__bp.weapon.pellets
      };
    })()`);
    if (state.id !== 'm870') throw new Error(`Expected m870 in snd, got ${state.id}`);
    if (state.ammo !== 6) throw new Error(`Expected 6 ammo, got ${state.ammo}`);
    if (state.reserve !== 42) throw new Error(`Expected 42 reserve in snd, got ${state.reserve}`);
    if (state.pellets !== 8) throw new Error(`Expected 8 pellets, got ${state.pellets}`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    return state;
  });

  await step(9, 'damage_values_all_weapons', async () => {
    const res = await b.evaluate(`(() => {
      return {
        mk7: window.__bp.WEAPONS.mk7.damage,
        vector9: window.__bp.WEAPONS.vector9.damage,
        m870Pellet: window.__bp.WEAPONS.m870.damage,
        m870Total: window.__bp.WEAPONS.m870.damage * window.__bp.WEAPONS.m870.pellets
      };
    })()`);
    if (res.mk7 !== 34) throw new Error(`MK-7 damage expected 34, got ${res.mk7}`);
    if (res.vector9 !== 22) throw new Error(`Vector-9 damage expected 22, got ${res.vector9}`);
    if (res.m870Pellet !== 15) throw new Error(`M870 pellet damage expected 15, got ${res.m870Pellet}`);
    if (res.m870Total !== 120) throw new Error(`M870 total damage expected 120, got ${res.m870Total}`);
    return res;
  });

  await step(10, 'fire_rate_and_cooldowns', async () => {
    const res = await b.evaluate(`(() => {
      return {
        mk7Rate: window.__bp.WEAPONS.mk7.fireRate,
        mk7Rpm: Math.round(60 / window.__bp.WEAPONS.mk7.fireRate),
        vectorRate: window.__bp.WEAPONS.vector9.fireRate,
        vectorRpm: Math.round(60 / window.__bp.WEAPONS.vector9.fireRate),
        m870Rate: window.__bp.WEAPONS.m870.fireRate,
        m870Rpm: Math.round(60 / window.__bp.WEAPONS.m870.fireRate)
      };
    })()`);
    if (res.mk7Rpm < 560 || res.mk7Rpm > 580) throw new Error(`MK-7 RPM unexpected: ${res.mk7Rpm}`);
    if (res.vectorRpm < 910 || res.vectorRpm > 930) throw new Error(`Vector-9 RPM unexpected: ${res.vectorRpm}`);
    if (res.m870Rpm < 70 || res.m870Rpm > 80) throw new Error(`M870 RPM unexpected: ${res.m870Rpm}`);
    return res;
  });

  await step(11, 'ammo_consumption_and_empty_click', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(1000);

    const test = await b.evaluate(`(() => {
      window.__bp.weapon.ammo = 1;
      window.__bp.shoot();
      const ammoAfterShoot = window.__bp.weapon.ammo;
      window.__bp.shoot();
      const ammoAfterDry = window.__bp.weapon.ammo;
      const cooldownAfterDry = window.__bp.weapon.cooldown;
      return { ammoAfterShoot, ammoAfterDry, cooldownAfterDry };
    })()`);
    if (test.ammoAfterShoot !== 0) throw new Error(`Ammo should decrement to 0, got ${test.ammoAfterShoot}`);
    if (test.ammoAfterDry !== 0) throw new Error(`Ammo should remain 0, got ${test.ammoAfterDry}`);
    if (test.cooldownAfterDry <= 0) throw new Error(`Dry click cooldown should be set`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    return test;
  });

  await step(12, 'shell_reload_and_interruption', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.selectWeapon('m870');
      window.__bp.startGame('waves');
    })()`);
    await b.sleep(1000);

    const res = await b.evaluate(`(() => {
      window.__bp.weapon.ammo = 0;
      window.__bp.weapon.reserve = 10;
      window.__bp.tryReload();
      const reloadingAtStart = window.__bp.weapon.reloading;
      const stageAtStart = window.__bp.weapon.reloadStage;

      window.__bp.shoot();
      const stillReloadingWhenZero = window.__bp.weapon.reloading;

      window.__bp.weapon.ammo = 1;
      window.__bp.weapon.reserve = 9;

      window.__bp.shoot();
      const interrupted = !window.__bp.weapon.reloading;
      const ammoAfterInterruptedShot = window.__bp.weapon.ammo;

      return { reloadingAtStart, stageAtStart, stillReloadingWhenZero, interrupted, ammoAfterInterruptedShot };
    })()`);
    if (!res.reloadingAtStart) throw new Error(`Expected reloading true on tryReload`);
    if (res.stageAtStart !== 'start') throw new Error(`Expected stage 'start', got ${res.stageAtStart}`);
    if (!res.stillReloadingWhenZero) throw new Error(`Reloading should NOT be interrupted when ammo is 0`);
    if (!res.interrupted) throw new Error(`Reloading SHOULD be interrupted when ammo > 0`);
    if (res.ammoAfterInterruptedShot !== 0) throw new Error(`Ammo should decrement on interrupted shot`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    return res;
  });

  await step(13, 'ads_speed_differentiation', async () => {
    const res = await b.evaluate(`(() => {
      return {
        mk7Ads: window.__bp.WEAPONS.mk7.adsSpeed,
        vectorAds: window.__bp.WEAPONS.vector9.adsSpeed,
        m870Ads: window.__bp.WEAPONS.m870.adsSpeed
      };
    })()`);
    if (res.vectorAds <= res.mk7Ads) throw new Error(`Vector-9 ADS speed (${res.vectorAds}) must be faster than MK-7 (${res.mk7Ads})`);
    if (res.m870Ads >= res.mk7Ads) throw new Error(`M870 ADS speed (${res.m870Ads}) must be slower than MK-7 (${res.mk7Ads})`);
    return res;
  });

  await step(14, 'distance_damage_dropoff_curves', async () => {
    const test = await b.evaluate(`(() => {
      const vClose = window.__bp.WEAPONS.vector9.damage;
      const vDrop = (function() {
        const d = window.__bp.WEAPONS.vector9.dropoff;
        const dist = 50;
        const mult = dist >= d.max ? d.minMult : 1.0;
        return 22 * mult;
      })();

      const mClose = window.__bp.WEAPONS.m870.damage;
      const mFar = (function() {
        const d = window.__bp.WEAPONS.m870.dropoff;
        const dist = 30;
        const mult = dist >= d.max ? d.minMult : 1.0;
        return 15 * mult;
      })();

      const mk7Dropoff = window.__bp.WEAPONS.mk7.dropoff;

      return { vClose, vDrop, mClose, mFar, mk7Dropoff };
    })()`);
    if (test.vClose !== 22) throw new Error(`Vector close damage expected 22, got ${test.vClose}`);
    if (Math.abs(test.vDrop - 10.56) > 0.01) throw new Error(`Vector far damage expected 10.56, got ${test.vDrop}`);
    if (test.mClose !== 15) throw new Error(`M870 close pellet damage expected 15, got ${test.mClose}`);
    if (Math.abs(test.mFar - 3.75) > 0.01) throw new Error(`M870 far pellet damage expected 3.75, got ${test.mFar}`);
    if (test.mk7Dropoff !== null) throw new Error(`MK-7 dropoff must be null`);
    return test;
  });

  await step(15, 'shotgun_conical_spread', async () => {
    const s = await b.evaluate(`(() => {
      return {
        hip: window.__bp.WEAPONS.m870.spreadHip,
        ads: window.__bp.WEAPONS.m870.spreadAds,
        pellets: window.__bp.WEAPONS.m870.pellets
      };
    })()`);
    if (s.pellets !== 8) throw new Error(`M870 pellets expected 8, got ${s.pellets}`);
    if (s.hip <= s.ads) throw new Error(`Hip spread (${s.hip}) should be wider than ADS (${s.ads})`);
    if (s.hip < 0.03) throw new Error(`M870 hip spread should be wide for shotgun pellet spread`);
    return s;
  });

  await step(16, 'consolidated_damage_zero_duplicate_xp', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.selectWeapon('m870');
      window.__bp.startGame('waves');
    })()`);
    await b.sleep(1500);

    const result = await b.evaluate(`(() => {
      const pBefore = window.__bp.progression.getPlayerInfo().currentXP;
      const wBefore = window.__bp.progression.getWeaponInfo('m870').currentXP;
      const killsBefore = parseInt(document.getElementById('kills').textContent, 10);

      const kRes = window.__bp.progression.recordKill('m870', false);

      const pAfter = window.__bp.progression.getPlayerInfo().currentXP;
      const wAfter = window.__bp.progression.getWeaponInfo('m870').currentXP;

      return {
        playerDiff: pAfter - pBefore,
        weaponDiff: wAfter - wBefore,
        pBefore, pAfter, wBefore, wAfter
      };
    })()`);
    if (result.playerDiff !== 100) throw new Error(`Expected exactly 100 player XP, got ${result.playerDiff}`);
    if (result.weaponDiff !== 60) throw new Error(`Expected exactly 60 weapon XP, got ${result.weaponDiff}`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    return result;
  });

  await step(17, 'lobby_operator_weapon_sync', async () => {
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(500);

    const res = await b.evaluate(`(() => {
      window.__bp.progression.selectWeapon('vector9');
      window.__bp.setWeapon('vector9');
      const wId = window.__bp.weapon.id;
      window.__bp.switchTab('operator');
      return { wId, tab: 'operator' };
    })()`);
    if (res.wId !== 'vector9') throw new Error(`Expected active weapon vector9, got ${res.wId}`);

    await b.evaluate(`window.__bp.switchTab('play')`);
    await b.sleep(500);
    return res;
  });

  await step(18, 'ten_cycles_loadout_leak_check', async () => {
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(300);

    const geoCounts = [];
    for (let i = 0; i < 10; i++) {
      const g = await b.evaluate(`(() => {
        const id = ['mk7', 'vector9', 'm870'][${i} % 3];
        window.__bp.progression.selectWeapon(id);
        window.__bp.setWeapon(id);
        return window.__bp.snapshot().sceneChildren;
      })()`);
      geoCounts.push(g);
      await b.sleep(50);
    }

    const first = geoCounts[0];
    const last = geoCounts[geoCounts.length - 1];
    if (Math.abs(last - first) > 5) {
      throw new Error(`Scene children count grew significantly: ${first} -> ${last} (${geoCounts.join(',')})`);
    }
    return { geoCounts };
  });

  await step(19, 'mesh_material_stability', async () => {
    const check = await b.evaluate(`(() => {
      const results = {};
      for (const id of ['mk7', 'vector9', 'm870']) {
        const w = window.__bp.WEAPONS[id];
        const m = w.buildMesh();
        let meshCount = 0;
        m.traverse(o => { if (o.isMesh) meshCount++; });
        results[id] = { hasMesh: !!m, meshCount };
      }
      return results;
    })()`);
    if (!check.mk7.hasMesh || check.mk7.meshCount < 5) throw new Error(`MK-7 mesh invalid`);
    if (!check.vector9.hasMesh || check.vector9.meshCount < 5) throw new Error(`Vector-9 mesh invalid`);
    if (!check.m870.hasMesh || check.m870.meshCount < 5) throw new Error(`M870 mesh invalid`);
    return check;
  });

  await step(20, 'zero_javascript_errors', async () => {
    const errorLogs = b.logs.filter(l => l.t === 'exception' || (l.t === 'console.error' && !l.text.includes('favicon')));
    if (errorLogs.length > 0) {
      throw new Error(`Found ${errorLogs.length} JS errors: ${errorLogs.map(l => l.text).join('; ')}`);
    }
    return { totalLogs: b.logs.length, errorLogsCount: errorLogs.length };
  });

  console.log('\n===============================================================');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`TOTAL SPRINT 5 TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
} catch (e) {
  console.error('Test harness exception:', e);
  process.exit(1);
} finally {
  await b.close();
  srv.close();
}
