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

async function grantFullUnlocks() {
  await b.evaluate(`(() => {
    window.__bp.progression.reset();
    window.__bp.progression.grantPlayerXP(20000);
    for (const id of ['mk7', 'vector9', 'm870', 'p12']) {
      window.__bp.progression.grantWeaponXP(id, 40000);
    }
  })()`);
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

  await step(1, 'catalog_compatibility_contracts', async () => {
    const res = await b.evaluate(`(() => {
      const a = window.__bp.attachments;
      const cat = a.catalog;
      const mk7List = a.getAttachmentsForWeapon('mk7').map(x => x.id);
      const vecList = a.getAttachmentsForWeapon('vector9').map(x => x.id);
      const m870List = a.getAttachmentsForWeapon('m870').map(x => x.id);
      const p12List = a.getAttachmentsForWeapon('p12').map(x => x.id);
      const redDotMk7 = a.getAttachmentProsCons(cat.find(x => x.id === 'optic_reddot'), 'mk7');
      const suppMk7 = a.getAttachmentProsCons(cat.find(x => x.id === 'muzzle_suppressor'), 'mk7');
      const suppVec = a.getAttachmentProsCons(cat.find(x => x.id === 'muzzle_suppressor'), 'vector9');
      return {
        total: cat.length,
        mk7Count: mk7List.length,
        vecHasTacStock: vecList.includes('stock_tactical'),
        m870HasMag: a.getAttachmentsForWeapon('m870', 'magazine').length,
        m870HasUnder: a.getAttachmentsForWeapon('m870', 'underbarrel').length,
        p12HasHolo: p12List.includes('optic_holo'),
        p12HasStock: a.getAttachmentsForWeapon('p12', 'stock').length,
        redDotMk7,
        suppMk7HasRange: suppMk7.pros.some(p => p.includes('alcance')),
        suppVecHasRange: suppVec.pros.some(p => p.includes('alcance'))
      };
    })()`);
    if (res.total !== 10) throw new Error(`Expected 10 attachments, got ${res.total}`);
    if (res.mk7Count !== 10) throw new Error(`Expected mk7 compatible with 10, got ${res.mk7Count}`);
    if (res.vecHasTacStock) throw new Error('vector9 should not support stock_tactical');
    if (res.m870HasMag !== 0 || res.m870HasUnder !== 0) throw new Error('m870 should not support mag or underbarrel');
    if (res.p12HasHolo || res.p12HasStock !== 0) throw new Error('p12 should not support holo or stocks');
    if (res.redDotMk7.pros.length < 2 || res.redDotMk7.cons.length !== 1) throw new Error(`Bad optic_reddot badges: ${JSON.stringify(res.redDotMk7)}`);
    if (res.suppMk7HasRange) throw new Error('Suppressor on mk7 must not advertise fake range bonus');
    if (!res.suppVecHasRange) throw new Error('Suppressor on vector9 should advertise range bonus');
    return res;
  });

  await step(2, 'base_weapon_zero_regression', async () => {
    const res = await b.evaluate(`(() => {
      const a = window.__bp.attachments;
      const out = {};
      for (const id of ['mk7', 'vector9', 'm870', 'p12']) {
        const base = window.__bp.WEAPONS[id];
        const eff = a.resolveWeaponStats(base, null);
        out[id] = {
          dmgSame: eff.damage === base.damage && eff.pellets === base.pellets,
          rateSame: eff.fireRate === base.fireRate,
          magSame: eff.magSize === base.magSize && eff.reserveDefault === base.reserveDefault && eff.reserveSnd === base.reserveSnd,
          reloadSame: eff.reloadTime === base.reloadTime,
          spreadSame: eff.spreadHip === base.spreadHip && eff.spreadAds === base.spreadAds,
          recoilSame: eff.recoilKick === base.recoilKick && eff.recoilMax === base.recoilMax && eff.recoilRecovery === base.recoilRecovery,
          handlingSame: eff.mobilityMultiplier === base.mobilityMultiplier && eff.adsSpeed === base.adsSpeed,
          dropoffSame: (eff.dropoff === null && base.dropoff === null) || (eff.dropoff && base.dropoff && eff.dropoff.optimal === base.dropoff.optimal && eff.dropoff.max === base.dropoff.max),
          supSame: eff.audioSuppressed === false && eff.muzzleFlashMult === 1 && eff.adsZoomOffset === 25
        };
      }
      return out;
    })()`);
    for (const [id, v] of Object.entries(res)) {
      for (const [k, ok] of Object.entries(v)) {
        if (!ok) throw new Error(`Base regression check failed on ${id}.${k}: ${JSON.stringify(v)}`);
      }
    }
    return res;
  });

  await step(3, 'math_composition_and_clamps', async () => {
    const res = await b.evaluate(`(() => {
      const a = window.__bp.attachments;
      const W = window.__bp.WEAPONS;
      const mkFull = a.resolveWeaponStats(W.mk7, {
        optic: 'optic_holo',
        muzzle: 'muzzle_suppressor',
        magazine: 'magazine_extended',
        underbarrel: 'underbarrel_vertical',
        stock: 'stock_tactical'
      });
      const vecExt = a.resolveWeaponStats(W.vector9, { magazine: 'magazine_extended' });
      const p12Ext = a.resolveWeaponStats(W.p12, { magazine: 'magazine_extended' });
      return { mkFull, vecExt, p12Ext };
    })()`);
    if (res.mkFull.magSize !== 40 || res.mkFull.reserveDefault !== 160 || res.mkFull.reserveSnd !== 200) {
      throw new Error(`MK7 extended scaling wrong: ${res.mkFull.magSize}/${res.mkFull.reserveDefault}/${res.mkFull.reserveSnd}`);
    }
    if (res.vecExt.magSize !== 45 || res.vecExt.reserveDefault !== 225 || res.vecExt.reserveSnd !== 270) {
      throw new Error(`VECTOR9 extended scaling wrong: ${res.vecExt.magSize}/${res.vecExt.reserveDefault}/${res.vecExt.reserveSnd}`);
    }
    if (res.p12Ext.magSize !== 16 || res.p12Ext.reserveDefault !== 64 || res.p12Ext.reserveSnd !== 80) {
      throw new Error(`P12 extended scaling wrong: ${res.p12Ext.magSize}/${res.p12Ext.reserveDefault}/${res.p12Ext.reserveSnd}`);
    }
    if (!res.mkFull.audioSuppressed || res.mkFull.muzzleFlashMult !== 0.22 || res.mkFull.adsZoomOffset !== 28) {
      throw new Error(`MK7 full build optical/suppressor flags wrong: ${JSON.stringify(res.mkFull)}`);
    }
    if (res.mkFull.spreadAds >= 0.0022 || res.mkFull.recoilKick >= 1.0) {
      throw new Error(`MK7 full build should lower spreadAds and recoilKick`);
    }
    return { mkMag: res.mkFull.magSize, vecMag: res.vecExt.magSize, p12Mag: res.p12Ext.magSize };
  });

  await step(4, 'weapon_level_unlock_enforcement', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.progression.reset();
      const lvl1Fail = window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_reddot');
      const slotMismatch = window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'optic_reddot');
      const m870Incompat = window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'm870', 'magazine', 'magazine_extended');
      window.__bp.progression.grantWeaponXP('mk7', 900);
      const mk7Lvl = window.__bp.progression.getWeaponInfo('mk7').level;
      const redDotOk = window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_reddot');
      const suppLocked = window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      return { lvl1Fail, slotMismatch, m870Incompat, mk7Lvl, redDotOk, suppLocked };
    })()`);
    if (res.lvl1Fail.ok || res.lvl1Fail.reason !== 'weapon_level_locked') {
      throw new Error(`Expected weapon_level_locked at lvl 1: ${JSON.stringify(res.lvl1Fail)}`);
    }
    if (res.slotMismatch.ok || res.slotMismatch.reason !== 'slot_mismatch') {
      throw new Error(`Expected slot_mismatch: ${JSON.stringify(res.slotMismatch)}`);
    }
    if (res.m870Incompat.ok || res.m870Incompat.reason !== 'incompatible_weapon') {
      throw new Error(`Expected incompatible_weapon: ${JSON.stringify(res.m870Incompat)}`);
    }
    if (res.mk7Lvl < 3 || !res.redDotOk.ok) {
      throw new Error(`Expected mk7 unlocked optic_reddot at lvl >= 3: ${JSON.stringify(res)}`);
    }
    if (res.suppLocked.ok || res.suppLocked.requiredLevel !== 20) {
      throw new Error(`Expected suppressor still locked at lvl 20: ${JSON.stringify(res.suppLocked)}`);
    }
    return res;
  });

  await step(5, 'independent_5_loadouts_persistence', async () => {
    await grantFullUnlocks();
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      p.setLoadoutWeaponAttachment('loadout_1', 'p12', 'optic', 'optic_reddot');
      p.setLoadoutWeaponAttachment('loadout_2', 'mk7', 'muzzle', 'muzzle_compensator');
      p.setLoadoutWeaponAttachment('loadout_2', 'mk7', 'magazine', 'magazine_fast');
      p.init();
      const l1Mk7 = p.getLoadoutWeaponAttachments('loadout_1', 'mk7');
      const l1P12 = p.getLoadoutWeaponAttachments('loadout_1', 'p12');
      const l2Mk7 = p.getLoadoutWeaponAttachments('loadout_2', 'mk7');
      const l3Mk7 = p.getLoadoutWeaponAttachments('loadout_3', 'mk7');
      return { l1Mk7, l1P12, l2Mk7, l3Mk7, version: p.getState().version };
    })()`);
    if (res.version !== 3) throw new Error(`Expected schema version 3, got ${res.version}`);
    if (res.l1Mk7.muzzle !== 'muzzle_suppressor' || res.l1Mk7.magazine !== 'magazine_extended') {
      throw new Error(`loadout_1 mk7 attachments wrong: ${JSON.stringify(res.l1Mk7)}`);
    }
    if (res.l1P12.optic !== 'optic_reddot') {
      throw new Error(`loadout_1 p12 attachment wrong: ${JSON.stringify(res.l1P12)}`);
    }
    if (res.l2Mk7.muzzle !== 'muzzle_compensator' || res.l2Mk7.magazine !== 'magazine_fast') {
      throw new Error(`loadout_2 mk7 leaked or lost: ${JSON.stringify(res.l2Mk7)}`);
    }
    if (Object.values(res.l3Mk7).some(Boolean)) {
      throw new Error(`loadout_3 mk7 should remain clean: ${JSON.stringify(res.l3Mk7)}`);
    }
    return res;
  });

  await step(6, 'migrations_v1_v2_v3_and_corruption', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const v1 = {
        version: 1,
        player: { xp: 2400 },
        weapons: { mk7: { xp: 500 } },
        selectedWeapon: 'mk7',
        history: { kills: 9, headshots: 3, wavesCleared: 1, sndWins: 0 }
      };
      localStorage.setItem('bp_progression_v1', JSON.stringify(v1));
      p.init();
      const s1 = p.getState();

      const v2 = {
        version: 2,
        player: { xp: 8000 },
        weapons: { mk7: { xp: 30000 }, vector9: { xp: 30000 }, m870: { xp: 30000 }, p12: { xp: 30000 } },
        selectedLoadoutId: 'loadout_2',
        loadouts: [
          { id: 'loadout_1', name: 'ALFA', primary: 'mk7', secondary: 'p12', updatedAt: 100 },
          { id: 'loadout_2', name: 'BRAVO', primary: 'vector9', secondary: 'p12', updatedAt: 200 },
          { id: 'loadout_3', name: 'C3', primary: 'mk7', secondary: null, updatedAt: 300 },
          { id: 'loadout_4', name: 'D4', primary: 'mk7', secondary: null, updatedAt: 400 },
          { id: 'loadout_5', name: 'E5', primary: 'mk7', secondary: null, updatedAt: 500 }
        ],
        history: { kills: 22, headshots: 5, wavesCleared: 4, sndWins: 2 }
      };
      localStorage.setItem('bp_progression_v1', JSON.stringify(v2));
      p.init();
      const s2 = p.getState();

      const corruptV3 = {
        version: 3,
        player: { xp: 10000 },
        weapons: { mk7: { xp: 0 }, m870: { xp: 40000 } },
        selectedLoadoutId: 'loadout_1',
        loadouts: [
          {
            id: 'loadout_1',
            name: 'SANITIZED',
            primary: 'mk7',
            secondary: 'p12',
            weaponAttachments: {
              mk7: { optic: 'optic_reddot', muzzle: 'muzzle_suppressor', magazine: 'nonexistent', underbarrel: null, stock: null },
              m870: { optic: 'optic_reddot', muzzle: null, magazine: 'magazine_extended', underbarrel: 'underbarrel_vertical', stock: null }
            }
          },
          { id: 'loadout_2', name: 'B', primary: 'mk7', secondary: null },
          { id: 'loadout_3', name: 'C', primary: 'mk7', secondary: null },
          { id: 'loadout_4', name: 'D', primary: 'mk7', secondary: null },
          { id: 'loadout_5', name: 'E', primary: 'mk7', secondary: null }
        ]
      };
      localStorage.setItem('bp_progression_v1', JSON.stringify(corruptV3));
      p.init();
      const s3 = p.getState();

      return {
        v1Ver: s1.version,
        v1Kills: s1.history.kills,
        v1HasMap: !!s1.loadouts[0].weaponAttachments?.mk7,
        v2Ver: s2.version,
        v2Active: s2.selectedLoadoutId,
        v2BravoName: s2.loadouts[1].name,
        v2HasMap: !!s2.loadouts[1].weaponAttachments?.vector9,
        s3Mk7: s3.loadouts[0].weaponAttachments.mk7,
        s3M870: s3.loadouts[0].weaponAttachments.m870
      };
    })()`);
    if (res.v1Ver !== 3 || res.v1Kills !== 9 || !res.v1HasMap) throw new Error(`v1->v3 failed: ${JSON.stringify(res)}`);
    if (res.v2Ver !== 3 || res.v2Active !== 'loadout_2' || res.v2BravoName !== 'BRAVO' || !res.v2HasMap) {
      throw new Error(`v2->v3 failed: ${JSON.stringify(res)}`);
    }
    if (res.s3Mk7.optic !== null || res.s3Mk7.muzzle !== null || res.s3Mk7.magazine !== null) {
      throw new Error(`Locked/unknown mk7 attachments were not pruned: ${JSON.stringify(res.s3Mk7)}`);
    }
    if (res.s3M870.optic !== 'optic_reddot' || res.s3M870.magazine !== null || res.s3M870.underbarrel !== null) {
      throw new Error(`Incompatible m870 attachments were not sanitized cleanly: ${JSON.stringify(res.s3M870)}`);
    }
    return res;
  });

  await step(7, 'customizer_ui_workflow_install_remove_reset', async () => {
    await grantFullUnlocks();
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(300);
    await b.click('#btn-customize-weapon');
    await b.sleep(250);

    await b.click('.cust-card[data-attachment-id="optic_reddot"] .btn-cust-install');
    await b.sleep(200);
    await b.click('.cust-slot-btn[data-slot="magazine"]');
    await b.sleep(150);
    await b.click('.cust-card[data-attachment-id="magazine_extended"] .btn-cust-install');
    await b.sleep(250);

    const mid = await b.evaluate(`(() => ({
      equipped: window.__bp.progression.getLoadoutWeaponAttachments('loadout_1', 'mk7'),
      magBarVal: document.getElementById('val-mag').textContent,
      showcase: window.__bp.getShowcaseState().attachments,
      pills: Array.from(document.querySelectorAll('.showcase-att-pill')).map(e => e.textContent),
      resetDisabled: document.getElementById('btn-cust-reset').disabled
    }))()`);

    await b.click('#btn-cust-reset');
    await b.sleep(200);

    const afterReset = await b.evaluate(`(() => ({
      equipped: window.__bp.progression.getLoadoutWeaponAttachments('loadout_1', 'mk7'),
      magBarVal: document.getElementById('val-mag').textContent,
      showcase: window.__bp.getShowcaseState().attachments,
      resetDisabled: document.getElementById('btn-cust-reset').disabled
    }))()`);

    await b.click('#btn-cust-back');
    await b.sleep(150);

    if (mid.equipped.optic !== 'optic_reddot' || mid.equipped.magazine !== 'magazine_extended') {
      throw new Error(`UI install failed: ${JSON.stringify(mid.equipped)}`);
    }
    if (mid.magBarVal !== '40 / 160' || mid.pills.length !== 2 || mid.resetDisabled) {
      throw new Error(`UI live bars/pills mismatch: ${JSON.stringify(mid)}`);
    }
    if (Object.values(afterReset.equipped).some(Boolean) || Object.values(afterReset.showcase).some(Boolean) || !afterReset.resetDisabled) {
      throw new Error(`UI reset failed: ${JSON.stringify(afterReset)}`);
    }
    return { mid, afterReset };
  });

  await step(8, 'incompatible_slots_ui_and_locked_preview', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.reset();
      window.__bp.switchTab('loadout');
    })()`);
    await b.sleep(250);

    await b.click('#btn-customize-weapon');
    await b.sleep(200);
    await b.click('.cust-slot-btn[data-slot="muzzle"]');
    await b.sleep(150);

    const lockState = await b.evaluate(`(() => {
      const card = document.querySelector('.cust-card[data-attachment-id="muzzle_suppressor"]');
      const instBtn = card.querySelector('.btn-cust-install');
      const prevBtn = card.querySelector('.btn-cust-preview');
      prevBtn.click();
      return {
        installDisabled: instBtn.disabled,
        pillText: document.getElementById('showcase-inspect-pill').textContent,
        showcaseMuzzle: window.__bp.getShowcaseState().attachments.muzzle,
        persistedMuzzle: window.__bp.progression.getLoadoutWeaponAttachments('loadout_1', 'mk7').muzzle,
        cancelVisible: getComputedStyle(document.getElementById('btn-cancel-preview')).display
      };
    })()`);

    await b.click('#btn-cust-back');
    await b.sleep(150);

    await b.click('.armory-cat-btn[data-cat="SHOTGUN"]');
    await b.sleep(200);
    await b.click('#btn-customize-weapon');
    await b.sleep(200);
    await b.click('.cust-slot-btn[data-slot="magazine"]');
    await b.sleep(150);

    const m870Ui = await b.evaluate(`(() => ({
      emptyMsg: document.querySelector('.cust-empty-msg')?.textContent || '',
      incompatCount: document.querySelectorAll('.cust-slot-btn.incompatible').length
    }))()`);

    await b.click('#btn-cust-back');
    await b.sleep(150);

    if (!lockState.installDisabled || lockState.pillText !== 'VISTA PREVIA' || lockState.showcaseMuzzle !== 'muzzle_suppressor') {
      throw new Error(`Locked preview UI wrong: ${JSON.stringify(lockState)}`);
    }
    if (lockState.persistedMuzzle !== null || lockState.cancelVisible === 'none') {
      throw new Error(`Preview mutated persisted state or hid cancel button: ${JSON.stringify(lockState)}`);
    }
    if (!m870Ui.emptyMsg.includes('NO ADMITE') || m870Ui.incompatCount !== 2) {
      throw new Error(`M870 incompatible slots UI wrong: ${JSON.stringify(m870Ui)}`);
    }
    return { lockState, m870Ui };
  });

  await step(9, 'preview_cancellation_and_switch_isolation', async () => {
    await grantFullUnlocks();
    await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]').click();
    })()`);
    await b.sleep(200);
    await b.click('#btn-customize-weapon');
    await b.sleep(200);
    await b.click('.cust-card[data-attachment-id="optic_holo"] .btn-cust-preview');
    await b.sleep(200);

    const duringPreview = await b.evaluate(`window.__bp.getShowcaseState().attachments.optic`);
    await b.click('#btn-cancel-preview');
    await b.sleep(200);
    const afterCancel = await b.evaluate(`({
      optic: window.__bp.getShowcaseState().attachments.optic,
      pill: document.getElementById('showcase-inspect-pill').textContent,
      persisted: window.__bp.progression.getLoadoutWeaponAttachments('loadout_1', 'mk7')
    })`);

    await b.click('.cust-card[data-attachment-id="optic_reddot"] .btn-cust-preview');
    await b.sleep(150);
    await b.click('button[data-tab="operator"]');
    await b.sleep(200);
    await b.click('button[data-tab="loadout"]');
    await b.sleep(200);
    const afterTabSwitch = await b.evaluate(`({
      showcaseOptic: window.__bp.getShowcaseState().attachments.optic,
      persistedOptic: window.__bp.progression.getLoadoutWeaponAttachments('loadout_1', 'mk7').optic
    })`);

    if (duringPreview !== 'optic_holo') throw new Error(`Expected optic_holo in preview, got ${duringPreview}`);
    if (afterCancel.optic !== null || afterCancel.persisted.optic !== null) {
      throw new Error(`Cancel preview did not restore clean state: ${JSON.stringify(afterCancel)}`);
    }
    if (afterTabSwitch.showcaseOptic !== null || afterTabSwitch.persistedOptic !== null) {
      throw new Error(`Tab switch left preview active: ${JSON.stringify(afterTabSwitch)}`);
    }
    return { duringPreview, afterCancel, afterTabSwitch };
  });

  await step(10, 'armory_3d_incremental_updates_and_angle_preservation', async () => {
    await grantFullUnlocks();
    await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      window.__bp.rotateShowcase(0.55, 0.22);
      window.__bp.zoomShowcase(-0.35);
    })()`);
    await b.sleep(450);

    const before = await b.evaluate(`window.__bp.getShowcaseState()`);
    await b.evaluate(`(() => {
      window.__bp.setCustomizerOpen(true);
      window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      window.__bp.setPreviewAttachment('mk7', 'optic', 'optic_holo');
    })()`);
    await b.sleep(250);
    const after = await b.evaluate(`window.__bp.getShowcaseState()`);

    await b.click('#btn-cust-back');
    await b.sleep(150);

    if (after.attachments.muzzle !== 'muzzle_suppressor' || after.attachments.optic !== 'optic_holo') {
      throw new Error(`3D showcase did not update attachments: ${JSON.stringify(after.attachments)}`);
    }
    if (Math.abs(after.targetYaw - before.targetYaw) > 0.001 || Math.abs(after.targetPitch - before.targetPitch) > 0.001) {
      throw new Error(`Attachment swap reset user showcase rotation: before=${before.targetYaw}, after=${after.targetYaw}`);
    }
    return { yawKept: after.targetYaw, attachments: after.attachments };
  });

  await step(11, 'showcase_framing_no_clipping_with_attachments', async () => {
    await grantFullUnlocks();
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_holo');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'underbarrel', 'underbarrel_vertical');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'stock', 'stock_tactical');
      window.__bp.switchTab('loadout');
      return true;
    })()`);
    await b.sleep(300);

    const checks = [];
    for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 768]]) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
      await b.sleep(450);
      const bnd = await b.evaluate(`(() => {
        const s = window.__bp.getShowcaseScreenBounds();
        const p = document.querySelector('.loadout-panel').getBoundingClientRect();
        const hd = document.getElementById('lobby-header').getBoundingClientRect();
        return { w: window.innerWidth, h: window.innerHeight, s, pRight: p.right, hdBottom: hd.bottom };
      })()`);
      if (!bnd.s) throw new Error(`Missing bounds at ${w}x${h}`);
      if (bnd.s.minX < bnd.pRight - 4 || bnd.s.maxX > bnd.w - 2 || bnd.s.minY < bnd.hdBottom || bnd.s.maxY > bnd.h - 2) {
        throw new Error(`Attached mk7 clipped at ${w}x${h}: ${JSON.stringify(bnd)}`);
      }
      checks.push({ res: `${w}x${h}`, minX: Math.round(bnd.s.minX), maxX: Math.round(bnd.s.maxX), maxY: Math.round(bnd.s.maxY) });
    }
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(250);
    return checks;
  });

  await step(12, 'combat_extended_and_fast_mag_mk7', async () => {
    await grantFullUnlocks();
    const ext = await b.evaluate(`(() => {
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      window.__bp.startGame('waves');
      const init = { mag: window.__bp.weapon.magSize, ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve, reloadTime: window.__bp.weapon.reloadTime };
      for (let i = 0; i < 15; i++) { window.__bp.weapon.cooldown = 0; window.__bp.shoot(); }
      const midAmmo = window.__bp.weapon.ammo;
      window.__bp.tryReload();
      return { init, midAmmo, reloading: window.__bp.weapon.reloading };
    })()`);
    await b.sleep(2100);
    const extAfter = await b.evaluate(`(() => {
      const s = { ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve, reloading: window.__bp.weapon.reloading };
      window.__bp.backToMenu();
      window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_fast');
      window.__bp.startGame('waves');
      const fastInit = { mag: window.__bp.weapon.magSize, res: window.__bp.weapon.reserve, reloadTime: window.__bp.weapon.reloadTime };
      for (let i = 0; i < 10; i++) { window.__bp.weapon.cooldown = 0; window.__bp.shoot(); }
      window.__bp.tryReload();
      return { s, fastInit };
    })()`);
    await b.sleep(1450);
    const fastDone = await b.evaluate(`(() => {
      const done = { ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve, reloading: window.__bp.weapon.reloading };
      window.__bp.backToMenu();
      return done;
    })()`);
    if (ext.init.mag !== 40 || ext.init.ammo !== 40 || ext.init.res !== 160 || ext.midAmmo !== 25 || !ext.reloading) {
      throw new Error(`Extended mag start/shoot failed: ${JSON.stringify(ext)}`);
    }
    if (extAfter.s.reloading || extAfter.s.ammo !== 40 || extAfter.s.res !== 145) {
      throw new Error(`Extended mag reload transfer wrong: ${JSON.stringify(extAfter.s)}`);
    }
    if (extAfter.fastInit.reloadTime >= 1.3 || extAfter.fastInit.mag !== 30 || fastDone.reloading || fastDone.ammo !== 30 || fastDone.res !== 110) {
      throw new Error(`Fast mag timing/transfer wrong: ${JSON.stringify({ fastInit: extAfter.fastInit, fastDone })}`);
    }
    return { ext: ext.init, extAfter: extAfter.s, fastDone };
  });

  await step(13, 'combat_vector9_dropoff_range_and_recoil', async () => {
    await grantFullUnlocks();
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const a = window.__bp.attachments;
      const baseVec = a.resolveWeaponStats(window.__bp.WEAPONS.vector9, null);
      p.selectLoadout('loadout_2');
      p.setLoadoutPrimary('loadout_2', 'vector9');
      p.setLoadoutWeaponAttachment('loadout_2', 'vector9', 'muzzle', 'muzzle_suppressor');
      p.setLoadoutWeaponAttachment('loadout_2', 'vector9', 'underbarrel', 'underbarrel_vertical');
      window.__bp.startGame('waves');
      const live = {
        id: window.__bp.weapon.id,
        dropoff: { ...window.__bp.weapon.dropoff },
        recoilKick: window.__bp.weapon.recoilKick,
        spreadAds: window.__bp.weapon.spreadAds
      };
      window.__bp.backToMenu();
      return { baseVec: { dropoff: baseVec.dropoff, recoilKick: baseVec.recoilKick, spreadAds: baseVec.spreadAds }, live };
    })()`);
    if (res.live.id !== 'vector9' || res.live.dropoff.optimal <= res.baseVec.dropoff.optimal || res.live.dropoff.max <= res.baseVec.dropoff.max) {
      throw new Error(`VECTOR9 range dropoff did not expand: ${JSON.stringify(res)}`);
    }
    if (res.live.recoilKick >= res.baseVec.recoilKick || res.live.spreadAds >= res.baseVec.spreadAds) {
      throw new Error(`VECTOR9 recoil/spread did not improve: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(14, 'combat_optics_ads_zoom_and_speed', async () => {
    await grantFullUnlocks();
    await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'mk7');
      p.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_holo');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'underbarrel', 'underbarrel_angled');
      window.__bp.startGame('waves');
      window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    })()`);
    await b.sleep(450);
    const res = await b.evaluate(`(() => {
      const out = {
        adsDown: window.__bp.getAdsState().adsDown,
        adsAmount: window.__bp.getAdsState().adsAmount,
        adsSpeed: window.__bp.weapon.adsSpeed,
        adsZoomOffset: window.__bp.weapon.adsZoomOffset,
        spreadAds: window.__bp.weapon.spreadAds
      };
      window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
      window.__bp.backToMenu();
      return out;
    })()`);
    if (!res.adsDown || res.adsAmount < 0.7 || res.adsZoomOffset !== 28 || res.adsSpeed <= 12.0 || res.spreadAds >= 0.002) {
      throw new Error(`ADS optics/angled grip integration wrong: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(15, 'combat_suppressor_flash_and_audio_contract', async () => {
    await grantFullUnlocks();
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'mk7');
      p.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      window.__bp.startGame('waves');
      window.__bp.shoot();
      const out = {
        suppressed: window.__bp.weapon.audioSuppressed,
        flashMult: window.__bp.weapon.muzzleFlashMult,
        mk7DropoffNull: window.__bp.weapon.dropoff === null
      };
      window.__bp.backToMenu();
      return out;
    })()`);
    if (!res.suppressed || res.flashMult !== 0.22 || !res.mk7DropoffNull) {
      throw new Error(`Suppressor combat state wrong: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(16, 'combat_m870_shell_reload_and_stock_handling', async () => {
    await grantFullUnlocks();
    const init = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'm870');
      p.setLoadoutWeaponAttachment('loadout_1', 'm870', 'optic', 'optic_reddot');
      p.setLoadoutWeaponAttachment('loadout_1', 'm870', 'muzzle', 'muzzle_compensator');
      p.setLoadoutWeaponAttachment('loadout_1', 'm870', 'stock', 'stock_tactical');
      window.__bp.startGame('waves');
      window.__bp.shoot();
      window.__bp.weapon.cooldown = 0;
      window.__bp.shoot();
      const ammoBefore = window.__bp.weapon.ammo;
      window.__bp.tryReload();
      return {
        ammoBefore,
        reloading: window.__bp.weapon.reloading,
        reloadType: window.__bp.weapon.reloadType,
        recoilKick: window.__bp.weapon.recoilKick,
        spreadAds: window.__bp.weapon.spreadAds
      };
    })()`);
    await b.sleep(1000);
    const midShot = await b.evaluate(`(() => {
      window.__bp.shoot();
      const afterInterrupt = { ammo: window.__bp.weapon.ammo, reloading: window.__bp.weapon.reloading };
      window.__bp.backToMenu();
      return afterInterrupt;
    })()`);
    if (init.reloadType !== 'shell' || !init.reloading || init.ammoBefore !== 4) {
      throw new Error(`M870 shell reload init wrong: ${JSON.stringify(init)}`);
    }
    if (init.recoilKick >= 4.5 || init.spreadAds >= 0.028) {
      throw new Error(`M870 compensator/stock/optic modifiers not applied: ${JSON.stringify(init)}`);
    }
    if (midShot.reloading || midShot.ammo >= 6) {
      throw new Error(`M870 reload interrupt-on-fire failed: ${JSON.stringify(midShot)}`);
    }
    return { init, midShot };
  });

  await step(17, 'combat_p12_secondary_and_slot_ammo_integrity', async () => {
    await grantFullUnlocks();
    await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'mk7');
      p.setLoadoutSecondary('loadout_1', 'p12');
      p.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      p.setLoadoutWeaponAttachment('loadout_1', 'p12', 'magazine', 'magazine_extended');
      p.setLoadoutWeaponAttachment('loadout_1', 'p12', 'muzzle', 'muzzle_suppressor');
      window.__bp.startGame('waves');
      for (let i = 0; i < 6; i++) { window.__bp.weapon.cooldown = 0; window.__bp.shoot(); }
      window.__bp.switchWeaponSlot('secondary');
    })()`);
    await b.sleep(450);

    const p12Mid = await b.evaluate(`(() => {
      const beforeShots = { id: window.__bp.weapon.id, mag: window.__bp.weapon.magSize, ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve, sup: window.__bp.weapon.audioSuppressed };
      for (let i = 0; i < 4; i++) {
        window.__bp.weapon.cooldown = 0;
        window.__bp.weapon.semiFired = false;
        window.__bp.shoot();
      }
      window.__bp.tryReload();
      return { beforeShots, afterShots: window.__bp.weapon.ammo };
    })()`);
    await b.sleep(1650);

    const p12Reloaded = await b.evaluate(`(() => {
      const p12State = { ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve, reloading: window.__bp.weapon.reloading };
      window.__bp.switchWeaponSlot('primary');
      return p12State;
    })()`);
    await b.sleep(450);

    const primReturn = await b.evaluate(`(() => {
      const out = { id: window.__bp.weapon.id, mag: window.__bp.weapon.magSize, ammo: window.__bp.weapon.ammo, res: window.__bp.weapon.reserve };
      window.__bp.backToMenu();
      return out;
    })()`);

    if (p12Mid.beforeShots.id !== 'p12' || p12Mid.beforeShots.mag !== 16 || p12Mid.beforeShots.res !== 64 || !p12Mid.beforeShots.sup) {
      throw new Error(`P12 customized stats wrong on switch: ${JSON.stringify(p12Mid)}`);
    }
    if (p12Reloaded.reloading || p12Reloaded.ammo !== 16 || p12Reloaded.res !== 60) {
      throw new Error(`P12 reload integrity failed: ${JSON.stringify(p12Reloaded)}`);
    }
    if (primReturn.id !== 'mk7' || primReturn.mag !== 40 || primReturn.ammo !== 34 || primReturn.res !== 160) {
      throw new Error(`Primary ammo/stats corrupted after P12 switch: ${JSON.stringify(primReturn)}`);
    }
    return { p12Mid, p12Reloaded, primReturn };
  });

  await step(18, 'combat_modes_snd_and_midmatch_immunity', async () => {
    await grantFullUnlocks();
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      window.__bp.startGame('snd');
      const startState = {
        mode: window.__bp.getGameMode ? window.__bp.getGameMode() : 'snd',
        mag: window.__bp.weapon.magSize,
        res: window.__bp.weapon.reserve,
        sup: window.__bp.weapon.audioSuppressed
      };
      p.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      p.setLoadoutPrimary('loadout_1', 'vector9');
      window.__bp.shoot();
      const midMatch = {
        id: window.__bp.weapon.id,
        mag: window.__bp.weapon.magSize,
        ammo: window.__bp.weapon.ammo,
        res: window.__bp.weapon.reserve,
        sup: window.__bp.weapon.audioSuppressed
      };
      window.__bp.backToMenu();
      return { startState, midMatch };
    })()`);
    if (res.startState.mag !== 40 || res.startState.res !== 200) {
      throw new Error(`S&D extended mag reserve wrong: ${JSON.stringify(res.startState)}`);
    }
    if (res.midMatch.id !== 'mk7' || res.midMatch.mag !== 40 || res.midMatch.ammo !== 39 || res.midMatch.sup !== false) {
      throw new Error(`Running match mutated after lobby edit: ${JSON.stringify(res.midMatch)}`);
    }
    return res;
  });

  await step(19, 'shared_resource_ownership_and_webgl_memory', async () => {
    await grantFullUnlocks();
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(300);
    await b.evaluate(`(() => {
      window.__bp.setCustomizerOpen(true);
      window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_holo');
    })()`);
    await b.sleep(200);
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(200);
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(200);
    await b.evaluate(`(() => {
      window.__bp.progression.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      window.__bp.switchTab('loadout');
      window.__bp.setCustomizerOpen(true);
    })()`);
    await b.sleep(250);
    const baseline = await b.evaluate(`window.__bp.snapshot()`);

    const combos = [
      ['optic', 'optic_reddot'],
      ['optic', 'optic_holo'],
      ['muzzle', 'muzzle_compensator'],
      ['muzzle', 'muzzle_suppressor'],
      ['magazine', 'magazine_extended'],
      ['magazine', 'magazine_fast'],
      ['underbarrel', 'underbarrel_vertical'],
      ['underbarrel', 'underbarrel_angled'],
      ['stock', 'stock_light'],
      ['stock', 'stock_tactical'],
      ['optic', null],
      ['muzzle', null]
    ];

    for (let r = 0; r < 3; r++) {
      for (const [slot, attId] of combos) {
        await b.evaluate(`(() => {
          window.__bp.setPreviewAttachment('mk7', ${JSON.stringify(slot)}, ${JSON.stringify(attId)});
          window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', ${JSON.stringify(slot)}, ${JSON.stringify(attId)});
        })()`);
        await b.sleep(25);
      }
    }

    await b.evaluate(`(() => {
      window.__bp.setPreviewAttachment(null, null, null);
      window.__bp.progression.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      window.__bp.setCustomizerOpen(false);
    })()`);
    await b.sleep(250);

    for (let c = 0; c < 4; c++) {
      await b.evaluate(`window.__bp.progression.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_holo')`);
      await b.evaluate(`window.__bp.startGame('waves')`);
      await b.sleep(150);
      await b.evaluate(`window.__bp.backToMenu()`);
      await b.sleep(150);
    }

    await b.evaluate(`(() => {
      window.__bp.progression.clearLoadoutWeaponAttachments('loadout_1', 'mk7');
      window.__bp.switchTab('loadout');
    })()`);
    await b.sleep(250);

    const endSnap = await b.evaluate(`({
      snap: window.__bp.snapshot(),
      sharedIntact: window.__bp.areSharedAttachmentGeometriesIntact()
    })`);
    const errs = b.logs.filter(l => l.t === 'exception' || l.t === 'console.error');
    if (errs.length > 0) throw new Error(`JS/Console errors during memory stress: ${JSON.stringify(errs)}`);
    if (!endSnap.sharedIntact) throw new Error('Shared module-level attachment geometries were improperly disposed!');
    if (endSnap.snap.geometries > baseline.geometries) {
      throw new Error(`WebGL geometries leaked across 36 attachment swaps + 4 matches: baseline=${baseline.geometries}, end=${endSnap.snap.geometries}`);
    }
    if (endSnap.snap.textures > baseline.textures) {
      throw new Error(`WebGL textures leaked: baseline=${baseline.textures}, end=${endSnap.snap.textures}`);
    }
    return {
      baseline: baseline.geometries,
      end: endSnap.snap.geometries,
      textures: `${baseline.textures}->${endSnap.snap.textures}`,
      sharedIntact: endSnap.sharedIntact
    };
  });

  await step(20, 'responsive_customizer_screenshots_1920_1280_1024', async () => {
    await grantFullUnlocks();
    await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.selectLoadout('loadout_1');
      p.setLoadoutPrimary('loadout_1', 'mk7');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'optic', 'optic_holo');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'muzzle', 'muzzle_suppressor');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'magazine', 'magazine_extended');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'underbarrel', 'underbarrel_vertical');
      p.setLoadoutWeaponAttachment('loadout_1', 'mk7', 'stock', 'stock_tactical');
      window.__bp.switchTab('loadout');
      window.__bp.setCustomizerOpen(true);
    })()`);
    await b.sleep(300);

    await b.evaluate(`(() => { const d = document.getElementById('diag'); if (d) d.style.display = 'none'; })()`);
    await capturePng('docs/assets/screenshots/sprint7/customizer_1920x1080.png', 1920, 1080);
    await capturePng('docs/assets/screenshots/sprint7/customizer_1280x720.png', 1280, 720);
    await capturePng('docs/assets/screenshots/sprint7/customizer_1024x768.png', 1024, 768);

    const checkOverflow = await b.evaluate(`(() => ({
      docScrollW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      customizerVis: getComputedStyle(document.getElementById('armory-customizer')).display !== 'none'
    }))()`);

    await b.evaluate(`(() => {
      window.__bp.setCustomizerOpen(false);
      window.__bp.startGame('waves');
      window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    })()`);
    await b.sleep(650);
    await capturePng('docs/assets/screenshots/sprint7/combat_ads_1280x720.png', 1280, 720);
    await b.evaluate(`(() => {
      const d = document.getElementById('diag'); if (d) d.style.display = '';
      window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
      window.__bp.backToMenu();
    })()`);
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(200);

    if (checkOverflow.docScrollW > checkOverflow.winW + 2 || !checkOverflow.customizerVis) {
      throw new Error(`Responsive customizer overflow at 1024x768: ${JSON.stringify(checkOverflow)}`);
    }
    return checkOverflow;
  });
} finally {
  await b.close();
  srv.close();
}

const passed = results.filter(r => r.ok).length;
console.log('\n--- RESUMEN SPRINT 7 ---');
console.log(`Total steps: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${results.length - passed}`);
if (passed !== results.length) {
  process.exit(1);
}
