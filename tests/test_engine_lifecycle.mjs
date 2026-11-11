import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const b = await launch(`http://127.0.0.1:${port}/index.html?debug&nolock`);
const snap = async () => b.evaluate(`(()=>{const s=window.__bp.snapshot();return {phase:s.phase,mode:s.mode,alive:s.enemiesAlive,total:s.enemiesTotal,geo:s.geometries,tex:s.textures,calls:s.calls,t:s.matchTime,tris:s.triangles}})()`);
const results = [];

async function step(name, fn) {
  try {
    const r = await fn();
    const s = await snap();
    results.push({ step: name, ok: true, snap: s, detail: r });
    console.log(`PASS [${name}] phase=${s.phase} alive=${s.alive}/${s.total} geo=${s.geo} calls=${s.calls} t=${s.t}`);
  } catch (e) {
    const s = await snap().catch(() => ({}));
    results.push({ step: name, ok: false, err: e.message, snap: s });
    console.log(`FAIL [${name}] ${e.message}`);
  }
}

try {
  await b.navigate(`http://127.0.0.1:${port}/index.html?debug&nolock`);
  await b.sleep(4000);

  await step('1_start_waves', async () => {
    await b.click('#mode-waves');
    await b.sleep(3000);
  });

  await step('2_pause_esc', async () => {
    await b.key('Escape', 'Escape');
    await b.sleep(500);
    const vis = await b.evaluate(`getComputedStyle(document.getElementById('menu')).display`);
    const qVis = await b.evaluate(`getComputedStyle(document.getElementById('quit-btn')).display`);
    const rVis = await b.evaluate(`getComputedStyle(document.getElementById('resume-btn')).display`);
    if (vis !== 'flex' || qVis === 'none' || rVis === 'none') throw new Error(`menu=${vis} quit=${qVis} resume=${rVis}`);
    return { menu: vis, quit: qVis, resume: rVis };
  });

  await step('3_resume', async () => {
    await b.click('#resume-btn');
    await b.sleep(600);
    const hudVis = await b.evaluate(`getComputedStyle(document.getElementById('hud')).display`);
    if (hudVis !== 'block') throw new Error(`hud=${hudVis}`);
  });

  await step('4_quit_to_menu', async () => {
    await b.key('Escape', 'Escape');
    await b.sleep(300);
    await b.click('#quit-btn');
    await b.sleep(500);
    const menuVis = await b.evaluate(`getComputedStyle(document.getElementById('menu')).display`);
    const modesVis = await b.evaluate(`getComputedStyle(document.getElementById('modes')).display`);
    const qVis = await b.evaluate(`getComputedStyle(document.getElementById('quit-btn')).display`);
    if (menuVis !== 'flex' || modesVis !== 'flex' || qVis !== 'none') throw new Error(`menu=${menuVis} modes=${modesVis} quit=${qVis}`);
  });

  await step('5_start_waves_again', async () => {
    await b.click('#mode-waves');
    await b.sleep(3000);
  });

  await step('6_player_death', async () => {
    await b.evaluate(`window.__bp.killPlayer()`);
    await b.sleep(500);
    const deathVis = await b.evaluate(`getComputedStyle(document.getElementById('death-screen')).display`);
    const title = await b.evaluate(`document.getElementById('death-title').textContent`);
    if (deathVis !== 'flex' || title !== 'K.I.A.') throw new Error(`deathVis=${deathVis} title=${title}`);
    return { deathVis, title };
  });

  await step('7_retry_after_death', async () => {
    await b.click('#retry-btn');
    await b.sleep(3000);
  });

  await step('8_switch_to_snd', async () => {
    await b.evaluate(`window.__bp.killPlayer()`);
    await b.sleep(400);
    await b.click('#menu-btn');
    await b.sleep(400);
    await b.click('#mode-snd');
    await b.sleep(1500);
  });

  await step('9_quit_snd', async () => {
    await b.key('Escape', 'Escape');
    await b.sleep(300);
    await b.click('#quit-btn');
    await b.sleep(500);
  });

  await step('10_back_to_waves', async () => {
    await b.click('#mode-waves');
    await b.sleep(3000);
  });

  await step('A_wave_summary_and_corpses', async () => {
    const before = await snap();
    await b.evaluate(`window.__bp.killAllEnemies()`);
    await b.sleep(500);
    const sumVis = await b.evaluate(`getComputedStyle(document.getElementById('wave-summary')).display`);
    if (sumVis !== 'flex') throw new Error(`summary not visible: ${sumVis}`);
    await b.click('#continue-btn');
    await b.sleep(1000);
    const during = await snap();
    await b.sleep(9000);
    const after = await snap();
    return { before, during, after };
  });

  await step('B_snd_defuse_loss', async () => {
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(300);
    await b.evaluate(`window.__bp.startGame('snd')`);
    await b.sleep(500);
    await b.evaluate(`window.__bp.setSndDefuse(10.5)`);
    await b.sleep(500);
    const title = await b.evaluate(`document.getElementById('death-title').textContent`);
    const vic = await b.evaluate(`document.getElementById('death-screen').classList.contains('victory')`);
    if (!/DESACTIVADA/.test(title) || vic) throw new Error(`title=${title} vic=${vic}`);
    return { title, victory: vic };
  });

  await step('C_snd_detonation_victory', async () => {
    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(300);
    await b.evaluate(`window.__bp.startGame('snd')`);
    await b.sleep(500);
    await b.evaluate(`window.__bp.setSndTime(0.05)`);
    await b.sleep(2200);
    const title = await b.evaluate(`document.getElementById('death-title').textContent`);
    const vic = await b.evaluate(`document.getElementById('death-screen').classList.contains('victory')`);
    if (!/CUMPLIDO/.test(title) || !vic) throw new Error(`title=${title} vic=${vic}`);
    return { title, victory: vic };
  });

  await step('D_10_cycles_leak_check', async () => {
    const geoSamples = [];
    for (let i = 0; i < 10; i++) {
      const mode = i % 2 === 0 ? 'waves' : 'snd';
      await b.evaluate(`window.__bp.startGame(${JSON.stringify(mode)})`);
      await b.sleep(200);
      await b.evaluate(`window.__bp.backToMenu()`);
      await b.sleep(100);
      const s = await snap();
      geoSamples.push(s.geo);
    }
    const first = geoSamples[0], last = geoSamples[geoSamples.length - 1];
    if (last !== first) throw new Error(`Geometries grew: ${first} -> ${last} (${geoSamples.join(',')})`);
    return { samples: geoSamples, stableAt: last };
  });

} catch (e) {
  console.log('SUITE ERR', e.message);
} finally {
  await b.close();
  srv.close();
}

console.log('\n--- RESUMEN ---');
console.log('Total steps:', results.length);
console.log('Passed:', results.filter(r => r.ok).length);
console.log('Failed:', results.filter(r => !r.ok).length);

if (results.some(r => !r.ok)) {
  process.exit(1);
}
