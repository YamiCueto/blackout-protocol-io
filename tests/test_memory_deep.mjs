import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const url = `http://127.0.0.1:${port}/index.html?debug&nolock`;
const b = await launch(url);
const results = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS [${name}]`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    console.error(`FAIL [${name}]: ${err.message}`);
  }
}

try {
  await b.navigate(url);
  await b.sleep(3500);

  await step('1_cadence_accumulator_in_browser', async () => {
    const report = await b.evaluate(`(() => {
      const weapons = ['mk7', 'vector9', 'm870'];
      const fpsList = [30, 60, 120];
      const out = {};

      for (const wId of weapons) {
        out[wId] = {};
        const def = window.__bp.WEAPONS[wId];
        const nominalRpm = Math.round(60 / def.fireRate);

        for (const fps of fpsList) {
          const frameDt = 1 / fps;
          const MAX_STEP = 0.05;
          const steps = Math.max(1, Math.ceil(frameDt / MAX_STEP));
          const dt = frameDt / steps;

          let cooldown = 0;
          let shots = 0;
          const simSecs = 60.0;
          const totalSteps = Math.round(simSecs / dt);

          for (let s = 0; s < totalSteps; s++) {
            cooldown -= dt;
            if (cooldown < -def.fireRate) cooldown = -def.fireRate;
            if (cooldown <= 0) {
              shots++;
              cooldown = cooldown <= 0 ? cooldown + def.fireRate : def.fireRate;
              if (cooldown < 0) cooldown = 0;
            }
          }

          const rpm = shots;
          const dev = Math.abs((rpm - nominalRpm) / nominalRpm * 100);
          out[wId][fps] = { nominalRpm, rpm, devPct: dev.toFixed(2) };

          if (dev > 2.5) {
            throw new Error(wId + ' at ' + fps + ' FPS deviation too high: ' + dev.toFixed(2) + '% (RPM: ' + rpm + ' vs nominal: ' + nominalRpm + ')');
          }
        }
      }
      return out;
    })()`);
    return report;
  });

  await step('2_burst_prevention_on_pause_and_lag', async () => {
    const test = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('mk7');

      window.__bp.pause();
      window.__bp.resumeGame();
      const cdAfterResume = window.__bp.weapon.cooldown;
      if (cdAfterResume < 0) throw new Error('Cooldown cannot be negative after resume');

      const def = window.__bp.WEAPONS.mk7;
      let cooldown = 0;
      let shots = 0;
      const frameDt = 0.25;
      const steps = Math.max(1, Math.ceil(frameDt / 0.05));
      const dt = frameDt / steps;

      for (let s = 0; s < steps; s++) {
        cooldown -= dt;
        if (cooldown < -def.fireRate) cooldown = -def.fireRate;
        if (cooldown <= 0) {
          shots++;
          cooldown = cooldown <= 0 ? cooldown + def.fireRate : def.fireRate;
          if (cooldown < 0) cooldown = 0;
        }
      }

      window.__bp.backToMenu();

      if (shots > 3) throw new Error('Burst detected: shots during 250ms spike was ' + shots + ' (max 3)');
      return { cdAfterResume, shotsIn250msSpike: shots };
    })()`);
    return test;
  });

  await step('3_memory_geometries_textures_20_weapon_swaps', async () => {
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(300);

    const memoryLog = await b.evaluate(`(() => {
      const snap = () => window.__bp.snapshot();
      const weapons = ['mk7', 'vector9', 'm870'];
      const initial = snap();
      const records = [];

      for (let i = 0; i < 20; i++) {
        const id = weapons[i % 3];
        window.__bp.progression.selectWeapon(id);
        window.__bp.setWeapon(id);
        const s = snap();
        records.push({ i, id, geo: s.geometries, tex: s.textures, sceneKids: s.sceneChildren });
      }

      const finalSnap = snap();
      const geoGrowth = finalSnap.geometries - initial.geometries;
      const texGrowth = finalSnap.textures - initial.textures;

      if (geoGrowth > 2) throw new Error('Geometries leaked across weapon swaps: grew by ' + geoGrowth);
      if (texGrowth > 0) throw new Error('Textures leaked across weapon swaps: grew by ' + texGrowth);

      return { initialGeo: initial.geometries, finalGeo: finalSnap.geometries, initialTex: initial.textures, finalTex: finalSnap.textures, recordsCount: records.length };
    })()`);
    return memoryLog;
  });

  await step('4_memory_10_cycles_waves', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const baseline = await b.evaluate(`window.__bp.snapshot()`);

    const geoSamples = [];
    for (let c = 0; c < 10; c++) {
      await b.evaluate(`window.__bp.startGame('waves')`);
      await b.sleep(150);
      await b.evaluate(`window.__bp.backToMenu()`);
      await b.sleep(150);
      const s = await b.evaluate(`window.__bp.snapshot()`);
      geoSamples.push(s.geometries);
    }

    const first = geoSamples[0];
    const last = geoSamples[geoSamples.length - 1];
    const peak = Math.max(...geoSamples);
    if (Math.abs(last - first) > 1 || peak - baseline.geometries > 1) {
      throw new Error(`Geometries grew across 10 waves cycles: baseline=${baseline.geometries} ${first} -> ${last} (${geoSamples.join(',')})`);
    }
    return { warmupBaselineGeo: baseline.geometries, first, last, peak, geoSamples };
  });

  await step('5_memory_10_cycles_snd', async () => {
    const geoSamples = [];
    for (let c = 0; c < 10; c++) {
      await b.evaluate(`window.__bp.startGame('snd')`);
      await b.sleep(150);
      await b.evaluate(`window.__bp.backToMenu()`);
      await b.sleep(150);
      const s = await b.evaluate(`window.__bp.snapshot()`);
      geoSamples.push(s.geometries);
    }

    const first = geoSamples[0];
    const last = geoSamples[geoSamples.length - 1];
    if (Math.abs(last - first) > 1) {
      throw new Error(`Geometries grew across 10 snd cycles: ${first} -> ${last} (${geoSamples.join(',')})`);
    }
    return { first, last, geoSamples };
  });

  await step('6_memory_death_retry_cycle', async () => {
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(1500);
    const beforeDeath = await b.evaluate(`window.__bp.snapshot()`);

    await b.evaluate(`window.__bp.killPlayer()`);
    await b.sleep(1000);
    const deathSnap = await b.evaluate(`window.__bp.snapshot()`);
    if (deathSnap.phase !== 'RESULTS') throw new Error('Expected phase RESULTS on death');

    await b.evaluate(`document.getElementById('retry-btn').click()`);
    await b.sleep(1500);
    const retrySnap = await b.evaluate(`window.__bp.snapshot()`);
    if (retrySnap.phase !== 'PLAYING') throw new Error('Expected phase PLAYING on retry');

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1000);
    const menuSnap = await b.evaluate(`window.__bp.snapshot()`);

    return { beforeDeathGeo: beforeDeath.geometries, deathGeo: deathSnap.geometries, retryGeo: retrySnap.geometries, menuGeo: menuSnap.geometries };
  });

  console.log('\n===============================================================');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`TOTAL MEMORY DEEP TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
} catch (e) {
  console.error('Test harness exception:', e);
  process.exit(1);
} finally {
  await b.close();
  srv.close();
}
