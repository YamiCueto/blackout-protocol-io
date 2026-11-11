import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const suites = [
  { name: 'test_progression_unit.mjs', count: 6, desc: 'Fórmulas XP, curvas 1-50 / 1-20, persistencia y catálogo' },
  { name: 'test_progression_browser.mjs', count: 7, desc: 'UI Armamento, categorías, XP en combate real y recarga' },
  { name: 'test_sprint3.mjs', count: 10, desc: 'Navegación de lobby táctico estilo Warzone, camuflajes y responsive' },
  { name: 'test_engine_lifecycle.mjs', count: 14, desc: 'Ciclo de vida del motor, pausas, oleadas, S&D y 10 ciclos de estabilidad' },
  { name: 'test_sprint5.mjs', count: 20, desc: '20 criterios de aceptación de armamento modular (Hito 9)' },
  { name: 'test_sprint5_closure.mjs', count: 5, desc: 'Cadencia, impactos mixtos M870, recarga interrumpible, persistencia' },
  { name: 'test_memory_deep.mjs', count: 6, desc: 'Acumulador en navegador, anti-burst, 20 swaps, 10 oleadas, 10 S&D, retry' },
  { name: 'test_sprint6.mjs', count: 22, desc: 'Equipamientos personalizados, P-12 Tactical, cambio en combate y regresión' }
];

async function runSuite(suite) {
  const filePath = path.resolve(__dirname, suite.name);
  console.log(`\n>>> EJECUTANDO [${suite.name}] (${suite.count} pruebas) - ${suite.desc}...`);
  const start = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--experimental-vm-modules', filePath], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      resolve({
        name: suite.name,
        count: suite.count,
        desc: suite.desc,
        code,
        elapsed,
        ok: code === 0
      });
    });
  });
}

const summary = [];
for (const s of suites) {
  const res = await runSuite(s);
  summary.push(res);
  if (!res.ok) {
    console.error(`\nFALLO CRÍTICO EN ${s.name} (código de salida: ${res.code})`);
    process.exit(1);
  }
}

console.log('\n========================================================================================');
console.log('                          RESUMEN DE PRUEBAS AUTOMATIZADAS                              ');
console.log('========================================================================================');

let totalTests = 0;
let passedTests = 0;

for (const r of summary) {
  const status = r.ok ? 'PASS' : 'FAIL';
  totalTests += r.count;
  if (r.ok) passedTests += r.count;
  console.log(`[${status}] ${r.name.padEnd(30)} | ${r.count.toString().padStart(2)} pruebas | ${r.elapsed}s | ${r.desc}`);
}

console.log('----------------------------------------------------------------------------------------');
console.log(`TOTAL GENERAL: ${passedTests}/${totalTests} PRUEBAS PASADAS (100% OK)`);
console.log('========================================================================================');

if (passedTests !== totalTests || totalTests !== 90) {
  process.exit(1);
} else {
  process.exit(0);
}
