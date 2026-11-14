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
  await b.sleep(3000);

  await step(1, 'reset_loadout_to_default_domain', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.grantPlayerXP(5000);
      p.grantWeaponXP('vector9', 5000);
      const l1 = p.getLoadouts()[0];
      const initialSelected = p.getActiveLoadout().id;
      p.renameLoadout(l1.id, 'CLASE MODIFICADA');
      p.setLoadoutPrimary(l1.id, 'vector9');
      p.setLoadoutWeaponAttachment(l1.id, 'vector9', 'optic', 'optic_reddot');
      p.setLoadoutSecondary(l1.id, null);

      const beforeReset = JSON.parse(JSON.stringify(p.getLoadouts()[0]));
      const ok = p.resetLoadoutToDefault(l1.id);
      const afterReset = JSON.parse(JSON.stringify(p.getLoadouts()[0]));
      const afterSelected = p.getActiveLoadout().id;

      const vectorAttachments = afterReset.weaponAttachments.vector9 || {};
      const allCleared = Object.values(vectorAttachments).every(v => v === null);

      return {
        ok,
        beforeReset,
        afterReset,
        selectedPreserved: initialSelected === afterSelected,
        attachmentsCleared: allCleared,
        defaultName: afterReset.name === 'ASALTO 1',
        defaultPrimary: afterReset.primary === 'mk7',
        defaultSecondary: afterReset.secondary === 'p12'
      };
    })()`);

    if (!res.ok) throw new Error('resetLoadoutToDefault returned false');
    if (!res.selectedPreserved) throw new Error('selectedLoadoutId was altered by reset');
    if (!res.attachmentsCleared) throw new Error('Attachments were not cleared on reset');
    if (!res.defaultName || !res.defaultPrimary || !res.defaultSecondary) {
      throw new Error(`Default values not restored: ${JSON.stringify(res.afterReset)}`);
    }
    return res;
  });

  await step(2, 'copy_loadout_deep_clone_and_isolation', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      p.grantPlayerXP(10000);
      p.grantWeaponXP('mk7', 50000);
      p.grantWeaponXP('p12', 50000);

      const loadouts = p.getLoadouts();
      const srcId = loadouts[0].id;
      const dstId = loadouts[1].id;
      const initialSelected = p.getActiveLoadout().id;

      p.setLoadoutPrimary(srcId, 'mk7');
      p.setLoadoutWeaponAttachment(srcId, 'mk7', 'optic', 'optic_holo');
      p.setLoadoutWeaponAttachment(srcId, 'mk7', 'barrel', 'barrel_suppressor');
      p.setLoadoutSecondary(srcId, 'p12');
      p.setLoadoutWeaponAttachment(srcId, 'p12', 'magazine', 'mag_extended_pistol');

      const ok = p.copyLoadout(srcId, dstId);
      const srcAfter = p.getLoadouts().find(l => l.id === srcId);
      const dstAfter = p.getLoadouts().find(l => l.id === dstId);
      const afterSelected = p.getActiveLoadout().id;

      const isDeepCloned = srcAfter.weaponAttachments !== dstAfter.weaponAttachments &&
        srcAfter.weaponAttachments.mk7 !== dstAfter.weaponAttachments.mk7 &&
        JSON.stringify(srcAfter.weaponAttachments.mk7) === JSON.stringify(dstAfter.weaponAttachments.mk7);

      p.setLoadoutWeaponAttachment(dstId, 'mk7', 'optic', 'optic_reddot');
      const mutatedDst = p.getLoadouts().find(l => l.id === dstId);
      const unmutatedSrc = p.getLoadouts().find(l => l.id === srcId);
      const isolationWorks = unmutatedSrc.weaponAttachments.mk7.optic === 'optic_holo' &&
        mutatedDst.weaponAttachments.mk7.optic === 'optic_reddot';

      return {
        ok,
        selectedPreserved: initialSelected === afterSelected,
        isDeepCloned,
        isolationWorks,
        nameCopied: dstAfter.name === srcAfter.name,
        primaryCopied: dstAfter.primary === srcAfter.primary,
        secondaryCopied: dstAfter.secondary === srcAfter.secondary
      };
    })()`);

    if (!res.ok) throw new Error('copyLoadout returned false');
    if (!res.selectedPreserved) throw new Error('Selected loadout changed unexpectedly');
    if (!res.isDeepCloned || !res.isolationWorks) throw new Error(`Attachments shared references or lacked isolation: ${JSON.stringify(res)}`);
    if (!res.nameCopied || !res.primaryCopied || !res.secondaryCopied) {
      throw new Error(`Loadout attributes failed to copy correctly: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(3, 'unequip_secondary_slot_persists', async () => {
    const res = await b.evaluate(`(() => {
      const p = window.__bp.progression;
      const l1 = p.getLoadouts()[0];
      p.setLoadoutSecondary(l1.id, 'p12');
      const before = p.getLoadouts()[0].secondary;
      const ok = p.setLoadoutSecondary(l1.id, null);
      const after = p.getLoadouts()[0].secondary;

      p.load();
      const afterReload = p.getLoadouts()[0].secondary;

      return {
        ok,
        before,
        after,
        afterReload,
        persistedNull: after === null && afterReload === null
      };
    })()`);

    if (!res.ok) throw new Error('setLoadoutSecondary(null) failed');
    if (!res.persistedNull) throw new Error(`Null secondary did not persist: ${JSON.stringify(res)}`);
    return res;
  });

  await step(4, 'armory_ux_reset_and_copy_modals', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const p = window.__bp.progression;
      const l = p.getLoadouts();
      window.__bp.setEditingLoadoutId(l[0].id);

      const btnReset = document.getElementById('btn-reset-loadout');
      const resetModal = document.getElementById('loadout-reset-modal');
      const resetCancel = document.getElementById('btn-reset-cancel');
      const resetConfirm = document.getElementById('btn-reset-confirm');

      btnReset.click();
      const resetOpened = resetModal.style.display === 'flex';
      resetCancel.click();
      const resetCancelled = resetModal.style.display === 'none';

      const btnCopy = document.getElementById('btn-copy-loadout');
      const copyModal = document.getElementById('loadout-copy-modal');
      const copyTargets = document.getElementById('loadout-copy-targets');
      const copyCancel = document.getElementById('btn-copy-cancel');
      const copyConfirm = document.getElementById('btn-copy-confirm');

      btnCopy.click();
      const copyOpened = copyModal.style.display === 'flex';
      const targetsCount = copyTargets.querySelectorAll('.loadout-target-btn').length;
      const initialConfirmDisabled = copyConfirm.disabled;

      const firstTarget = copyTargets.querySelector('.loadout-target-btn');
      if (firstTarget) firstTarget.click();
      const confirmEnabledAfterPick = !copyConfirm.disabled;
      copyCancel.click();
      const copyCancelled = copyModal.style.display === 'none';

      return {
        resetOpened,
        resetCancelled,
        copyOpened,
        targetsCount,
        initialConfirmDisabled,
        confirmEnabledAfterPick,
        copyCancelled
      };
    })()`);

    if (!res.resetOpened || !res.resetCancelled) throw new Error('Reset modal workflow broken');
    if (!res.copyOpened || res.targetsCount !== 4 || !res.initialConfirmDisabled || !res.confirmEnabledAfterPick || !res.copyCancelled) {
      throw new Error(`Copy modal workflow broken: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(5, 'armory_ux_unequip_button_interaction', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const p = window.__bp.progression;
      const l = p.getLoadouts();
      window.__bp.setEditingLoadoutId(l[0].id);
      p.setLoadoutSecondary(l[0].id, 'p12');
      window.__bp.setEditingLoadoutId(l[0].id);

      const btnUnequip = document.getElementById('btn-unequip-secondary');
      const secVal = document.getElementById('slot-secondary-val');
      const wasVisible = btnUnequip.style.display !== 'none';

      btnUnequip.click();

      const isHiddenAfter = btnUnequip.style.display === 'none';
      const labelAfter = secVal.textContent.trim();
      const currentSecondary = p.getLoadouts().find(x => x.id === l[0].id).secondary;

      return {
        wasVisible,
        isHiddenAfter,
        labelAfter,
        currentSecondary,
        success: wasVisible && isHiddenAfter && labelAfter === 'VACÍA' && currentSecondary === null
      };
    })()`);

    if (!res.success) throw new Error(`Unequip button interaction failed: ${JSON.stringify(res)}`);
    return res;
  });

  await step(6, 'status_badges_differentiation', async () => {
    const res = await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const p = window.__bp.progression;
      const loadouts = p.getLoadouts();
      p.selectLoadout(loadouts[0].id);
      p.setLoadoutPrimary(loadouts[0].id, 'mk7');
      p.setLoadoutPrimary(loadouts[1].id, 'vector9');

      window.__bp.setEditingLoadoutId(loadouts[0].id);
      const tagActiveDeploy = document.getElementById('loadout-status-tag').className;
      const textActiveDeploy = document.getElementById('loadout-status-tag').textContent;

      window.__bp.setEditingLoadoutId(loadouts[1].id);
      const tagEditing = document.getElementById('loadout-status-tag').className;
      const textEditing = document.getElementById('loadout-status-tag').textContent;

      const cardMk7 = document.querySelector('.weapon-card[data-id="mk7"]');
      if (cardMk7) cardMk7.click();
      const tagOtherDeploy = document.getElementById('loadout-status-tag').className;
      const textOtherDeploy = document.getElementById('loadout-status-tag').textContent;

      return {
        tagActiveDeploy,
        textActiveDeploy,
        tagEditing,
        textEditing,
        tagOtherDeploy,
        textOtherDeploy,
        hasActiveDeployClass: tagActiveDeploy.includes('st-active-deploy'),
        hasEditingClass: tagEditing.includes('st-active-deploy') || tagEditing.includes('st-editing-loadout'),
        hasOtherDeployClass: tagOtherDeploy.includes('st-active-deploy-other')
      };
    })()`);

    if (!res.hasActiveDeployClass || !res.hasOtherDeployClass) {
      throw new Error(`Status badge styling failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(7, 'compact_3d_viewer_layout_at_768px', async () => {
    await b.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(450);

    const res = await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const stage = document.getElementById('armory-showcase-stage');
      const panel = document.querySelector('#tab-loadout .loadout-panel');
      const rect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const style = window.getComputedStyle(stage);
      const state = window.__bp.getShowcaseState();
      const bounds = window.__bp.getShowcaseScreenBounds();

      return {
        stageDisplay: style.display,
        stageHeight: rect.height,
        stageWidth: rect.width,
        stageTop: rect.top,
        panelTop: panelRect.top,
        hasNoOverlap: panelRect.top >= rect.bottom - 4,
        isFramed: bounds && bounds.width > 0 && bounds.height > 0,
        meshVisible: state && state.showcaseVisible
      };
    })()`);

    if (res.stageDisplay === 'none' || res.stageHeight < 150) {
      throw new Error(`3D Stage hidden or collapsed in 768px: ${JSON.stringify(res)}`);
    }
    if (!res.hasNoOverlap || !res.isFramed || !res.meshVisible) {
      throw new Error(`3D Stage bounds or layout invalid in 768px: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(8, 'compact_3d_viewer_touch_rotation_and_reset', async () => {
    const res = await b.evaluate(`(() => {
      const initial = window.__bp.getShowcaseState();
      window.__bp.rotateShowcase(1.25, 0.45);
      const afterRotate = window.__bp.getShowcaseState();
      window.__bp.resetShowcaseView();
      const afterReset = window.__bp.getShowcaseState();

      return {
        initialYaw: initial.targetYaw,
        rotatedYaw: afterRotate.targetYaw,
        resetYaw: afterReset.targetYaw,
        rotateDelta: Math.abs(afterRotate.targetYaw - initial.targetYaw),
        resetDelta: Math.abs(afterReset.targetYaw - initial.targetYaw)
      };
    })()`);

    if (res.rotateDelta < 0.5) throw new Error('Showcase rotation did not apply');
    if (res.resetDelta > 0.05) throw new Error('Showcase reset failed to return to default targetYaw');
    return res;
  });

  await step(9, 'ads_alignment_mk7', async () => {
    const res = await b.evaluate(`(async () => {
      const w = window.__bp.WEAPONS.mk7;
      const ironAdsPos = w.adsPos;
      const ironSightY = 0.085;
      const ironRaycastErr = Math.abs(ironAdsPos.y + ironSightY);

      const opticAnchors = { adsYOffset: -0.015, adsYOffsetRedDot: -0.015, adsYOffsetHolo: -0.018 };
      const opticSightY = 0.100;
      const opticRaycastErr = Math.abs(ironAdsPos.y + opticAnchors.adsYOffsetRedDot + opticSightY);

      return {
        weapon: 'mk7',
        ironAdsPos: { x: ironAdsPos.x, y: ironAdsPos.y, z: ironAdsPos.z },
        ironRaycastErr,
        opticRaycastErr,
        aligned: ironRaycastErr < 0.005 && opticRaycastErr < 0.005
      };
    })()`);

    if (!res.aligned) throw new Error(`MK-7 ADS misaligned: ${JSON.stringify(res)}`);
    return res;
  });

  await step(10, 'ads_alignment_vector9', async () => {
    const res = await b.evaluate(`(async () => {
      const w = window.__bp.WEAPONS.vector9;
      const ironAdsPos = w.adsPos;
      const ironSightY = 0.096;
      const ironRaycastErr = Math.abs(ironAdsPos.y + ironSightY);

      const opticAnchors = { adsYOffset: -0.005, adsYOffsetRedDot: -0.005 };
      const opticSightY = 0.101;
      const opticRaycastErr = Math.abs(ironAdsPos.y + opticAnchors.adsYOffsetRedDot + opticSightY);

      return {
        weapon: 'vector9',
        ironAdsPos: { x: ironAdsPos.x, y: ironAdsPos.y, z: ironAdsPos.z },
        ironRaycastErr,
        opticRaycastErr,
        aligned: ironRaycastErr < 0.005 && opticRaycastErr < 0.005
      };
    })()`);

    if (!res.aligned) throw new Error(`VECTOR-9 ADS misaligned: ${JSON.stringify(res)}`);
    return res;
  });

  await step(11, 'ads_alignment_m870', async () => {
    const res = await b.evaluate(`(async () => {
      const w = window.__bp.WEAPONS.m870;
      const ironAdsPos = w.adsPos;
      const ironSightY = 0.072;
      const ironRaycastErr = Math.abs(ironAdsPos.y + ironSightY);

      const opticAnchors = { adsYOffset: -0.01425, adsYOffsetRedDot: -0.01425 };
      const opticSightY = 0.08625;
      const opticRaycastErr = Math.abs(ironAdsPos.y + opticAnchors.adsYOffsetRedDot + opticSightY);

      return {
        weapon: 'm870',
        ironAdsPos: { x: ironAdsPos.x, y: ironAdsPos.y, z: ironAdsPos.z },
        ironRaycastErr,
        opticRaycastErr,
        aligned: ironRaycastErr < 0.005 && opticRaycastErr < 0.005
      };
    })()`);

    if (!res.aligned) throw new Error(`M870 ADS misaligned: ${JSON.stringify(res)}`);
    return res;
  });

  await step(12, 'ads_alignment_p12', async () => {
    const res = await b.evaluate(`(async () => {
      const w = window.__bp.WEAPONS.p12;
      const ironAdsPos = w.adsPos;
      const ironSightY = 0.058;
      const ironRaycastErr = Math.abs(ironAdsPos.y + ironSightY);

      const opticAnchors = { adsYOffset: -0.0065, adsYOffsetRedDot: -0.0065 };
      const opticSightY = 0.0645;
      const opticRaycastErr = Math.abs(ironAdsPos.y + opticAnchors.adsYOffsetRedDot + opticSightY);

      return {
        weapon: 'p12',
        ironAdsPos: { x: ironAdsPos.x, y: ironAdsPos.y, z: ironAdsPos.z },
        ironRaycastErr,
        opticRaycastErr,
        aligned: ironRaycastErr < 0.005 && opticRaycastErr < 0.005
      };
    })()`);

    if (!res.aligned) throw new Error(`P-12 ADS misaligned: ${JSON.stringify(res)}`);
    return res;
  });

  await step(13, 'crosshair_dynamic_fade_in_ads', async () => {
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(400);

    const res = await b.evaluate(`(async () => {
      window.__bp.switchTab('play');
      document.getElementById('deploy-btn').click();
      await new Promise(r => setTimeout(r, 600));

      const crossEl = document.getElementById('crosshair');
      const hipOpacity = window.getComputedStyle(crossEl).opacity;

      window.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
      await new Promise(r => setTimeout(r, 450));

      const adsState = window.__bp.getAdsState();
      const adsOpacity = window.getComputedStyle(crossEl).opacity;

      window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));
      await new Promise(r => setTimeout(r, 450));

      const backOpacity = window.getComputedStyle(crossEl).opacity;

      return {
        hipOpacity: parseFloat(hipOpacity),
        adsAmount: adsState.adsAmount,
        adsOpacity: parseFloat(adsOpacity),
        backOpacity: parseFloat(backOpacity),
        fadedOut: parseFloat(adsOpacity) < 0.05,
        restored: parseFloat(backOpacity) > 0.85
      };
    })()`);

    if (!res.fadedOut || !res.restored) {
      throw new Error(`Crosshair fade transition failed: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(14, 'combat_with_empty_secondary_slot', async () => {
    const res = await b.evaluate(`(async () => {
      window.__bp.backToMenu();
      const p = window.__bp.progression;
      const cur = p.getActiveLoadout();
      p.setLoadoutSecondary(cur.id, null);
      window.__bp.switchTab('play');
      document.getElementById('deploy-btn').click();
      await new Promise(r => setTimeout(r, 600));

      const secSlot = window.__bp.combatSession.slots.secondary;
      const switchResult = window.__bp.switchWeaponSlot('secondary');
      const activeSlotAfter = window.__bp.combatSession.activeSlot;

      return {
        secSlotExists: !!secSlot,
        secSlotId: secSlot?.id,
        switchPrevented: switchResult === false && activeSlotAfter === 'primary'
      };
    })()`);

    if (!res.switchPrevented) {
      throw new Error(`Empty secondary slot did not prevent invalid switch: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step(15, 'webgl_stability_and_zero_errors', async () => {
    const res = await b.evaluate(`(() => {
      const gl = document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl');
      const err = gl ? gl.getError() : -1;
      const sharedIntact = window.__bp.areSharedAttachmentGeometriesIntact();
      return {
        webglError: err,
        sharedIntact
      };
    })()`);

    if (res.webglError !== 0 && res.webglError !== -1) {
      throw new Error(`WebGL error code ${res.webglError}`);
    }
    if (!res.sharedIntact) {
      throw new Error('Shared attachment geometries were mutated or disposed');
    }
    return res;
  });

  await b.evaluate(`(() => {
    window.__bp.backToMenu();
    window.__bp.switchTab('loadout');
    const btnCopy = document.getElementById('btn-copy-loadout');
    if (btnCopy) btnCopy.click();
  })()`);
  await b.sleep(600);
  await capturePng('docs/assets/screenshots/sprint8_1/01_loadout_management_and_copy_modal.png', 1280, 720);

  await b.evaluate(`(() => {
    const btnCancelCopy = document.getElementById('btn-copy-cancel');
    if (btnCancelCopy) btnCancelCopy.click();
    const btnReset = document.getElementById('btn-reset-loadout');
    if (btnReset) btnReset.click();
  })()`);
  await b.sleep(400);
  await capturePng('docs/assets/screenshots/sprint8_1/02_loadout_reset_confirmation.png', 1280, 720);

  await b.evaluate(`(() => {
    const btnCancelReset = document.getElementById('btn-reset-cancel');
    if (btnCancelReset) btnCancelReset.click();
    const p = window.__bp.progression;
    const l = p.getLoadouts();
    p.setLoadoutSecondary(l[0].id, null);
    window.__bp.setEditingLoadoutId(l[0].id);
  })()`);
  await b.sleep(400);
  await capturePng('docs/assets/screenshots/sprint8_1/03_secondary_unequipped.png', 1280, 720);

  await capturePng('docs/assets/screenshots/sprint8_1/04_compact_3d_viewer_768px.png', 768, 1024);

  await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await b.sleep(400);

  await b.evaluate(`(() => {
    window.__bp.switchTab('play');
    document.getElementById('deploy-btn').click();
  })()`);
  await b.sleep(600);

  await b.evaluate(`(() => {
    window.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
  })()`);
  await b.sleep(500);
  await capturePng('docs/assets/screenshots/sprint8_1/05_ads_iron_sight_aligned.png', 1280, 720);
  await b.evaluate(`(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));
  })()`);
  await b.sleep(400);

} finally {
  await b.close();
  await srv.close();
}

const passed = results.filter(r => r.ok).length;
const total = results.length;
console.log(`\nSprint 8.1 Results: ${passed}/${total} PASS`);
if (passed !== total) {
  process.exit(1);
}
