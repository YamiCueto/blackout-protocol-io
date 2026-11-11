import { serve, launch } from './harness.mjs';

const { srv, port } = await serve();
const url = `http://127.0.0.1:${port}/index.html?debug&nolock`;
const b = await launch(url);
const results = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS [${name}]`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    console.error(`FAIL [${name}]: ${err.message}`);
  }
}

try {
  await b.navigate(url);
  await b.sleep(3500);

  await step('1_header_initial_state', async () => {
    await b.evaluate(`window.__bp.progression.reset()`);
    await b.sleep(200);

    const lvlText = await b.evaluate(`document.getElementById('player-level-badge').textContent`);
    const xpText = await b.evaluate(`document.getElementById('player-xp-text').textContent`);
    const xpWidth = await b.evaluate(`document.getElementById('player-xp-fill').style.width`);

    if (lvlText !== 'NVL 1') throw new Error(`Expected NVL 1, got ${lvlText}`);
    if (xpText !== '0 / 500 XP') throw new Error(`Expected 0 / 500 XP, got ${xpText}`);
    if (xpWidth !== '0%') throw new Error(`Expected 0%, got ${xpWidth}`);
    return { lvlText, xpText, xpWidth };
  });

  await step('2_armory_tab_categories', async () => {
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(300);

    const isLoadoutVis = await b.evaluate(`getComputedStyle(document.getElementById('tab-loadout')).display !== 'none'`);
    if (!isLoadoutVis) throw new Error('tab-loadout is not visible');

    const catCount = await b.evaluate(`document.querySelectorAll('.armory-cat-btn').length`);
    if (catCount !== 7) throw new Error(`Expected 7 category buttons, got ${catCount}`);

    const activeCat = await b.evaluate(`document.querySelector('.armory-cat-btn.active').dataset.cat`);
    if (activeCat !== 'ASSAULT') throw new Error(`Expected active category ASSAULT, got ${activeCat}`);

    const cardCount = await b.evaluate(`document.querySelectorAll('.weapon-card').length`);
    if (cardCount !== 2) throw new Error(`Expected 2 assault cards (MK-7, AK-12), got ${cardCount}`);

    const weaponName = await b.evaluate(`document.getElementById('loadout-weapon-name').textContent`);
    if (weaponName !== 'MK-7 CARBINE') throw new Error(`Expected MK-7 CARBINE, got ${weaponName}`);

    const equipBtnText = await b.evaluate(`document.getElementById('btn-equip-weapon').textContent`);
    if (equipBtnText !== 'EQUIPADA') throw new Error(`Expected EQUIPADA, got ${equipBtnText}`);

    return { catCount, activeCat, cardCount, weaponName };
  });

  await step('3_category_switch_planned_weapons', async () => {
    await b.evaluate(`document.querySelector('.armory-cat-btn[data-cat="SMG"]').click()`);
    await b.sleep(200);

    const activeCat = await b.evaluate(`document.querySelector('.armory-cat-btn.active').dataset.cat`);
    if (activeCat !== 'SMG') throw new Error(`Expected SMG, got ${activeCat}`);

    const cardCount = await b.evaluate(`document.querySelectorAll('.weapon-card').length`);
    if (cardCount !== 2) throw new Error(`Expected 2 SMG cards (VECTOR-9, MP-5K), got ${cardCount}`);

    const weaponName = await b.evaluate(`document.getElementById('loadout-weapon-name').textContent`);
    if (weaponName !== 'VECTOR-9') throw new Error(`Expected VECTOR-9, got ${weaponName}`);

    const btnText = await b.evaluate(`document.getElementById('btn-equip-weapon').textContent`);
    const btnDisabled = await b.evaluate(`document.getElementById('btn-equip-weapon').disabled`);
    const statusHint = await b.evaluate(`document.getElementById('loadout-status-tag').textContent`);

    if (btnText !== 'BLOQUEADA') throw new Error(`Expected BLOQUEADA for locked Vector-9 at lvl 1, got ${btnText}`);
    if (!btnDisabled) throw new Error('Locked weapon equip button must be disabled');
    if (!statusHint.includes('NVL 4')) throw new Error(`Expected level 4 requirement hint, got ${statusHint}`);

    await b.evaluate(`document.querySelectorAll('.weapon-card')[1].click()`);
    await b.sleep(150);
    const mp5Btn = await b.evaluate(`document.getElementById('btn-equip-weapon').textContent`);
    const mp5Disabled = await b.evaluate(`document.getElementById('btn-equip-weapon').disabled`);
    if (mp5Btn !== 'EN DESARROLLO') throw new Error(`Expected EN DESARROLLO for planned weapon, got ${mp5Btn}`);
    if (!mp5Disabled) throw new Error('Planned weapon button must be disabled');

    return { activeCat, weaponName, btnText, statusHint, mp5Btn };
  });

  await step('4_kill_xp_and_level_up', async () => {
    await b.evaluate(`document.querySelector('.armory-cat-btn[data-cat="ASSAULT"]').click()`);
    await b.sleep(200);

    await b.evaluate(`window.__bp.progression.recordKill('mk7', false)`);
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(200);

    const pXpText = await b.evaluate(`document.getElementById('player-xp-text').textContent`);
    const wXpText = await b.evaluate(`document.getElementById('loadout-weapon-xp-text').textContent`);

    if (pXpText !== '100 / 500 XP') throw new Error(`Expected player 100 / 500 XP, got ${pXpText}`);
    if (wXpText !== '60 / 250 XP') throw new Error(`Expected weapon 60 / 250 XP, got ${wXpText}`);

    await b.evaluate(`window.__bp.progression.recordKill('mk7', true)`);
    await b.sleep(100);

    const pXp2 = await b.evaluate(`document.getElementById('player-xp-text').textContent`);
    if (pXp2 !== '250 / 500 XP') throw new Error(`Expected 250 / 500 XP, got ${pXp2}`);

    await b.evaluate(`window.__bp.progression.grantPlayerXP(300)`);
    await b.evaluate(`window.__bp.switchTab('loadout')`);
    await b.sleep(200);

    const pLvl = await b.evaluate(`document.getElementById('player-level-badge').textContent`);
    const pXp3 = await b.evaluate(`document.getElementById('player-xp-text').textContent`);

    if (pLvl !== 'NVL 2') throw new Error(`Expected NVL 2, got ${pLvl}`);
    if (pXp3 !== '50 / 620 XP') throw new Error(`Expected 50 / 620 XP, got ${pXp3}`);

    return { pLvl, pXp3, wXpText };
  });

  await step('5_waves_combat_xp', async () => {
    await b.evaluate(`window.__bp.switchTab('play')`);
    await b.sleep(200);
    await b.evaluate(`window.__bp.startGame('waves')`);
    await b.sleep(3500);

    const inPlaying = await b.evaluate(`window.__bp.snapshot().phase === 'PLAYING'`);
    if (!inPlaying) throw new Error('Not in PLAYING phase');

    await b.evaluate(`window.__bp.killAllEnemies()`);
    await b.sleep(1200);

    const inSummary = await b.evaluate(`window.__bp.snapshot().phase === 'SUMMARY'`);
    if (!inSummary) throw new Error('Expected SUMMARY phase after clearing wave');

    const rewardText = await b.evaluate(`document.getElementById('ws-reward').textContent`);
    if (!rewardText.includes('+250 XP')) throw new Error(`Expected summary to show +250 XP, got ${rewardText}`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1500);

    const phase = await b.evaluate(`window.__bp.snapshot().phase`);
    if (phase !== 'MENU') throw new Error(`Expected MENU phase, got ${phase}`);

    return { rewardText };
  });

  await step('6_snd_victory_xp', async () => {
    const xpBefore = await b.evaluate(`window.__bp.progression.getPlayerInfo().currentXP`);

    await b.evaluate(`window.__bp.startGame('snd')`);
    await b.sleep(2000);

    const inPlaying = await b.evaluate(`window.__bp.snapshot().phase === 'PLAYING'`);
    if (!inPlaying) throw new Error('Not in PLAYING phase');

    await b.evaluate(`window.__bp.setSndTime(0)`);
    await b.sleep(2200);

    const isVictory = await b.evaluate(`document.getElementById('death-screen').classList.contains('victory')`);
    if (!isVictory) throw new Error('Expected death-screen to have victory class');

    const xpAfter = await b.evaluate(`window.__bp.progression.getPlayerInfo().currentXP`);
    if (xpAfter - xpBefore !== 750) throw new Error(`Expected +750 XP for S&D victory, got ${xpAfter - xpBefore}`);

    await b.evaluate(`window.__bp.backToMenu()`);
    await b.sleep(1500);

    return { xpBefore, xpAfter, diff: xpAfter - xpBefore };
  });

  await step('7_persistence_reload', async () => {
    const savedXp = await b.evaluate(`window.__bp.progression.getPlayerInfo().currentXP`);
    const savedLvl = await b.evaluate(`window.__bp.progression.getPlayerInfo().level`);

    await b.navigate(url);
    await b.sleep(3500);

    const restoredLvl = await b.evaluate(`window.__bp.progression.getPlayerInfo().level`);
    const restoredXp = await b.evaluate(`window.__bp.progression.getPlayerInfo().currentXP`);
    const badgeText = await b.evaluate(`document.getElementById('player-level-badge').textContent`);

    if (restoredLvl !== savedLvl) throw new Error(`Level mismatch after reload: expected ${savedLvl}, got ${restoredLvl}`);
    if (restoredXp !== savedXp) throw new Error(`XP mismatch after reload: expected ${savedXp}, got ${restoredXp}`);
    if (badgeText !== 'NVL ' + savedLvl) throw new Error(`Badge text mismatch: expected NVL ${savedLvl}, got ${badgeText}`);

    return { savedLvl, restoredLvl, savedXp, restoredXp };
  });

  console.log('\n=============================================');
  const allOk = results.every(r => r.ok);
  console.log(`TOTAL BROWSER TESTS: ${results.length} | PASSED: ${results.filter(r => r.ok).length} | FAILED: ${results.filter(r => !r.ok).length}`);
  console.log('=============================================');

  if (!allOk) {
    process.exit(1);
  }
} finally {
  await b.close();
  srv.close();
}
