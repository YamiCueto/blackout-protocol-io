# INFORME TÉCNICO DE CIERRE — SPRINT 8
## Sistema de drops, suministros y supervivencia en combate

**Proyecto:** BLACKOUT PROTOCOL  
**Repositorio:** YamiCueto/blackout-protocol-io  
**Directorio de trabajo:** `C:\Users\YAMI\projects\game`  
**Rama:** `develop`  
**Commit base:** `47fcff29f74d632414c0c0f8fa81a02f26d1c08a`  
**Estado de la suite de pruebas:** 144/144 aprobadas (100% OK)  
**Fecha de finalización:** 2026-11-13  

---

## 1. RESUMEN EJECUTIVO

El Sprint 8 implementa de forma integral la capa de supervivencia táctica para **BLACKOUT PROTOCOL**. Permite al operador sostener combates prolongados en el modo Oleadas mediante el despliegue procedural y limitado de suministros (`ammo_pack`, `medkit`, `stim`), mientras preserva las restricciones competitivas del modo Buscar y Destruir.

La arquitectura cumple estrictamente todos los requisitos directivos:
1. **Desacoplamiento total del dominio:** `js/drops.js`, `js/supplies.js` y `js/consumables.js` son módulos puros sin dependencias de Three.js ni del DOM, garantizando pruebas unitarias y deterministas.
2. **Representación gráfica centralizada:** Las mallas, animaciones y materiales de los paquetes en el suelo se gestionan exclusivamente en `js/drop-visuals.js` mediante sincronización por ID de entidad.
3. **Estabilidad de memoria WebGL:** Se emplean geometrías compartidas a nivel de módulo marcadas con `userData.shared = true`. Las mallas instanciadas comparten geometrías fijas sin fuga de memoria en ciclos continuos de aparición y expiración.
4. **Coherencia balística y munición:** Fuente única de verdad consolidada en `combatSession.slots`. Los suministros de munición respetan los topes máximos por ranura calculados dinámicamente según accesorios instalados (cargadores ampliados o estándar), sin duplicar balas en recámara ni interrumpir recargas por cartucho (M870).
5. **Mecanismo anti-agotamiento absoluto:** En Oleadas, si ambas armas agotan completamente su munición disponible y de reserva, el sistema genera de forma controlada y con enfriamiento de 45s un paquete de munición de emergencia radialmente accesible, impidiendo el bloqueo pasivo de la partida.
6. **Tiempo simulado estricto:** La vida de los drops, canalización del botiquín (1.8s), duración del estimulante (8.0s) y su enfriamiento (12.0s) avanzan únicamente con el delta de simulación (`dt`), deteniéndose completamente al pausar el juego.

---

## 2. ARQUITECTURA DE MÓDULOS

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BLACKOUT PROTOCOL                             │
│                              Sprint 8                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ js/supplies.js   │      │ js/drops.js      │      │ js/consumables.js│
│ - SUPPLY_CATALOG │      │ - DropsManager   │      │ - Pure state     │
│ - INVENTORY_CAPS │      │ - PRNG / Pity    │      │ - Channeling dt  │
│ - MODE_RULES     │      │ - Spatial bounds │      │ - Stim timers    │
│ - Drop chances   │      │ - Emergency ammo │      │ - Mobility mult  │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         └────────────────┐        │        ┌────────────────┘
                          ▼        ▼        ▼
                   ┌─────────────────────────────────┐
                   │           js/main.js            │
                   │ - Loop de simulación (stepSim)  │
                   │ - combatSession.slots (Ammo SS) │
                   │ - Entrada e interacciones E/F/G │
                   │ - HUD y señales audiovisuales   │
                   └────────────────┬────────────────┘
                                    │
                                    ▼
                   ┌─────────────────────────────────┐
                   │      js/drop-visuals.js         │
                   │ - Shared Drop Geometries        │
                   │ - Mesh pooling by dropId        │
                   │ - Bobbing & Rotation            │
                   │ - Zero WebGL Leaks              │
                   └─────────────────────────────────┘
```

### 2.1 Catálogo de suministros (`js/supplies.js`)
Define los contratos inmutables de los suministros:
- `ammo_pack`:
  - Tipo: `ammo`.
  - Recarga por defecto: 75% del cargador por arma.
  - Fracciones por categoría: `ASSAULT: 0.75` (MK-7: +23), `SMG: 0.85` (VECTOR-9: +28), `SHOTGUN: 0.80` (M870: +5), `PISTOL: 1.00` (P-12: +12).
  - Recogida automática al situarse a $\le 1.35\,\text{m}$ o manual con `[E]` a $\le 2.20\,\text{m}$.
- `medkit`:
  - Tipo: `consumable`.
  - Capacidad máxima de inventario: 2 unidades.
  - Canalización: 1.8 segundos continuos sin sprint excesivo ni daño letal.
  - Curación: +50 HP (hasta el límite de 100 HP). Se consume el botiquín del inventario únicamente al finalizar con éxito la canalización.
- `stim`:
  - Tipo: `consumable`.
  - Capacidad máxima de inventario: 2 unidades.
  - Activación instantánea con tecla `[G]`: +20 HP de curación inmediata.
  - Modificador de movilidad: $\times 1.25$ de velocidad durante 8.0 segundos.
  - Enfriamiento: 12.0 segundos tras el uso antes de permitir la activación del siguiente.

### 2.2 Reglas por modo de juego
- **Oleadas (`waves`):**
  - Probabilidad base por baja: 35% de drop.
  - Si la munición del jugador es baja ($\le 1$ cargador): probabilidad aumentada al 60%.
  - Distribución de bajas: 60% Munición, 25% Botiquín, 15% Estimulante.
  - Límite simultáneo en arena: 8 drops activos.
  - Tiempo de vida de paquetes en el suelo: 35.0 segundos.
  - Suministro de emergencia: activo cuando la munición activa y de reserva de ambas ranuras es 0.
- **Buscar y Destruir (`snd`):**
  - Economía restrictiva estricta: 0% botiquines, 0% estimulantes.
  - Probabilidad de munición por baja: 10% fija.
  - Límite simultáneo en arena: 3 drops activos.
  - Tiempo de vida de paquetes: 20.0 segundos.
  - Suministro de emergencia: desactivado.

---

## 3. INTEGRACIÓN CON SISTEMAS PREVIOS

### 3.1 Coherencia balística y recargas
- `combatSession.slots` actúa como única fuente de verdad. `refillSlotReserve(slotKey, amount)` valida el límite superior de reserva obtenido a través de `getSlotMaxReserve(slotKey)` (que consulta las estadísticas efectivas tras aplicar accesorios de cargador).
- La recogida de munición durante la recarga de cartuchos de la escopeta M870 no reinicia el temporizador ni rompe el estado de inserción.
- Cambiar de arma durante una recogida actualiza inmediatamente la reserva de la ranura inactiva sin sobrescribir la munición en recámara.

### 3.2 Interfaz de usuario táctica y HUD
- Se agregaron paneles SVG/HTML semánticos en `index.html` estilizados en `css/style.css`:
  - Ranura de Botiquín `[F]` con contador `X/2` y barra de progreso de canalización.
  - Ranura de Estimulante `[G]` con contador `X/2` e indicador dinámico de duración y enfriamiento.
  - Indicador flotante `[E] RECOGER <SUMINISTRO>` con detección de estado lleno.
- Los paneles se adaptan proporcionalmente en resoluciones 1920×1080, 1280×720 y 1024×768.

---

## 4. ESTABILIDAD DE MEMORIA WEBGL

Se implementó una arquitectura de geometrías compartidas a nivel de módulo en `js/drop-visuals.js`:
- Caja metálica verde oliva con banda amarilla para `ammo_pack`.
- Estuche militar blanco/gris con cruz de socorro roja para `medkit`.
- Cilindro presurizado con ampolla luminiscente cian para `stim`.
- Todas las geometrías están marcadas con `userData.shared = true`.
- Durante las pruebas de estrés (20 apariciones y limpiezas sucesivas de paquetes), el contador del renderizador `renderer.info.memory.geometries` se mantiene completamente plano, garantizando cero fugas de memoria.

---

## 5. MATRIZ DE PRUEBAS AUTOMATIZADAS (144/144 APROBADAS)

La suite global `node tests/run_all.mjs` valida 11 suites consecutivas con 144 pruebas aprobadas al 100%:

| Suite | Pruebas | Tiempo | Estado | Cobertura |
|---|:---:|:---:|:---:|---|
| `test_progression_unit.mjs` | 6 | 0.0s | **PASS** | Fórmulas XP, curvas 1-50 / 1-20, persistencia y catálogo |
| `test_progression_browser.mjs` | 7 | 22.2s | **PASS** | UI Armamento, categorías, XP en combate real y recarga |
| `test_sprint3.mjs` | 10 | 10.1s | **PASS** | Navegación de lobby táctico estilo Warzone, camuflajes y responsive |
| `test_engine_lifecycle.mjs` | 14 | 41.1s | **PASS** | Ciclo de vida del motor, pausas, oleadas, S&D y 10 ciclos de estabilidad |
| `test_sprint5.mjs` | 20 | 21.7s | **PASS** | 20 criterios de aceptación de armamento modular (Hito 9) |
| `test_sprint5_closure.mjs` | 5 | 7.5s | **PASS** | Cadencia, impactos mixtos M870, recarga interrumpible, persistencia |
| `test_memory_deep.mjs` | 6 | 16.3s | **PASS** | Acumulador en navegador, anti-burst, 20 swaps, 10 oleadas, 10 S&D |
| `test_sprint6.mjs` | 22 | 23.5s | **PASS** | Equipamientos personalizados, P-12 Tactical, cambio en combate |
| `test_sprint6_1.mjs` | 14 | 69.7s | **PASS** | Exhibición 3D, barra de categorías tácticas, responsividad, aislamiento |
| `test_sprint7.mjs` | 20 | 31.0s | **PASS** | Sistema modular de accesorios, personalización 3D, combate, memoria WebGL |
| `test_sprint8.mjs` | 20 | 13.7s | **PASS** | Drops, suministros, consumibles de supervivencia y memoria WebGL |
| **TOTAL GENERAL** | **144** | **~256s** | **PASS** | **100% de criterios aprobados sin regresiones** |

### Desglose específico de `test_sprint8.mjs` (20/20):
1. `1_catalog_declarative_contracts_and_rules`: Validación del catálogo inmutable y reglas de modo.
2. `2_deterministic_drop_prng_and_chances`: Frecuencias y ponderaciones de drops según munición del jugador.
3. `3_spatial_collision_validation_and_fallback`: Búsqueda radial para evitar zonas bloqueadas o fuera de límites.
4. `4_max_active_drops_enforcement`: Descarte del paquete más antiguo al superar el límite de 8 drops.
5. `5_drop_ttl_and_simulated_time_expiration`: Expiración de paquetes por tiempo de vida simulado.
6. `6_pause_stops_simulated_timers`: Inmunidad de temporizadores durante la pausa del juego.
7. `7_pickup_interaction_distance_threshold`: Umbral de interacción manual a $\le 2.20\,\text{m}$.
8. `8_ammo_auto_pickup_threshold`: Umbral de recogida automática de munición a $\le 1.35\,\text{m}$.
9. `9_inventory_limits_enforcement`: Límite máximo de 2 unidades por consumible y aviso de inventario lleno.
10. `10_reserve_caps_and_no_duplication`: Límite estricto de reserva y cero duplicación en recámara.
11. `11_ammo_pickup_during_weapon_switch`: Integridad de munición al recibir suministros durante el cambio de arma.
12. `12_m870_shell_reload_interruption_immunity_with_refill`: No interrupción de inserción de cartuchos por reabastecimiento.
13. `13_absolute_ammo_exhaustion_emergency_drop`: Generación de suministro de emergencia tras agotamiento total en Oleadas.
14. `14_medkit_channeling_healing_and_cancellation`: Canalización de 1.8s, curación de +50 HP y retención tras cancelación.
15. `15_stim_activation_speed_buff_and_cooldown`: Activación de estimulante, +20 HP, velocidad $\times 1.25$ y enfriamiento de 12s.
16. `16_death_and_restart_cleanup_isolation`: Reinicio limpio de consumibles e inventario al morir o reiniciar partida.
17. `17_back_to_menu_and_mode_switch_isolation`: Destrucción completa de drops y mallas al salir al menú principal.
18. `18_snd_restrictive_economy_and_prohibitions`: Prohibición total de botiquines y estimulantes en Buscar y Destruir.
19. `19_webgl_shared_geometries_and_leak_free_memory`: Cero fugas de geometrías WebGL en 20 ciclos continuos.
20. `20_responsive_hud_screenshots_and_interaction_capture`: Verificación de renderizado y captura visual responsive.

---

## 6. EVIDENCIAS VISUALES

Se capturaron las pantallas de combate e interfaz en las resoluciones objetivo:
- [supplies_hud_1920x1080.png](file:///c:/Users/YAMI/projects/game/docs/assets/screenshots/sprint8/supplies_hud_1920x1080.png) (1920×1080)
- [supplies_hud_1280x720.png](file:///c:/Users/YAMI/projects/game/docs/assets/screenshots/sprint8/supplies_hud_1280x720.png) (1280×720)
- [supplies_hud_1024x768.png](file:///c:/Users/YAMI/projects/game/docs/assets/screenshots/sprint8/supplies_hud_1024x768.png) (1024×768)

---

## 7. AUDITORÍA DE CÓDIGO Y ESTADO DE GIT

- **Comentarios en el código:** Se verificó mediante búsqueda de expresiones regulares (`(^|\s)//|/\*|<!--`) que los archivos nuevos (`js/supplies.js`, `js/consumables.js`, `js/drops.js`, `js/drop-visuals.js`, `tests/test_sprint8.mjs`) y las modificaciones introducidas en `js/main.js`, `js/audio.js`, `index.html` y `css/style.css` cuentan con **CERO comentarios añadidos**.
- **Estado de Git:**
  - Rama: `develop`
  - Commit base: `47fcff2` (Sprint 7)
  - Árbol de trabajo consistente y listo para commit bajo autorización.
