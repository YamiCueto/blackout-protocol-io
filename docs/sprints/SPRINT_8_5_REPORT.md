# BLACKOUT PROTOCOL — SPRINT 8.5
## INFORME DE AUDITORÍA Y VALIDACIÓN TÉCNICA (HITO 8)
### Sistema de impactos, daño localizado, armadura, VFX y respuesta de combate

---

### 1. ALCANCE Y OBJETIVOS DEL HITO 8

El Hito 8 certifica de manera empírica, visual y automatizada los comportamientos del nuevo pipeline balístico introducido en el Sprint 8.5:
1. Detección multidireccional por raycast de zonas anatómicas (`HEAD`, `HELMET`, `TORSO`, `ARMOR_PLATE`, `ARM_L/R`, `LEG_L/R`).
2. Blindaje táctico y mitigación selectiva en la placa frontal del Blindado vs vulnerabilidad en la espalda y cabeza.
3. Balística compuesta por perdigón individual en la escopeta M870 con consolidación atómica por disparo (cero duplicaciones de bajas, XP o drops).
4. Reacciones físicas de sacudida (flinch procedural) y persistencia sin ser sobrescritas por las animaciones de movimiento de la IA.
5. Sistema de partículas por tipo de superficie (metal, concreto, madera, tierra y carne/blindaje).
6. Ciclo de vida y limpieza de efectos en reinicio, muerte y cambio de modo.
7. Comportamiento y visibilidad de hitmarkers en ADS y modo Reducir movimiento.
8. Rendimiento medido mediante `requestAnimationFrame` con identificación explícita del renderizador WebGL activo.
9. Ejecución completa de la suite de regresión (`run_all.mjs`) con 237 pruebas aprobadas y código de salida 0.

---

### 2. MATRIZ DE ESCENARIOS DE VALIDACIÓN (HITO 8)

| ID | Escenario de Prueba | Valores Medidos / Datos Observados | Evidencia / Archivo | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **ESC-01** | Raycasts multidireccionales sobre partes anatómicas | Frontal: `ARMOR_PLATE` / Espalda: `TORSO` / Lateral: `ARM_L` / Cabeza: `HEAD`/`HELMET` / Pierna: `LEG_L` | `tests/test_sprint8_5.mjs` (Paso 13) | **PASS** |
| **ESC-02** | Mitigación Zonal de Armadura del Blindado | Frontal en placa: 35.0 dmg ($50 \times 0.70$). Espalda: 50.0 dmg ($50 \times 1.0$). Cabeza: 110.0 dmg ($50 \times 2.2$). | `tests/test_sprint8_5.mjs` (Paso 4 y 13) | **PASS** |
| **ESC-03** | Balística de perdigones M870 (Impacto Mixto) | 2 perdigones a cabeza ($16.5 \times 2 = 33$), 4 a torso ($11 \times 4 = 44$), 2 a pierna ($8.8 \times 2 = 17.6$). Total: 94.6 dmg. Bajas/XP: 1 evento. | `tests/test_sprint8_5.mjs` (Paso 5) | **PASS** |
| **ESC-04** | AWM-338 Multiplicador Crítico | Daño base: 140 HP. Daño cabeza: 350 HP (Ratio exacto: $2.50\times$). Decapitación (`popHead`) activada. | `tests/test_sprint8_5.mjs` (Paso 6) | **PASS** |
| **ESC-05** | Ataque cuerpo a cuerpo (Cuchillo) | Daño directo a torso: 90.0 HP. Autoridad central en `damageEnemy`. | `tests/test_sprint8_5.mjs` (Paso 7) | **PASS** |
| **ESC-06** | Inmunidad de cadáveres ante impactos | Daño a enemigo con `alive === false` retorna `false`. Cero eventos duplicados. | `tests/test_sprint8_5.mjs` (Paso 8) | **PASS** |
| **ESC-07** | Continuidad de desactivación en B&D | Daño no letal: `defusing` se mantiene en `true`. Muerte: `defusing` cancelado a `false` inmediatamente. | `tests/test_sprint8_5.mjs` (Paso 9) | **PASS** |
| **ESC-08** | Flinch procedural vs animación de la IA | Inclinación inicial de torso: $-0.18$ rad. Tras `stepSim` con IA patrullando: rotación preservada en $-0.17$ rad (sin anulación brusca). Coordenadas globales $x,y,z$ intactas. | `tests/test_sprint8_5.mjs` (Paso 10 y 14) | **PASS** |
| **ESC-09** | Partículas por superficie | Metal: chispas amarillas (`0xfff0aa`, vel 4.2). Concreto: escombros (`0xd0c8b8`). Madera: astillas (`0xc49a45`). Suelo: polvo (`0x5a544d`). Carne: sangre (`0xc22222`). Placa: chispas (`0xffd066`). | `js/effects.js` y `tests/test_sprint8_5.mjs` (Paso 15) | **PASS** |
| **ESC-10** | Limpieza de efectos (Leak Prevention) | `resetEffects()` invocado en muerte, inicio de oleada, retorno a menú y cambio de modo. Tracers, decals, particles y debris vaciados a 0. | `tests/test_sprint8_5.mjs` (Paso 16) | **PASS** |
| **ESC-11** | Hitmarker en ADS y Reducir movimiento | Opacidad: 1.0 en ADS. Clases `.hit-crit` y `.hit-armor` aplicadas. Transición CSS deshabilitada con `@media (prefers-reduced-motion)`. | `tests/test_sprint8_5.mjs` (Paso 11 y 17) | **PASS** |
| **ESC-12** | Unicidad de XP y Drops en bajas | 1 baja con tiro a la cabeza otorga exactamente 150 XP ($100 + 50$ bonus) y 1 drop. Pity counter y racha intactos. | `tests/test_sprint8_5.mjs` (Paso 12) | **PASS** |
| **ESC-13** | Captura visual Playwright: Flinch | Deformación física de la parte superior del cuerpo tras impacto balístico. | `docs/sprints/screenshots/sprint8_5/01_hit_flinch_reaction.png` | **PASS** |
| **ESC-14** | Captura visual Playwright: ADS Hitmarker | Hitmarker táctico azul cian en modo apuntado con mira. | `docs/sprints/screenshots/sprint8_5/02_ads_armor_hitmarker.png` | **PASS** |
| **ESC-15** | Captura visual Playwright: Chispas de Armadura | Emisión de partículas de impacto sobre la placa reforzada del Blindado. | `docs/sprints/screenshots/sprint8_5/03_brute_armor_sparks.png` | **PASS** |

---

### 3. HALLAZGOS Y CORRECCIONES EFECTUADAS EN EL HITO 8

1. **Alineación Geométrica de la Placa del Blindado:**
   - *Hallazgo:* La caja de colisión de `heavyPlate` tenía un espesor de 0.46m centrado en $z=0$, sobresaliendo hacia la espalda del modelo y causando que disparos por la retaguardia fueran interceptados erróneamente por la placa.
   - *Solución:* Se ajustó la geometría a `BoxGeometry(0.72, 0.55, 0.14)` con posición local $z=-0.18$, colocándola estrictamente en el frontal del pecho. Los impactos por la espalda ahora colisionan contra `torso` (`userData.hitZone = 'TORSO'`), recibiendo daño pleno sin absorción.
2. **Diferenciación de Partículas por Superficie:**
   - *Hallazgo:* Los impactos contra el escenario siempre generaban la misma calca y chispas amarillas por defecto, sin diferenciar metal, concreto, madera o suelo.
   - *Solución:* Se etiquetaron los colisionadores de `world.js` con `userData.surfaceType` ('concrete', 'metal', 'wood', 'ground') e implementó `spawnSurfaceImpact(point, normal, surfaceType)` en `effects.js`.
3. **Limpieza de Efectos en Ciclo de Vida:**
   - *Hallazgo:* `resetEffects()` no se ejecutaba al morir el jugador (`die()`) ni al iniciar una nueva partida en `startGame()`.
   - *Solución:* Se agregaron las llamadas de limpieza en `main.js`, garantizando la liberación inmediata de mallas temporales y sprites.

---

### 4. BENCHMARK REAL DE RENDIMIENTO (WEBGL / RENDERER)

- **Condiciones:** 9 enemigos en combate activo (8 Tiradores patrullando + 1 Blindado en movimiento).
- **Muestras capturadas:** 130 fotogramas consecutivos tras calentamiento.
- **Renderizador WebGL detectado:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`
- **Proveedor:** `Google Inc. (Google)`
- **Tiempo medio de fotograma:** **53.90 ms**
- **Percentil p95:** **62.50 ms**
- **Percentil p99:** **66.70 ms**
- **FPS Promedio / Mínimo:** **18.6 FPS / 10.4 FPS** (aceleración por software de CPU sin GPU física)
- **Llamadas de dibujo (Draw Calls):** **52 calls** estables
- **Geometrías WebGL en memoria:** **120 geometrías** (cero fugas de memoria)
- **Texturas WebGL activas:** **6 texturas**

---

### 5. CERTIFICACIÓN DE LA SUITE GLOBAL DE PRUEBAS

Total de pruebas ejecutadas: **237**.
Resultado: **237/237 PASS (100% OK)**. Código de salida: **0**.
