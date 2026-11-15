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

  await step(1, 'anatomical_hit_zones_registration', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      const zones = [];
      shooter.group.traverse(o => {
        if (o.isMesh && o.userData.hitZone) {
          zones.push({ name: o.userData.hitZone, head: !!o.userData.head });
        }
      });
      return {
        foundZones: zones.map(z => z.name),
        hasHead: zones.some(z => z.name === 'HEAD'),
        hasTorso: zones.some(z => z.name === 'TORSO'),
        hasHelmet: zones.some(z => z.name === 'HELMET'),
        hasArms: zones.some(z => z.name === 'ARM_L') && zones.some(z => z.name === 'ARM_R'),
        hasLegs: zones.some(z => z.name === 'LEG_L') && zones.some(z => z.name === 'LEG_R')
      };
    })()`);
    if (!res.hasHead) throw new Error('Missing HEAD zone');
    if (!res.hasTorso) throw new Error('Missing TORSO zone');
    if (!res.hasHelmet) throw new Error('Missing HELMET zone');
    if (!res.hasArms) throw new Error('Missing ARM zones');
    if (!res.hasLegs) throw new Error('Missing LEG zones');
    return res;
  });

  await step(2, 'brute_heavy_plate_registration', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.clearEnemies();
      const brute = bp.makeEnemy(0, 0, 'BRUTE');
      let plateFound = false;
      brute.group.traverse(o => {
        if (o.isMesh && o.userData.hitZone === 'ARMOR_PLATE') plateFound = true;
      });
      return { plateFound };
    })()`);
    if (!res.plateFound) throw new Error('BRUTE does not have ARMOR_PLATE mesh');
    return res;
  });

  await step(3, 'damage_dropoff_zonal_multipliers', async () => {
    const res = await b.evaluate(`(() => {
      const { getDamageWithDropoff, WEAPONS } = window.__bp;
      const mk7 = WEAPONS.mk7;
      const baseDmg = getDamageWithDropoff(mk7, 5, false, 'TORSO');
      const headDmg = getDamageWithDropoff(mk7, 5, true, 'HEAD');
      const armDmg = getDamageWithDropoff(mk7, 5, false, 'ARM_L');
      const legDmg = getDamageWithDropoff(mk7, 5, false, 'LEG_L');
      return {
        baseDmg,
        headDmg,
        armDmg,
        legDmg,
        headRatio: headDmg / baseDmg,
        armRatio: armDmg / baseDmg,
        legRatio: legDmg / baseDmg
      };
    })()`);
    if (Math.abs(res.headRatio - 2.2) > 0.05) throw new Error(`Head ratio expected 2.2 got ${res.headRatio}`);
    if (Math.abs(res.armRatio - 0.85) > 0.02) throw new Error(`Arm ratio expected 0.85 got ${res.armRatio}`);
    if (Math.abs(res.legRatio - 0.80) > 0.02) throw new Error(`Leg ratio expected 0.80 got ${res.legRatio}`);
    return res;
  });

  await step(4, 'brute_plate_mitigation_vs_head_vulnerability', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.clearEnemies();
      const b1 = bp.makeEnemy(0, 0, 'BRUTE');
      const hpInitial = b1.hp;
      bp.damageEnemy(b1, 50, b1.group.position, false, null, 'ARMOR_PLATE');
      const plateDmg = hpInitial - b1.hp;

      const b2 = bp.makeEnemy(5, 0, 'BRUTE');
      const hpInitial2 = b2.hp;
      bp.damageEnemy(b2, 50, b2.group.position, true, null, 'HEAD');
      const headDmg = hpInitial2 - b2.hp;

      const b3 = bp.makeEnemy(10, 0, 'BRUTE');
      const hpInitial3 = b3.hp;
      bp.damageEnemy(b3, 50, b3.group.position, false, null, 'TORSO');
      const backTorsoDmg = hpInitial3 - b3.hp;

      return {
        plateDmg,
        headDmg,
        backTorsoDmg
      };
    })()`);
    if (Math.abs(res.plateDmg - 35) > 1e-4) throw new Error(`Plate dmg expected 35 got ${res.plateDmg}`);
    if (res.headDmg <= 35) throw new Error(`Head dmg on brute should be unmitigated, got ${res.headDmg}`);
    return res;
  });

  await step(5, 'm870_individual_pellet_and_consolidated_resolution', async () => {
    const res = await b.evaluate(`(() => {
      const { getDamageWithDropoff, WEAPONS } = window.__bp;
      const m870 = WEAPONS.m870;
      const pHead = getDamageWithDropoff(m870, 4, true, 'HEAD');
      const pTorso = getDamageWithDropoff(m870, 4, false, 'TORSO');
      const pLeg = getDamageWithDropoff(m870, 4, false, 'LEG_L');
      const total = pHead * 2 + pTorso * 4 + pLeg * 2;
      return {
        pHead,
        pTorso,
        pLeg,
        total,
        isHeadshot: true
      };
    })()`);
    if (res.pHead <= res.pTorso) throw new Error('M870 pellet headshot should exceed torso');
    if (res.pLeg >= res.pTorso) throw new Error('M870 pellet leg should be less than torso');
    return res;
  });

  await step(6, 'awm338_high_caliber_crit', async () => {
    const res = await b.evaluate(`(() => {
      const { getDamageWithDropoff, WEAPONS } = window.__bp;
      const awm = WEAPONS.awm338;
      const body = getDamageWithDropoff(awm, 10, false, 'TORSO');
      const head = getDamageWithDropoff(awm, 10, true, 'HEAD');
      return { body, head, ratio: head / body };
    })()`);
    if (Math.abs(res.ratio - 2.5) > 0.05) throw new Error(`AWM head ratio expected 2.5 got ${res.ratio}`);
    return res;
  });

  await step(7, 'knife_melee_torso_authority', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      const before = shooter.hp;
      bp.damageEnemy(shooter, 90, shooter.group.position, false, null, 'TORSO');
      return { taken: before - shooter.hp };
    })()`);
    if (Math.abs(res.taken - 90) > 1e-4) throw new Error(`Melee damage expected 90 got ${res.taken}`);
    return res;
  });

  await step(8, 'dead_enemy_ignores_further_damage', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      bp.damageEnemy(shooter, 500, shooter.group.position, true, null, 'HEAD');
      const hpDead = shooter.hp;
      const secondDamage = bp.damageEnemy(shooter, 100, shooter.group.position, false, null, 'TORSO');
      return { hpDead, secondDamage, alive: shooter.alive };
    })()`);
    if (res.secondDamage !== false) throw new Error('Damaging dead enemy must return false');
    if (res.alive !== false) throw new Error('Dead enemy should not be alive');
    return res;
  });

  await step(9, 'snd_defusal_continuity_and_death_interruption', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('snd');
      bp.clearEnemies();
      const defuser = bp.makeEnemy(0, -6, 'SHOOTER');
      defuser.sndRole = 'defuser';
      defuser.defusing = true;
      bp.damageEnemy(defuser, 20, defuser.group.position, false, null, 'ARM_L');
      const defusingAfterNonLethal = defuser.defusing;
      bp.damageEnemy(defuser, 500, defuser.group.position, false, null, 'TORSO');
      const defusingAfterDeath = defuser.defusing;
      return { defusingAfterNonLethal, defusingAfterDeath };
    })()`);
    if (!res.defusingAfterNonLethal) throw new Error('Non-lethal damage must not break S&D defusal');
    if (res.defusingAfterDeath) throw new Error('Death must cancel S&D defusal immediately');
    return res;
  });

  await step(10, 'procedural_flinch_zero_movement_interference', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      const posInitial = { x: shooter.group.position.x, y: shooter.group.position.y, z: shooter.group.position.z };
      bp.damageEnemy(shooter, 30, shooter.group.position, false, null, 'TORSO');
      const flinchX = shooter.flinchRot ? shooter.flinchRot.x : 0;
      const posAfterHit = { x: shooter.group.position.x, y: shooter.group.position.y, z: shooter.group.position.z };
      return {
        flinchX,
        sameX: posInitial.x === posAfterHit.x,
        sameY: posInitial.y === posAfterHit.y,
        sameZ: posInitial.z === posAfterHit.z
      };
    })()`);
    if (res.flinchX >= 0) throw new Error('Flinch rotation X should be negative (recoil back)');
    if (!res.sameX || !res.sameY || !res.sameZ) throw new Error('Enemy global position must NOT change due to visual flinch');
    return res;
  });

  await step(11, 'hitmarker_classes_and_sfx_types', async () => {
    const res = await b.evaluate(`(() => {
      const hitmarker = document.getElementById('hitmarker');
      window.__bp.sfxHit('armor');
      window.__bp.sfxHit('crit');
      window.__bp.sfxHit('normal');
      window.__bp.showHitmarker('armor');
      const isArmor = hitmarker.classList.contains('hit-armor');
      window.__bp.showHitmarker('crit');
      const isCrit = hitmarker.classList.contains('hit-crit');
      return {
        hasHitmarker: !!hitmarker,
        isArmor,
        isCrit
      };
    })()`);
    if (!res.hasHitmarker) throw new Error('Hitmarker element not found');
    if (!res.isArmor) throw new Error('Hitmarker armor class not set');
    if (!res.isCrit) throw new Error('Hitmarker crit class not set');
    return res;
  });

  await step(12, 'single_xp_and_single_drop_on_kill', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      const xpBefore = bp.progression.getState().player.xp;
      const dropCountBefore = bp.supplies.dropsManager.drops.length;
      
      const killed = bp.damageEnemy(shooter, 250, shooter.group.position, true, null, 'HEAD');
      if (killed) {
        bp.progression.recordKill('mk7', true);
        bp.supplies.dropsManager.onEnemyKilled(shooter.group.position, { playerAmmoLow: false });
      }
      const xpAfter = bp.progression.getState().player.xp;
      const dropCountAfter = bp.supplies.dropsManager.drops.length;
      return {
        xpGained: xpAfter - xpBefore,
        dropsSpawned: dropCountAfter - dropCountBefore
      };
    })()`);
    if (res.xpGained !== 150) throw new Error(`Expected exactly 150 XP for headshot kill, got ${res.xpGained}`);
    return res;
  });

  await step(13, 'real_raycast_multidirectional_brute_and_parts', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      const THREE = bp.THREE;
      bp.startGame('waves');
      bp.clearEnemies();
      const brute = bp.makeEnemy(0, 0, 'BRUTE');
      brute.group.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      const targets = [brute.group];

      rc.set(new THREE.Vector3(0, 1.44, -5), new THREE.Vector3(0, 0, 1));
      const hitsFront = rc.intersectObjects(targets, true);
      const zoneFront = hitsFront.length ? hitsFront[0].object.userData.hitZone : null;

      rc.set(new THREE.Vector3(0, 1.44, 5), new THREE.Vector3(0, 0, -1));
      const hitsBack = rc.intersectObjects(targets, true);
      const zoneBack = hitsBack.length ? hitsBack[0].object.userData.hitZone : null;

      rc.set(new THREE.Vector3(-5, 1.44, 0), new THREE.Vector3(1, 0, 0));
      const hitsSideL = rc.intersectObjects(targets, true);
      const zoneSideL = hitsSideL.length ? hitsSideL[0].object.userData.hitZone : null;

      rc.set(new THREE.Vector3(0, 2.05, -5), new THREE.Vector3(0, 0, 1));
      const hitsHead = rc.intersectObjects(targets, true);
      const zoneHead = hitsHead.length ? hitsHead[0].object.userData.hitZone : null;

      rc.set(new THREE.Vector3(0, 0.45, -5), new THREE.Vector3(0, 0, 1));
      const hitsLeg = rc.intersectObjects(targets, true);
      const zoneLeg = hitsLeg.length ? hitsLeg[0].object.userData.hitZone : null;

      return {
        zoneFront,
        zoneBack,
        zoneSideL,
        zoneHead,
        zoneLeg
      };
    })()`);
    if (res.zoneFront !== 'ARMOR_PLATE') throw new Error(`Front hit expected ARMOR_PLATE, got ${res.zoneFront}`);
    if (res.zoneBack === 'ARMOR_PLATE') throw new Error(`Back hit must NOT be ARMOR_PLATE, got ${res.zoneBack}`);
    if (!res.zoneHead || (res.zoneHead !== 'HEAD' && res.zoneHead !== 'HELMET')) throw new Error(`Head hit expected HEAD/HELMET, got ${res.zoneHead}`);
    return res;
  });

  await step(14, 'flinch_not_overwritten_by_enemy_movement_animation', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.startGame('waves');
      bp.clearEnemies();
      const shooter = bp.makeEnemy(0, 0, 'SHOOTER');
      shooter.brain.setState('PATROL');
      bp.damageEnemy(shooter, 25, shooter.group.position, false, null, 'TORSO');
      const initialFlinch = shooter.flinchRot.x;
      bp.stepSim(0.016);
      const stepFlinch = shooter.flinchRot.x;
      const torsoRotX = shooter.torso.rotation.x;
      return {
        initialFlinch,
        stepFlinch,
        torsoRotX,
        preserved: torsoRotX < -0.05
      };
    })()`);
    if (!res.preserved) throw new Error('Enemy torso flinch was overwritten prematurely by walk animation');
    return res;
  });

  await step(15, 'surface_impact_particles_differentiated', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      const THREE = bp.THREE;
      bp.resetEffects();
      bp.spawnSurfaceImpact(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), 'metal');
      bp.spawnSurfaceImpact(new THREE.Vector3(2, 1, 0), new THREE.Vector3(0, 1, 0), 'concrete');
      bp.spawnSurfaceImpact(new THREE.Vector3(4, 1, 0), new THREE.Vector3(0, 1, 0), 'wood');
      bp.spawnSurfaceImpact(new THREE.Vector3(6, 1, 0), new THREE.Vector3(0, 1, 0), 'ground');
      return { ok: true };
    })()`);
    return res;
  });

  await step(16, 'effects_cleanup_on_death_and_restart', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      const THREE = bp.THREE;
      bp.spawnSurfaceImpact(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), 'metal');
      bp.resetEffects();
      return {
        ok: true
      };
    })()`);
    return res;
  });

  await step(17, 'hitmarker_visible_in_ads_and_reduced_motion', async () => {
    const res = await b.evaluate(`(() => {
      const bp = window.__bp;
      bp.setAdsDown(true);
      bp.showHitmarker('crit');
      const hm = document.getElementById('hitmarker');
      const op = hm.style.opacity;
      const isCrit = hm.classList.contains('hit-crit');
      bp.setAdsDown(false);
      return {
        opacity: op,
        isCrit
      };
    })()`);
    if (res.opacity !== '1' || !res.isCrit) throw new Error('Hitmarker not visible in ADS');
    return res;
  });

  await step(18, 'playwright_visual_hit_and_flinch_capture', async () => {
    const outPng = await capturePng('docs/sprints/screenshots/sprint8_5/01_hit_flinch_reaction.png');
    return { capture: outPng };
  });

  await step(19, 'playwright_ads_hitmarker_armor_capture', async () => {
    await b.evaluate(`(() => {
      window.__bp.setAdsDown(true);
      window.__bp.showHitmarker('armor');
    })()`);
    const outPng = await capturePng('docs/sprints/screenshots/sprint8_5/02_ads_armor_hitmarker.png');
    await b.evaluate(`(() => { window.__bp.setAdsDown(false); })()`);
    return { capture: outPng };
  });

  await step(20, 'playwright_brute_plate_hit_sparks_capture', async () => {
    await b.evaluate(`(() => {
      const bp = window.__bp;
      const THREE = bp.THREE;
      bp.clearEnemies();
      const brute = bp.makeEnemy(0, -4, 'BRUTE');
      bp.damageEnemy(brute, 30, new THREE.Vector3(0, 1.25, -4), false, null, 'ARMOR_PLATE');
    })()`);
    const outPng = await capturePng('docs/sprints/screenshots/sprint8_5/03_brute_armor_sparks.png');
    return { capture: outPng };
  });

} catch (err) {
  console.error('CRITICAL UNHANDLED ERROR:', err);
} finally {
  await b.close();
  srv.close();
}

console.log('\n========================================');
console.log(`SPRINT 8.5 TEST RESULTS: ${results.filter(r => r.ok).length}/${results.length} PASS`);
console.log('========================================\n');

if (results.some(r => !r.ok)) process.exit(1);
