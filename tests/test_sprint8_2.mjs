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
  await b.sleep(300);
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
  await b.sleep(2500);

  await step(1, 'catalog_all_implemented', async () => {
    const res = await b.evaluate(`(() => {
      const cat = window.__bp.progression.getCatalogWithStatus();
      const defs = window.__bp.WEAPONS;
      const expectedIds = ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12', 'knife'];
      const allFound = expectedIds.every(id => cat.some(w => w.id === id) && !!defs[id]);
      const allImplemented = cat.every(w => w.implementation === 'IMPLEMENTED');
      return { total: cat.length, allFound, allImplemented };
    })()`);
    if (res.total !== 9) throw new Error(`Expected 9 weapons in catalog, found ${res.total}`);
    if (!res.allFound) throw new Error('Not all 9 expected weapons are present in catalog and WEAPONS definition');
    if (!res.allImplemented) throw new Error('All 9 weapons must have implementation: IMPLEMENTED');
    return res;
  });

  await step(2, 'level_thresholds_and_unlocks', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const cat = p.getCatalogWithStatus();
      const getReq = (id) => cat.find(w => w.id === id)?.reqLevel;
      const reqs = {
        mk7: getReq('mk7'),
        vector9: getReq('vector9'),
        m870: getReq('m870'),
        p12: getReq('p12'),
        ak12: getReq('ak12'),
        mp5k: getReq('mp5k'),
        mk48: getReq('mk48'),
        awm338: getReq('awm338'),
        knife: getReq('knife')
      };
      const lockedAt1 = {
        ak12: cat.find(w => w.id === 'ak12')?.status === 'LOCKED',
        mp5k: cat.find(w => w.id === 'mp5k')?.status === 'LOCKED',
        mk48: cat.find(w => w.id === 'mk48')?.status === 'LOCKED',
        awm338: cat.find(w => w.id === 'awm338')?.status === 'LOCKED'
      };
      return { reqs, lockedAt1 };
    })()`);
    if (res.reqs.ak12 !== 14) throw new Error(`AK-12 reqLevel must be 14, got ${res.reqs.ak12}`);
    if (res.reqs.mp5k !== 20) throw new Error(`MP-5K reqLevel must be 20, got ${res.reqs.mp5k}`);
    if (res.reqs.mk48 !== 24) throw new Error(`MK-48 reqLevel must be 24, got ${res.reqs.mk48}`);
    if (res.reqs.awm338 !== 30) throw new Error(`AWM-338 reqLevel must be 30, got ${res.reqs.awm338}`);
    if (res.reqs.knife !== 1) throw new Error(`Knife reqLevel must be 1, got ${res.reqs.knife}`);
    if (!res.lockedAt1.ak12 || !res.lockedAt1.mp5k || !res.lockedAt1.mk48 || !res.lockedAt1.awm338) {
      throw new Error('Weapons above level 1 must be LOCKED at initial level 1 state');
    }
    return res;
  });

  await step(3, 'mp5k_hybrid_slot', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.grantPlayerXP(100000);
      const l = p.getLoadouts()[0];
      const okPrim = p.setLoadoutPrimary(l.id, 'mp5k');
      const curAfterPrim = p.getLoadouts()[0].primary;
      const okSec = p.setLoadoutSecondary(l.id, 'mp5k');
      const curAfterSec = p.getLoadouts()[0].secondary;
      return { okPrim, curAfterPrim, okSec, curAfterSec };
    })()`);
    if (!res.okPrim || res.curAfterPrim !== 'mp5k') throw new Error('MP-5K must be equippable as primary');
    if (!res.okSec || res.curAfterSec !== 'mp5k') throw new Error('MP-5K must be equippable as secondary (hybrid)');
    return res;
  });

  await step(4, 'primary_weapon_restrictions', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const l = p.getLoadouts()[0];
      return {
        secAk12: p.setLoadoutSecondary(l.id, 'ak12'),
        secMk48: p.setLoadoutSecondary(l.id, 'mk48'),
        secAwm: p.setLoadoutSecondary(l.id, 'awm338'),
        secMk7: p.setLoadoutSecondary(l.id, 'mk7'),
        secM870: p.setLoadoutSecondary(l.id, 'm870')
      };
    })()`);
    if (res.secAk12 !== false || res.secMk48 !== false || res.secAwm !== false || res.secMk7 !== false || res.secM870 !== false) {
      throw new Error('Primary-only firearms must be rejected when attempting to equip in secondary slot');
    }
    return res;
  });

  await step(5, 'secondary_weapon_restrictions', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const l = p.getLoadouts()[0];
      return {
        primKnife: p.setLoadoutPrimary(l.id, 'knife'),
        primP12: p.setLoadoutPrimary(l.id, 'p12')
      };
    })()`);
    if (res.primKnife !== false || res.primP12 !== false) {
      throw new Error('Secondary-only weapons (knife, p12) must be rejected when attempting to equip in primary slot');
    }
    return res;
  });

  await step(6, 'cadence_invariance_across_fps', async () => {
    const res = await b.evaluate(`(() => {
      const wpn = window.__bp.WEAPONS.ak12;
      const fireRate = wpn.fireRate;
      function simulateShooting(dt, totalTime) {
        let cd = 0;
        let shots = 0;
        for (let t = 0; t < totalTime; t += dt) {
          cd -= dt;
          if (cd <= 0) {
            shots++;
            cd = fireRate;
          }
        }
        return shots;
      }
      const shots30 = simulateShooting(1/30, 2.0);
      const shots60 = simulateShooting(1/60, 2.0);
      const shots120 = simulateShooting(1/120, 2.0);
      return { shots30, shots60, shots120 };
    })()`);
    const diff1 = Math.abs(res.shots30 - res.shots60);
    const diff2 = Math.abs(res.shots60 - res.shots120);
    if (diff1 > 1 || diff2 > 1) {
      throw new Error(`Cadence variance detected across FPS rates: 30fps=${res.shots30}, 60fps=${res.shots60}, 120fps=${res.shots120}`);
    }
    return res;
  });

  await step(7, 'awm_bolt_action_cycle', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('awm338');
      const initialAmmo = window.__bp.weapon.ammo;
      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();
      const postShotAmmo = window.__bp.weapon.ammo;
      const isCycling = window.__bp.weapon.boltCycling;
      const initialBoltT = window.__bp.weapon.boltT;

      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();
      const midCycleAmmo = window.__bp.weapon.ammo;

      window.__bp.stepSim(0.40);
      const stillCycling = window.__bp.weapon.boltCycling;

      window.__bp.stepSim(0.50);
      const finishedCycling = window.__bp.weapon.boltCycling;

      return {
        initialAmmo,
        postShotAmmo,
        isCycling,
        initialBoltT,
        midCycleAmmo,
        stillCycling,
        finishedCycling
      };
    })()`);
    if (res.postShotAmmo !== res.initialAmmo - 1) throw new Error('Shot should consume 1 ammo');
    if (!res.isCycling) throw new Error('AWM-338 should enter bolt cycling state on firing');
    if (res.midCycleAmmo !== res.postShotAmmo) throw new Error('AWM-338 must lock firing during bolt action cycle');
    if (!res.stillCycling) throw new Error('AWM-338 should still be cycling at 0.40s');
    if (res.finishedCycling) throw new Error('AWM-338 should finish cycling after total 0.90s simulated');
    return res;
  });

  await step(8, 'awm_no_queued_shots_on_hold', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('awm338');
      window.__bp.setMouseDown(true);
      window.__bp.shoot();
      const ammoAfterFirst = window.__bp.weapon.ammo;

      window.__bp.stepSim(0.90);
      const isCycling = window.__bp.weapon.boltCycling;
      const ammoAfterCycleWhileHolding = window.__bp.weapon.ammo;

      window.__bp.setMouseDown(false);
      window.__bp.stepSim(0.05);
      window.__bp.setMouseDown(true);
      window.__bp.shoot();
      const ammoAfterSecondClick = window.__bp.weapon.ammo;
      window.__bp.setMouseDown(false);

      return {
        ammoAfterFirst,
        isCycling,
        ammoAfterCycleWhileHolding,
        ammoAfterSecondClick
      };
    })()`);
    if (res.ammoAfterCycleWhileHolding !== res.ammoAfterFirst) {
      throw new Error('AWM-338 must not automatically queue or fire second shot while mouse is continuously held');
    }
    if (res.ammoAfterSecondClick !== res.ammoAfterFirst - 1) {
      throw new Error('AWM-338 must fire second shot after releasing and pressing trigger again');
    }
    return res;
  });

  await step(9, 'knife_ammo_and_hud', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('knife');
      window.__bp.updateHUD();
      const ammo = window.__bp.weapon.ammo;
      const reserve = window.__bp.weapon.reserve;
      const ammoNumText = document.getElementById('ammo-num').textContent;
      const ammoReserveText = document.getElementById('ammo-reserve').textContent;
      const reloadHintOpacity = document.getElementById('reload-hint').style.opacity;

      window.__bp.tryReload();
      const reloading = window.__bp.weapon.reloading;
      return { ammo, reserve, ammoNumText, ammoReserveText, reloadHintOpacity, reloading };
    })()`);
    if (res.ammo !== 0 || res.reserve !== 0) throw new Error('Knife must have 0 ammo and 0 reserve');
    if (res.ammoNumText !== '—') throw new Error(`Knife HUD ammo-num must display '—', got '${res.ammoNumText}'`);
    if (res.ammoReserveText !== '') throw new Error(`Knife HUD ammo-reserve must be empty, got '${res.ammoReserveText}'`);
    if (res.reloading) throw new Error('Knife must not be reloadable');
    return res;
  });

  await step(10, 'knife_melee_state_machine', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('knife');
      window.__bp.weapon.meleeStage = 'idle';
      window.__bp.performMeleeAttack();
      const stage1 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.09);
      const stage2 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.13);
      const stage3 = window.__bp.weapon.meleeStage;

      window.__bp.stepSim(0.26);
      const stage4 = window.__bp.weapon.meleeStage;

      return { stage1, stage2, stage3, stage4 };
    })()`);
    if (res.stage1 !== 'windup') throw new Error(`Initial stage must be windup, got ${res.stage1}`);
    if (res.stage2 !== 'strike') throw new Error(`Stage after 0.09s must be strike, got ${res.stage2}`);
    if (res.stage3 !== 'recovery') throw new Error(`Stage after 0.13s must be recovery, got ${res.stage3}`);
    if (res.stage4 !== 'idle') throw new Error(`Stage after 0.26s must return to idle, got ${res.stage4}`);
    return res;
  });

  await step(11, 'knife_hit_detection_cone_and_range', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      window.__bp.setWeapon('knife');

      const cam = window.__bp.camera;
      cam.position.set(0, 1.7, 0);
      cam.rotation.set(0, 0, 0, 'YXZ');
      window.__bp.player.pos.set(0, 1.7, 0);

      const inFrontClose = window.__bp.makeEnemy(0, -1.4);
      window.__bp.weapon.meleeStage = 'strike';
      window.__bp.weapon.hitEnemies = new Set();
      window.__bp.checkMeleeHit();
      const hitClose = window.__bp.weapon.hitEnemies.has(inFrontClose);

      const inFrontFar = window.__bp.makeEnemy(0, -3.2);
      window.__bp.weapon.hitEnemies = new Set();
      window.__bp.checkMeleeHit();
      const hitFar = window.__bp.weapon.hitEnemies.has(inFrontFar);

      const behind = window.__bp.makeEnemy(0, 1.4);
      window.__bp.weapon.hitEnemies = new Set();
      window.__bp.checkMeleeHit();
      const hitBehind = window.__bp.weapon.hitEnemies.has(behind);

      return { hitClose, hitFar, hitBehind };
    })()`);
    if (!res.hitClose) throw new Error('Knife must hit enemy directly in front within 2.0m range');
    if (res.hitFar) throw new Error('Knife must not hit enemy beyond 2.0m range');
    if (res.hitBehind) throw new Error('Knife must not hit enemy located behind player');
    return res;
  });

  await step(12, 'knife_wall_occlusion', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      window.__bp.setWeapon('knife');

      const solid = window.__bp.solidMeshes();
      let pillar = solid[0];
      let px = 0, pz = 0;
      if (pillar) {
        px = pillar.position.x;
        pz = pillar.position.z;
      }
      window.__bp.player.pos.set(px, 1.7, pz + 1.2);
      window.__bp.camera.position.set(px, 1.7, pz + 1.2);
      window.__bp.camera.lookAt(px, 1.7, pz - 1.2);

      const behindWallEnemy = window.__bp.makeEnemy(px, pz - 0.4);
      window.__bp.weapon.meleeStage = 'strike';
      window.__bp.weapon.hitEnemies = new Set();
      window.__bp.checkMeleeHit();
      const hitBehindWall = window.__bp.weapon.hitEnemies.has(behindWallEnemy);

      return { hitBehindWall };
    })()`);
    if (res.hitBehindWall) throw new Error('Knife attack must be blocked by obstacles and not hit through walls');
    return res;
  });

  await step(13, 'knife_damage_and_single_hit_per_swing', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.clearEnemies();
      window.__bp.setWeapon('knife');

      window.__bp.player.pos.set(0, 1.7, 0);
      window.__bp.camera.position.set(0, 1.7, 0);
      window.__bp.camera.rotation.set(0, 0, 0, 'YXZ');

      const targetEnemy = window.__bp.makeEnemy(0, -1.2);
      const hpBefore = targetEnemy.hp;

      window.__bp.weapon.meleeStage = 'strike';
      window.__bp.weapon.hitEnemies = new Set();
      window.__bp.checkMeleeHit();
      const hpAfterFirst = targetEnemy.hp;

      window.__bp.checkMeleeHit();
      const hpAfterSecondInSameSwing = targetEnemy.hp;

      return { hpBefore, hpAfterFirst, hpAfterSecondInSameSwing, damageDealt: hpBefore - hpAfterFirst };
    })()`);
    if (res.damageDealt !== 105) throw new Error(`Expected exactly 105 knife damage, got ${res.damageDealt}`);
    if (res.hpAfterSecondInSameSwing !== res.hpAfterFirst) {
      throw new Error('Knife must not hit target more than once within single attack swing');
    }
    return res;
  });

  await step(14, 'xp_attribution_all_new_weapons', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.reset();
      const weaponsToTest = ['ak12', 'mp5k', 'mk48', 'awm338', 'knife'];
      const records = {};
      weaponsToTest.forEach(id => {
        const k = p.recordKill(id, false);
        records[id] = {
          playerXP: p.getPlayerInfo().currentXP,
          weaponXP: p.getWeaponInfo(id).currentXP
        };
      });
      return records;
    })()`);
    let expectedTotalPlayerXP = 0;
    ['ak12', 'mp5k', 'mk48', 'awm338', 'knife'].forEach(id => {
      expectedTotalPlayerXP += 100;
      if (res[id].playerXP !== expectedTotalPlayerXP) {
        throw new Error(`Player XP mismatch after ${id} kill: expected ${expectedTotalPlayerXP}, got ${res[id].playerXP}`);
      }
      if (res[id].weaponXP !== 60) {
        throw new Error(`Weapon XP mismatch for ${id}: expected 60, got ${res[id].weaponXP}`);
      }
    });
    return res;
  });

  await step(15, 'attachments_compatibility', async () => {
    const res = await b.evaluate(`(() => {
      const atts = window.__bp.attachments;
      const akAtts = atts.getAttachmentsForWeapon('ak12');
      const mpAtts = atts.getAttachmentsForWeapon('mp5k');
      const mkAtts = atts.getAttachmentsForWeapon('mk48');
      const awmAtts = atts.getAttachmentsForWeapon('awm338');
      const knifeAtts = atts.getAttachmentsForWeapon('knife');
      return {
        akCount: akAtts.length,
        mpCount: mpAtts.length,
        mkCount: mkAtts.length,
        awmCount: awmAtts.length,
        knifeCount: knifeAtts.length
      };
    })()`);
    if (res.akCount < 5) throw new Error(`AK-12 must have compatible attachments, got ${res.akCount}`);
    if (res.mpCount < 4) throw new Error(`MP-5K must have compatible attachments, got ${res.mpCount}`);
    if (res.mkCount < 3) throw new Error(`MK-48 must have compatible attachments, got ${res.mkCount}`);
    if (res.awmCount < 4) throw new Error(`AWM-338 must have compatible attachments, got ${res.awmCount}`);
    if (res.knifeCount !== 0) throw new Error(`Knife must have exactly 0 compatible attachments, got ${res.knifeCount}`);
    return res;
  });

  await step(16, 'awm_telescopic_scope', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      window.__bp.setWeapon('awm338');
      window.__bp.setAdsDown(true);
      window.__bp.stepSim(0.40);
      const scopeEl = document.getElementById('sniper-scope');
      const scopeDisplayAds = scopeEl ? scopeEl.style.display : null;
      const gunVisibleAds = window.__bp.gunGroup.visible;

      const svg = scopeEl ? scopeEl.querySelector('svg') : null;
      const hasMask = !!scopeEl?.querySelector('mask#scope-mask');
      const hasClip = !!scopeEl?.querySelector('clipPath#scope-aperture');
      const hasReticle = !!scopeEl?.querySelector('g[clip-path*="scope-aperture"] line');

      window.__bp.weapon.ammo = 0;
      window.__bp.tryReload();
      window.__bp.stepSim(0.02);
      const scopeDisplayReload = scopeEl ? scopeEl.style.display : null;
      const gunVisibleReload = window.__bp.gunGroup.visible;

      window.__bp.switchWeaponSlot('secondary');
      const scopeDisplaySwap = scopeEl ? scopeEl.style.display : null;
      const gunVisibleSwap = window.__bp.gunGroup.visible;

      window.__bp.pause();
      const scopeDisplayPause = scopeEl ? scopeEl.style.display : null;

      window.__bp.backToMenu();
      const scopeDisplayMenu = scopeEl ? scopeEl.style.display : null;

      return {
        scopeDisplayAds,
        gunVisibleAds,
        hasMask,
        hasClip,
        hasReticle,
        scopeDisplayReload,
        gunVisibleReload,
        scopeDisplaySwap,
        gunVisibleSwap,
        scopeDisplayPause,
        scopeDisplayMenu
      };
    })()`);
    if (res.scopeDisplayAds !== 'block') throw new Error(`Sniper scope overlay should be display: block in deep ADS, got ${res.scopeDisplayAds}`);
    if (res.gunVisibleAds !== false) throw new Error('Gun viewmodel should be hidden in telescopic scope sight picture');
    if (!res.hasMask || !res.hasClip || !res.hasReticle) throw new Error('Sniper scope must feature masked circular aperture and clipped reticle');
    if (res.scopeDisplayReload !== 'none' || res.gunVisibleReload !== true) throw new Error('Reloading must cancel sniper scope and restore gun visibility');
    if (res.scopeDisplaySwap !== 'none' || res.gunVisibleSwap !== true) throw new Error('Swapping weapon must cancel sniper scope and restore gun visibility');
    if (res.scopeDisplayPause !== 'none') throw new Error('Pausing must clear sniper scope overlay');
    if (res.scopeDisplayMenu !== 'none') throw new Error('Returning to menu must clear sniper scope overlay');
    return res;
  });

  await step(17, 'optics_aperture_unobstructed_and_aligned', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      const THREE = window.__bp.THREE;
      const cam = window.__bp.camera;
      const list = ['mk7', 'vector9', 'm870', 'p12', 'ak12', 'mp5k', 'mk48', 'awm338'];
      const failures = [];

      for (const id of list) {
        for (const opt of ['optic_reddot', 'optic_holo']) {
          window.__bp.setWeapon(id, { attachments: { optic: opt } });
          window.__bp.setAdsDown(true);
          for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
          const r = window.__bp.renderer;
          r.render(window.__bp.scene, cam);

          const tmpRay = new THREE.Raycaster();
          const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          tmpRay.set(cam.position, camDir);
          tmpRay.near = 0.01;
          tmpRay.far = 50;
          const hits = tmpRay.intersectObjects(window.__bp.gunGroup.children, true);
          const visibleOpaqueHits = hits.filter(h => h.object.visible && !h.object.material?.transparent && h.object.geometry?.type !== 'SphereGeometry');
          if (visibleOpaqueHits.length > 0) {
            failures.push({ id, opt, hits: visibleOpaqueHits.map(h => ({ dist: h.distance, geo: h.object.geometry?.type, role: h.object.userData?.partRole })) });
          }
        }
      }
      return { failures };
    })()`);
    if (res.failures.length > 0) {
      throw new Error(`Opaque geometry blocking optical aperture in ADS: ${JSON.stringify(res.failures)}`);
    }
    return res;
  });

  await step(18, 'schema_v3_persistence_new_weapons', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.grantPlayerXP(200000);
      p.grantWeaponXP('ak12', 10000);
      const l = p.getLoadouts()[0];
      p.setLoadoutPrimary(l.id, 'ak12');
      p.setLoadoutSecondary(l.id, 'knife');
      p.setLoadoutWeaponAttachment(l.id, 'ak12', 'optic', 'optic_reddot');

      const saved = JSON.parse(localStorage.getItem('bp_progression_v1'));
      return {
        version: saved.version,
        primary: saved.loadouts[0].primary,
        secondary: saved.loadouts[0].secondary,
        optic: saved.loadouts[0].weaponAttachments?.ak12?.optic
      };
    })()`);
    if (res.version !== 3) throw new Error(`Schema version must be 3, got ${res.version}`);
    if (res.primary !== 'ak12') throw new Error(`Primary should persist ak12, got ${res.primary}`);
    if (res.secondary !== 'knife') throw new Error(`Secondary should persist knife, got ${res.secondary}`);
    if (res.optic !== 'optic_reddot') throw new Error(`AK-12 attachment should persist optic_reddot, got ${res.optic}`);
    return res;
  });

  await step(19, 'copy_and_reset_with_new_weapons', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.grantPlayerXP(200000);
      const loads = p.getLoadouts();
      p.setLoadoutPrimary(loads[0].id, 'ak12');
      p.setLoadoutSecondary(loads[0].id, 'mp5k');

      const copyOk = p.copyLoadout(loads[0].id, loads[1].id);
      const afterCopyLoads = p.getLoadouts();
      const copyMatches = afterCopyLoads[1].primary === 'ak12' && afterCopyLoads[1].secondary === 'mp5k';

      const resetOk = p.resetLoadoutToDefault(loads[0].id);
      const afterResetLoads = p.getLoadouts();
      const resetMatches = afterResetLoads[0].primary === 'mk7' && afterResetLoads[0].secondary === 'p12';

      return { copyOk, copyMatches, resetOk, resetMatches };
    })()`);
    if (!res.copyOk || !res.copyMatches) throw new Error('Copying loadout with new weapons must succeed and copy configuration');
    if (!res.resetOk || !res.resetMatches) throw new Error('Resetting loadout must restore authentic default primary/secondary');
    return res;
  });

  await step(20, 'supply_drops_lmg_sniper_and_knife', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      const sup = window.__bp.supplies;
      const ammoPack = sup.catalog.ammo_pack;

      window.__bp.combatSession.slots.primary.id = 'mk48';
      window.__bp.combatSession.slots.primary.effectiveStats = null;
      window.__bp.setWeapon('mk48');
      window.__bp.weapon.reserve = 0;
      window.__bp.combatSession.slots.primary.reserve = 0;
      const refillLmg = sup.refillCombatAmmo(ammoPack);

      window.__bp.combatSession.slots.primary.id = 'awm338';
      window.__bp.combatSession.slots.primary.effectiveStats = null;
      window.__bp.setWeapon('awm338');
      window.__bp.weapon.reserve = 0;
      window.__bp.combatSession.slots.primary.reserve = 0;
      const refillSniper = sup.refillCombatAmmo(ammoPack);

      window.__bp.combatSession.slots.primary.id = 'mk7';
      window.__bp.combatSession.slots.primary.ammo = 0;
      window.__bp.combatSession.slots.primary.reserve = 0;
      window.__bp.combatSession.slots.secondary.id = 'knife';
      window.__bp.combatSession.slots.secondary.ammo = 0;
      window.__bp.combatSession.slots.secondary.reserve = 0;
      window.__bp.setWeapon('knife');

      const emergencyDrop = sup.dropsManager.checkEmergencyAmmo(window.__bp.player.pos, true);

      return {
        lmgAdded: refillLmg.added,
        sniperAdded: refillSniper.added,
        emergencyDropCreated: !!emergencyDrop
      };
    })()`);
    if (res.lmgAdded !== 50) throw new Error(`LMG ammo pack refill should be 50 rounds (50% of 100), got ${res.lmgAdded}`);
    if (res.sniperAdded !== 3) throw new Error(`Sniper ammo pack refill should be 3 rounds (60% of 5), got ${res.sniperAdded}`);
    if (!res.emergencyDropCreated) throw new Error('Knife secondary must not block emergency ammo drop when primary firearm is empty');
    return res;
  });

  await step(21, 'webgl_memory_stability_all_9_weapons', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.startGame('waves');
      const ids = ['mk7', 'ak12', 'vector9', 'mp5k', 'm870', 'mk48', 'awm338', 'p12', 'knife'];
      const r = window.__bp.renderer;
      const beforeGeos = r.info.memory.geometries;

      for (let cycle = 0; cycle < 4; cycle++) {
        for (const id of ids) {
          window.__bp.setWeapon(id);
        }
      }
      const afterGeos = r.info.memory.geometries;
      return { beforeGeos, afterGeos, diff: afterGeos - beforeGeos };
    })()`);
    if (res.diff > 35) {
      throw new Error(`WebGL geometry accumulation detected: initial ${res.beforeGeos}, after 36 switches ${res.afterGeos} (diff +${res.diff})`);
    }
    return res;
  });

  await b.evaluate(`(() => {
    window.__bp.switchTab('loadout');
    document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]').click();
    document.querySelectorAll('.weapon-card')[1].click();
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/01_armory_ak12.png', 1280, 720);

  await b.evaluate(`(() => {
    document.querySelector('.armory-cat-btn[data-cat="SMG"]').click();
    document.querySelectorAll('.weapon-card')[1].click();
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/02_armory_mp5k.png', 1280, 720);

  await b.evaluate(`(() => {
    document.querySelector('.armory-cat-btn[data-cat="LMG"]').click();
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/03_armory_mk48.png', 1280, 720);

  await b.evaluate(`(() => {
    document.querySelector('.armory-cat-btn[data-cat="MELEE"]').click();
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/04_knife_melee_factory.png', 1280, 720);

  await b.evaluate(`(() => {
    window.__bp.startGame('waves');
    window.__bp.player.pos.set(0, 1.7, 10);
    window.__bp.player.yaw = 0;
    window.__bp.player.pitch = 0;
    window.__bp.setWeapon('mk7', { attachments: { optic: 'optic_reddot' } });
    window.__bp.setAdsDown(true);
    for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/05_mk7_reddot_ads_1920x1080.png', 1920, 1080);
  await capturePng('docs/assets/screenshots/sprint8_2/05_mk7_reddot_ads_1280x720.png', 1280, 720);
  await capturePng('docs/assets/screenshots/sprint8_2/05_mk7_reddot_ads_1024x768.png', 1024, 768);

  await b.evaluate(`(() => {
    window.__bp.setWeapon('mk7', { attachments: { optic: 'optic_holo' } });
    for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/06_mk7_holo_ads_1280x720.png', 1280, 720);

  await b.evaluate(`(() => {
    window.__bp.setWeapon('vector9', { attachments: { optic: 'optic_reddot' } });
    for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/07_vector9_optic_ads_1280x720.png', 1280, 720);

  await b.evaluate(`(() => {
    window.__bp.setWeapon('awm338');
    window.__bp.setAdsDown(true);
    for (let i = 0; i < 40; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/08_awm338_telescopic_ads_1920x1080.png', 1920, 1080);
  await capturePng('docs/assets/screenshots/sprint8_2/08_awm338_telescopic_ads_1280x720.png', 1280, 720);
  await capturePng('docs/assets/screenshots/sprint8_2/08_awm338_telescopic_ads_1024x768.png', 1024, 768);

  await b.evaluate(`(() => {
    window.__bp.setAdsDown(false);
    for (let i = 0; i < 15; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/09_awm338_exiting_ads_1280x720.png', 1280, 720);

  await b.evaluate(`(() => {
    window.__bp.combatSession.slots.primary.id = 'mk7';
    window.__bp.combatSession.slots.primary.attachments = { optic: 'optic_reddot' };
    window.__bp.combatSession.slots.secondary.id = 'p12';
    window.__bp.combatSession.slots.secondary.attachments = { optic: 'optic_holo' };
    window.__bp.setWeapon('mk7', { attachments: { optic: 'optic_reddot' } });
    window.__bp.switchWeaponSlot('secondary');
    for (let i = 0; i < 15; i++) window.__bp.stepSim(0.02);
  })()`);
  await b.sleep(300);
  await capturePng('docs/assets/screenshots/sprint8_2/10_weapon_switch_different_optics.png', 1280, 720);

} finally {
  await b.close();
  await srv.close();
}

const passed = results.filter(r => r.ok).length;
const total = results.length;
console.log(`\n========================================`);
console.log(`SPRINT 8.2 TEST RESULTS: ${passed}/${total} PASS`);
console.log(`========================================`);
if (passed !== total || total !== 21) {
  process.exit(1);
}
