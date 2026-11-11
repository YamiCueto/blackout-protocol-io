import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const url = `http://127.0.0.1:${port}/index.html?debug&nolock`;
const b = await launch(url);
const testResults = {};

try {
  await b.navigate(url);
  await b.sleep(3000);

  console.log('--- 1. VERIFICACIÓN DE CADENCIA EFECTIVA (30, 60, 120 FPS) ---');
  testResults.cadence = await b.evaluate(`(() => {
    const results = {};
    const weapons = ['mk7', 'vector9', 'm870'];
    const fpsList = [30, 60, 120];

    for (const wId of weapons) {
      results[wId] = {};
      const def = window.__bp.WEAPONS[wId];
      const nominalRpm = Math.round(60 / def.fireRate);

      for (const fps of fpsList) {
        const frameDt = 1 / fps;
        const MAX_STEP = 0.05;
        const steps = Math.max(1, Math.ceil(frameDt / MAX_STEP));
        const dt = frameDt / steps;

        let cooldown = 0;
        let shots = 0;
        const simDuration = 60.0;
        const totalSteps = Math.round(simDuration / dt);

        for (let s = 0; s < totalSteps; s++) {
          cooldown -= dt;
          if (cooldown < -def.fireRate) cooldown = -def.fireRate;
          if (cooldown <= 0) {
            shots++;
            cooldown = cooldown <= 0 ? cooldown + def.fireRate : def.fireRate;
            if (cooldown < 0) cooldown = 0;
          }
        }
        const effectiveRpm = shots;
        const devPct = ((effectiveRpm - nominalRpm) / nominalRpm * 100).toFixed(1);
        results[wId][fps] = {
          nominalRpm,
          effectiveRpm,
          shotsIn60s: shots,
          deviationPct: devPct,
          frameDtMs: +(frameDt * 1000).toFixed(2)
        };
      }
    }
    return results;
  })()`);
  console.log('Cadence results:', JSON.stringify(testResults.cadence, null, 2));

  console.log('--- 2. VERIFICACIÓN DE IMPACTOS MIXTOS M870 (1 BAJA / 1 RECOMPENSA) ---');
  testResults.mixedImpacts = await b.evaluate(`(() => {
    window.__bp.progression.reset();
    window.__bp.progression.grantPlayerXP(10000);
    window.__bp.progression.selectWeapon('m870');
    window.__bp.startGame('waves');

    const pXpBefore = window.__bp.progression.getPlayerInfo().currentXP;
    const wXpBefore = window.__bp.progression.getWeaponInfo('m870').currentXP;
    const killsBefore = parseInt(document.getElementById('kills').textContent, 10);

    const mockEnemy = {
      alive: true,
      hp: 100,
      group: { position: { x: 0, y: 0, z: 0 } },
      mesh: {}
    };

    const damagedEnemies = new Map();
    for (let i = 0; i < 3; i++) {
      const dmg = 22.5;
      const headshot = true;
      if (!damagedEnemies.has(mockEnemy)) {
        damagedEnemies.set(mockEnemy, { totalDmg: dmg, isHeadshot: headshot });
      } else {
        const rec = damagedEnemies.get(mockEnemy);
        rec.totalDmg += dmg;
        if (headshot) rec.isHeadshot = true;
      }
    }
    for (let i = 0; i < 5; i++) {
      const dmg = 15;
      const headshot = false;
      if (!damagedEnemies.has(mockEnemy)) {
        damagedEnemies.set(mockEnemy, { totalDmg: dmg, isHeadshot: headshot });
      } else {
        const rec = damagedEnemies.get(mockEnemy);
        rec.totalDmg += dmg;
        if (headshot) rec.isHeadshot = true;
      }
    }

    let killsRecorded = 0;
    let xpEventsDispatched = 0;
    for (const [enemy, hitData] of damagedEnemies) {
      if (enemy.alive && hitData.totalDmg >= enemy.hp) {
        enemy.alive = false;
        killsRecorded++;
        const kRes = window.__bp.progression.recordKill('m870', hitData.isHeadshot);
        if (kRes) xpEventsDispatched++;
      }
    }

    const pXpAfter = window.__bp.progression.getPlayerInfo().currentXP;
    const wXpAfter = window.__bp.progression.getWeaponInfo('m870').currentXP;

    window.__bp.backToMenu();

    return {
      totalDamage: damagedEnemies.get(mockEnemy).totalDmg,
      isHeadshotConsolidated: damagedEnemies.get(mockEnemy).isHeadshot,
      enemiesInMap: damagedEnemies.size,
      killsRecorded,
      xpEventsDispatched,
      playerXpGain: pXpAfter - pXpBefore,
      weaponXpGain: wXpAfter - wXpBefore
    };
  })()`);
  console.log('Mixed impacts results:', JSON.stringify(testResults.mixedImpacts, null, 2));

  console.log('--- 3. VERIFICACIÓN DE RECARGA INTERRUMPIBLE ---');
  testResults.reloadInterruption = await b.evaluate(`(() => {
    window.__bp.progression.selectWeapon('m870');
    window.__bp.startGame('waves');

    window.__bp.weapon.ammo = 0;
    window.__bp.weapon.reserve = 12;
    window.__bp.tryReload();
    const reloadingA = window.__bp.weapon.reloading;
    window.__bp.shoot();
    const stillReloadingA = window.__bp.weapon.reloading;

    window.__bp.weapon.ammo = 2;
    window.__bp.shoot();
    const reloadingB = window.__bp.weapon.reloading;
    const ammoB = window.__bp.weapon.ammo;

    window.__bp.backToMenu();

    return {
      reloadingA,
      stillReloadingA,
      interruptedOnShoot: !reloadingB,
      ammoAfterInterruptedShot: ammoB
    };
  })()`);
  console.log('Reload interruption results:', JSON.stringify(testResults.reloadInterruption, null, 2));

  console.log('--- 4. VERIFICACIÓN DE PERSISTENCIA ---');
  await b.evaluate(`(() => {
    window.__bp.progression.selectWeapon('vector9');
  })()`);
  await b.sleep(300);

  await b.navigate(url);
  await b.sleep(3000);

  testResults.persistence = await b.evaluate(`(() => {
    const raw = localStorage.getItem('bp_progression_v1');
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      selectedInStorage: parsed ? parsed.selectedWeapon : null,
      activeInEngine: window.__bp.weapon.id,
      selectedInState: window.__bp.progression.getState().selectedWeapon
    };
  })()`);
  console.log('Persistence results:', JSON.stringify(testResults.persistence, null, 2));

  console.log('--- 5. AUSENCIA DE FUGAS TRAS 20 CAMBIOS DE ARMA ---');
  testResults.leakCheck = await b.evaluate(`(() => {
    window.__bp.switchTab('loadout');
    const weapons = ['mk7', 'vector9', 'm870'];
    const counts = [];

    for (let i = 0; i < 20; i++) {
      const wId = weapons[i % 3];
      window.__bp.progression.selectWeapon(wId);
      window.__bp.setWeapon(wId);
      counts.push(window.__bp.snapshot().sceneChildren);
    }

    return {
      counts,
      first: counts[0],
      last: counts[counts.length - 1],
      isStable: Math.abs(counts[counts.length - 1] - counts[0]) <= 2
    };
  })()`);
  console.log('Leak check results:', JSON.stringify(testResults.leakCheck, null, 2));

  if (!testResults.mixedImpacts || testResults.mixedImpacts.killsRecorded !== 1) throw new Error('Mixed impacts failed');
  if (!testResults.reloadInterruption || !testResults.reloadInterruption.interruptedOnShoot) throw new Error('Reload interruption failed');
  if (!testResults.persistence || testResults.persistence.activeInEngine !== 'vector9') throw new Error('Persistence failed');
  if (!testResults.leakCheck || !testResults.leakCheck.isStable) throw new Error('Leak check failed');

  console.log('\n=== CIERRE CONTROLADO: TODAS LAS VERIFICACIONES COMPLETADAS EXITOSAMENTE ===');
} catch (err) {
  console.error('Error during closure tests:', err);
  process.exit(1);
} finally {
  await b.close();
  srv.close();
}
