const NOOP = { frame() {} };

export function createDiagnostics(renderer, scene, getState, actions = {}) {
  if (!new URLSearchParams(location.search).has('debug')) return NOOP;

  const el = document.createElement('pre');
  el.id = 'diag';
  document.body.appendChild(el);

  let frames = 0, acc = 0, last = performance.now(), fps = 0, frameMs = 0;
  let peakCalls = 0, peakTris = 0, peakGeos = 0, peakTex = 0;
  let nextPaint = 0;

  function snapshot() {
    const i = renderer.info, s = getState();
    return {
      fps: Math.round(fps), frameMs: +frameMs.toFixed(2),
      calls: i.render.calls, triangles: i.render.triangles,
      geometries: i.memory.geometries, textures: i.memory.textures,
      programs: i.programs ? i.programs.length : 0,
      sceneChildren: s.sceneChildren !== undefined ? s.sceneChildren : scene.children.length,
      enemiesAlive: s.enemiesAlive, enemiesTotal: s.enemiesTotal,
      phase: s.phase, mode: s.mode, matchTime: +s.matchTime.toFixed(2),
      peakCalls, peakTris, peakGeos, peakTex,
    };
  }

  function paint(d) {
    el.textContent =
      'DIAGNÓSTICO (?debug · F3)\n' +
      'FPS            ' + d.fps + '  (' + d.frameMs + ' ms)\n' +
      'Estado         ' + d.phase + '\n' +
      'Modo           ' + d.mode + '\n' +
      'Tiempo partida ' + d.matchTime + ' s\n' +
      'Enemigos       ' + d.enemiesAlive + ' vivos / ' + d.enemiesTotal + ' en lista\n' +
      'Draw calls     ' + d.calls + '  (máx ' + d.peakCalls + ')\n' +
      'Triángulos     ' + d.triangles + '  (máx ' + d.peakTris + ')\n' +
      'Geometrías     ' + d.geometries + '  (máx ' + d.peakGeos + ')\n' +
      'Texturas       ' + d.textures + '  (máx ' + d.peakTex + ')\n' +
      'Programas      ' + d.programs + '\n' +
      'Hijos escena   ' + d.sceneChildren + '\n' +
      'Son contadores de three.js (renderer.info), no bytes de memoria GPU.';
  }

  addEventListener('keydown', e => {
    if (e.code !== 'F3') return;
    e.preventDefault();
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });

  window.__bp = { snapshot, ...actions };

  return {
    frame() {
      const now = performance.now();
      const ms = now - last;
      last = now;
      frames++; acc += ms;
      if (acc >= 500) { fps = frames * 1000 / acc; frameMs = acc / frames; frames = 0; acc = 0; }
      const i = renderer.info;
      peakCalls = Math.max(peakCalls, i.render.calls);
      peakTris = Math.max(peakTris, i.render.triangles);
      peakGeos = Math.max(peakGeos, i.memory.geometries);
      peakTex = Math.max(peakTex, i.memory.textures);
      if (now >= nextPaint) { nextPaint = now + 250; paint(snapshot()); }
    },
  };
}
