# BLACKOUT PROTOCOL — INFORME DE CIERRE DE SPRINT 1
## Estabilización del motor y preparación para el lobby 3D

- **Fecha:** 2026-11-10
- **Rama:** `master`
- **Commit inicial de línea base:** `4c89813` (`Linea base: estado del proyecto previo al Sprint 1 y auditoria Fase 0`)
- **Estado de cambios:** 5 archivos modificados (`css/style.css`, `index.html`, `js/effects.js`, `js/enemies.js`, `js/main.js`) y 1 archivo nuevo (`js/diagnostics.js`). Sin commits adicionales (en espera de autorización). Sin push.

---

## 1. Hitos completados

### Hito 1 — Línea base y control de versiones
- Verificación del estado del repositorio limpio antes de iniciar modificaciones.
- Creación de `.gitignore` integral para proyectos web/Node (exclusión de `node_modules`, archivos `.env`, temporales, cachés y artefactos del sistema).
- Creación del commit inicial de línea base `4c89813`.
- No se realizó `git push` en cumplimiento estricto de las restricciones.

### Hito 2 — Gestión del ciclo de vida de partida
- Implementación de la máquina de estados liviana basada en fases (`phase`): `MENU`, `PLAYING`, `PAUSED`, `SUMMARY`, `RESULTS`.
- Transición bidireccional estable sin recarga de página:
  `MENU → PLAYING → PAUSED → PLAYING → RESULTS → MENU`
- Soporte para reinicio inmediato (`retry-btn`), reanudación (`resume-btn`), retorno a menú (`menu-btn`) y abandono en caliente (`quit-btn`).
- Verificado: no hay bucles de animación duplicados (un único `requestAnimationFrame(tick)` en el ciclo de vida del juego).
- Verificado: no hay registro acumulativo de listeners de eventos. Todos los manejadores se registran a nivel de módulo una sola vez.

### Hito 3 — Gestión de memoria y recursos
- **Geometrías de enemigos compartidas:** Se sustituyó la instanciación de 8 `BoxGeometry` por cada enemigo en `makeEnemy()` por un juego de 8 geometrías compartidas a nivel de módulo (`geoTorso`, `geoVest`, `geoHead`, `geoHelmet`, `geoVisor`, `geoLeg`, `geoArm`, `geoGun`).
- **Ciclo de vida de cadáveres en Oleadas:** Se introdujo `updateCorpses(dt)` con `CORPSE_LIFETIME = 8s` y fase de hundimiento (`CORPSE_SINK_TIME = 1.2s`). Al expirar, el enemigo se desvincula de la escena y se remueve de `enemies[]`.
- **Limpieza de escombros (*debris*):** En `popHead`, las partes del enemigo despedidas usan las geometrías compartidas; `effects.js` ya no invoca `dispose()` sobre geometrías compartidas al expirar la partícula, evitando invalidar el renderizado de futuros enemigos.
- **Liberación de decals:** Se añadió liberación explícita (`geometry.dispose()` y `material.dispose()`) en `resetEffects()`.
- **Objetivo explosivo (bomba en S&D):** `removeBomb()` ahora recorre `bombGroup` y ejecuta `dispose()` sobre cada geometría y material instanciado (`body`, `screen`, `wires`, `bombLight`).
- **Verificación cuantitativa de memoria:** Se verificó mediante `renderer.info.memory.geometries` que tras 10 partidas consecutivas alternando modos, el recuento de geometrías se mantiene completamente estable (49 geometrías), eliminando la fuga de memoria de la versión base.

### Hito 4 — Tiempo de simulación y unificación de reloj
- **Reloj desacoplado:** Se introdujo `matchTime` como acumulador de tiempo de simulación puro, que solo avanza cuando `phase === 'PLAYING'`.
- **Eliminación de desincronización por `performance.now()`:**
  - El temporizador de S&D, el escalado de hostiles (`lvl`), la estadística "Aguantaste" y el cálculo de duración de oleada en el resumen usan `matchTime`.
  - La pausa no incrementa la dificultad ni corrompe las estadísticas al reanudar.
- **Sub-stepping y protección contra saltos temporales:**
  - `tick()` calcula `frameDt = Math.min(clock.getDelta(), 0.25)` para evitar picos por cambio de pestaña o ralentización severa.
  - Se implementó subdivisión de fotograma (`MAX_STEP = 0.05`) para estabilidad de física y colisiones.
- **Temporizadores lógicos:** La transición tras detonación de bomba (`endDelay = 1.6s`) se integró en la simulación; pausar o abandonar cancela o congela el temporizador correctamente, sin timers huérfanos de `setTimeout`.

### Hito 5 — Controles y Pointer Lock
- **Pérdida de foco:** Se agregaron listeners para `blur` de ventana y `visibilitychange` de documento, limpiando el mapa de teclas (`keys`), `mouseDown` y `adsDown`, e ingresando a pausa de forma segura si la partida estaba activa.
- **Tecla Escape:** Manejo explícito de `Keydown: Escape` para pausar la partida si `phase === 'PLAYING'`, o regresar de la pantalla de ajustes.
- **Gestión de fallos de Pointer Lock:**
  - `requestLock()` captura rechazos asíncronos (`promise.catch`) y escucha el evento `pointerlockerror`.
  - Ante fallo de bloqueo de puntero, el juego activa automáticamente la pausa (`showMenuPause()`), previniendo desincronizaciones donde la partida avanza sin control del jugador.
- **Botón "Abandonar partida":**
  - Incorporado al menú de pausa (`#quit-btn` con clase `btn btn-ghost`).
  - Restaura la interfaz a la selección de modos, detiene la simulación, libera enemigos y efectos, y retorna al estado `MENU` sin recargar la página.

### Hito 6 — Diagnóstico de rendimiento
- **Módulo `js/diagnostics.js`:**
  - Se activa únicamente cuando la URL incluye el parámetro `?debug`. En entornos normales o de producción no agrega carga visual ni de cómputo.
  - Tecla `F3` permite conmutar la visibilidad del panel en pantalla.
  - Expone contadores reales derivados de `renderer.info`:
    - FPS y tiempo de fotograma en milisegundos (`frameMs`).
    - Estado de fase actual y modo de juego.
    - Tiempo acumulado de partida (`matchTime`).
    - Enemigos vivos y total en memoria.
    - Llamadas de renderizado (*draw calls*) y pico histórico.
    - Triángulos renderizados y pico histórico.
    - Geometrías registradas en GPU.
    - Texturas registradas en GPU.
    - Programas de shader compilados.
    - Total de nodos hijos directos en la escena Three.js.
  - Se aclara explícitamente en el panel que estos valores reflejan contadores de WebGL/Three.js y no equivalen directamente al consumo en megabytes de VRAM física de la GPU.
  - Sin dependencias externas añadidas.

### Hito 7 — Verificación y pruebas
- Ejecución de suite de 14 pruebas automatizadas con Chrome Headless mediante protocolo CDP (`scratch/run_suite.mjs`).
- **Tasa de éxito:** 14/14 pruebas aprobadas (100%).
- Verificación sintáctica rigurosa de los 10 módulos JavaScript (`node --experimental-vm-modules`).
- Verificación de ausencia absoluta de comentarios añadidos al código fuente.

---

## 2. Archivos modificados y nuevos

| Archivo | Estado | Modificaciones principales |
|---|---|---|
| `css/style.css` | Modificado (+2 líneas) | Estilos para el elemento `#diag` del panel de diagnóstico. |
| `index.html` | Modificado (+1 línea) | Incorporación del botón `<button id="quit-btn">Abandonar partida</button>` en `#menu`. |
| `js/effects.js` | Modificado (+6 / -2 líneas) | `resetEffects()` libera geometrías y materiales de decals. `updateEffects()` no destruye geometrías compartidas de escombros de cabeza. |
| `js/enemies.js` | Modificado (+53 / -8 líneas) | 8 geometrías `BoxGeometry` compartidas. Implementación de `CORPSE_LIFETIME = 8s`, `updateCorpses(dt)` y `releaseEnemy()`. |
| `js/main.js` | Modificado (+158 / -48 líneas) | Fases de estado (`phase`), `matchTime`, `clearInput()`, `requestLock()` con fallback `onLockFailed`, listeners de `blur`, `visibilitychange`, `Escape`, `pointerlockerror`, botón Abandonar, sub-stepping temporal (`stepSim`), eliminación de `setTimeout` en detonación, integración con diagnósticos. |
| `js/diagnostics.js` | Nuevo (67 líneas) | Panel HUD de telemetría de rendimiento y puente de pruebas bajo `?debug`. Cero comentarios. |
| `.gitignore` | Nuevo (25 líneas) | Exclusiones para repositorios web/Node. Creado en Hito 1. |

---

## 3. Problemas corregidos

1. **F-001 (Línea base Git):** Resuelto mediante el commit `4c89813` y el archivo `.gitignore`.
2. **F-003 (Cadáveres infinitos en Oleadas):** Resuelto. Los enemigos caídos se animan, reposan y a los 8 segundos se hunden levemente y son retirados de la escena y de la memoria activa.
3. **F-004 (Fuga de geometrías de enemigos y bomba):** Resuelto. Las geometrías de los hostiles son compartidas a nivel de módulo (instanciadas 1 sola vez en lugar de 8 veces por enemigo). La bomba libera sus mallas y materiales al destruirse o reiniciarse.
4. **F-006 (Imposibilidad de abandonar desde la pausa):** Resuelto. El botón `#quit-btn` permite salir al menú principal en cualquier momento sin recargar la página.
5. **F-008 (Fallo de Pointer Lock no gestionado):** Resuelto. Se captura el rechazo y el evento de error, enviando al juego a pausa ordenada en lugar de dejar la simulación corriendo sin control de cámara.
6. **F-009 (Desincronización de reloj / trampa en pausa):** Resuelto. Se eliminó la dependencia de `performance.now()` para la lógica de combate; el juego usa `matchTime`, que se congela durante la pausa.
7. **F-010 (Teclas atascadas al perder foco):** Resuelto. `blur` y `visibilitychange` vacían el mapa de teclas y pausan la partida.
8. **F-018 (Timers huérfanos de detonación):** Resuelto. La transición de victoria de S&D es controlada por el acumulador de simulación y se reinicia en `backToMenu()`.
9. **F-019 (Decals persistentes):** Resuelto. `resetEffects()` limpia y libera la memoria GPU de los decals entre partidas.

---

## 4. Pruebas ejecutadas y resultados

### 4.1 Comprobación estática y de sintaxis
Se ejecutó validación sintáctica de ES Modules nativos sobre todos los archivos del directorio `js/`:
```bash
node --experimental-vm-modules --no-warnings -e "const vm=require('vm'),fs=require('fs');for(const f of fs.readdirSync('js')){new vm.SourceTextModule(fs.readFileSync('js/'+f,'utf8'));console.log('SYNTAX OK',f)}"
```
**Resultado:**
- `audio.js`: SYNTAX OK
- `core.js`: SYNTAX OK
- `diagnostics.js`: SYNTAX OK
- `effects.js`: SYNTAX OK
- `enemies.js`: SYNTAX OK
- `main.js`: SYNTAX OK
- `settings.js`: SYNTAX OK
- `textures.js`: SYNTAX OK
- `weapon.js`: SYNTAX OK
- `world.js`: SYNTAX OK

### 4.2 Cumplimiento de restricciones de comentarios
Se auditó el `git diff` y el archivo nuevo `js/diagnostics.js` buscando comentarios de línea o bloque agregados:
```bash
git diff | Select-String '^\+\s*(//|/\*)'
Select-String -Path js\diagnostics.js -Pattern '//|/\*'
```
**Resultado:** 0 coincidencias. Ningún comentario fue introducido en el código.

### 4.3 Suite automatizada en Chrome Headless (CDP)
Ejecución completa de 14 pruebas funcionales y de estrés:

| Paso | Escenario | Resultado | Métricas registradas |
|---|---|---|---|
| 1 | Iniciar Oleadas (click UI) | PASS | phase=PLAYING, alive=5/5, geo=47, t=3.27s |
| 2 | Pausar con tecla Escape | PASS | phase=PAUSED, alive=5/5, quit-btn visible, resume-btn visible |
| 3 | Reanudar partida (click UI) | PASS | phase=PLAYING, HUD visible, t=3.97s |
| 4 | Abandonar a Menú principal | PASS | phase=MENU, alive=0/0, enemies cleared |
| 5 | Iniciar nuevamente Oleadas | PASS | phase=PLAYING, alive=5/5, wave 1 spawn OK |
| 6 | Muerte del jugador | PASS | phase=RESULTS, pantalla K.I.A. visible |
| 7 | Reintentar partida (click UI) | PASS | phase=PLAYING, reinicio completo de estadísticas y salud |
| 8 | Cambiar a Buscar y Destruir | PASS | phase=PLAYING, bomba y luz roja creadas, reserva 150 |
| 9 | Abandonar S&D desde pausa | PASS | phase=MENU, bomba destruida y liberada |
| 10 | Regresar a Oleadas | PASS | phase=PLAYING, alive=5/5 |
| A | Oleada superada y recolección de cadáveres | PASS | Wave summary visible; a los 9s cadáveres recolectados limpiamente |
| B | S&D derrota por desactivación de bomba | PASS | Defuse >= 10s activa pantalla "BOMBA DESACTIVADA / MISIÓN FALLIDA" |
| C | S&D victoria por detonación | PASS | Temporizador 0s activa explosión y pantalla "OBJETIVO CUMPLIDO" |
| D | Estrés de fugas (10 ciclos start/quit) | PASS | Geometrías GPU estables en 49 durante todo el ciclo (0 fugas) |

**Resumen de la suite:** 14/14 pasos aprobados.

---

## 5. Limitación de Pointer Lock en entornos Headless y procedimiento de verificación manual

### Diagnóstico técnico de la limitación
Al solicitar `canvas.requestPointerLock()` en Chrome Headless (`--headless=new`), Chromium rechaza la promesa con la excepción:
```
DOMException: The root document of this element is not valid for pointer lock.
```
Esto ocurre por especificación de Chromium: el documento raíz no está acoplado a un widget de ventana nativa del sistema operativo con foco de escritorio.

Nuestro manejador `onLockFailed()` captura correctamente este fallo y envía el juego a pausa defensiva. Para permitir que la suite automatizada simule la partida en headless sin este bloqueo, se habilitó la bandera de prueba `?nolock` que solo actúa cuando se solicita explícitamente en la URL de pruebas.

### Procedimiento de validación manual en navegador con GUI (Chrome / Edge / Firefox)
Para verificar el comportamiento real con puntero físico en un entorno interactivo:

1. Iniciar el servidor local:
   ```bash
   python -m http.server 8000
   ```
2. Abrir en el navegador: `http://localhost:8000/?debug`
3. **Verificación de bloqueo de puntero:**
   - Hacer clic en "DESPLEGAR »" en la tarjeta OLEADAS.
   - Constatar que el cursor del ratón desaparece y el puntero queda bloqueado sobre el canvas.
   - Mover el ratón: la cámara en primera persona debe rotar suavemente en los ejes horizontal y vertical.
4. **Verificación de pausa por Escape:**
   - Presionar la tecla `Escape`.
   - El puntero debe liberarse inmediatamente, el HUD debe ocultarse y debe aparecer el menú de pausa con las opciones "REANUDAR", "AJUSTES" y "ABANDONAR PARTIDA".
5. **Verificación de reanudación:**
   - Hacer clic en "REANUDAR".
   - El puntero debe volver a bloquearse y el juego continuar con fluidez.
6. **Verificación de pérdida de foco (Alt-Tab):**
   - Estando en partida, presionar `Alt + Tab` o hacer clic fuera del navegador.
   - Al regresar a la pestaña, el juego debe estar en pausa y no debe existir movimiento residual de caminar.
7. **Verificación de abandono:**
   - Estando en pausa, hacer clic en "ABANDONAR PARTIDA".
   - El juego debe volver al menú inicial con las dos tarjetas de modo visibles.
8. **Verificación de telemetría:**
   - Presionar `F3` para abrir y cerrar el panel de diagnóstico verde en la esquina superior izquierda.

---

## 6. Estado de ambos modos de juego

### Modo OLEADAS
- **Comportamiento:** 100% operativo. Spawns perimetrales dinámicos (`3 + 2 * wave`), escalado de vida, daño y puntería de IA.
- **Cadáveres:** Los cuerpos caen, permanecen 8 segundos visibles y se hunden suavemente en el suelo antes de ser recolectados, evitando saturación geométrica.
- **Transición:** Al abatir a todos los enemigos de la oleada, se despliega el informe de combate (`#wave-summary`) con recuento de bajas, disparos y precisión. Al pulsar "Continuar", la siguiente oleada comienza en 1.5s.

### Modo BUSCAR Y DESTRUIR
- **Comportamiento:** 100% operativo. La bomba se sitúa en `(0, 0, -6)` con luz parpadeante sincronizada a la simulación.
- **Inteligencia artificial:** Los bots se dirigen hacia la bomba. Al llegar a menos de 2.3 metros, se detienen e inician la desactivación acumulativa.
- **Condiciones de fin:**
  - Derrota por desactivación completa (`defuse >= 10s`).
  - Derrota por baja del jugador (`player.hp <= 0`).
  - Victoria por detonación al expirar los 90 segundos: genera explosión, elimina hostiles en radio de 30 metros y muestra pantalla de victoria tras 1.6 segundos de simulación.

---

## 7. Preparación para el futuro lobby 3D

El motor ha quedado preparado para soportar el lobby sin necesidad de introducir un segundo renderer:

1. **Escenas limpias:** `clearEnemies()`, `resetEffects()` y `removeBomb()` garantizan que al salir al menú no quedan mallas, luces ni colisionadores residuales en la escena.
2. **Máquina de fases clara:** El estado `phase` (`MENU`, `PLAYING`, `PAUSED`, `RESULTS`, `SUMMARY`) permite conectar de forma limpia una futura escena de lobby (`LOBBY`) administrada por un único bucle de renderizado.
3. **Reutilización del renderer:** El `THREE.WebGLRenderer` de `core.js` puede renderizar una escena de hangar/operador mientras `phase === 'MENU'` y alternar a la escena de juego en `phase === 'PLAYING'`, sin pérdidas de contexto WebGL ni duplicación de texturas procedurales.
4. **Reloj inmune a transiciones:** `matchTime` garantiza que la partida comenzará en `t = 0` independientemente del tiempo que el usuario pase navegando menús o personalizando en el lobby.

---

## 8. Riesgos y asuntos pendientes para fases posteriores

1. **Commit pendiente de autorización:** Las modificaciones del Sprint 1 se encuentran en el árbol de trabajo (*working tree*). Deben ser versionadas en Git en cuanto el usuario lo autorice.
2. **Refactorización modular de `main.js` (Sprint 2):** Aunque `main.js` se encuentra estabilizado y sin fugas, contiene 887 líneas. Se recomienda extraer formalmente `GameManager`, `StateMachine` e `InputManager` en el Sprint 2 para desacoplar completamente la lógica antes de construir la interfaz del lobby.
3. **Dependencia de Three.js por CDN:** Se mantiene la versión r160 desde `cdn.jsdelivr.net`. Deberá definirse si se vendoriza localmente para despliegues autónomos sin conexión.
4. **Sensibilidad de ratón fija:** La sensibilidad de entrada (`0.0021`) permanece fija en código; convendría incorporarla a la pantalla de Ajustes en un sprint posterior.

---

## 9. Conclusión y Criterio de Cierre

El **Sprint 1 ha cumplido el 100% de los criterios de aceptación y restricciones**:
- Se mantuvo la integridad tecnológica (JavaScript vanilla + Three.js r160, sin frameworks ni dependencias añadidas).
- Se preservaron intactas las mecánicas de disparo, movimiento y balance de combate.
- No se agregaron comentarios al código fuente.
- Se verificó la eliminación de fugas de memoria y acumulación de cadáveres.
- Ambos modos de juego inician, se pausan, se reanudan, se abandonan y se reinician sin recargar la página.
- Se validó el 100% de los escenarios con suite automatizada y se documentó el procedimiento de verificación manual.

**Estado: SPRINT 1 COMPLETADO. A la espera de autorización del usuario antes de proceder a cualquier commit adicional o comenzar el Sprint 2.**
