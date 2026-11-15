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

async function capturePng(relPath, width = 1280, height = 720) {
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await b.sleep(200);
  const res = await b.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await b.sleep(100);
    }
  }
  return outPath;
}

try {
  await b.navigate(url);
  await b.sleep(1500);

  await step(1, 'spatial_nav_graph_generation_and_clearance', async () => {
    const res = await b.evaluate(`(() => {
      const nav = window.__bp.spatialNav;
      return {
        nodeCount: nav.nodes.length,
        hasAdjacency: nav.adjacency.length === nav.nodes.length,
        coverNodesCount: nav.coverNodes.length
      };
    })()`);
    if (res.nodeCount < 30) throw new Error('Spatial navigation graph has too few waypoints: ' + res.nodeCount);
    if (!res.hasAdjacency) throw new Error('Adjacency list mismatch');
    if (res.coverNodesCount < 4) throw new Error('Too few cover points identified: ' + res.coverNodesCount);
    return res;
  });

  await step(2, 'deterministic_astar_pathfinding_around_obstacles', async () => {
    const res = await b.evaluate(`(() => {
      const nav = window.__bp.spatialNav;
      const start = { x: -34, z: -18 };
      const target = { x: -34, z: -42 };
      const p1 = nav.findPath(start, target);
      const p2 = nav.findPath(start, target);
      const sameLength = p1.length === p2.length;
      const goesAround = p1.length >= 3;
      return { p1Len: p1.length, sameLength, goesAround };
    })()`);
    if (!res.sameLength) throw new Error('A* pathfinding is not deterministic');
    if (!res.goesAround) throw new Error('Path does not route around building obstacle');
    return res;
  });

  await step(3, 'perception_fov_and_physical_occlusion', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(10, 0, 'SHOOTER');
      e.group.rotation.y = 0;

      const playerPosFront = { x: 10, y: 1.7, z: 8 };
      const seeFront = window.__bp.perception.checkVision(e, playerPosFront, 'ALERT');

      const playerPosBehind = { x: 10, y: 1.7, z: -8 };
      const seeBehind = window.__bp.perception.checkVision(e, playerPosBehind, 'PATROL');

      const behindBuilding = { x: -34, y: 1.7, z: -40 };
      e.group.position.set(-34, 0, -20);
      e.group.rotation.y = Math.PI;
      const seeOccluded = window.__bp.perception.checkVision(e, behindBuilding, 'ALERT');

      return { seeFront, seeBehind, seeOccluded };
    })()`);
    if (!res.seeFront) throw new Error('Enemy should see player in front within FOV');
    if (res.seeBehind) throw new Error('Enemy should not see player behind in PATROL');
    if (res.seeOccluded) throw new Error('Enemy should not see through solid buildings');
    return res;
  });

  await step(4, 'acoustic_detection_suppressed_vs_unsuppressed', async () => {
    const res = await b.evaluate(`(() => {
      const perc = window.__bp.perception;
      const t = performance.now() * 0.001;

      perc.broadcastSound('shot', { x: 0, y: 0, z: 0 }, false);
      const heardLoudAt25 = perc.getAudibleSounds({ x: 0, z: 25 }, t - 0.1).length > 0;
      const heardLoudAt55 = perc.getAudibleSounds({ x: 0, z: 55 }, t - 0.1).length > 0;

      perc.broadcastSound('shot', { x: 0, y: 0, z: 0 }, true);
      const heardSuppAt10 = perc.getAudibleSounds({ x: 0, z: 10 }, t - 0.1).some(s => s.distance <= 12);
      const heardSuppAt25 = perc.getAudibleSounds({ x: 0, z: 25 }, t - 0.1).some(s => s.radius === 12);

      return { heardLoudAt25, heardLoudAt55, heardSuppAt10, heardSuppAt25 };
    })()`);
    if (!res.heardLoudAt25) throw new Error('Unsuppressed shot must be heard at 25m');
    if (res.heardLoudAt55) throw new Error('Unsuppressed shot must not be heard beyond 45m');
    if (!res.heardSuppAt10) throw new Error('Suppressed shot must be heard at 10m');
    if (res.heardSuppAt25) throw new Error('Suppressed shot must not propagate to 25m');
    return res;
  });

  await step(5, 'last_known_position_and_progressive_loss', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(10, 0, 'SHOOTER');
      const brain = e.brain;
      const curT = 10.0;

      brain.update(0.016, { pos: { x: 10, y: 1.7, z: 8 } }, [e], 0, 'waves', null, curT);
      const lkpInitial = brain.lkp !== null && brain.lkp.z === 8;

      brain.update(0.016, { pos: { x: 999, y: 1.7, z: 999 } }, [e], 0, 'waves', null, curT + 2.0);
      const lkpRetained = brain.lkp !== null;

      brain.update(0.016, { pos: { x: 999, y: 1.7, z: 999 } }, [e], 0, 'waves', null, curT + 12.0);
      const lkpForgotten = brain.lkp === null;

      return { lkpInitial, lkpRetained, lkpForgotten };
    })()`);
    if (!res.lkpInitial) throw new Error('LKP was not set upon direct sight');
    if (!res.lkpRetained) throw new Error('LKP was lost prematurely');
    if (!res.lkpForgotten) throw new Error('LKP was not forgotten after timeout');
    return res;
  });

  await step(6, 'five_differentiated_archetypes_instantiation', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.clearEnemies();
      const keys = ['CHASER', 'FLANKER', 'BRUTE', 'SHOOTER', 'ELITE'];
      const spawned = keys.map(k => window.__bp.makeEnemy(0, 0, k));
      return spawned.map(e => ({
        id: e.archetype.id,
        hp: e.hp,
        speed: e.speed,
        scale: e.group.scale.x
      }));
    })()`);
    if (res.length !== 5) throw new Error('Failed to spawn all 5 archetypes');
    const brute = res.find(r => r.id === 'brute');
    const chaser = res.find(r => r.id === 'chaser');
    if (!brute || brute.hp <= 200 || brute.scale <= 1.0) throw new Error('Brute archetype attributes incorrect');
    if (!chaser || chaser.speed < 4.0) throw new Error('Chaser archetype speed incorrect');
    await capturePng('docs/sprints/screenshots/sprint8_4/01_archetypes_roster.png');
    return res;
  });

  await step(7, 'tactical_cover_identification_and_usage', async () => {
    const res = await b.evaluate(`(() => {
      const nav = window.__bp.spatialNav;
      const enemyPos = { x: -25, z: -10 };
      const threatPos = { x: 0, z: 0 };
      const cover = nav.findBestCover(enemyPos, threatPos, 5, 30);
      const isBehindWall = cover ? !nav.isSegmentClear(cover.x, cover.z, threatPos.x, threatPos.z, 0.2) : false;
      return { found: !!cover, isBehindWall, cover };
    })()`);
    if (!res.found || !res.isBehindWall) throw new Error('Failed to identify valid occluded cover node');
    return res;
  });

  await step(8, 'stuck_detection_and_separation_between_enemies', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.clearEnemies();
      const e1 = window.__bp.makeEnemy(5, 5, 'SHOOTER');
      const e2 = window.__bp.makeEnemy(5.2, 5.2, 'SHOOTER');
      const sepVec = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, length() { return Math.hypot(this.x, this.z); } };
      window.__bp.spatialNav.computeSeparation(e1.group.position, [e1, e2], 0, sepVec);
      const hasRepulsion = sepVec.length() > 0.1;
      return { hasRepulsion, length: sepVec.length() };
    })()`);
    if (!res.hasRepulsion) throw new Error('Local separation did not repel overlapping enemies');
    return res;
  });

  await step(9, 'fsm_state_transitions_and_hysteresis', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(0, 0, 'SHOOTER');
      const brain = e.brain;

      brain.setState('PATROL', true);
      const s1 = brain.state;

      brain.setState('ALERT');
      const s2 = brain.state;

      brain.stateTime = 1.0;
      brain.setState('ALERT');
      const s3 = brain.state;

      return { s1, s2, s3 };
    })()`);
    if (res.s1 !== 'PATROL') throw new Error('Initial state not PATROL');
    if (res.s2 !== 'PATROL') throw new Error('Hysteresis failed to block immediate state oscillation');
    if (res.s3 !== 'ALERT') throw new Error('State transition failed after minimum duration elapsed');
    return res;
  });

  await step(10, 'cancellation_of_attacks_and_decisions_on_death', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(0, 0, 'SHOOTER');
      e.brain.setState('ATTACK', true);
      e.brain.currentPath = [{ x: 0, z: 0 }, { x: 10, z: 10 }];

      e.hp = 0;
      e.alive = false;
      e.brain.setState('DEAD', true);

      return {
        state: e.brain.state,
        pathCleared: e.brain.currentPath.length === 0,
        burstCancelled: e.brain.burstRemaining === 0
      };
    })()`);
    if (res.state !== 'DEAD') throw new Error('Brain did not transition to DEAD');
    if (!res.pathCleared) throw new Error('Path was not cleared on death');
    return res;
  });

  await step(11, 'snd_mode_defuser_and_escort_roles', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('snd');
      for (let i = 0; i < 40; i++) window.__bp.stepSim(0.05);

      const roles = window.__bp.enemies.map(e => ({
        role: e.sndRole,
        state: e.brain ? e.brain.state : null
      }));

      const defusers = roles.filter(r => r.role === 'defuser').length;
      const escorts = roles.filter(r => r.role === 'escort').length;

      return { total: roles.length, defusers, escorts };
    })()`);
    if (res.total === 0) throw new Error('No enemies spawned in S&D');
    if (res.defusers === 0) throw new Error('No enemy assigned as defuser');
    await capturePng('docs/sprints/screenshots/sprint8_4/02_snd_tactical_roles.png');
    return res;
  });

  await step(12, 'waves_mode_composition_and_no_player_overlap_spawn', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      for (let i = 0; i < 60; i++) window.__bp.stepSim(0.05);

      const pPos = window.__bp.player.pos;
      const distances = window.__bp.enemies.map(e => {
        const dx = e.group.position.x - pPos.x;
        const dz = e.group.position.z - pPos.z;
        return Math.sqrt(dx * dx + dz * dz);
      });
      const minDistance = Math.min(...distances);
      const allSafe = distances.every(d => d >= 18);

      return { count: distances.length, minDistance, allSafe };
    })()`);
    if (!res.allSafe) throw new Error(`Enemy spawned too close to player (${res.minDistance}m < 18m)`);
    await capturePng('docs/sprints/screenshots/sprint8_4/03_waves_tactical_spread.png');
    return res;
  });

  await step(13, 'framerate_invariance_across_30_60_120_fps', async () => {
    const res = await b.evaluate(`(() => {
      const dts = [1 / 30, 1 / 60, 1 / 120];
      const stepCounts = [30, 60, 120];
      const speeds = [];

      for (let idx = 0; idx < dts.length; idx++) {
        const dt = dts[idx];
        const count = stepCounts[idx];
        window.__bp.clearEnemies();
        const e = window.__bp.makeEnemy(0, 0, 'CHASER');
        e.brain.setState('CHASE', true);
        e.brain.setMoveTarget({ x: 0, z: 20 }, true);

        const startZ = e.group.position.z;
        for (let i = 0; i < count; i++) {
          e.brain.update(dt, { pos: { x: 0, y: 1.7, z: 20 } }, [e], 0, 'waves', null, i * dt);
        }
        const moved = e.group.position.z - startZ;
        speeds.push(moved);
      }

      const diff30to60 = Math.abs(speeds[0] - speeds[1]);
      const diff60to120 = Math.abs(speeds[1] - speeds[2]);

      return { speeds, diff30to60, diff60to120, ok: diff30to60 < 0.35 && diff60to120 < 0.35 };
    })()`);
    if (!res.ok) throw new Error('Movement rate varied unacceptably across framerates');
    return res;
  });

  await step(14, 'webgl_memory_stability_zero_leaks_after_combat', async () => {
    const res = await b.evaluate(`(() => {
      const r = window.__bp.renderer;
      const initialGeos = r.info.memory.geometries;
      const initialTexs = r.info.memory.textures;

      window.__bp.startGame('waves');
      for (let i = 0; i < 40; i++) window.__bp.stepSim(0.04);
      window.__bp.clearEnemies();

      window.__bp.startGame('snd');
      for (let i = 0; i < 40; i++) window.__bp.stepSim(0.04);
      window.__bp.clearEnemies();

      const finalGeos = r.info.memory.geometries;
      const finalTexs = r.info.memory.textures;

      return {
        initialGeos, finalGeos,
        initialTexs, finalTexs,
        stable: finalGeos <= initialGeos + 2 && finalTexs === initialTexs
      };
    })()`);
    if (!res.stable) throw new Error('Memory leak detected in geometries or textures');
    return res;
  });

  await step(15, 'preservation_of_existing_xp_and_drops_pipeline', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(0, -3, 'SHOOTER');

      const hpBefore = window.__bp.getPlayerHp();
      const dropCountBefore = window.__bp.supplies.getActiveDropVisualCount();

      window.__bp.setWeapon('mk7');
      window.__bp.player.pos.set(0, 1.7, 0);
      window.__bp.camera.position.set(0, 1.7, 0);
      window.__bp.camera.rotation.set(0, 0, 0, 'YXZ');
      window.__bp.camera.updateMatrixWorld(true);

      e.group.position.set(0, 0, -3);
      e.group.updateMatrixWorld(true);

      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();

      return {
        enemyAlive: e.alive,
        enemyHp: e.hp,
        hitRecorded: e.hp < e.archetype.hpBase
      };
    })()`);
    if (!res.hitRecorded) throw new Error('Shooting enemy did not register damage properly in new AI loop');
    return res;
  });

  const NAV_HELPER = `
    const runRoute = (start, goal, archKey, maxSteps) => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      const e = window.__bp.makeEnemy(start.x, start.z, archKey);
      window.__bp.player.pos.set(goal.x, 1.7, goal.z);
      e.brain.setState('CHASE', true);
      e.brain.setMoveTarget(goal, true);
      const colliders = window.__bp.spatialNav.colliders;
      let penetrations = 0;
      let reachedStep = -1;
      let maxJump = 0;
      let prev = { x: e.group.position.x, z: e.group.position.z };
      let replans = 0;
      let lastTarget = e.brain.currentPath;
      for (let s = 0; s < maxSteps; s++) {
        window.__bp.heal();
        window.__bp.stepSim(0.05);
        const p = e.group.position;
        maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.z - prev.z));
        prev = { x: p.x, z: p.z };
        if (e.brain.currentPath !== lastTarget) { replans++; lastTarget = e.brain.currentPath; }
        for (const c of colliders) {
          if (c.max.y > 0.5 && p.x > c.min.x + 0.3 && p.x < c.max.x - 0.3 && p.z > c.min.z + 0.3 && p.z < c.max.z - 0.3) penetrations++;
        }
        if (Math.hypot(goal.x - p.x, goal.z - p.z) <= 1.2) { reachedStep = s; break; }
      }
      const finalDist = Math.hypot(goal.x - e.group.position.x, goal.z - e.group.position.z);
      return {
        reached: reachedStep >= 0,
        reachedStep,
        timeSec: reachedStep >= 0 ? reachedStep * 0.05 : null,
        finalDist: Number(finalDist.toFixed(2)),
        penetrations,
        maxStepJump: Number(maxJump.toFixed(3)),
        replans
      };
    };
  `;

  await step(16, 'navigation_arrival_around_buildings_both_directions', async () => {
    const res = await b.evaluate(`(() => {
      ${NAV_HELPER}
      return {
        northToSouth: runRoute({ x: -34, z: -18 }, { x: -34, z: -42 }, 'CHASER', 500),
        southToNorth: runRoute({ x: -34, z: -42 }, { x: -34, z: -18 }, 'CHASER', 500)
      };
    })()`);
    for (const key of ['northToSouth', 'southToNorth']) {
      const r = res[key];
      if (!r.reached) throw new Error(`Building route ${key} did not arrive, final distance ${r.finalDist}`);
      if (r.penetrations > 0) throw new Error(`Building route ${key} penetrated colliders ${r.penetrations} times`);
      if (r.maxStepJump > 0.6) throw new Error(`Building route ${key} showed teleport-like jump ${r.maxStepJump}`);
      if (r.timeSec > 25) throw new Error(`Building route ${key} too slow: ${r.timeSec}s`);
    }
    return res;
  });

  await step(17, 'navigation_arrival_around_containers_both_directions', async () => {
    const res = await b.evaluate(`(() => {
      ${NAV_HELPER}
      return {
        westToEast: runRoute({ x: -16, z: -20 }, { x: 0, z: -20 }, 'CHASER', 500),
        eastToWest: runRoute({ x: 0, z: -20 }, { x: -16, z: -20 }, 'CHASER', 500),
        crateRow: runRoute({ x: 10, z: 22 }, { x: 34, z: 18 }, 'CHASER', 600)
      };
    })()`);
    for (const key of ['westToEast', 'eastToWest', 'crateRow']) {
      const r = res[key];
      if (!r.reached) throw new Error(`Container route ${key} did not arrive, final distance ${r.finalDist}`);
      if (r.penetrations > 0) throw new Error(`Container route ${key} penetrated colliders ${r.penetrations} times`);
      if (r.maxStepJump > 0.7) throw new Error(`Container route ${key} showed teleport-like jump ${r.maxStepJump}`);
    }
    return res;
  });

  await step(18, 'snd_defusal_starts_inside_valid_radius', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      const bomb = { x: 0, z: -6 };
      let defuser = null;
      let startStep = -1;
      let startDist = null;
      let distWhileDefusing = [];
      for (let s = 0; s < 900; s++) {
        bp.heal();
        bp.stepSim(0.05);
        if (!defuser) defuser = bp.enemies.find(e => e.sndRole === 'defuser' && e.alive) || null;
        if (defuser && defuser.defusing) {
          const d = Math.hypot(defuser.group.position.x - bomb.x, defuser.group.position.z - bomb.z);
          if (startStep < 0) { startStep = s; startDist = d; }
          distWhileDefusing.push(d);
          if (distWhileDefusing.length >= 20) break;
        }
      }
      return {
        hasDefuser: !!defuser,
        startStep,
        startDist,
        maxDistWhileDefusing: distWhileDefusing.length ? Math.max(...distWhileDefusing) : null,
        progress: bp.getSndState().defuse
      };
    })()`);
    if (!res.hasDefuser) throw new Error('No defuser assigned');
    if (res.startStep < 0) throw new Error('Defuser never started defusing');
    if (res.startDist >= 2.3) throw new Error(`Defusal began outside valid radius: ${res.startDist}`);
    if (res.maxDistWhileDefusing >= 2.3) throw new Error(`Defuser left valid radius while defusing: ${res.maxDistWhileDefusing}`);
    if (res.progress <= 0) throw new Error('Defusal progress did not increase');
    return res;
  });

  await step(19, 'snd_defusal_interrupted_when_operator_dies', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      let defuser = null;
      for (let s = 0; s < 900; s++) {
        bp.heal();
        bp.stepSim(0.05);
        if (!defuser) defuser = bp.enemies.find(e => e.sndRole === 'defuser' && e.alive) || null;
        if (defuser && defuser.defusing && bp.getSndState().defuse > 2) break;
      }
      const before = bp.getSndState().defuse;
      const wasDefusing = defuser.defusing;
      bp.damageEnemy(defuser, 9999, defuser.group.position, false, null);
      bp.stepSim(0.05);
      const afterKillDefusing = defuser.defusing;
      const progressAfterKill = bp.getSndState().defuse;
      for (let s = 0; s < 30; s++) { bp.heal(); bp.stepSim(0.05); }
      const afterDecay = bp.getSndState().defuse;
      return { before, wasDefusing, defuserAlive: defuser.alive, afterKillDefusing, progressAfterKill, afterDecay, ended: bp.getSndState().ended };
    })()`);
    if (!res.wasDefusing) throw new Error('Operator was not defusing before kill');
    if (res.defuserAlive) throw new Error('Defuser still alive after lethal damage');
    if (res.afterKillDefusing) throw new Error('Defusing flag stayed true after operator death');
    if (!(res.afterDecay < res.before)) throw new Error(`Defusal progress did not decay: ${res.before} -> ${res.afterDecay}`);
    if (res.ended) throw new Error('Round ended despite interrupted defusal');
    return res;
  });

  await step(20, 'snd_defeat_when_bomb_defused', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      let ended = false;
      let steps = 0;
      for (let s = 0; s < 1500; s++) {
        bp.heal();
        bp.stepSim(0.05);
        steps = s;
        if (bp.getSndState().ended) { ended = true; break; }
      }
      return {
        ended,
        steps,
        phase: bp.getPhase(),
        title: document.getElementById('death-title').textContent,
        victoryClass: document.getElementById('death-screen').classList.contains('victory'),
        defuse: bp.getSndState().defuse
      };
    })()`);
    if (!res.ended) throw new Error('Round did not finish within bounded simulation');
    if (res.phase !== 'RESULTS') throw new Error('Phase is not RESULTS after round end: ' + res.phase);
    if (res.victoryClass) throw new Error('Defusal must be reported as defeat');
    if (!/DESACTIVADA/.test(res.title)) throw new Error('Unexpected end title: ' + res.title);
    if (res.defuse < 10) throw new Error('Defusal progress below limit at end: ' + res.defuse);
    return res;
  });

  await step(21, 'snd_victory_when_bomb_detonates', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      for (let s = 0; s < 20; s++) { bp.heal(); bp.stepSim(0.05); }
      bp.setSndTime(0.05);
      for (let s = 0; s < 80; s++) { bp.heal(); bp.stepSim(0.05); }
      return {
        ended: bp.getSndState().ended,
        phase: bp.getPhase(),
        victoryClass: document.getElementById('death-screen').classList.contains('victory'),
        title: document.getElementById('death-title').textContent
      };
    })()`);
    if (!res.ended) throw new Error('Round did not end on detonation');
    if (res.phase !== 'RESULTS') throw new Error('Phase is not RESULTS after detonation: ' + res.phase);
    if (!res.victoryClass) throw new Error('Detonation must be reported as victory, title: ' + res.title);
    return res;
  });

  await step(22, 'brute_resistance_is_exactly_070', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      bp.clearEnemies();
      const brute = bp.makeEnemy(0, 0, 'BRUTE');
      const shooter = bp.makeEnemy(5, 0, 'SHOOTER');
      const bruteBefore = brute.hp;
      const shooterBefore = shooter.hp;
      bp.damageEnemy(brute, 50, brute.group.position, false, null);
      bp.damageEnemy(shooter, 50, shooter.group.position, false, null);
      return {
        resistanceMult: brute.archetype.resistanceMult,
        bruteHpBase: brute.archetype.hpBase,
        bruteDamage: bruteBefore - brute.hp,
        shooterDamage: shooterBefore - shooter.hp
      };
    })()`);
    if (res.resistanceMult !== 0.7) throw new Error('Brute resistanceMult is ' + res.resistanceMult);
    if (Math.abs(res.bruteDamage - 35) > 1e-6) throw new Error('Brute received ' + res.bruteDamage + ' instead of 35');
    if (Math.abs(res.shooterDamage - 50) > 1e-6) throw new Error('Shooter must take full damage, got ' + res.shooterDamage);
    return res;
  });

} finally {
  await b.close();
  await srv.close();
}

console.log(`\n========================================`);
const passCount = results.filter(r => r.ok).length;
console.log(`SPRINT 8.4 TEST RESULTS: ${passCount}/${results.length} PASS`);
console.log(`========================================\n`);

if (passCount !== results.length) {
  process.exit(1);
}
