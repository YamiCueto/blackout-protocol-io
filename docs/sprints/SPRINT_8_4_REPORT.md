# BLACKOUT PROTOCOL — INFORME TÉCNICO SPRINT 8.4
## IA enemiga: navegación espacial, percepción, máquina de estados y arquetipos tácticos

**Rama:** `develop`  
**Commit base:** `5ebc3394c4130cd96870c98cf81bad81cca04868`  
**Pruebas:** 217/217 (`node tests/run_all.mjs`, código de salida 0)  
**Dependencias nuevas:** ninguna (JavaScript nativo y Three.js r160)

Este documento reemplaza la versión anterior. Los valores de arquetipos, temporizadores y reglas de aparición se han contrastado con el código fuente; la versión previa contenía cifras que no coincidían con él.

---

## 1. Módulos

| Archivo | Responsabilidad |
|---|---|
| `js/spatial-nav.js` | Grafo de waypoints generado desde los `Box3` del escenario, A* acotado (200 iteraciones), suavizado de ruta, nodos de cobertura, separación local y detector de estancamiento |
| `js/perception.js` | Conos de visión por estado, oclusión por raycast contra `solidMeshes()`, bus acústico, radios de sonido |
| `js/enemy-ai.js` | `EnemyAIBrain` (FSM de 10 estados), memoria de última posición conocida (LKP), definición de arquetipos |
| `js/enemies.js` | Modelos por arquetipo, resistencia al daño, `setAISystems`, limpieza de `defusing` al morir |
| `js/main.js` | Integración con Oleadas y Buscar y Destruir, difusión de sonido de disparos, accesores de prueba (`getSndState`, `getPhase`, `damageEnemy`) |

`pushOutCircle` se mantiene como protección física final de colisión.

## 2. Parámetros reales (verificados en el código)

**Percepción** — alcance y apertura por estado: PATROL 75°/26 m, SUSPICIOUS 90°/30 m, INVESTIGATE 90°/32 m, ALERT 130°/40 m, CHASE y ATTACK 140°/42 m, TAKE_COVER 110°/35 m, RETREAT 100°/32 m, SEARCH 100°/28 m.

**Sonido** — disparo sin supresor 45 m, con supresor 12 m, sprint 14 m, recarga 8 m, explosión 70 m, pasos 4 m.

**Memoria LKP** — se olvida tras 7.0 s sin contacto (`lkpTimeout`).

**Histéresis** — duración mínima de estado 0.65 s (`minStateDuration`); la muerte siempre puede forzar el cambio.

**Arquetipos**

| Arquetipo | Velocidad | HP base | Alcance de ataque | Escala | Rasgo |
|---|---|---|---|---|---|
| Perseguidor (CHASER) | 4.2 | 85 | 2.8 | 1.00 | Cuerpo a cuerpo / corta distancia |
| Flanqueador (FLANKER) | 3.8 | 95 | 22 | 1.00 | Desvía su objetivo ortogonalmente (`flankBias`) |
| Blindado (BRUTE) | 2.2 | 240 | 32 | 1.15 | `resistanceMult` 0.70 (recibe el 70 % del daño) |
| Tirador (SHOOTER) | 2.8 | 110 | 35 | 1.00 | Usa cobertura |
| Élite (ELITE) | 3.4 | 160 | 42 | 1.00 | Modo francotirador, usa cobertura |

El Blindado se unificó a 0.70x en el Hito 8.1; con 50 de daño base recibe 35 (verificado por la prueba 22).

## 3. Integración con los modos

- **Oleadas:** composición por tramos de oleada (1–2: Perseguidor/Tirador; 3–4: añade Flanqueador; 5–7: añade Blindado; 8+: añade Élite). La aparición busca puntos de borde a 20 m o más del jugador y fuera de colisionadores, con un máximo de 24 intentos. No existe regla de exclusión por campo de visión.
- **Buscar y Destruir:** los enemigos nacen en el borde a 16 m o más del jugador (mismo límite de intentos). El primero vivo recibe el rol `defuser` y avanza en CHASE hacia `bombPos (0, 0, -6)`; el resto son `escort`. Cuando el desactivador llega a menos de 2.3 m, `defusing` pasa a `true` y se detiene. Las reglas originales no se modificaron: la desactivación acumulada llega a 10 s (derrota), la detonación a 90 s es victoria, y el progreso decae a 0.6 por segundo sin desactivador.

## 4. Rendimiento: tiempo de CPU frente a tiempo real de fotograma

Son magnitudes distintas y no se convierten entre sí:

- **Tiempo de CPU de la IA:** duración de `brain.update()` medida con `performance.now()`. Su resolución efectiva es de 0.1 ms, por lo que medianas de 0.000 y p95 de 0.100 indican "por debajo de la resolución del temporizador", no un valor exacto.
- **Tiempo real de fotograma:** intervalo entre callbacks de `requestAnimationFrame`. Incluye simulación, render, composición y espera de VSync.

Resultados completos (319 muestras tras calentamiento, 5/8/12 enemigos, GPU y SwiftShader) en `SPRINT_8_4_HITO_8_REPORT.md`. Resumen: el coste de IA medido fue de 0.008–0.042 ms de media en ambos renderizadores; el intervalo entre fotogramas fue ≈16.7 ms (≈60 FPS) con GPU y ≈56–57 ms (≈17–18 FPS) con SwiftShader.

**Limitaciones del benchmark**
- Con VSync, `requestAnimationFrame` queda limitado al refresco de pantalla. 60 FPS indica que se cumple el presupuesto de 16.7 ms, pero no revela cuánta holgura queda.
- No se capturó la cadena del adaptador (`WEBGL_debug_renderer_info`), por lo que la etiqueta "GPU/ANGLE" se basa en la configuración de lanzamiento y en la diferencia observada frente a SwiftShader.
- No se midió el coste de renderizado WebGL por separado; solo `draw calls` y geometrías de `renderer.info`.
- La IA se midió llamando a `brain.update()` desde el gancho de medición, además del bucle normal del juego; es una cota del coste, no una medición dentro de `stepSim`.

## 5. Pruebas

`tests/test_sprint8_4.mjs` contiene 22 comprobaciones:

| # | Verificación |
|---|---|
| 1–2 | Grafo de navegación y A* determinista |
| 3–5 | Visión con FOV y oclusión, sonido con y sin supresor, LKP |
| 6–7 | Cinco arquetipos y cobertura |
| 8–10 | Separación, histéresis de la FSM, cancelación al morir |
| 11–12 | Roles de S&D y composición/distancia de Oleadas |
| 13–15 | Invariancia de framerate, memoria WebGL, daño y XP preservados |
| 16 | Llegada alrededor de edificios en ambos sentidos |
| 17 | Llegada alrededor de contenedores y fila de cajas, ambos sentidos |
| 18 | La desactivación empieza y se mantiene a menos de 2.3 m de la bomba |
| 19 | Muerte del desactivador: `defusing` pasa a falso y el progreso decae |
| 20 | Fin de ronda por bomba desactivada: derrota, fase RESULTS |
| 21 | Fin de ronda por detonación: victoria, fase RESULTS |
| 22 | Blindado a 0.70x exacto (35 de 50) y Tirador sin reducción |

Las pruebas 16–17 comprueban llegada a ≤1.2 m, cero penetraciones de colisionadores (posición dentro de un `Box3` reducido 0.3 m) y ausencia de saltos de posición mayores que un paso de movimiento.

La suite completa suma 217 pruebas (195 previas + 22 de este sprint).

## 6. Corrección de producción descubierta durante la validación

`damageEnemy` no limpiaba `defusing` al matar al operador, y `stepSim` salta a los enemigos muertos, por lo que la bandera quedaba obsoleta y el progreso de desactivación seguía avanzando. Ahora `e.defusing = false` se asigna en la rama de muerte.

## 7. Evidencias visuales

`docs/sprints/screenshots/sprint8_4/` (`01_archetypes_roster.png`, `02_snd_tactical_roles.png`, `03_waves_tactical_spread.png`) y subcarpetas `hito8/` y `hito8_1/`.
