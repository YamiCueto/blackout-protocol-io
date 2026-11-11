import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const b = await launch(`http://127.0.0.1:${port}/index.html?debug&nolock`);
const snap = async () => b.evaluate(`(()=>{const s=window.__bp.snapshot();return {phase:s.phase,mode:s.mode,calls:s.calls,geo:s.geometries,tris:s.triangles}})()`);
const results = [];

async function step(name, fn) {
  try {
    const r = await fn();
    const s = await snap();
    results.push({ step: name, ok: true, snap: s, detail: r });
    console.log(`PASS [${name}]`);
  } catch (e) {
    const s = await snap().catch(() => ({}));
    results.push({ step: name, ok: false, err: e.message, snap: s });
    console.log(`FAIL [${name}] ${e.message}`);
  }
}

try {
  await b.navigate(`http://127.0.0.1:${port}/index.html?debug&nolock`);
  await b.sleep(3000);

  await step('1_play_tab_layout', async () => {
    const title = await b.evaluate(`document.getElementById('selected-title').textContent`);
    const cardSelected = await b.evaluate(`document.getElementById('mode-waves').classList.contains('selected')`);
    const playVisible = await b.evaluate(`document.getElementById('tab-play').style.display !== 'none'`);
    if (title !== 'OLEADAS') throw new Error(`Expected title OLEADAS, got ${title}`);
    if (!cardSelected) throw new Error(`mode-waves should be selected by default`);
    if (!playVisible) throw new Error(`tab-play should be visible`);
  });

  await step('2_mode_selection_intel', async () => {
    await b.evaluate(`window.__bp.selectMode('snd')`);
    await b.sleep(200);
    const title = await b.evaluate(`document.getElementById('selected-title').textContent`);
    const sndSelected = await b.evaluate(`document.getElementById('mode-snd').classList.contains('selected')`);
    const wavesSelected = await b.evaluate(`document.getElementById('mode-waves').classList.contains('selected')`);
    if (title !== 'BUSCAR Y DESTRUIR') throw new Error(`Expected title BUSCAR Y DESTRUIR, got ${title}`);
    if (!sndSelected || wavesSelected) throw new Error(`mode-snd should be selected and mode-waves unselected`);
  });

  await step('3_tab_operator', async () => {
    await b.click('button[data-tab="operator"]');
    await b.sleep(400);
    const opVisible = await b.evaluate(`document.getElementById('tab-operator').style.display !== 'none'`);
    const playVisible = await b.evaluate(`document.getElementById('tab-play').style.display`);
    const tabActive = await b.evaluate(`document.querySelector('button[data-tab="operator"]').classList.contains('active')`);
    if (!opVisible) throw new Error(`tab-operator should be visible`);
    if (playVisible !== 'none') throw new Error(`tab-play should be hidden`);
    if (!tabActive) throw new Error(`operator tab button should have active class`);
  });

  await step('4_operator_camo', async () => {
    await b.click('button[data-camo="specops"]');
    await b.sleep(200);
    const activeCamo = await b.evaluate(`document.querySelector('button[data-camo="specops"]').classList.contains('active')`);
    if (!activeCamo) throw new Error(`specops camo should be active`);
  });

  await step('5_tab_loadout', async () => {
    await b.click('button[data-tab="loadout"]');
    await b.sleep(400);
    const loadoutVis = await b.evaluate(`document.getElementById('tab-loadout').style.display !== 'none'`);
    if (!loadoutVis) throw new Error(`tab-loadout should be visible`);
  });

  await step('6_return_to_play_tab', async () => {
    await b.click('button[data-tab="play"]');
    await b.sleep(400);
    const playVis = await b.evaluate(`document.getElementById('tab-play').style.display !== 'none'`);
    if (!playVis) throw new Error(`tab-play should be visible`);
  });

  await step('7_deploy_button', async () => {
    await b.click('#deploy-btn');
    await b.sleep(2000);
    const s = await snap();
    if (s.phase !== 'PLAYING') throw new Error(`Expected phase PLAYING, got ${s.phase}`);
  });

  await step('8_pause_box_isolation', async () => {
    await b.key('Escape', 'Escape');
    await b.sleep(500);
    const s = await snap();
    if (s.phase !== 'PAUSED') throw new Error(`Expected phase PAUSED, got ${s.phase}`);
    const pauseBoxVis = await b.evaluate(`getComputedStyle(document.getElementById('pause-box')).display`);
    const headerVis = await b.evaluate(`getComputedStyle(document.getElementById('lobby-header')).display`);
    if (pauseBoxVis === 'none') throw new Error(`pause-box should be visible`);
    if (headerVis !== 'none') throw new Error(`lobby-header should be hidden in pause`);
  });

  await step('9_quit_restores_lobby', async () => {
    await b.click('#quit-btn');
    await b.sleep(600);
    const s = await snap();
    if (s.phase !== 'MENU') throw new Error(`Expected phase MENU, got ${s.phase}`);
    const headerVis = await b.evaluate(`getComputedStyle(document.getElementById('lobby-header')).display`);
    const pauseBoxVis = await b.evaluate(`getComputedStyle(document.getElementById('pause-box')).display`);
    if (headerVis === 'none') throw new Error(`lobby-header should be visible`);
    if (pauseBoxVis !== 'none') throw new Error(`pause-box should be hidden`);
  });

  await step('10_responsive_viewports', async () => {
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 768, height: 1024, deviceScaleFactor: 1, mobile: false
    });
    await b.sleep(300);
    const playVisTab = await b.evaluate(`document.getElementById('tab-play').style.display !== 'none'`);
    if (!playVisTab) throw new Error(`tab-play not visible on tablet`);

    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 667, deviceScaleFactor: 1, mobile: true
    });
    await b.sleep(300);
    const brandTagVis = await b.evaluate(`getComputedStyle(document.querySelector('.brand-tag')).display`);
    if (brandTagVis !== 'none') throw new Error(`brand-tag should be hidden on mobile`);

    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
    });
    await b.sleep(300);
  });

} catch (e) {
  console.log('CRITICAL SUITE ERROR:', e.message);
} finally {
  await b.close();
  srv.close();
}

console.log('\n--- RESUMEN SPRINT 3 ---');
console.log(`Total steps: ${results.length}`);
console.log(`Passed: ${results.filter(r => r.ok).length}`);
console.log(`Failed: ${results.filter(r => !r.ok).length}`);

if (results.some(r => !r.ok)) {
  process.exit(1);
}
