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

async function selectCategoryAndCard(catId, weaponId) {
  await b.evaluate(`(() => {
    const catBtn = document.querySelector('.armory-cat-btn[data-cat="${catId}"]');
    if (catBtn) catBtn.click();
  })()`);
  await b.sleep(100);
  await b.evaluate(`(() => {
    const card = document.querySelector('.weapon-card[data-id="${weaponId}"]');
    if (card) card.click();
  })()`);
  await b.sleep(160);
}

try {
  await b.navigate(url);
  await b.sleep(3200);

  await b.evaluate(`window.__bp.progression.reset()`);
  await b.sleep(250);

  await step(1, 'loadout_hides_operator_shows_showcase', async () => {
    const before = await b.evaluate(`window.__bp.getShowcaseState()`);
    await b.click('button[data-tab="loadout"]');
    await b.sleep(500);
    const inLoadout = await b.evaluate(`window.__bp.getShowcaseState()`);
    await b.click('button[data-tab="operator"]');
    await b.sleep(500);
    const backToOp = await b.evaluate(`window.__bp.getShowcaseState()`);

    if (!before.operatorVisible || before.showcaseVisible) {
      throw new Error(`Expected operator visible and showcase hidden on play tab, got ${JSON.stringify(before)}`);
    }
    if (inLoadout.operatorVisible || !inLoadout.showcaseVisible || !inLoadout.lightsVisible) {
      throw new Error(`Expected operator hidden and showcase+lights visible in armory, got ${JSON.stringify(inLoadout)}`);
    }
    if (!backToOp.operatorVisible || backToOp.showcaseVisible || backToOp.lightsVisible) {
      throw new Error(`Expected operator restored and showcase hidden on operator tab, got ${JSON.stringify(backToOp)}`);
    }
    return { beforeOp: before.operatorVisible, loadoutOp: inLoadout.operatorVisible, restoredOp: backToOp.operatorVisible };
  });

  await step(2, 'inspection_never_modifies_equipped_loadouts', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.reset();
      window.__bp.progression.grantPlayerXP(12000);
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_2', 'vector9');
      window.__bp.switchTab('loadout');
    })()`);
    await b.sleep(300);

    const targets = [
      ['ASSAULT', 'ak12'],
      ['SMG', 'vector9'],
      ['SMG', 'mp5k'],
      ['SHOTGUN', 'm870'],
      ['LMG', 'mk48'],
      ['SNIPER', 'awm338'],
      ['PISTOL', 'p12'],
      ['MELEE', 'knife']
    ];
    for (const [cat, id] of targets) {
      await selectCategoryAndCard(cat, id);
    }

    const check = await b.evaluate(`(() => {
      const active = window.__bp.progression.getActiveLoadout();
      const l2 = window.__bp.progression.getLoadouts().find(l => l.id === 'loadout_2');
      const sc = window.__bp.getShowcaseState();
      return {
        activeId: active.id,
        activePrim: active.primary,
        activeSec: active.secondary,
        l2Prim: l2.primary,
        lobbyWpn: window.__bp.getLobbyWeaponId(),
        combatWpn: window.__bp.weapon.id,
        inspected: sc.weaponId
      };
    })()`);

    if (check.activeId !== 'loadout_1' || check.activePrim !== 'mk7' || check.activeSec !== 'p12') {
      throw new Error(`Inspection mutated active loadout: ${JSON.stringify(check)}`);
    }
    if (check.l2Prim !== 'vector9' || check.lobbyWpn !== 'mk7' || check.combatWpn !== 'mk7') {
      throw new Error(`Inspection mutated secondary/operator/combat weapon: ${JSON.stringify(check)}`);
    }
    if (check.inspected !== 'knife') {
      throw new Error(`Expected last inspected knife, got ${check.inspected}`);
    }
    return check;
  });

  await step(3, 'immediate_update_for_locked_and_planned_weapons', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.reset();
      window.__bp.switchTab('loadout');
    })()`);
    await b.sleep(300);

    await selectCategoryAndCard('SHOTGUN', 'm870');
    const lockedRes = await b.evaluate(`(() => ({
      sc: window.__bp.getShowcaseState(),
      pill: document.getElementById('showcase-state-pill').textContent,
      btnDisabled: document.getElementById('btn-equip-weapon').disabled,
      btnText: document.getElementById('btn-equip-weapon').textContent
    }))()`);

    await selectCategoryAndCard('SNIPER', 'awm338');
    const plannedRes = await b.evaluate(`(() => ({
      sc: window.__bp.getShowcaseState(),
      pill: document.getElementById('showcase-state-pill').textContent,
      note: document.getElementById('showcase-note').textContent,
      btnDisabled: document.getElementById('btn-equip-weapon').disabled,
      btnText: document.getElementById('btn-equip-weapon').textContent
    }))()`);

    if (lockedRes.sc.weaponId !== 'm870' || lockedRes.sc.status !== 'LOCKED' || !lockedRes.btnDisabled || lockedRes.btnText !== 'BLOQUEADA') {
      throw new Error(`Locked weapon showcase mismatch: ${JSON.stringify(lockedRes)}`);
    }
    if (plannedRes.sc.weaponId !== 'awm338' || plannedRes.sc.status !== 'LOCKED' || !plannedRes.btnDisabled || plannedRes.btnText !== 'BLOQUEADA') {
      throw new Error(`Planned weapon showcase mismatch: ${JSON.stringify(plannedRes)}`);
    }
    return { locked: lockedRes.sc.weaponId, planned: plannedRes.sc.weaponId };
  });

  await step(4, 'all_9_catalog_weapons_distinct_scaled_models', async () => {
    const catalogIds = [
      ['ASSAULT', 'mk7'],
      ['ASSAULT', 'ak12'],
      ['SMG', 'vector9'],
      ['SMG', 'mp5k'],
      ['SHOTGUN', 'm870'],
      ['LMG', 'mk48'],
      ['SNIPER', 'awm338'],
      ['PISTOL', 'p12'],
      ['MELEE', 'knife']
    ];
    const metrics = [];
    for (const [cat, id] of catalogIds) {
      await selectCategoryAndCard(cat, id);
      const m = await b.evaluate(`(() => {
        const s = window.__bp.getShowcaseState();
        return { id: s.weaponId, scale: Number(s.scale.toFixed(3)), halfW: Number(s.halfW.toFixed(3)), halfH: Number(s.halfH.toFixed(3)) };
      })()`);
      if (m.id !== id || !(m.halfW > 0.2) || !(m.halfH > 0.05)) {
        throw new Error(`Invalid geometry for ${id}: ${JSON.stringify(m)}`);
      }
      metrics.push(m);
    }
    const mk7Aspect = metrics.find(m => m.id === 'mk7').halfH / metrics.find(m => m.id === 'mk7').halfW;
    const ak12Aspect = metrics.find(m => m.id === 'ak12').halfH / metrics.find(m => m.id === 'ak12').halfW;
    const knifeAspect = metrics.find(m => m.id === 'knife').halfH / metrics.find(m => m.id === 'knife').halfW;
    if (Math.abs(mk7Aspect - ak12Aspect) < 0.005 && metrics.find(m => m.id === 'mk7').scale === metrics.find(m => m.id === 'ak12').scale) {
      throw new Error(`ak12 seems identical to mk7 fallback: ${JSON.stringify(metrics)}`);
    }
    if (knifeAspect <= 0) throw new Error(`Invalid knife aspect`);
    return metrics;
  });

  await step(5, 'responsive_centering_no_clipping_1920_1280_1024', async () => {
    const resolutions = [
      [1920, 1080],
      [1280, 720],
      [1024, 768]
    ];
    const allWeapons = [
      ['ASSAULT', 'mk7'],
      ['ASSAULT', 'ak12'],
      ['SMG', 'vector9'],
      ['SMG', 'mp5k'],
      ['SHOTGUN', 'm870'],
      ['LMG', 'mk48'],
      ['SNIPER', 'awm338'],
      ['PISTOL', 'p12'],
      ['MELEE', 'knife']
    ];
    const verifyBounds = async (w, h, label) => {
      const check = await b.evaluate(`(() => {
        const bnd = window.__bp.getShowcaseScreenBounds();
        const panel = document.querySelector('.loadout-panel').getBoundingClientRect();
        const header = document.getElementById('lobby-header').getBoundingClientRect();
        return {
          vw: window.innerWidth,
          vh: window.innerHeight,
          panelRight: panel.right,
          headerBottom: header.bottom,
          bnd
        };
      })()`);
      if (!check.bnd) throw new Error(`Missing bounds for ${label} at ${w}x${h}`);
      if (check.bnd.minX < check.panelRight - 2) {
        throw new Error(`Weapon ${label} overlapped left panel at ${w}x${h}: minX=${check.bnd.minX.toFixed(1)}, panelRight=${check.panelRight.toFixed(1)}`);
      }
      if (check.bnd.maxX > check.vw - 4) {
        throw new Error(`Weapon ${label} clipped right edge at ${w}x${h}: maxX=${check.bnd.maxX.toFixed(1)}`);
      }
      if (check.bnd.minY < check.headerBottom + 2) {
        throw new Error(`Weapon ${label} clipped header at ${w}x${h}: minY=${check.bnd.minY.toFixed(1)}, header=${check.headerBottom}`);
      }
      if (check.bnd.maxY > check.vh - 4) {
        throw new Error(`Weapon ${label} clipped bottom edge at ${w}x${h}: maxY=${check.bnd.maxY.toFixed(1)}`);
      }
      return check.bnd;
    };

    const report = [];
    await selectCategoryAndCard('ASSAULT', 'mk7');
    await b.sleep(350);
    for (const [w, h] of resolutions) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
      await b.sleep(350);
      const bnd = await verifyBounds(w, h, 'mk7_same_weapon_resize');
      report.push({ res: `${w}x${h}`, id: 'mk7_resize', minX: Math.round(bnd.minX), maxX: Math.round(bnd.maxX), width: Math.round(bnd.width) });
    }

    for (const [w, h] of resolutions) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
      await b.sleep(350);

      for (const [cat, id] of allWeapons) {
        await selectCategoryAndCard(cat, id);
        await b.sleep(380);
        const bnd = await verifyBounds(w, h, id);
        report.push({ res: `${w}x${h}`, id, minX: Math.round(bnd.minX), maxX: Math.round(bnd.maxX), minY: Math.round(bnd.minY), maxY: Math.round(bnd.maxY), width: Math.round(bnd.width), cx: Math.round(bnd.cx) });
      }
      if (w === 1280) {
        const wMk7 = report.find(r => r.res === '1280x720' && r.id === 'mk7');
        const wP12 = report.find(r => r.res === '1280x720' && r.id === 'p12');
        if (!wMk7 || !wP12 || wP12.width >= wMk7.width) {
          throw new Error(`Expected P-12 to render narrower than MK-7 at 1280x720: mk7=${JSON.stringify(wMk7)}, p12=${JSON.stringify(wP12)}`);
        }
      }
    }
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(300);
    return report;
  });

  await step(6, 'drag_rotation_clamped_zoom_and_recenter', async () => {
    await selectCategoryAndCard('ASSAULT', 'mk7');
    await b.sleep(400);
    const initial = await b.evaluate(`window.__bp.getShowcaseState()`);

    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 880, y: 360 });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 880, y: 360, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 240 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1060, y: 120 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1060, y: 120, button: 'left', clickCount: 1 });
    await b.sleep(250);

    const afterDrag = await b.evaluate(`window.__bp.getShowcaseState()`);
    if (Math.abs(afterDrag.targetYaw - initial.targetYaw) < 0.3) {
      throw new Error(`Expected yaw rotation after drag, ${initial.targetYaw} -> ${afterDrag.targetYaw}`);
    }
    if (afterDrag.targetPitch > 0.55 || afterDrag.targetPitch < -0.55) {
      throw new Error(`Pitch exceeded clamp bounds: ${afterDrag.targetPitch}`);
    }

    for (let i = 0; i < 15; i++) {
      await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 880, y: 360, deltaX: 0, deltaY: -300 });
    }
    await b.sleep(250);
    const zoomedIn = await b.evaluate(`window.__bp.getShowcaseState()`);
    if (zoomedIn.targetZoom < zoomedIn.minZoom - 0.001 || zoomedIn.targetZoom >= initial.baseZoom) {
      throw new Error(`Zoom in failed or missed min clamp: ${JSON.stringify({ z: zoomedIn.targetZoom, min: zoomedIn.minZoom, base: initial.baseZoom })}`);
    }

    for (let i = 0; i < 30; i++) {
      await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 880, y: 360, deltaX: 0, deltaY: 300 });
    }
    await b.sleep(250);
    const zoomedOut = await b.evaluate(`window.__bp.getShowcaseState()`);
    if (zoomedOut.targetZoom > zoomedOut.maxZoom + 0.001 || zoomedOut.targetZoom <= initial.baseZoom) {
      throw new Error(`Zoom out failed or missed max clamp: ${JSON.stringify({ z: zoomedOut.targetZoom, max: zoomedOut.maxZoom, base: initial.baseZoom })}`);
    }

    await b.click('#btn-showcase-reset');
    await b.sleep(350);
    const resetRes = await b.evaluate(`window.__bp.getShowcaseState()`);
    if (Math.abs(resetRes.targetYaw - initial.targetYaw) > 0.01 || Math.abs(resetRes.targetZoom - resetRes.baseZoom) > 0.02) {
      throw new Error(`Recenter button failed to reset: ${JSON.stringify(resetRes)}`);
    }
    return { dragYawDelta: Number((afterDrag.targetYaw - initial.targetYaw).toFixed(2)), minZ: zoomedIn.targetZoom, maxZ: zoomedOut.targetZoom };
  });

  await step(7, 'event_isolation_panel_scroll_and_combat', async () => {
    await b.click('#btn-showcase-reset');
    await b.sleep(300);
    const beforePanelScroll = await b.evaluate(`(() => ({
      zoom: window.__bp.getShowcaseState().targetZoom,
      yaw: window.__bp.getShowcaseState().targetYaw
    }))()`);

    await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 200, y: 360, deltaX: 0, deltaY: 240 });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 360, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 320, y: 360 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 320, y: 360, button: 'left', clickCount: 1 });
    await b.sleep(200);

    const afterPanelInput = await b.evaluate(`(() => ({
      zoom: window.__bp.getShowcaseState().targetZoom,
      yaw: window.__bp.getShowcaseState().targetYaw
    }))()`);
    if (afterPanelInput.zoom !== beforePanelScroll.zoom || afterPanelInput.yaw !== beforePanelScroll.yaw) {
      throw new Error(`Panel wheel/drag leaked into showcase: before=${JSON.stringify(beforePanelScroll)} after=${JSON.stringify(afterPanelInput)}`);
    }

    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(1000);
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.startGame('waves');
    })()`);
    await b.sleep(200);
    await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 360, deltaX: 0, deltaY: 120 });
    await b.sleep(200);
    const combatCheck = await b.evaluate(`(() => ({
      slot: window.__bp.combatSession.activeSlot,
      switching: window.__bp.combatSession.switching
    }))()`);
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(250);
    if (!combatCheck.switching && combatCheck.slot !== 'secondary') {
      throw new Error(`Combat wheel swap should still function in PLAYING phase: ${JSON.stringify(combatCheck)}`);
    }
    return { panelIsolated: true, combatWheelWorks: true };
  });

  await step(8, 'operator_full_body_framing_in_play_and_operator', async () => {
    const viewports = [
      [1280, 720],
      [1024, 768]
    ];
    const framingReport = [];
    for (const [w, h] of viewports) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
      for (const tab of ['operator', 'play']) {
        await b.click(`button[data-tab="${tab}"]`);
        await b.sleep(900);
        const f = await b.evaluate(`(() => {
          const bnd = window.__bp.getOperatorScreenBounds();
          const hdr = document.getElementById('lobby-header').getBoundingClientRect();
          const panelSel = '${tab}' === 'operator' ? '#tab-operator .dossier-panel' : '#mission-intel';
          const pnl = document.querySelector(panelSel).getBoundingClientRect();
          return { vw: window.innerWidth, vh: window.innerHeight, hdrBottom: hdr.bottom, panelRight: pnl.right, bnd };
        })()`);
        if (!f.bnd) throw new Error(`Missing operator bounds on ${tab} ${w}x${h}`);
        if (f.bnd.minY < f.hdrBottom - 2) {
          throw new Error(`Operator helmet clipped under header on ${tab} ${w}x${h}: minY=${f.bnd.minY.toFixed(1)}, hdr=${f.hdrBottom}`);
        }
        if (f.bnd.maxY > f.vh + 2) {
          throw new Error(`Operator boots clipped at bottom on ${tab} ${w}x${h}: maxY=${f.bnd.maxY.toFixed(1)}, vh=${f.vh}`);
        }
        if (f.bnd.minX < f.panelRight - 24) {
          throw new Error(`Operator overlapped left panel on ${tab} ${w}x${h}: minX=${f.bnd.minX.toFixed(1)}, panelRight=${f.panelRight.toFixed(1)}`);
        }
        framingReport.push({ res: `${w}x${h}`, tab, minY: Math.round(f.bnd.minY), maxY: Math.round(f.bnd.maxY), minX: Math.round(f.bnd.minX) });
      }
    }
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(250);
    return framingReport;
  });

  await step(9, 'differentiate_inspected_edited_and_active_deploy_states', async () => {
    await b.evaluate(`(() => {
      window.__bp.progression.grantPlayerXP(12000);
      window.__bp.progression.setLoadoutPrimary('loadout_1', 'mk7');
      window.__bp.progression.setLoadoutSecondary('loadout_1', 'p12');
      window.__bp.progression.selectLoadout('loadout_1');
      window.__bp.progression.setLoadoutPrimary('loadout_2', 'vector9');
      window.__bp.switchTab('loadout');
    })()`);
    await b.sleep(300);

    await b.evaluate(`document.querySelector('.loadout-tab-btn[data-id="loadout_2"]').click()`);
    await b.sleep(200);
    await selectCategoryAndCard('SHOTGUN', 'm870');

    const ui = await b.evaluate(`(() => ({
      title: document.getElementById('showcase-title').textContent,
      statePill: document.getElementById('showcase-state-pill').textContent,
      editName: document.getElementById('ctx-editing-name').textContent,
      editWeapons: document.getElementById('ctx-editing-weapons').textContent,
      deployName: document.getElementById('ctx-deploy-name').textContent,
      deployWeapons: document.getElementById('ctx-deploy-weapons').textContent,
      diffHint: document.getElementById('showcase-diff-hint').textContent
    }))()`);

    if (ui.title !== 'M870 BREACHER' || ui.statePill !== 'DESBLOQUEADA') {
      throw new Error(`Inspected weapon HUD wrong: ${JSON.stringify(ui)}`);
    }
    if (ui.editName !== 'ASALTO 2' || !ui.editWeapons.includes('VECTOR-9')) {
      throw new Error(`Edited loadout context wrong: ${JSON.stringify(ui)}`);
    }
    if (ui.deployName !== 'ASALTO 1' || !ui.deployWeapons.includes('MK-7')) {
      throw new Error(`Active deploy context wrong: ${JSON.stringify(ui)}`);
    }
    if (!ui.diffHint.includes('ASALTO 2') || !ui.diffHint.includes('ASALTO 1')) {
      throw new Error(`Mismatch diff hint missing class names: ${JSON.stringify(ui)}`);
    }
    return ui;
  });

  await step(10, 'showcase_memory_stability_and_zero_errors', async () => {
    await b.click('button[data-tab="loadout"]');
    await b.sleep(300);
    await selectCategoryAndCard('ASSAULT', 'mk7');
    await b.sleep(200);
    const snapStart = await b.evaluate(`window.__bp.snapshot()`);

    const cycle = [
      ['ASSAULT', 'ak12'],
      ['SMG', 'vector9'],
      ['SMG', 'mp5k'],
      ['SHOTGUN', 'm870'],
      ['LMG', 'mk48'],
      ['SNIPER', 'awm338'],
      ['PISTOL', 'p12'],
      ['MELEE', 'knife'],
      ['ASSAULT', 'mk7']
    ];
    for (let r = 0; r < 3; r++) {
      for (const [cat, id] of cycle) {
        await selectCategoryAndCard(cat, id);
      }
    }
    await b.sleep(250);
    const snapMid = await b.evaluate(`window.__bp.snapshot()`);

    for (let i = 0; i < 4; i++) {
      await b.click('button[data-tab="operator"]');
      await b.sleep(150);
      await b.click('button[data-tab="loadout"]');
      await b.sleep(150);
    }
    await selectCategoryAndCard('ASSAULT', 'mk7');
    await b.sleep(200);
    const snapEnd = await b.evaluate(`window.__bp.snapshot()`);

    if (snapMid.geometries > snapStart.geometries || snapEnd.geometries > snapStart.geometries) {
      throw new Error(`Geometries leaked during showcase switches: ${snapStart.geometries} -> ${snapMid.geometries} -> ${snapEnd.geometries}`);
    }
    if (snapMid.textures > snapStart.textures || snapEnd.textures > snapStart.textures) {
      throw new Error(`Textures leaked during showcase switches: ${snapStart.textures} -> ${snapMid.textures} -> ${snapEnd.textures}`);
    }
    const jsErrs = b.logs.filter(l => l.t === 'exception' || l.t === 'console.error');
    if (jsErrs.length > 0) {
      throw new Error(`Console/JS errors recorded: ${JSON.stringify(jsErrs)}`);
    }
    return {
      geometries: `${snapStart.geometries}->${snapMid.geometries}->${snapEnd.geometries}`,
      textures: `${snapStart.textures}->${snapEnd.textures}`,
      errors: jsErrs.length
    };
  });

  await step(11, 'category_nav_arrows_scroll_and_boundary_disable', async () => {
    await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const assaultBtn = document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]');
      if (assaultBtn) assaultBtn.click();
      const nav = document.getElementById('armory-cat-nav');
      if (nav) nav.scrollLeft = 0;
    })()`);
    await b.sleep(300);

    const init = await b.evaluate(`(() => {
      const prev = document.getElementById('armory-cat-prev');
      const next = document.getElementById('armory-cat-next');
      const nav = document.getElementById('armory-cat-nav');
      const active = document.querySelector('.armory-cat-btn.active');
      return {
        prevDisabled: prev.disabled,
        nextDisabled: next.disabled,
        scrollLeft: nav.scrollLeft,
        maxScroll: nav.scrollWidth - nav.clientWidth,
        activeCat: active?.dataset.cat,
        inspected: window.__bp.getShowcaseState().weaponId
      };
    })()`);
    if (init.maxScroll <= 10 || !init.prevDisabled || init.nextDisabled) {
      throw new Error(`Expected initial overflow with prev disabled and next enabled: ${JSON.stringify(init)}`);
    }

    await b.click('#armory-cat-next');
    await b.sleep(450);

    const mid = await b.evaluate(`(() => {
      const prev = document.getElementById('armory-cat-prev');
      const next = document.getElementById('armory-cat-next');
      const nav = document.getElementById('armory-cat-nav');
      const active = document.querySelector('.armory-cat-btn.active');
      return {
        prevDisabled: prev.disabled,
        nextDisabled: next.disabled,
        scrollLeft: nav.scrollLeft,
        activeCat: active?.dataset.cat,
        inspected: window.__bp.getShowcaseState().weaponId
      };
    })()`);
    if (mid.scrollLeft <= 0 || mid.prevDisabled) {
      throw new Error(`Expected right arrow click to scroll right and enable prev arrow: ${JSON.stringify(mid)}`);
    }
    if (mid.activeCat !== init.activeCat || mid.inspected !== init.inspected) {
      throw new Error(`Scrolling category bar mutated selection: ${JSON.stringify({ init, mid })}`);
    }

    for (let i = 0; i < 6; i++) {
      const isEnd = await b.evaluate(`document.getElementById('armory-cat-next').disabled`);
      if (isEnd) break;
      await b.click('#armory-cat-next');
      await b.sleep(420);
    }

    const endRight = await b.evaluate(`(() => {
      const prev = document.getElementById('armory-cat-prev');
      const next = document.getElementById('armory-cat-next');
      const nav = document.getElementById('armory-cat-nav');
      return {
        prevDisabled: prev.disabled,
        nextDisabled: next.disabled,
        scrollLeft: nav.scrollLeft,
        maxScroll: nav.scrollWidth - nav.clientWidth,
        activeCat: document.querySelector('.armory-cat-btn.active')?.dataset.cat
      };
    })()`);
    if (!endRight.nextDisabled || endRight.prevDisabled || endRight.activeCat !== 'ASSAULT') {
      throw new Error(`Expected right extreme disabled next arrow without changing selection: ${JSON.stringify(endRight)}`);
    }

    for (let i = 0; i < 6; i++) {
      const isStart = await b.evaluate(`document.getElementById('armory-cat-prev').disabled`);
      if (isStart) break;
      await b.click('#armory-cat-prev');
      await b.sleep(420);
    }

    const backStart = await b.evaluate(`(() => ({
      prevDisabled: document.getElementById('armory-cat-prev').disabled,
      nextDisabled: document.getElementById('armory-cat-next').disabled,
      scrollLeft: document.getElementById('armory-cat-nav').scrollLeft
    }))()`);
    if (!backStart.prevDisabled || backStart.nextDisabled) {
      throw new Error(`Expected return to left extreme to disable prev and enable next: ${JSON.stringify(backStart)}`);
    }
    return { init, mid, endRight, backStart };
  });

  await step(12, 'category_nav_wheel_trackpad_touch_and_zoom_isolation', async () => {
    await b.evaluate(`(() => {
      window.__bp.switchTab('loadout');
      const assaultBtn = document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]');
      if (assaultBtn) assaultBtn.click();
      const nav = document.getElementById('armory-cat-nav');
      if (nav) nav.scrollLeft = 0;
    })()`);
    await b.sleep(300);

    const before = await b.evaluate(`(() => {
      const nav = document.getElementById('armory-cat-nav');
      const panel = document.querySelector('.loadout-panel');
      const r = nav.getBoundingClientRect();
      return {
        cx: r.left + r.width * 0.5,
        cy: r.top + r.height * 0.5,
        scrollLeft: nav.scrollLeft,
        panelScrollTop: panel.scrollTop,
        zoom: window.__bp.getShowcaseState().targetZoom
      };
    })()`);

    await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.cx, y: before.cy, deltaX: 0, deltaY: 160 });
    await b.sleep(150);
    const afterWheel = await b.evaluate(`(() => ({
      scrollLeft: document.getElementById('armory-cat-nav').scrollLeft,
      panelScrollTop: document.querySelector('.loadout-panel').scrollTop,
      zoom: window.__bp.getShowcaseState().targetZoom,
      activeCat: document.querySelector('.armory-cat-btn.active')?.dataset.cat
    }))()`);
    if (afterWheel.scrollLeft <= before.scrollLeft) {
      throw new Error(`Vertical mouse wheel over categories failed to scroll horizontally: ${JSON.stringify(afterWheel)}`);
    }
    if (afterWheel.zoom !== before.zoom) {
      throw new Error(`Category wheel leaked into 3D showcase zoom: before=${before.zoom}, after=${afterWheel.zoom}`);
    }
    if (afterWheel.panelScrollTop !== before.panelScrollTop || afterWheel.activeCat !== 'ASSAULT') {
      throw new Error(`Category wheel leaked into panel scroll or changed category: ${JSON.stringify(afterWheel)}`);
    }

    await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.cx, y: before.cy, deltaX: 120, deltaY: 0 });
    await b.sleep(150);
    const afterTrackpad = await b.evaluate(`(() => ({
      scrollLeft: document.getElementById('armory-cat-nav').scrollLeft,
      zoom: window.__bp.getShowcaseState().targetZoom
    }))()`);
    if (afterTrackpad.scrollLeft <= afterWheel.scrollLeft || afterTrackpad.zoom !== before.zoom) {
      throw new Error(`Trackpad horizontal delta failed or affected zoom: ${JSON.stringify({ afterWheel, afterTrackpad })}`);
    }

    await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.cx, y: before.cy, deltaX: 0, deltaY: -400 });
    await b.sleep(150);

    await b.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(before.cx + 80), y: Math.round(before.cy), id: 1 }]
    });
    await b.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(before.cx - 40), y: Math.round(before.cy), id: 1 }]
    });
    await b.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await b.sleep(250);

    const afterTouch = await b.evaluate(`(() => ({
      scrollLeft: document.getElementById('armory-cat-nav').scrollLeft,
      touchAction: getComputedStyle(document.getElementById('armory-cat-nav')).touchAction,
      zoom: window.__bp.getShowcaseState().targetZoom
    }))()`);
    if (afterTouch.touchAction !== 'pan-x') {
      throw new Error(`Expected touch-action pan-x for horizontal gestures, got ${afterTouch.touchAction}`);
    }
    if (afterTouch.zoom !== before.zoom) {
      throw new Error(`Touch swipe altered 3D zoom: ${before.zoom} -> ${afterTouch.zoom}`);
    }
    return { afterWheel, afterTrackpad, afterTouch };
  });

  await step(13, 'category_auto_reveal_no_vertical_scroll_and_active_indicator', async () => {
    await b.evaluate(`(() => {
      const panel = document.querySelector('.loadout-panel');
      if (panel) panel.scrollTop = 18;
      const assaultBtn = document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]');
      if (assaultBtn) assaultBtn.click();
    })()`);
    await b.sleep(400);

    const beforeScrollTop = await b.evaluate(`document.querySelector('.loadout-panel').scrollTop`);
    await b.evaluate(`document.querySelector('.armory-cat-btn[data-cat="MELEE"]').click()`);
    await b.sleep(450);

    const meleeVis = await b.evaluate(`(() => {
      const nav = document.getElementById('armory-cat-nav');
      const active = nav.querySelector('.armory-cat-btn.active');
      const panel = document.querySelector('.loadout-panel');
      const navR = nav.getBoundingClientRect();
      const btnR = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      return {
        cat: active.dataset.cat,
        panelScrollTop: panel.scrollTop,
        navLeft: navR.left,
        navRight: navR.right,
        btnLeft: btnR.left,
        btnRight: btnR.right,
        color: style.color,
        borderColor: style.borderTopColor,
        nextDisabled: document.getElementById('armory-cat-next').disabled
      };
    })()`);

    if (meleeVis.cat !== 'MELEE') {
      throw new Error(`Expected MELEE active, got ${meleeVis.cat}`);
    }
    if (meleeVis.btnLeft < meleeVis.navLeft - 1 || meleeVis.btnRight > meleeVis.navRight + 1) {
      throw new Error(`Selected MELEE category not scrolled into view: ${JSON.stringify(meleeVis)}`);
    }
    if (Math.abs(meleeVis.panelScrollTop - beforeScrollTop) > 1) {
      throw new Error(`Selecting category vertically scrolled panel: ${beforeScrollTop} -> ${meleeVis.panelScrollTop}`);
    }
    if (!meleeVis.color.includes('255, 106, 0') || !meleeVis.borderColor.includes('255, 106, 0')) {
      throw new Error(`Expected orange active indicator on category button: ${JSON.stringify(meleeVis)}`);
    }

    await b.click('#btn-slot-primary');
    await b.sleep(450);
    const primVis = await b.evaluate(`(() => {
      const nav = document.getElementById('armory-cat-nav');
      const active = nav.querySelector('.armory-cat-btn.active');
      const navR = nav.getBoundingClientRect();
      const btnR = active.getBoundingClientRect();
      return {
        cat: active.dataset.cat,
        panelScrollTop: document.querySelector('.loadout-panel').scrollTop,
        visible: btnR.left >= navR.left - 1 && btnR.right <= navR.right + 1
      };
    })()`);
    if (!primVis.visible || Math.abs(primVis.panelScrollTop - beforeScrollTop) > 1) {
      throw new Error(`Returning to primary slot category failed to auto-reveal cleanly: ${JSON.stringify(primVis)}`);
    }
    return { meleeVis, primVis };
  });

  await step(14, 'category_nav_responsive_1920_1280_1024_768', async () => {
    const viewports = [
      [1920, 1080],
      [1280, 720],
      [1024, 768],
      [768, 1024]
    ];
    const layoutReport = [];
    for (const [w, h] of viewports) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
      await b.sleep(300);
      await b.evaluate(`(() => {
        const nav = document.getElementById('armory-cat-nav');
        if (nav) nav.scrollLeft = 0;
        const assault = document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]');
        if (assault) assault.click();
      })()`);
      await b.sleep(300);

      const m = await b.evaluate(`(() => {
        const panel = document.querySelector('.loadout-panel').getBoundingClientRect();
        const bar = document.getElementById('armory-cat-bar').getBoundingClientRect();
        const prev = document.getElementById('armory-cat-prev').getBoundingClientRect();
        const nav = document.getElementById('armory-cat-nav').getBoundingClientRect();
        const next = document.getElementById('armory-cat-next').getBoundingClientRect();
        const active = document.querySelector('.armory-cat-btn.active').getBoundingClientRect();
        const navEl = document.getElementById('armory-cat-nav');
        return {
          res: '${w}x${h}',
          panelRight: panel.right,
          barRight: bar.right,
          prevW: prev.width,
          prevRight: prev.right,
          navLeft: nav.left,
          navRight: nav.right,
          nextLeft: next.left,
          nextW: next.width,
          activeVisible: active.left >= nav.left - 1 && active.right <= nav.right + 1,
          overflowPx: navEl.scrollWidth - navEl.clientWidth,
          prevDisabled: document.getElementById('armory-cat-prev').disabled,
          nextDisabled: document.getElementById('armory-cat-next').disabled
        };
      })()`);
      if (m.prevW < 20 || m.nextW < 20 || m.prevRight > m.navLeft + 1 || m.nextLeft < m.navRight - 1) {
        throw new Error(`Category arrows overlap or missing at ${m.res}: ${JSON.stringify(m)}`);
      }
      if (m.barRight > m.panelRight + 1) {
        throw new Error(`Category bar overflows loadout panel at ${m.res}: ${JSON.stringify(m)}`);
      }
      if (!m.activeVisible) {
        throw new Error(`Active category not visible at ${m.res}: ${JSON.stringify(m)}`);
      }
      if (m.overflowPx > 2 && !m.nextDisabled) {
        await b.click('#armory-cat-next');
        let moved = 0;
        for (let t = 0; t < 15; t++) {
          await b.sleep(100);
          moved = await b.evaluate(`document.getElementById('armory-cat-nav').scrollLeft`);
          if (moved > 0) break;
        }
        if (moved <= 0) {
          throw new Error(`Next arrow click did not scroll at ${m.res}`);
        }
      }
      layoutReport.push({ res: m.res, overflowPx: Math.round(m.overflowPx), prevDisabled: m.prevDisabled, nextDisabled: m.nextDisabled });
    }
    await b.send('Emulation.clearDeviceMetricsOverride');
    await b.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await b.sleep(250);
    const jsErrs = b.logs.filter(l => l.t === 'exception' || l.t === 'console.error');
    if (jsErrs.length > 0) {
      throw new Error(`Console/JS errors recorded: ${JSON.stringify(jsErrs)}`);
    }
    return layoutReport;
  });

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log('\n--- RESUMEN SPRINT 6.1 ---');
  console.log(`Total steps: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) {
    console.error('Failing steps:', JSON.stringify(results.filter(r => !r.ok), null, 2));
    process.exitCode = 1;
  }
} finally {
  await b.close();
  srv.close();
}
