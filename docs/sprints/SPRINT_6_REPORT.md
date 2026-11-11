# BLACKOUT PROTOCOL — INFORME DE CIERRE DE SPRINT 6
## Equipamientos personalizados, arma secundaria y cambio de armas en combate
### Preparación de v0.2.0-alpha

- **Fecha:** 2026-11-11
- **Rama:** `develop`
- **Commit base de referencia:** `e494e47` (`feat(engine): cadence accumulator, anti-burst protection, deep memory stability and versioned test suite (Sprint 5.1)`)
- **Rama protegida intacta:** `main` (`6a29c8c`) / versión pública `v0.1.0-alpha`
- **Archivos modificados:** `js/progression.js`, `js/audio.js`, `js/weapon.js`, `js/lobby.js`, `js/main.js`, `index.html`, `css/style.css`, `tests/run_all.mjs`
- **Archivos nuevos:** `tests/test_sprint6.mjs`, `docs/sprints/SPRINT_6_REPORT.md`
- **Cumplimiento de restricciones:** Cero comentarios añadidos al código (`//`, `/* */` o `<!-- -->`), Three.js r160 intacto, cero frameworks externos, sin accesorios ni arrojadizos, sin segundo renderer, balance de MK-7 / VECTOR-9 / M870 100% preservado, sin commit ni push automático pendiente de aprobación.

---

## 1. Resumen ejecutivo

El **Sprint 6** evoluciona BLACKOUT PROTOCOL desde la selección de un arma única hacia una arquitectura completa de **clases personalizables (Loadouts)** y **combate bi-arma en tiempo real**.

Principales capacidades implementadas:
1. **Cinco clases persistentes personalizables (`loadout_1` a `loadout_5`):** Cada clase almacena nombre editable, arma principal y arma secundaria, persistiendo en `localStorage` bajo `bp_progression_v1` con esquema versionado v2 y migración retrocompatible desde v1.
2. **Nueva arma secundaria funcional (`P-12 TACTICAL`):** Pistola semiautomática calibre `.45 ACP` desbloqueable al Nivel 2 de jugador, con modelo procedural 3D, sintetizadores acústicos Web Audio propios, sistema de gatillo semiautomático puro (sin ráfaga continua al mantener presionado) y maestría XP independiente.
3. **Sistema de intercambio de armas en combate (`combatSession`):** Cambio táctico entre ranura principal (`Tecla 1`) y secundaria (`Tecla 2` o rueda del ratón) con duración de `0.32s`, intercambio de malla y estadísticas al 50% de la transición, cancelación segura de recargas y ADS sin regalar munición, bloqueo de disparo durante la animación y retención totalmente independiente de cargador, reserva y cooldown por arma.
4. **Integración completa de HUD y Lobby 3D:** Indicador de ranura activa, nombre de arma y vista previa de munición en reserva de la ranura secundaria/inactiva; barra de gestión de clases en Armamento con sincronización automática del arma mostrada en manos del operador 3D en el hangar.

---

## 2. Arquitectura de Estado en Tres Capas

Se diseñó una separación explícita entre catálogo estático, persistencia de perfil y estado volátil de sesión de combate:

1. **Capa 1 — Catálogo Estático de Armas (`WEAPONS` en `js/weapon.js`):**
   - Fuente única e inmutable de estadísticas balísticas, geometría procedural, cadencia, recarga, dispersión, ADS y generadores de audio.
   - El perfil de combate se obtiene desde `WEAPONS[id]`.

2. **Capa 2 — Equipamientos Persistentes (`ProgressionManager` en `js/progression.js`):**
   - Gestiona los 5 objetos de clase (`loadout_1`..`loadout_5`) y `selectedLoadoutId`.
   - Expone métodos transaccionales: `getLoadouts()`, `getActiveLoadout()`, `selectLoadout(id)`, `renameLoadout(id, name)`, `setLoadoutPrimary(id, weaponId)`, `setLoadoutSecondary(id, weaponId)` e `isWeaponUnlocked(weaponId, level)`.

3. **Capa 3 — Sesión de Combate Activa (`combatSession` en `js/main.js`):**
   - Estructura efímera instanciada en `startGame(mode)` a partir de `progression.getActiveLoadout()`.
   - Mantiene registros independientes para `slots.primary` y `slots.secondary`: `id`, `ammo`, `reserve`, `cooldown`, `reloading`, `reloadT`, `reloadStage`, `recoil` y `semiFired`.
   - Utiliza `setWeapon(slot.id, { preserveState: true })` para alternar el arma activa sin sobrescribir la munición consumida ni los temporizadores de sesión.

---

## 3. Modelo de Equipamientos y Migración (`js/progression.js`)

### 3.1 Estructura del Esquema v2 (`SCHEMA_VERSION = 2`)

- **Máximo de clases (`MAX_LOADOUTS`):** `5` (`loadout_1` a `loadout_5`).
- **Nombres predeterminados (`DEFAULT_LOADOUT_NAMES`):**
  1. `ASALTO 1`
  2. `ASALTO 2`
  3. `CQC TÁCTICO`
  4. `APOYO PESADO`
  5. `INFILTRACIÓN`
- **Validaciones de edición:**
  - `renameLoadout`: Elimina espacios extremos y limita a `24` caracteres; rechaza cadenas vacías (`false`).
  - `setLoadoutPrimary`: Verifica desbloqueo por nivel de jugador y prohíbe categorías `PISTOL` o `MELEE`.
  - `setLoadoutSecondary`: Verifica desbloqueo por nivel de jugador y restringe a categorías `PISTOL` o `MELEE` (o `null`).
  - **Desbloqueo automático al subir a Nivel 2:** Al cruzar a nivel ≥ 2 en `grantPlayerXP`, todas las clases con ranura secundaria vacía equipan automáticamente `p12`.

### 3.2 Migración Retrocompatible v1 → v2

En `validateAndNormalizeState(raw)`:
- Conserva íntegramente `player.xp`, `weapons[id].xp` e `history` (`kills`, `headshots`, `wavesCleared`, `sndWins`).
- Si el estado guardado carece de arreglo `loadouts` válido, inicializa las 5 clases predeterminadas y asigna `raw.selectedWeapon` como arma principal de `loadout_1`.
- Valida integridad y desbloqueo de cada arma asignada, restableciendo valores seguros (`mk7` o `null`) en caso de datos corruptos o niveles manipulados.
- Mantiene `state.selectedWeapon` sincronizado con la ranura principal de la clase seleccionada para retrocompatibilidad con herramientas y pruebas legadas.

---

## 4. Nueva Arma Secundaria: P-12 TACTICAL (`js/weapon.js`, `js/audio.js`)

### 4.1 Especificaciones Balísticas y Modelo 3D

La **P-12 TACTICAL** pasa de estado `PLANNED` a `IMPLEMENTED` en `WEAPON_CATALOG` (`reqLevel: 2`, categoría `PISTOL`, ranura `secondary`).

| Parámetro | Valor | Observación |
| :--- | :--- | :--- |
| **ID / Nombre** | `p12` / `P-12 TACTICAL` | Arma secundaria semiautomática |
| **Calibre** | `.45 ACP` | Reflejado en ficha del armero |
| **Desbloqueo** | Nivel 2 de jugador (`500 XP`) | Automático al subir de nivel |
| **Daño base** | `38 HP` | Multiplicador headshot `1.5x` (`57 HP`) |
| **Cadencia / Modo** | `0.18s` (333 RPM máx.) / `'semi'` | Requiere soltar gatillo por cada disparo |
| **Cargador / Reserva** | `12` / `48` (Oleadas) · `60` (S&D) | Recarga tipo cargador en `1.20s` |
| **Caída de daño** | `12m` óptimo → `32m` mín (`0.45x`) | Efectiva a corto-medio alcance |
| **Dispersión** | Cadera `0.014` · ADS `0.0028` | Precisión rápida en transición |
| **Movilidad / ADS** | `1.12x` (+12% velocidad) / `18.0` | Mayor agilidad táctica del arsenal |

- **Geometría Procedural (`buildP12Mesh` y `buildLobbyWeaponMesh`):** Construida con corredera (`slide`), cañón (`barrel`), armazón inferior (`frame`), empuñadura inclinada (`handle`), guardamonte (`triggerGuard`) y miras de hierro delantera y trasera (`sightF`, `sightR`). Sin fugas de geometría gracias a `geometry.dispose()` en `setWeapon()` y `setLobbyWeapon()`.

### 4.2 Disparo Semiautomático Estricto

- `shoot()` verifica `if (weapon.fireMode === 'semi' && weapon.semiFired) return;`.
- Al disparar un arma semiautomática se activa `weapon.semiFired = true`.
- `weapon.semiFired` únicamente se reinicia en el evento `mouseup` (botón `0`) o cuando `!mouseDown` en `stepSim(dt)`, garantizando **1 disparo por pulsación**.

### 4.3 Audio Procedural (`js/audio.js`)

- `sfxShotPistol()`: Estallido seco `.45 ACP` de `0.16s` mediante ruido blanco filtrado paso-bajos (4200 Hz → 400 Hz) y oscilador triangular de impacto (160 Hz → 50 Hz).
- `sfxReloadPistol()`: Secuencia mecánica trifásica de liberación, inserción y liberación de corredera (1050 Hz, 750 Hz, 1500 Hz).
- `sfxWeaponSwap()`: Deslizamiento textil/funda paso-banda (1800 Hz) más clic metálico de seguro (1200 Hz).

---

## 5. Contrato de Cambio de Arma en Combate (`js/main.js`)

La transición se orquesta en `switchWeaponSlot(targetSlot)` y `stepSim(dt)`:

1. **Precondiciones obligatorias:**
   - Permitido únicamente si `phase === 'PLAYING'` y `player.alive === true`. Bloqueado explícitamente durante pausa (`PAUSED`) o muerte (`K.I.A.`).
   - Ignorado si ya hay una transición activa (`combatSession.switching === true`), si la ranura destino es igual a la activa o si la ranura destino carece de arma (`!target.id`).

2. **Cancelaciones seguras y aislamiento al iniciar transición:**
   - Guarda el estado vivo del arma actual en su ranura mediante `syncActiveWeaponToSlot()`.
   - Cancela inmediatamente cualquier recarga en curso (`weapon.reloading = false`, `reloadT = 0`, `reloadStage = 'idle'`) tanto en `weapon` como en el slot activo, impidiendo recargas gratuitas o incompletas.
   - Fuerza salida inmediata de apuntado (`adsDown = false`, `adsAmount = 0`).
   - Inicia bloqueo de transición (`combatSession.switching = true`, `switchTimer = 0.32s`) y reproduce `sfxWeaponSwap()`.

3. **Ejecución de la transición (`stepSim(dt)`):**
   - `shoot()` y `tryReload()` rechazan toda ejecución mientras `combatSession.switching || combatSession.switchTimer > 0`.
   - `gunGroup` ejecuta un descenso vertical y cabeceo sinusoidal suave (`dip = Math.sin(switchProgress * Math.PI) * 0.28`).
   - Al cruzar el punto medio (`switchTimer <= switchDuration * 0.5`), cambia `combatSession.activeSlot`, invoca `syncSlotToActiveWeapon(activeSlot)` (cargando modelo 3D, munición, reserva y cooldown independientes) y actualiza el HUD.
   - Al alcanzar `switchTimer <= 0`, libera el bloqueo de combate (`switching = false`).

4. **Atribución exacta de XP de arma:**
   - En `shoot()`, las bajas registran XP directamente contra el identificador real del arma que disparó (`combatSession.slots[combatSession.activeSlot]?.id || weapon.id`).

---

## 6. Integración en Interfaz (HUD y Armamento) y Operador 3D

- **HUD de Combate (`index.html`, `css/style.css`, `js/main.js`):**
  - `#weapon-slot-badge`: Muestra `[ 1 ] PRINCIPAL` o `[ 2 ] SECUNDARIA`.
  - `#ammo-num`: Muestra `--` durante el cambio de arma y el conteo real al finalizar la transición.
  - `#sec-preview` (`#sec-slot-name` y `#sec-slot-ammo`): Muestra permanentemente el nombre y munición (`ammo / reserve`) del arma en la ranura alternativa (`VACÍA` / `-- / --` si aún no está equipada).
  - `#lobby-keys`: Añadida guía rápida `1 / 2 Arma Principal / Secundaria`.
- **Gestor de Clases en Armamento (`#loadouts-bar`):**
  - Selector de las 5 clases (`.loadout-tab-btn` con indicador `★` y borde inferior verde `.deploy-active` para la clase activa de despliegue).
  - Entrada `#loadout-name-input` para renombrar la clase en tiempo real (máx. 24 caracteres).
  - Botón `#btn-select-loadout` (`DESPLEGAR CON ESTA CLASE`) y etiqueta de confirmación `#loadout-deploy-status`.
  - Botones de ranura `#btn-slot-primary` y `#btn-slot-secondary` sincronizados bidireccionalmente con la barra de categorías `#armory-cat-nav`.
- **Operador 3D en Hangar (`js/lobby.js`, `js/main.js`):**
  - `getLobbyWeaponId()` y la suscripción a `progression` aseguran que el operador 3D en el hangar sostenga siempre el arma principal de la clase activa de despliegue.

---

## 7. Resultados de Validación Automatizada (90/90 PASS)

Se ejecutó la suite unificada completa `node tests/run_all.mjs` sobre Node.js v24 y Google Chrome Headless (CDP) tras el último ajuste en [js/main.js](file:///c:/Users/YAMI/projects/game/js/main.js).

### 7.1 Suite Específica de Sprint 6 (`tests/test_sprint6.mjs`, 22/22 PASS en 23.6s)

| Criterio | Prueba | Resultado | Validación Comprobada |
| :---: | :--- | :---: | :--- |
| **1** | `create_five_loadouts` | **PASS** | Se crean 5 clases (`loadout_1`..`loadout_5`), principal `mk7`, secundaria `null` en Nivel 1 |
| **2** | `migration_v1_to_v2` | **PASS** | Esquema v1 migra a v2 preservando XP jugador, XP armas, historial y `selectedWeapon` |
| **3** | `persistence_reload` | **PASS** | Nombres y clase seleccionada persisten tras recargar (`progression.init()`) |
| **4** | `rename_loadout` | **PASS** | Renombrado válido persiste; cadenas en blanco son rechazadas (`false`) |
| **5** | `primary_slot_valid_weapons` | **PASS** | `vector9` / `m870` aceptadas como principal; `p12` / `knife` rechazadas (`false`) |
| **6** | `secondary_slot_locked_at_lvl_1` | **PASS** | Imposible asignar `p12` a ranura secundaria en Nivel 1 |
| **7** | `p12_unlocks_at_lvl_2` | **PASS** | Con 500 XP se desbloquea `p12` (Nivel 2) y permite asignación secundaria |
| **8** | `p12_semi_automatic_behavior` | **PASS** | Mantener pulsado no dispara en ráfaga; requiere soltar gatillo (`semiFired = false`) |
| **9** | `combat_switch_primary_secondary` | **PASS** | Teclas `1` y `2` alternan arma activa, malla 3D y badge en HUD |
| **10** | `switch_cancels_reload_safely` | **PASS** | Cambiar durante recarga cancela la recarga sin otorgar munición gratuita |
| **11** | `independent_ammo_retention` | **PASS** | Cargadores independientes exactos (25 en MK-7, 9 en P-12) y vista previa en HUD |
| **12** | `independent_cooldowns` | **PASS** | Cambio guarda cooldown restante en ranura origen sin reiniciar demora |
| **13** | `switch_cancels_ads` | **PASS** | Iniciar cambio fuerza salida inmediata de mira (`adsDown = false`, `adsAmount = 0`) |
| **14** | `block_fire_during_switch` | **PASS** | `shoot()` ignora disparos mientras `combatSession.switching === true` |
| **15** | `prohibit_switch_in_pause` | **PASS** | `switchWeaponSlot` bloqueado en `PAUSED` y funcional al reanudar |
| **16** | `prohibit_switch_on_death` | **PASS** | `switchWeaponSlot` retorna `false` tras caer `K.I.A.` |
| **17** | `xp_attributed_to_firing_weapon` | **PASS** | Bajas con MK-7 otorgan XP solo a `mk7`; bajas con P-12 solo a `p12` |
| **18** | `lobby_operator_weapon_sync` | **PASS** | Operador 3D en hangar actualiza arma mostrada según clase de despliegue activa |
| **19** | `ten_weapon_swaps_memory_stability` | **PASS** | Swaps temporizados, 20 swaps rápidos y ciclos de partida con crecimiento `+0` en geometrías/texturas |
| **20** | `waves_mode_regression` | **PASS** | Inicio Oleadas, eliminación de enemigos, resumen de oleada y retorno a menú |
| **21** | `snd_mode_regression` | **PASS** | Inicio Buscar y Destruir con `reserveSnd`, detonación de bomba y retorno a menú |
| **22** | `zero_javascript_errors` | **PASS** | Cero excepciones o errores en consola durante toda la batería |

### 7.2 Resultado Global Unificado (`node tests/run_all.mjs`)

| Suite | Archivo | Pruebas | Pasadas | Tiempo | Ámbito |
| :--- | :--- | :---: | :---: | :---: | :--- |
| Progresión Unit | `tests/test_progression_unit.mjs` | 6 | 6 | 0.0s | Fórmulas XP, curvas 1–50 / 1–20, persistencia y catálogo |
| Progresión Browser | `tests/test_progression_browser.mjs` | 7 | 7 | 22.0s | UI Armamento, categorías, XP en combate real y recarga |
| Lobby Táctico | `tests/test_sprint3.mjs` | 10 | 10 | 10.1s | Navegación de lobby táctico, camuflajes, despliegue y responsive |
| Ciclo de Vida Motor | `tests/test_engine_lifecycle.mjs` | 14 | 14 | 41.4s | Pausas, oleadas, S&D, muerte/reintento y estabilidad |
| Armamento Modular | `tests/test_sprint5.mjs` | 20 | 20 | 21.8s | 20 criterios de aceptación MK-7, Vector-9, M870 y fugas |
| Cierre Sprint 5.1 | `tests/test_sprint5_closure.mjs` | 5 | 5 | 7.7s | Cadencia 30/60/120 FPS, impactos mixtos M870, recarga, fugas |
| Memoria Profunda | `tests/test_memory_deep.mjs` | 6 | 6 | 16.0s | Acumulador, anti-burst, 20 swaps, 10 oleadas, 10 S&D, retry |
| Sprint 6 Loadouts & Secundaria | `tests/test_sprint6.mjs` | 22 | 22 | 23.6s | 5 equipamientos, P-12 Tactical, cambio en combate y regresión |
| **TOTAL GENERAL** | **`tests/run_all.mjs`** | **90** | **90** | **142.6s** | **100% OK (0 fallos)** |

---

## 8. Inventario de Archivos y Verificación de Restricciones

- **`js/progression.js`:** Esquema `SCHEMA_VERSION = 2`, `MAX_LOADOUTS = 5`, migración v1→v2, P-12 marcada como `IMPLEMENTED`, API completa de loadouts, `isWeaponUnlocked` e `init()`.
- **`js/audio.js`:** Generadores Web Audio `sfxShotPistol()`, `sfxReloadPistol()` y `sfxWeaponSwap()`.
- **`js/weapon.js`:** `buildP12Mesh()`, registro `WEAPONS.p12`, soporte `{ preserveState }` en `setWeapon()`, factor headshot `1.5x` en `getDamageWithDropoff()` y geometría P-12 en `buildLobbyWeaponMesh()`.
- **`js/lobby.js`:** Exportación de `getLobbyWeaponId()` para inspeccionar el arma sostenida por el operador 3D.
- **`js/main.js`:** Estado `combatSession`, `switchWeaponSlot()`, `syncActiveWeaponToSlot()`, `syncSlotToActiveWeapon()`, controles `1`/`2`/rueda, latch semiautomático, bloqueo en transición, animación de transición, atribución de XP por arma disparadora, UI `#loadouts-bar` y actualización del HUD.
- **`index.html` y `css/style.css`:** Estructura y estilos para `#loadouts-bar`, selector de ranuras, insignia `#weapon-slot-badge`, vista secundaria `#sec-preview` y guía de teclado.
- **`tests/test_sprint6.mjs` y `tests/run_all.mjs`:** Nueva suite de 22 pruebas versionada e integrada en el corredor maestro (90 pruebas totales).

**Auditoría de comentarios:** Validado sobre el diff completo mediante búsqueda de patrones (`//`, `/*`, `<!--`): **0 comentarios añadidos** en los archivos de código, estilos, HTML y pruebas.

---

## 9. Riesgos Identificados y Estado para v0.2.0-alpha

1. **Riesgo:** Decals de disparos enemigos sobre muros durante partidas prolongadas acumulan geometrías transitorias hasta el límite del búfer circular (`decals.length <= 60` en `js/effects.js`).
   - **Mitigación:** `resetEffects()` limpia y llama `dispose()` completo al salir o reiniciar partida; las métricas de swaps repetidos de arma mantienen crecimiento estricto `+0`.
2. **Riesgo:** El jugador en Nivel 1 comienza sin arma secundaria (`secondary: null`) hasta alcanzar 500 XP (Nivel 2).
   - **Mitigación:** Al alcanzar Nivel 2, `grantPlayerXP()` autoequipa `p12` en cualquier clase que tenga la ranura secundaria vacía, permitiendo uso inmediato tras la subida de nivel o despliegue posterior.
3. **Estado de Git:** Cambios preparados en árbol de trabajo sobre `develop` (sin commit ni push realizados, en espera de autorización para confirmar commit de cierre de Sprint 6 y preparar lanzamiento `v0.2.0-alpha`).

