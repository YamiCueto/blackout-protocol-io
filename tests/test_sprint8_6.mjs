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
    if (err.detail) console.error(JSON.stringify(err.detail));
  }
}

try {
  await b.navigate(url);
  await b.sleep(1500);

  await step(1, 'concurrency_limit_across_waves', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      const limits = {
        w1: bp.getMaxConcurrentEnemies(1),
        w3: bp.getMaxConcurrentEnemies(3),
        w4: bp.getMaxConcurrentEnemies(4),
        w7: bp.getMaxConcurrentEnemies(7),
        w8: bp.getMaxConcurrentEnemies(8),
        w10: bp.getMaxConcurrentEnemies(10),
        w20: bp.getMaxConcurrentEnemies(20)
      };

      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);
      const w1State = bp.getWaveState();
      const w1Alive = bp.enemies.filter(e => e.alive).length;

      return { limits, w1State, w1Alive };
    })()`);

    if (res.limits.w1 !== 6 || res.limits.w3 !== 6) throw new Error('Waves 1-3 limit mismatch: ' + JSON.stringify(res.limits));
    if (res.limits.w4 !== 8 || res.limits.w7 !== 8) throw new Error('Waves 4-7 limit mismatch: ' + JSON.stringify(res.limits));
    if (res.limits.w8 !== 10 || res.limits.w10 !== 10 || res.limits.w20 !== 10) throw new Error('Waves 8+ limit mismatch: ' + JSON.stringify(res.limits));
    if (res.w1Alive > 6) throw new Error('Wave 1 exceeded max alive: ' + res.w1Alive);
    return res;
  });

  await step(2, 'reinforcement_queue_refills_when_capacity_freed', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const queue = bp.getWaveSpawnQueue();
      queue.length = 0;
      for (let i = 0; i < 5; i++) {
        queue.push({ index: i, archKey: 'SHOOTER', wave: 4 });
      }

      const initialAlive = bp.enemies.filter(e => e.alive).length;
      const initialPending = queue.length;

      const target = bp.enemies.find(e => e.alive);
      bp.damageEnemy(target, 9999, target.group.position, false, null);

      const afterKillAlive = bp.enemies.filter(e => e.alive).length;

      for (let s = 0; s < 30; s++) {
        bp.stepSim(0.05);
      }

      const refilledAlive = bp.enemies.filter(e => e.alive).length;
      const remainingPending = queue.length;

      return {
        initialAlive,
        initialPending,
        afterKillAlive,
        refilledAlive,
        remainingPending
      };
    })()`);

    if (res.afterKillAlive >= res.initialAlive) throw new Error('Enemy was not killed');
    if (res.remainingPending >= res.initialPending) throw new Error('Pending queue did not decrease');
    if (res.refilledAlive <= res.afterKillAlive) throw new Error('Alive enemies did not refill from queue');
    return res;
  });

  await step(3, 'zero_enemy_duplication_strict_invariant', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      let invariantViolations = 0;
      const checks = [];

      for (let s = 0; s < 100; s++) {
        bp.stepSim(0.05);
        const st = bp.getWaveState();
        const alive = bp.enemies.filter(e => e.alive).length;
        const currentSum = st.waveKilled + st.wavePending + alive;
        if (currentSum !== st.waveTotal) {
          invariantViolations++;
          checks.push({ step: s, sum: currentSum, total: st.waveTotal, killed: st.waveKilled, pending: st.wavePending, alive });
        }
        if (s % 20 === 0) {
          const victim = bp.enemies.find(e => e.alive);
          if (victim) bp.damageEnemy(victim, 9999, victim.group.position, false, null);
        }
      }

      return { invariantViolations, checks };
    })()`);

    if (res.invariantViolations > 0) throw new Error('Invariant violated: ' + JSON.stringify(res.checks));
    return res;
  });

  await step(4, 'wave_completion_only_when_all_enemies_eliminated', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const queue = bp.getWaveSpawnQueue();
      queue.push({ index: 99, archKey: 'CHASER', wave: 1 });

      const aliveBefore = bp.enemies.filter(e => e.alive);
      for (const e of aliveBefore) {
        bp.damageEnemy(e, 9999, e.group.position, false, null);
      }

      bp.stepSim(0.05);
      const waveStatePremature = bp.getWaveState();
      const phasePremature = bp.getPhase();

      for (let s = 0; s < 40; s++) {
        bp.stepSim(0.05);
      }

      const spawnedQueued = bp.enemies.find(e => e.alive);
      let phaseFinal = null;
      if (spawnedQueued) {
        bp.damageEnemy(spawnedQueued, 9999, spawnedQueued.group.position, false, null);
        bp.stepSim(0.05);
        phaseFinal = bp.getPhase();
      }

      return {
        wavePrematureBetween: waveStatePremature.betweenWaves,
        phasePremature,
        spawnedQueuedAlive: !!spawnedQueued,
        phaseFinal
      };
    })()`);

    if (res.wavePrematureBetween) throw new Error('Wave ended prematurely while reinforcements were still in queue');
    if (res.phasePremature === 'SUMMARY') throw new Error('Wave summary showed before queue emptied');
    if (!res.spawnedQueuedAlive) throw new Error('Queued enemy failed to spawn');
    if (res.phaseFinal !== 'SUMMARY') throw new Error('Wave summary did not show after all enemies died: ' + res.phaseFinal + ' (res: ' + JSON.stringify(res) + ')');
    return res;
  });

  await step(5, 'restart_during_active_reinforcement_queue', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const queue = bp.getWaveSpawnQueue();
      queue.push({ index: 101, archKey: 'BRUTE', wave: 2 });
      queue.push({ index: 102, archKey: 'ELITE', wave: 2 });
      const pendingBefore = queue.length;

      bp.startGame('waves');
      const pendingAfter = bp.getWaveSpawnQueue().length;
      const enemiesCount = bp.enemies.length;

      return { pendingBefore, pendingAfter, enemiesCount };
    })()`);

    if (res.pendingBefore < 2) throw new Error('Failed to inject pending reinforcements');
    if (res.pendingAfter !== 0) throw new Error('Queue was not cleared on startGame: ' + res.pendingAfter);
    return res;
  });

  await step(6, 'player_death_with_active_queue_stops_spawning', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const queue = bp.getWaveSpawnQueue();
      queue.push({ index: 201, archKey: 'SHOOTER', wave: 1 });
      queue.push({ index: 202, archKey: 'SHOOTER', wave: 1 });

      bp.player.hp = 0;
      bp.damageEnemy(bp.enemies[0], 0, bp.enemies[0].group.position);
      for (let s = 0; s < 30; s++) bp.stepSim(0.05);

      const queueAfterDeath = bp.getWaveSpawnQueue().length;
      const phaseAfterDeath = bp.getPhase();

      return { queueAfterDeath, phaseAfterDeath };
    })()`);

    if (res.queueAfterDeath !== 0) throw new Error('Queue remained non-empty after death');
    return res;
  });

  await step(7, 'spawn_retries_resilience_without_freeze', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const queue = bp.getWaveSpawnQueue();
      queue.push({ index: 301, archKey: 'CHASER', wave: 1 });
      const beforePending = queue.length;

      const origDistanceTo = bp.player.pos.distanceTo;
      bp.player.pos.distanceTo = () => 5.0;

      const spawnedBlocked = bp.spawnNextWaveEnemy();
      const stateBlocked = bp.getWaveState();
      const pendingAfterBlocked = queue.length;

      bp.player.pos.distanceTo = origDistanceTo;

      const spawnedNormal = bp.spawnNextWaveEnemy();
      const stateNormal = bp.getWaveState();

      return {
        beforePending,
        spawnedBlocked,
        retriesBlocked: stateBlocked.waveSpawnRetries,
        pendingAfterBlocked,
        spawnedNormal,
        pendingAfterNormal: queue.length
      };
    })()`);

    if (res.spawnedBlocked) throw new Error('Spawn succeeded despite being blocked');
    if (res.retriesBlocked < 1) throw new Error('Spawn retry was not recorded: ' + res.retriesBlocked);
    if (res.pendingAfterBlocked !== 1) throw new Error('Pending queue lost item on retry failure: pendingAfterBlocked=' + res.pendingAfterBlocked + ', before=' + res.beforePending);
    if (!res.spawnedNormal) throw new Error('Spawn failed after unblocking');
    if (res.pendingAfterNormal !== 0) throw new Error('Queue was not consumed after valid spawn');
    return res;
  });

  await step(8, 'offensive_coordinator_prevents_simultaneous_damage_spikes', async () => {
    const res = await b.evaluate(`(() => {
      const coord = window.__bp.offensiveCoordinator;
      coord.reset();

      const enemyA = { id: 'A' };
      const enemyB = { id: 'B' };
      const enemyC = { id: 'C' };

      const time0 = 10.0;
      const permA0 = coord.requestPermission(enemyA, time0);
      const permB0 = coord.requestPermission(enemyB, time0);
      const permC0 = coord.requestPermission(enemyC, time0 + 0.05);

      const time1 = time0 + 0.17;
      const permB1 = coord.requestPermission(enemyB, time1);

      return { permA0, permB0, permC0, permB1 };
    })()`);

    if (!res.permA0) throw new Error('First shooter denied permission');
    if (res.permB0) throw new Error('Second simultaneous shooter granted permission in same tick');
    if (res.permC0) throw new Error('Third shooter granted permission inside 0.16s window');
    if (!res.permB1) throw new Error('Shooter denied permission after 0.16s interval elapsed');
    return res;
  });

  await step(9, 'offensive_token_released_on_enemy_death_or_state_change', async () => {
    const res = await b.evaluate(`(() => {
      const coord = window.__bp.offensiveCoordinator;
      coord.reset();

      const enemyA = { id: 'A' };
      const enemyB = { id: 'B' };

      coord.requestPermission(enemyA, 20.0);
      const activeBefore = coord.activeShooter === enemyA;

      coord.releasePermission(enemyA);
      const activeAfter = coord.activeShooter === null;

      coord.requestPermission(enemyB, 20.2);
      coord.reset();
      const activeAfterReset = coord.activeShooter === null;

      return { activeBefore, activeAfter, activeAfterReset };
    })()`);

    if (!res.activeBefore) throw new Error('Active shooter not tracked');
    if (!res.activeAfter) throw new Error('Token not released on releasePermission');
    if (!res.activeAfterReset) throw new Error('Coordinator not cleared on reset');
    return res;
  });

  await step(10, 'compatibility_with_spatial_navigation_cover_and_fsm', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const states = bp.enemies.filter(e => e.alive).map(e => e.brain ? e.brain.state : null);
      const uniqueStates = [...new Set(states)];
      const hasNav = bp.enemies.some(e => e.brain && e.brain.spatialNav);

      return { uniqueStates, hasNav, enemyCount: states.length };
    })()`);

    if (res.enemyCount === 0) throw new Error('No active enemies found');
    if (!res.hasNav) throw new Error('Enemies lost spatial navigation provider');
    return res;
  });

  await step(11, 'compatibility_with_search_and_destroy_mode', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      for (let s = 0; s < 40; s++) bp.stepSim(0.05);

      const sndState = bp.getSndState();
      const defuser = bp.enemies.find(e => e.sndRole === 'defuser' && e.alive);
      const escorts = bp.enemies.filter(e => e.sndRole === 'escort' && e.alive);

      return {
        sndActive: !!sndState && !sndState.ended,
        hasDefuser: !!defuser,
        escortCount: escorts.length
      };
    })()`);

    if (!res.sndActive) throw new Error('S&D mode not active');
    if (!res.hasDefuser) throw new Error('Defuser not spawned in S&D');
    if (res.escortCount < 1) throw new Error('Escorts not spawned in S&D');
    return res;
  });

  await step(12, 'framerate_invariance_across_30_60_120_fps', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;

      function runSim(dt, totalTime) {
        bp.startGame('waves');
        const steps = Math.round(totalTime / dt);
        for (let s = 0; s < steps; s++) {
          bp.stepSim(dt);
        }
        const state = bp.getWaveState();
        const alive = bp.enemies.filter(e => e.alive).length;
        return { wave: state.wave, waveTotal: state.waveTotal, alive, pending: state.wavePending };
      }

      const sim30 = runSim(1 / 30, 3.0);
      const sim60 = runSim(1 / 60, 3.0);
      const sim120 = runSim(1 / 120, 3.0);

      return { sim30, sim60, sim120 };
    })()`);

    if (res.sim30.alive > 6 || res.sim60.alive > 6 || res.sim120.alive > 6) {
      throw new Error('Alive enemies exceeded limit at some framerate: ' + JSON.stringify(res));
    }
    if (res.sim30.wave !== 1 || res.sim60.wave !== 1 || res.sim120.wave !== 1) {
      throw new Error('Wave mismatch across framerates');
    }
    return res;
  });

  await step(13, 'offensive_fairness_anti_starvation_distribution', async () => {
    const res = await b.evaluate(`(() => {
      const coord = window.__bp.offensiveCoordinator;
      coord.reset();

      const enemies = [
        { id: 'E0' },
        { id: 'E1' },
        { id: 'E2' },
        { id: 'E3' }
      ];

      const shotsPerEnemy = { E0: 0, E1: 0, E2: 0, E3: 0 };
      let currentTime = 1.0;

      for (let cycle = 0; cycle < 40; cycle++) {
        currentTime += 0.17;
        const offset = cycle % enemies.length;
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[(i + offset) % enemies.length];
          if (coord.requestPermission(e, currentTime)) {
            shotsPerEnemy[e.id]++;
            break;
          }
        }
      }

      return shotsPerEnemy;
    })()`);

    const counts = Object.values(res);
    const minShots = Math.min(...counts);
    const maxShots = Math.max(...counts);

    if (minShots === 0) throw new Error('Starvation detected! An enemy received 0 shots: ' + JSON.stringify(res));
    if (minShots < 7) throw new Error('Unfair distribution, min shots too low: ' + JSON.stringify(res));
    if (maxShots > 13) throw new Error('Unfair distribution, max shots too high: ' + JSON.stringify(res));
    return res;
  });

  await step(14, 'mode_isolation_snd_unconstrained_by_wave_coordinator', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      for (let s = 0; s < 40; s++) bp.stepSim(0.05);

      const coord = bp.offensiveCoordinator;
      const isSndUntouched = coord.lastFireTime === -Infinity;
      const activeInSnd = coord.activeShooter;

      bp.selectMode('waves');
      const resetOnModeSwitch = coord.lastFireTime === -Infinity && coord.activeShooter === null;

      return {
        mode: bp.getWaveState ? 'snd_or_waves' : 'unknown',
        isSndUntouched,
        activeInSnd,
        resetOnModeSwitch
      };
    })()`);

    if (!res.isSndUntouched) throw new Error('OffensivePressureCoordinator was invoked in S&D mode');
    if (res.activeInSnd !== null) throw new Error('Coordinator tracked an active shooter in S&D mode');
    if (!res.resetOnModeSwitch) throw new Error('Coordinator was not reset on selectMode');
    return res;
  });

  await step(15, 'deterministic_simulation_with_injectable_seed', async () => {
    const res = await b.evaluate(`(() => {
      const coord = window.__bp.offensiveCoordinator;

      function createMulberry32(seed) {
        return function() {
          let t = seed += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      function runSequence(seed) {
        coord.reset();
        coord.setRng(createMulberry32(seed));
        const history = [];
        const enemies = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
        let time = 0;
        for (let i = 0; i < 30; i++) {
          time += 0.05;
          const e = enemies[i % enemies.length];
          const granted = coord.requestPermission(e, time);
          const jitter = 0.08 + coord.rng() * 0.08;
          history.push({ i, granted, jitter: +jitter.toFixed(6) });
        }
        return history;
      }

      const seq1 = runSequence(12345);
      const seq2 = runSequence(12345);
      const seqDiff = runSequence(54321);

      const identical = JSON.stringify(seq1) === JSON.stringify(seq2);
      const different = JSON.stringify(seq1) !== JSON.stringify(seqDiff);

      coord.setRng(Math.random);
      return { identical, different };
    })()`);

    if (!res.identical) throw new Error('Seeded runs produced non-deterministic results');
    if (!res.different) throw new Error('Different seeds produced identical results unexpectedly');
    return res;
  });

  await step(16, 'death_listeners_multi_subscription_and_zero_leaks', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      for (let s = 0; s < 60; s++) bp.stepSim(0.05);

      const coord = bp.offensiveCoordinator;
      coord.reset();

      const victim = bp.enemies.find(e => e.alive);
      coord.requestPermission(victim, 100.0);
      const wasActive = coord.activeShooter === victim;
      const hadRecord = coord.lastShotTimeByEnemy.has(victim);

      bp.damageEnemy(victim, 9999, victim.group.position, false, null);

      const clearedActive = coord.activeShooter === null;
      const purgedRecord = !coord.lastShotTimeByEnemy.has(victim);

      bp.backToMenu();
      const resetOnMenu = coord.lastFireTime === -Infinity && coord.activeShooter === null && coord.lastShotTimeByEnemy.size === 0;

      return { wasActive, hadRecord, clearedActive, purgedRecord, resetOnMenu };
    })()`);

    if (!res.wasActive || !res.hadRecord) throw new Error('Victim was not registered in coordinator');
    if (!res.clearedActive) throw new Error('Active shooter was not cleared upon death');
    if (!res.purgedRecord) throw new Error('Dead enemy was retained in lastShotTimeByEnemy map');
    if (!res.resetOnMenu) throw new Error('Coordinator was not fully purged upon backToMenu');
    return res;
  });

} finally {
  await b.close();
  await srv.close();
}

console.log('\n========================================');
const passed = results.filter(r => r.ok).length;
const total = results.length;
console.log(`SPRINT 8.6 TEST RESULTS: ${passed}/${total} PASS`);
console.log('========================================');
if (passed !== total || total !== 16) {
  process.exit(1);
} else {
  process.exit(0);
}
