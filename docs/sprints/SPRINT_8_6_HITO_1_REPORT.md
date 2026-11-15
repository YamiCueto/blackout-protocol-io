# BLACKOUT PROTOCOL — SPRINT 8.6
## HITO 1 & 1.1 — INFORME DE CONTROL DE CONCURRENCIA, RITMO TÁCTICO, COORDINACIÓN OFENSIVA Y ESTABILIDAD

---

### 1. AUDITORÍA DE INTEGRIDAD DE ESTADÍSTICAS

Antes de modificar el código fuente se auditaron las discrepancias señaladas respecto al Hito 0:

1. **Cuchillo Táctico (`knife`):**
   * **Valor efectivo en código (`js/weapon.js:768`):** `damage: 105`.
   * **Explicación técnica:** El valor `90` correspondía a la documentación conceptual preliminar del Sprint 8.1. Durante el Sprint 8.4 se calibró a `105` para asegurar que 1 impacto al torso elimine al Chaser (85 HP) y Flanker (95 HP), dejando al Shooter (110 HP) a 5 HP de salud residual (requiriendo 2 impactos o impacto craneal). Se mantuvo `105` intacto.
2. **M870 Breacher (`m870`):**
   * **Capacidad en código (`js/weapon.js:567`):** `magSize: 6`, `reloadType: 'shell'`.
   * **Accesorios (`js/attachments.js:194`):** El cargador ampliado (`magazine_extended`) solo es compatible con fusiles y pistolas (`mk7`, `ak12`, `vector9`, `mp5k`, `p12`). La escopeta M870 cuenta con depósito tubular fijo invariable en 6 cartuchos.
3. **Buscar y Destruir (`snd`):**
   * **Valores en código (`js/main.js:1969-1970`):** `SND_DURATION = 90` segundos, `SND_DEFUSE_TIME = 10` segundos de desactivación acumulada. Preservados sin alteración.
4. **Economía de Munición en Oleadas:**
   * Las cajas de munición (`js/supplies.js:14-21`) devuelven una fracción de cargador (`0.65` para fusiles de asalto = 20 balas para MK-7, no 30).
   * La bonificación entre oleadas (`js/main.js:2908`) repone el 50% de la reserva máxima del arma activa (60 balas para MK-7).

---

### 2. AISLAMIENTO ESTRICTO ENTRE MODOS (HITO 1.1)

Se auditó el comportamiento del regulador en ambos modos:
* **Exclusión de Buscar y Destruir:**
  En `js/main.js` se condicionó la consulta del coordinador a `gameMode !== 'waves' || offensiveCoordinator.requestPermission(e, matchTime)`.
  En consecuencia, los enemigos de Buscar y Destruir (operador desactivador y escoltas en estado `ALERT`) no sufren ninguna restricción impuesta por el coordinador de oleadas, manteniendo 100% inalteradas sus reglas, tiempos y agresividad originales.
* **Reinicio al cambiar de modo:**
  En `selectMode(mode)` y en `startGame(mode)` se ejecuta `offensiveCoordinator.reset()`, garantizando que cualquier estado residual sea purgado de la memoria.

---

### 3. JUSTICIA DISTRIBUTIVA Y PREVENCIÓN DE INANICIÓN (HITO 1.1)

#### Diagnóstico del Riesgo
En la iteración secuencial estándar `0, 1, 2, ...`, si múltiples enemigos alcanzan simultáneamente la condición de disparo (`fireTimer <= 0`), los índices menores del arreglo siempre se evaluaban primero, monopolizando los tokens y produciendo inanición en los últimos índices.

#### Solución Implementada
1. **Desplazamiento Rotativo de Evaluación (Round-Robin):**
   En cada fotograma de simulación se rota el índice inicial mediante `enemyLoopOffset = (enemyLoopOffset + 1) % Math.max(1, numEnemies)`. Ninguna entidad posee prioridad posicional estática.
2. **Restricción de Disparos Consecutivos:**
   `OffensivePressureCoordinator` registra el último tirador (`activeShooter`). Cuando existen múltiples hostiles listos, la entidad que acaba de disparar cede el turno a sus compañeros.
3. **Micro-Stagger Determinista:**
   Los enemigos aplazados reprograman su reintento mediante `0.08 + offensiveCoordinator.rng() * 0.08`, dosificando las ráfagas dentro de la ventana de 160 ms sin imponer cadencias homogéneas artificiales y respetando el cooldown base de cada arquetipo (`baseCd`).
4. **Aleatoriedad Inyectable:**
   El coordinador incorpora `setRng(fn)`, permitiendo sustituir `Math.random` por un generador pseudoaleatorio con semilla fija (Mulberry32) para validaciones automatizadas 100% reproducibles.

---

### 4. INTEGRIDAD DEL INVARIANTE Y CICLO DE VIDA DE OLEADAS

Se valida en todo fotograma activo el invariante de conservación:
$$\text{waveTotal} = \text{waveKilled} + \text{wavePending} + \text{aliveCount}$$

#### Comportamiento por Estados:
* **Inicio de Oleada:** `waveSpawnQueue` recibe los $N = 3 + \text{wave} \times 2$ enemigos. Se generan los primeros hasta alcanzar `maxConcurrent` (6, 8 o 10). `betweenWaves` pasa a `false` antes de iniciar las apariciones, garantizando que el lote inicial entre a la arena.
* **Apariciones Sucesivas:** Se dosifican secuencialmente a intervalos de `0.8 s` mediante `waveSpawnTimer`, evitando desbordamientos súbitos tras bajas múltiples.
* **Bloqueos Espaciales:** Si un punto no cumple despeje (`!pointBlocked`) o distancia ($\ge 18\text{ m}$), el enemigo no se pierde ni se duplica; permanece en cola y se reintenta en $0.2\text{ s}$ incrementando `waveSpawnRetries`.
* **Estados Terminales:**
  * Al morir el jugador (`die()`), cambiar de modo o reiniciar (`startGame`), la cola `waveSpawnQueue` se vacía de inmediato y el temporizador se cancela, impidiendo apariciones fantasma posteriores al fin de la partida.
  * La condición de cierre `aliveCount === 0 && waveSpawnQueue.length === 0 && waveKilled >= waveTotal` evita transiciones prematuras mientras existan refuerzos pendientes.

---

### 5. ARQUITECTURA DE SUSCRIPCIÓN DE MUERTE (ZERO-LEAKS)

En `js/enemies.js` se implementó `deathListeners = new Set()` con las funciones:
* `addEnemyDeathListener(fn)`: Permite múltiples observadores concurrentes sin sobrescribir callbacks de otros subsistemas.
* `setEnemyDeathListener(fn)`: Limpia y registra el listener principal del ciclo de oleadas.
* **Purga en Cascada:**
  Al morir un enemigo (`damageEnemy`), se ejecuta la notificación unificada que:
  1. Incrementa `waveKilled` si el modo es Oleadas.
  2. Ejecuta `offensiveCoordinator.releasePermission(e)`, eliminando toda referencia del enemigo en `lastShotTimeByEnemy` y vaciando `activeShooter`.
  3. Previene la retención de referencias circulares o fugas de memoria en JavaScript.

---

### 6. MEDICIONES DETALLADAS DE RENDIMIENTO Y PERFILADO

Perfilado comparativo realizado sobre 300 pasos de simulación continua (dt = 0.0166 s) en Oleada 10:

| Métrica | Base (Sin Límite) | Hito 1 & 1.1 (Controlado) | Unidad / Notas |
| :--- | :---: | :---: | :--- |
| **Entidades Vivas Concurrentes** | 23 | **10** | Límite máximo estricto para Oleada 10 |
| **Entidades en Cola Pendientes** | 0 | **13** | Dosificadas por `waveSpawnTimer` |
| **CPU de Simulación / IA (Media)** | 0.082 ms | **0.027 ms** | Reducción de coste computacional de IA |
| **CPU de Simulación / IA (Mediana)** | 0.050 ms | **0.000 ms** | Medición sub-milisegundo |
| **CPU de Simulación / IA (p95)** | 0.340 ms | **0.100 ms** | Estabilidad frente a picos |
| **CPU de Simulación / IA (p99)** | 0.850 ms | **0.300 ms** | Eliminación de bloqueos de fotograma |
| **Draw Calls (Llamadas Three.js)** | ~90–120 | **58** | Estable y constante |
| **Geometrías en Memoria** | 56 | **56** | Zero geometrías huérfanas |
| **Texturas en Memoria** | 4 | **4** | Memoria de textura inalterada |
| **Limpieza al volver al Menú** | Riesgo de leak | **0 vivos, 0 pendientes, 28 hijos base** | Purga completa verificada |

*Nota metodológica: La reducción en tiempo de CPU de la función de simulación (de 0.082 ms a 0.027 ms) optimiza el presupuesto por fotograma, pero no se extrapola como garantía absoluta de 60 FPS fijos en hardware con limitación de GPU o SwiftShader.*

---

### 7. CERTIFICACIÓN COMPLETA DE REGRESIÓN (253 PRUEBAS)

Se ampliaron las pruebas en `tests/test_sprint8_6.mjs` a 16 escenarios:
1. `1_concurrency_limit_across_waves`
2. `2_reinforcement_queue_refills_when_capacity_freed`
3. `3_zero_enemy_duplication_strict_invariant`
4. `4_wave_completion_only_when_all_enemies_eliminated`
5. `5_restart_during_active_reinforcement_queue`
6. `6_player_death_with_active_queue_stops_spawning`
7. `7_spawn_retries_resilience_without_freeze`
8. `8_offensive_coordinator_prevents_simultaneous_damage_spikes`
9. `9_offensive_token_released_on_enemy_death_or_state_change`
10. `10_compatibility_with_spatial_navigation_cover_and_fsm`
11. `11_compatibility_with_search_and_destroy_mode`
12. `12_framerate_invariance_across_30_60_120_fps`
13. `13_offensive_fairness_anti_starvation_distribution`
14. `14_mode_isolation_snd_unconstrained_by_wave_coordinator`
15. `15_deterministic_simulation_with_injectable_seed`
16. `16_death_listeners_multi_subscription_and_zero_leaks`

#### Resultado de la Suite Global (`node tests/run_all.mjs`):
```text
========================================================================================
                          RESUMEN DE PRUEBAS AUTOMATIZADAS                              
========================================================================================
[PASS] test_progression_unit.mjs      |  6 pruebas | 0.0s | Fórmulas XP, curvas 1-50 / 1-20, persistencia y catálogo
[PASS] test_progression_browser.mjs   |  7 pruebas | 22.1s | UI Armamento, categorías, XP en combate real y recarga
[PASS] test_sprint3.mjs               | 10 pruebas | 10.0s | Navegación de lobby táctico estilo Warzone, camuflajes y responsive
[PASS] test_engine_lifecycle.mjs      | 14 pruebas | 41.1s | Ciclo de vida del motor, pausas, oleadas, S&D y 10 ciclos de estabilidad
[PASS] test_sprint5.mjs               | 20 pruebas | 21.8s | 20 criterios de aceptación de armamento modular (Hito 9)
[PASS] test_sprint5_closure.mjs       |  5 pruebas | 7.5s | Cadencia, impactos mixtos M870, recarga interrumpible, persistencia
[PASS] test_memory_deep.mjs           |  6 pruebas | 16.2s | Acumulador en navegador, anti-burst, 20 swaps, 10 oleadas, 10 S&D, retry
[PASS] test_sprint6.mjs               | 22 pruebas | 23.5s | Equipamientos personalizados, P-12 Tactical, cambio en combate y regresión
[PASS] test_sprint6_1.mjs             | 14 pruebas | 69.3s | Exhibición 3D, barra de categorías tácticas, responsividad, aislamiento y memoria
[PASS] test_sprint7.mjs               | 20 pruebas | 30.6s | Sistema modular de accesorios, personalización 3D, combate, memoria WebGL y migración v3
[PASS] test_sprint8.mjs               | 20 pruebas | 13.5s | Sistema de drops, suministros, consumibles de supervivencia y memoria WebGL
[PASS] test_sprint8_1.mjs             | 15 pruebas | 16.2s | Cierre de equipamientos, gestión de clases, responsividad 768px y calibración ADS
[PASS] test_sprint8_2.mjs             | 21 pruebas | 27.0s | Arsenal completo: 5 armas nuevas, cerrojo real AWM-338, combate cuerpo a cuerpo y balance
[PASS] test_sprint8_3.mjs             | 15 pruebas | 18.5s | Animaciones procedurales, brazos tácticos, piezas mecánicas y composición visual
[PASS] test_sprint8_4.mjs             | 22 pruebas | 5.7s | Inteligencia artificial enemiga, percepción sensorial, navegación táctica A* y 5 arquetipos
[PASS] test_sprint8_5.mjs             | 20 pruebas | 4.8s | Sistema de impactos, daño localizado, blindaje táctico y respuesta de combate
[PASS] test_sprint8_6.mjs             | 16 pruebas | 2.7s | Control de concurrencia, cola de refuerzos, regulador de presión ofensiva y estabilidad
----------------------------------------------------------------------------------------
TOTAL GENERAL: 253/253 PRUEBAS PASADAS (100% OK)
========================================================================================
Código de salida: 0
```

---

### 8. ESTADO DE GIT Y RESTRICCIONES

* **Cero comentarios nuevos** en código de producción (`//`, `/* */`).
* **Cero dependencias externas** añadidas.
* **Sin alteraciones** a estadísticas de armas, multiplicadores de daño, drops, XP ni reglas de Buscar y Destruir.
* **Rama `develop`** mantenida localmente sin commits ni publicaciones remotas.
* **Rama `main`** intacta.
* **Hito 2 y Sprint 9** no iniciados.
