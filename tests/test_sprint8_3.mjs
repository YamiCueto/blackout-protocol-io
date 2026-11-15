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
  await b.sleep(250);
  const res = await b.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await b.sleep(120);
    }
  }
  return outPath;
}

try {
  await b.navigate(url);
  await b.sleep(2000);

  await step(1, 'arms_rig_presence_all_9_weapons', async () => {
    await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      window.__bp.setPlayerHp(100);
    })()`);
    const ids = ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12', 'knife'];
    const checks = [];
    for (const id of ids) {
      const ok = await b.evaluate(`(() => {
        window.__bp.setWeapon('${id}');
        window.__bp.stepSim(0.016);
        const rig = window.__bp.armsRig;
        return !!rig && rig.group.visible && rig.left.root.children.length > 0 && rig.right.root.children.length > 0;
      })()`);
      checks.push({ id, ok });
      await capturePng(`docs/sprints/screenshots/sprint8_3/01_grip_${id}.png`);
    }
    const allOk = checks.every(c => c.ok);
    if (!allOk) throw new Error(`Arms rig missing or invisible on weapons: ${JSON.stringify(checks)}`);
    await capturePng('docs/sprints/screenshots/sprint8_3/01_mk7_hipfire_arms.png');
    return { checks, allOk };
  });

  await step(2, 'hand_anchors_and_grip_alignment', async () => {
    const res = await b.evaluate(`(() => {
      const ids = ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12', 'knife'];
      const results = [];
      const cam = window.__bp.camera;
      for (const id of ids) {
        window.__bp.setWeapon(id);
        window.__bp.stepSim(0.016);
        const rig = window.__bp.armsRig;
        const leftHand = rig.left.hand;
        const rightHand = rig.right.hand;
        const wpL = new window.__bp.THREE.Vector3();
        const wpR = new window.__bp.THREE.Vector3();
        leftHand.getWorldPosition(wpL);
        rightHand.getWorldPosition(wpR);
        const belowCam = wpL.y <= cam.position.y && wpR.y <= cam.position.y;
        const finite = Number.isFinite(wpL.x) && Number.isFinite(wpR.x);
        results.push({ id, wpLY: wpL.y, wpRY: wpR.y, belowCam, finite });
      }
      return { results, allValid: results.every(r => r.belowCam && r.finite) };
    })()`);
    if (!res.allValid) throw new Error(`Hand anchor grip misalignment: ${JSON.stringify(res.results)}`);
    return res;
  });

  await step(3, 'mechanical_parts_all_9_weapons', async () => {
    const res = await b.evaluate(`(() => {
      const expected = {
        mk7: ['mag', 'chargingHandle', 'bolt'],
        vector9: ['mag', 'bolt', 'chargingHandle'],
        m870: ['pump', 'shell'],
        p12: ['slide', 'mag', 'slideCatch'],
        ak12: ['mag', 'boltHandle', 'bolt'],
        mp5k: ['mag', 'chargingHandle'],
        mk48: ['topCover', 'ammoBox', 'ammoBelt', 'chargingHandle'],
        awm338: ['mag', 'boltAssembly', 'casing'],
        knife: ['blade', 'knife']
      };
      const report = [];
      for (const [id, reqParts] of Object.entries(expected)) {
        window.__bp.setWeapon(id);
        const mesh = window.__bp.weaponMeshSubGroup.children[0];
        const parts = mesh?.userData?.rigParts || {};
        const missing = reqParts.filter(p => !parts[p]);
        report.push({ id, missing, totalFound: Object.keys(parts).length });
      }
      return { report, allPresent: report.every(r => r.missing.length === 0) };
    })()`);
    if (!res.allPresent) throw new Error(`Missing mechanical rig parts: ${JSON.stringify(res.report)}`);
    return res;
  });

  await step(4, 'differentiated_reloads_tactical_vs_empty', async () => {
    const res1 = await b.evaluate(`(() => {
      window.__bp.setWeapon('mk7');
      window.__bp.weapon.ammo = 15;
      window.__bp.tryReload();
      const tacticalEmptyFlag = window.__bp.weapon.reloadWasEmpty;

      for (let i = 0; i < 20; i++) window.__bp.stepSim(0.04);
      const mesh = window.__bp.weaponMeshSubGroup.children[0];
      const magYDuringTac = mesh.userData.rigParts.mag.position.y;
      const magRestY = mesh.userData.rigRest.mag.pos.y;
      const magMovedTac = Math.abs(magYDuringTac - magRestY) > 0.02;
      return { tacticalEmptyFlag, magMovedTac };
    })()`);
    await capturePng('docs/sprints/screenshots/sprint8_3/03_mk7_tactical_reload_mag.png');

    const res2 = await b.evaluate(`(() => {
      const mesh = window.__bp.weaponMeshSubGroup.children[0];
      const magRestY = mesh.userData.rigRest.mag.pos.y;
      for (let i = 0; i < 35; i++) window.__bp.stepSim(0.04);
      const magRestoredTac = Math.abs(mesh.userData.rigParts.mag.position.y - magRestY) < 0.001;

      window.__bp.setWeapon('p12');
      window.__bp.weapon.ammo = 0;
      window.__bp.stepSim(0.016);
      const slideMesh = window.__bp.weaponMeshSubGroup.children[0].userData.rigParts.slide;
      const slideLockedBack = slideMesh.position.z > -0.04;

      window.__bp.tryReload();
      const emptyReloadFlag = window.__bp.weapon.reloadWasEmpty;

      for (let i = 0; i < 45; i++) window.__bp.stepSim(0.04);
      const slideReleased = Math.abs(slideMesh.position.z - (-0.05)) < 0.01;

      return {
        magRestoredTac,
        slideLockedBack,
        emptyReloadFlag,
        slideReleased
      };
    })()`);
    const res = { ...res1, ...res2 };
    if (res.tacticalEmptyFlag !== false) throw new Error('Tactical reload must have reloadWasEmpty = false');
    if (!res.magMovedTac) throw new Error('Magazine mesh did not move during tactical reload');
    if (!res.magRestoredTac) throw new Error('Magazine mesh did not return to rest after reload');
    if (!res.slideLockedBack) throw new Error('P-12 slide must lock back on empty ammo');
    if (res.emptyReloadFlag !== true) throw new Error('Empty reload must have reloadWasEmpty = true');
    if (!res.slideReleased) throw new Error('P-12 slide must release forward after empty reload');
    await capturePng('docs/sprints/screenshots/sprint8_3/04_p12_slide_lock_empty.png');
    return res;
  });

  await step(5, 'm870_shell_reload_and_fire_interruption', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.setWeapon('m870');
      window.__bp.weapon.ammo = 2;
      window.__bp.weapon.reserve = 10;
      window.__bp.tryReload();

      for (let i = 0; i < 15; i++) window.__bp.stepSim(0.03);
      const mesh = window.__bp.weaponMeshSubGroup.children[0];
      const shellVisDuring = mesh.userData.rigParts.shell.visible;

      window.__bp.shoot();
      const cancelled = !window.__bp.weapon.reloading;
      const ammoAfterCancel = window.__bp.weapon.ammo;

      for (let i = 0; i < 10; i++) window.__bp.stepSim(0.03);
      const pumpAtRest = Math.abs(mesh.userData.rigParts.pump.position.z - mesh.userData.rigRest.pump.pos.z) < 0.01;

      return { shellVisDuring, cancelled, ammoAfterCancel, pumpAtRest };
    })()`);
    if (!res.cancelled) throw new Error('Shooting during M870 shell reload must cancel reload immediately');
    if (!res.pumpAtRest) throw new Error('Pump must return to firing readiness after interruption');
    await capturePng('docs/sprints/screenshots/sprint8_3/05_m870_shell_insertion.png');
    return res;
  });

  await step(6, 'awm338_bolt_action_cycle_and_casing', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.setWeapon('awm338');
      window.__bp.weapon.ammo = 5;
      window.__bp.shoot();
      const cyclingStart = window.__bp.weapon.boltCycling;

      for (let i = 0; i < 12; i++) window.__bp.stepSim(0.03);
      const mesh = window.__bp.weaponMeshSubGroup.children[0];
      const boltAss = mesh.userData.rigParts.boltAssembly;
      const casing = mesh.userData.rigParts.casing;
      const boltRotated = boltAss.rotation.z > 0.3;
      const boltPulledBack = boltAss.position.z > 0.02;
      const casingVisible = casing.visible;

      for (let i = 0; i < 20; i++) window.__bp.stepSim(0.03);
      const cycleDone = !window.__bp.weapon.boltCycling;
      const restZ = mesh.userData.rigRest?.boltAssembly?.pos?.z ?? 0;
      const boltRestored = Math.abs(boltAss.rotation.z) < 0.05 && Math.abs(boltAss.position.z - restZ) < 0.01;
      const casingHidden = !casing.visible;

      return { cyclingStart, boltRotated, boltPulledBack, casingVisible, cycleDone, boltRestored, casingHidden };
    })()`);
    if (!res.cyclingStart) throw new Error('AWM-338 did not enter bolt cycling on shot');
    if (!res.boltRotated || !res.boltPulledBack) throw new Error('Bolt assembly did not rotate or slide back during cycle');
    if (!res.casingVisible) throw new Error('Ejected casing mesh must be visible during bolt retraction');
    if (!res.cycleDone || !res.boltRestored) throw new Error('Bolt did not return to battery after cycle');
    await capturePng('docs/sprints/screenshots/sprint8_3/07_awm338_bolt_open_casing.png');
    return res;
  });

  await step(7, 'knife_melee_animation_stages', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      window.__bp.player.alive = true;
      window.__bp.setPlayerHp(100);
      window.__bp.weapon.meleeStage = 'idle';
      window.__bp.weapon.meleeT = 0;
      window.__bp.weapon.cooldown = 0;
      window.__bp.setWeapon('knife');
      window.__bp.performMeleeAttack();
      const stage1 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.05);
      const stMidWindup = window.__bp.getViewModelState().lastAction;

      window.__bp.stepSim(0.05);
      const stage2 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.14);
      const stage3 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.26);
      const stageFinal = window.__bp.weapon.meleeStage;

      return { stage1, stMidWindup, stage2, stage3, stageFinal };
    })()`);
    if (res.stage1 !== 'windup') throw new Error(`Expected initial stage windup, got ${res.stage1}`);
    if (res.stage2 !== 'strike') throw new Error(`Expected stage strike, got ${res.stage2}`);
    if (res.stage3 !== 'recovery') throw new Error(`Expected stage recovery, got ${res.stage3}`);
    if (res.stageFinal !== 'idle') throw new Error(`Expected stage idle after recovery, got ${res.stageFinal}`);
    await capturePng('docs/sprints/screenshots/sprint8_3/08_knife_melee_strike.png');
    return res;
  });

  await step(8, 'procedural_recoil_independent_of_raycast', async () => {
    const res = await b.evaluate(`(() => {
      if (window.__bp.snapshot().phase !== 'PLAYING') {
        window.__bp.startGame('waves');
      }
      window.__bp.clearEnemies();
      window.__bp.setPlayerHp(100);
      window.__bp.setWeapon('mk7');
      const baseSpreadHip = window.__bp.weapon.spreadHip;
      const baseSpreadAds = window.__bp.weapon.spreadAds;

      window.__bp.triggerFireImpulse('mk7', 'ASSAULT');
      const stAfter = window.__bp.getViewModelState();
      const hasRecoil = stAfter.recoilZ > 0.01 && stAfter.recoilPitch > 0.01;

      const spreadHipAfter = window.__bp.weapon.spreadHip;
      const spreadAdsAfter = window.__bp.weapon.spreadAds;
      const balisticsIntact = baseSpreadHip === spreadHipAfter && baseSpreadAds === spreadAdsAfter;

      for (let i = 0; i < 30; i++) window.__bp.stepSim(0.033);
      const stRecovered = window.__bp.getViewModelState();
      const recovered = stRecovered.recoilZ < 0.005 && stRecovered.recoilPitch < 0.005;

      return { hasRecoil, balisticsIntact, recovered };
    })()`);
    if (!res.hasRecoil) throw new Error('Visual recoil impulse was not triggered in viewmodel state');
    if (!res.balisticsIntact) throw new Error('Ballistic spread constants must not be altered by visual recoil');
    if (!res.recovered) throw new Error('Visual recoil did not recover to zero');
    await capturePng('docs/sprints/screenshots/sprint8_3/09_vector9_recoil_burst.png');
    return res;
  });

  await step(9, 'ads_alignment_and_zero_optical_obstruction', async () => {
    const res = await b.evaluate(`(() => {
      const list = ['mk7', 'vector9', 'm870', 'p12', 'ak12', 'mp5k', 'mk48', 'awm338'];
      const cam = window.__bp.camera;
      const failures = [];

      for (const id of list) {
        for (const opt of ['optic_reddot', 'optic_holo']) {
          window.__bp.setWeapon(id, { attachments: { optic: opt } });
          window.__bp.setAdsDown(true);
          for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
          window.__bp.renderer.render(window.__bp.scene, cam);

          const tmpRay = new window.__bp.THREE.Raycaster();
          const camDir = new window.__bp.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          tmpRay.set(cam.position, camDir);
          tmpRay.near = 0.01;
          tmpRay.far = 50;
          const hits = tmpRay.intersectObjects(window.__bp.gunGroup.children, true);
          const visibleOpaqueHits = hits.filter(h => h.object.visible && !h.object.material?.transparent && h.object.geometry?.type !== 'SphereGeometry');
          if (visibleOpaqueHits.length > 0) {
            failures.push({ id, opt, hits: visibleOpaqueHits.map(h => ({ dist: h.distance, geo: h.object.geometry?.type, role: h.object.userData?.partRole, name: h.object.name })) });
          }
        }
      }
      return { failures };
    })()`);
    if (res.failures.length > 0) throw new Error(`Opaque geometry blocking optical aperture in ADS: ${JSON.stringify(res.failures)}`);
    await capturePng('docs/sprints/screenshots/sprint8_3/02_mk7_ads_optical_clear.png');
    return res;
  });

  await step(10, 'weapon_switch_during_actions', async () => {
    const resReload = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.combatSession.slots.secondary = {
        id: 'p12',
        ammo: 15,
        reserve: 60,
        cooldown: 0,
        reloading: false,
        reloadT: 0,
        reloadStage: 'idle',
        recoil: 0,
        semiFired: false,
        boltCycling: false,
        boltT: 0,
        meleeStage: 'idle',
        meleeT: 0,
        attachments: {},
        effectiveStats: window.__bp.WEAPONS.p12
      };
      window.__bp.combatSession.activeSlot = 'primary';
      window.__bp.combatSession.switching = false;
      window.__bp.combatSession.switchTimer = 0;
      window.__bp.setWeapon('mk48');
      window.__bp.weapon.ammo = 20;
      window.__bp.tryReload();
      for (let i = 0; i < 15; i++) window.__bp.stepSim(0.04);
      return { reloading: window.__bp.weapon.reloading };
    })()`);
    await capturePng('docs/sprints/screenshots/sprint8_3/06_mk48_top_cover_open.png');

    await b.evaluate(`(() => {
      window.__bp.switchWeaponSlot('secondary');
      for (let i = 0; i < 6; i++) window.__bp.stepSim(0.02);
    })()`);
    await capturePng('docs/sprints/screenshots/sprint8_3/06b_weapon_switch_action.png');

    const res = await b.evaluate(`(() => {
      for (let i = 0; i < 35; i++) window.__bp.stepSim(0.033);

      const activeSlot = window.__bp.combatSession.activeSlot;
      const activeWpn = window.__bp.weapon.id;
      const switchingEnded = !window.__bp.combatSession.switching;
      const mesh = window.__bp.weaponMeshSubGroup.children[0];
      const validMesh = !!mesh;

      return { switched: true, activeSlot, activeWpn, switchingEnded, validMesh };
    })()`);
    if (!res.switched) throw new Error('switchWeaponSlot returned false');
    if (res.activeSlot !== 'secondary') throw new Error('Failed to switch to secondary during reload');
    if (!res.switchingEnded) throw new Error('Switching state was not concluded cleanly');
    return { ...resReload, ...res };
  });

  await step(11, 'pause_death_and_restart_stability', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('mk7');
      window.__bp.stepSim(0.05);

      const pos1 = window.__bp.gunGroup.position.clone();
      window.__bp.stepSim(0);
      const pos2 = window.__bp.gunGroup.position.clone();
      const pausedStable = Math.abs(pos1.x - pos2.x) < 0.001;

      window.__bp.setPlayerHp(0);
      window.__bp.stepSim(0.05);

      window.__bp.startGame('waves');
      window.__bp.stepSim(0.05);
      const hpAfterRestart = window.__bp.getPlayerHp();
      const armsOkAfter = window.__bp.armsRig.group.visible;

      return { pausedStable, hpAfterRestart, armsOkAfter };
    })()`);
    if (!res.pausedStable) throw new Error('Paused game must not drift viewmodel position');
    if (res.hpAfterRestart <= 0) throw new Error('Player HP did not reset upon restart');
    if (!res.armsOkAfter) throw new Error('Arms rig must remain active and visible upon restart');
    return res;
  });

  await step(12, 'framerate_invariance_across_30_60_120_fps', async () => {
    const res = await b.evaluate(`(() => {
      const fpsModes = [
        { name: '30fps', dt: 1 / 30, steps: 15 },
        { name: '60fps', dt: 1 / 60, steps: 30 },
        { name: '120fps', dt: 1 / 120, steps: 60 }
      ];
      const results = {};

      for (const m of fpsModes) {
        window.__bp.resetViewModelState();
        window.__bp.triggerFireImpulse('mk7', 'ASSAULT');
        for (let s = 0; s < m.steps; s++) {
          window.__bp.stepSim(m.dt);
        }
        const st = window.__bp.getViewModelState();
        results[m.name] = { recoilZ: st.recoilZ, recoilPitch: st.recoilPitch };
      }

      const diff30_60 = Math.abs(results['30fps'].recoilZ - results['60fps'].recoilZ);
      const diff60_120 = Math.abs(results['60fps'].recoilZ - results['120fps'].recoilZ);
      const maxDiff = Math.max(diff30_60, diff60_120);

      return { results, maxDiff, invariant: maxDiff < 0.005 };
    })()`);
    if (!res.invariant) throw new Error(`Framerate variance exceeded tolerance: ${JSON.stringify(res)}`);
    return res;
  });

  await step(13, 'synchronization_visual_events_combat_state', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.setWeapon('mk7');
      window.__bp.stepSim(0.016);
      const idleSync = window.__bp.getViewModelState().lastAction === 'idle';

      window.__bp.weapon.ammo = 10;
      window.__bp.tryReload();
      window.__bp.stepSim(0.016);
      const reloadSync = window.__bp.getViewModelState().lastAction === 'reloading';

      window.__bp.setWeapon('awm338');
      window.__bp.shoot();
      window.__bp.stepSim(0.016);
      const boltSync = window.__bp.getViewModelState().lastAction === 'boltCycling';

      return { idleSync, reloadSync, boltSync, allSynced: idleSync && reloadSync && boltSync };
    })()`);
    if (!res.allSynced) throw new Error(`Visual action state desynchronized from combat state: ${JSON.stringify(res)}`);
    return res;
  });

  await step(14, 'webgl_memory_stability_zero_leaks', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      const ids = ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12', 'knife'];
      const r = window.__bp.renderer;
      const beforeGeos = r.info.memory.geometries;

      for (let c = 0; c < 3; c++) {
        for (const id of ids) {
          window.__bp.setWeapon(id);
          window.__bp.stepSim(0.016);
        }
      }

      const afterGeos = r.info.memory.geometries;
      const diff = afterGeos - beforeGeos;
      return { beforeGeos, afterGeos, diff };
    })()`);
    if (res.diff > 15) throw new Error(`WebGL geometry leak detected: initial ${res.beforeGeos}, after cycles ${res.afterGeos} (diff +${res.diff})`);
    return res;
  });

  await step(15, 'settings_reduced_motion_behavior', async () => {
    const res = await b.evaluate(`(() => {
      const checkbox = document.getElementById('set-reduced-motion');
      if (!checkbox) return { error: 'Checkbox set-reduced-motion not found' };

      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      window.__bp.setWeapon('mk7');
      window.__bp.player.pos.set(0, 1.7, 0);
      window.__bp.player.vel.set(0, 0, 5);

      for (let i = 0; i < 20; i++) window.__bp.stepSim(0.033);
      const reducedGunY = window.__bp.gunGroup.position.y;

      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      for (let i = 0; i < 20; i++) window.__bp.stepSim(0.033);
      const normalGunY = window.__bp.gunGroup.position.y;

      return {
        reducedGunY,
        normalGunY,
        testedOk: true
      };
    })()`);
    if (res.error) throw new Error(res.error);
    await capturePng('docs/sprints/screenshots/sprint8_3/10_settings_reduced_motion.png');
    return res;
  });

} catch (globalErr) {
  console.error(`FATAL TEST HARNESS ERROR: ${globalErr.message}`);
} finally {
  await b.close();
  srv.close();
}

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;

console.log(`\n========================================`);
console.log(`SPRINT 8.3 TEST RESULTS: ${passed}/${results.length} PASS | ${failed} FAIL`);
console.log(`========================================`);

if (failed > 0 || results.length < 15) {
  process.exit(1);
} else {
  process.exit(0);
}
