# BLACKOUT PROTOCOL — INFORME TÉCNICO DE SPRINT 6.1
## Exhibición 3D independiente de armamento, navegación táctica de categorías y diagnóstico de estabilidad WebGL
### Refinamiento visual y estabilización previos a `v0.2.0-alpha`

- **Fecha:** 2026-11-11
- **Rama activa:** `develop`
- **Commit base de referencia:** `a89686c` (`feat(loadouts): custom loadouts, P-12 Tactical secondary weapon, combat weapon swap and Sprint 6 report (Sprint 6)`)
- **Rama protegida intacta:** `main` (`6a29c8c`) / versión pública `v0.1.0-alpha`
- **Archivos modificados:** `js/weapon.js`, `js/lobby.js`, `js/main.js`, `index.html`, `css/style.css`, `tests/run_all.mjs`, `tests/test_memory_deep.mjs`
- **Archivos nuevos:** `tests/test_sprint6_1.mjs`, `docs/sprints/SPRINT_6_1_REPORT.md`, `docs/assets/screenshots/sprint6_1/*.png` (14 capturas de validación visual)
- **Restricciones verificadas:** Cero comentarios añadidos al código (`//`, `/* */` o `<!-- -->`), único `WebGLRenderer` compartido, cero fugas de geometrías o texturas, sin mutación de equipamientos durante la inspección, sin relajación de aserciones de estabilidad, cierre confirmado localmente en `develop` sin `git push` ni publicación de versión.

---

## 1. Resumen ejecutivo

El **Sprint 6.1** consolida la pestaña `ARMAMENTO` (`#tab-loadout`) como una **exhibición 3D independiente de armamento** junto con el refinamiento de navegación horizontal de categorías y la auditoría completa de inicialización/memoria WebGL:

1. **Separación visual Operador vs. Exhibición (`js/lobby.js`, `js/main.js`):** Al entrar a `ARMAMENTO` (`switchTab('loadout')` / `setLobbyView('loadout')`), el operador 3D se oculta (`operator.visible = false`) y se activan `showcaseRoot` y su iluminación de estudio `showcaseLights` para presentar en exclusiva el arma inspeccionada. Al regresar a `JUGAR` u `OPERADOR`, `operator.visible` se restaura mostrando el arma principal del despliegue activo (`progression.getActiveLoadout().primary`), mientras `showcaseRoot` y `showcaseLights` vuelven a ocultarse.
2. **Coexistencia de los 9 modelos del catálogo con identidad visual de prototipos (`js/weapon.js`):** Todas las armas jugables (`mk7`, `vector9`, `m870`, `p12`) y las 5 armas `PLANNED` (`ak12`, `mp5k`, `mk48`, `awm338`, `knife`) disponen de mallas diferenciadas generadas por `buildShowcaseWeaponMesh(id, options)`. Los prototipos utilizan materiales blueprint/wireframe (`protoBody`, `protoAccent`, `protoWire`) acompañados de etiquetas explícitas (`PROTOTIPO // EN DESARROLLO`, `CONCEPTO VISUAL NO JUGABLE — SOLO EXHIBICIÓN`).
3. **Encuadre responsivo automático sin recortes (`js/lobby.js`):** Cada modelo se escala proporcionalmente a su categoría (`SHOWCASE_SPANS`) y se centra dinámicamente en el espacio libre a la derecha de `.loadout-panel` y debajo de `#lobby-header` mediante `recomputeShowcaseFraming()` y `applyShowcaseCameraTargets()`, validado en `1920×1080`, `1280×720`, `1024×768` y `768×1024`.
4. **Inspección 3D aislada (`js/main.js`, `css/style.css`):** `#armory-showcase-stage` captura arrastre orbital (`rotateShowcase`), zoom limitado por rueda (`zoomShowcase`), doble clic y botón `RECENTRAR VISTA` (`#btn-showcase-reset`) con `{ passive: false }` en `wheel`, sin interferir con el scroll vertical de `.loadout-panel`, la barra de categorías ni el cambio de arma en combate.
5. **Barra horizontal de categorías táctica (`index.html`, `css/style.css`, `js/main.js`):** `#armory-cat-bar` envuelve `#armory-cat-nav` con flechas laterales (`#armory-cat-prev`, `#armory-cat-next`), desplazamiento suave sin alterar la selección al desplazarse, soporte completo para rueda vertical/horizontal, trackpad y gestos táctiles (`touch-action: pan-x`), auto-centrado horizontal de la categoría activa (`ensureActiveCategoryVisible`), deshabilitación automática en los extremos e indicador inferior naranja intacto.
6. **Diferenciación explícita de 3 estados (`index.html`, `js/main.js`, `css/style.css`):** El visor distingue simultáneamente el arma en **inspección** (`#showcase-hud-top`), la clase en **edición** (`#ctx-editing-card`) y la clase de **despliegue activo** (`#ctx-deploy-card` con `★`).
7. **Corrección del encuadre del operador (`js/lobby.js`):** Se calibraron los presets de cámara para `play` (`targetCam = (0.12, 1.28, 3.30)`, `targetLook = (0.68, 1.10, 0)`) y `operator` (`targetCam = (0.24, 1.20, 3.30)`, `targetLook = (0.64, 1.08, -0.05)`) mediante `projectObjectScreenBounds()`, garantizando visibilidad completa de casco a botas sin solapes.
8. **Ciclo de vida del visor y diagnóstico de memoria (`js/lobby.js`, `js/main.js`, `tests/test_memory_deep.mjs`):** `setShowcaseWeapon()` incorpora guarda de identidad para evitar reconstrucciones redundantes al entrar o alternar menús (`0` reconstrucciones verificadas por UUID), y `tests/test_memory_deep.mjs` documenta mediante una fase controlada de calentamiento la inicialización diferida legítima de `+37` geometrías estáticas de combate sin relajar ninguna aserción de estabilidad (**104/104 PASS**).

---

## 2. Arquitectura 3D de Exhibición, Prototipos e Iluminación (`js/weapon.js`, `js/lobby.js`)

### 2.1 Catálogo visual completo (9 armas) y gestión de materiales

En `js/weapon.js` se definieron cuatro materiales compartidos a nivel de módulo para reutilización continua sin creación por fotograma:

| Material | Propiedades clave | Uso |
| :--- | :--- | :--- |
| `metalBright` | `color: 0x67707d`, `roughness: 0.32`, `metalness: 0.88` | Realce especular de partes metálicas de armas `IMPLEMENTED` en exhibición |
| `protoBody` | `color: 0x1e3a52`, `emissive: 0x0d3b5c`, `emissiveIntensity: 0.55`, `opacity: 0.86`, `transparent: true` | Cuerpo técnico semitransparente de prototipos `PLANNED` |
| `protoAccent` | `color: 0x38bdf8`, `emissive: 0x0ea5e9`, `emissiveIntensity: 0.75` | Ópticas, bípodes, bocachas y acentos de silueta prototipo |
| `protoWire` | `color: 0x7dd3fc`, `wireframe: true`, `opacity: 0.28`, `transparent: true` | Malla wireframe superpuesta de lectura CAD/blueprint |

- **`WEAPONS` jugables (`mk7`, `vector9`, `m870`, `p12`):** Se construyen con `WEAPONS[id].buildMesh()`, rotadas `-Math.PI / 2` sobre el eje Y y sustituyendo el material `metal` base por `metalBright` únicamente dentro de `buildShowcaseWeaponMesh(id, options)`.
- **Prototipos `PLANNED` (`ak12`, `mp5k`, `mk48`, `awm338`, `knife`):** Definidos en `PROTO_SPECS` e instanciados por `buildProtoFromSpec(parts)` con primitivas diferenciadas por silueta (`awm338` con mira telescópica y bípode, `mk48` con caja de munición lateral y bípode, `mp5k` compacta con cargador curvo, `knife` con hoja y guarda, `ak12` con freno de boca y culata).

### 2.2 Iluminación de estudio optimizada y prevención de reconstrucciones

`js/lobby.js` mantiene el único `WebGLRenderer` importado desde `core.js` y ubica la exhibición en `SHOWCASE_ORIGIN = (-0.15, 1.48, 0.55)` dentro de `lobbyScene`, conservando la iluminación táctica base del hangar (`HemisphereLight`, `keyLight` con sombras, `fillLight`, `rimLight`, `warmLight`) y activando un rig conciso de 3 luces en `showcaseLights` exclusivamente cuando `currentLobbyView === 'loadout'`:

| Luz en `showcaseLights` | Tipo / Color | Intensidad | Posición | Función |
| :--- | :--- | :---: | :--- | :--- |
| `studioKey` | `DirectionalLight(0xf8fafc)` | `3.35` (`2.75` prototipo / `2.65` bloqueada) | `(-0.4, 2.2, 3.8)` | Luz frontal principal hacia `studioTarget` sobre perfil y receptor |
| `studioBackBounce` | `DirectionalLight(0xcbd5e1)` | `2.35` | `(1.1, -0.45, -2.8)` | Relleno trasero e inferior al rotar `360°` en horizontal |
| `studioRim` | `PointLight` dinámico | `9.5` desbloqueada (`9.0` bloqueada / `10.0` prototipo, alcance `6.5`) | `(-0.15, 2.45, -0.85)` | Contraluz superior/lateral cromática (`0x38bdf8` normal, `0xef4444` bloqueada, `0x0ea5e9` prototipo) |

Esta configuración de 3 luces reduce la carga por fragmento en renderizado por software respecto a añadir múltiples direccionales redundantes y mantiene contraste legible tanto de frente como en ángulos rotados (`armory_mk7_rotated_1280x720.png`).

Para garantizar estabilidad de geometrías:
- `disposeHierarchyGeometries(root)` (`js/weapon.js`) recopila en un `Set` todas las geometrías únicas antes de invocar `g.dispose()`, evitando doble liberación en prototipos con malla sólida y wireframe compartida.
- `setShowcaseWeapon(weaponId, options)` (`js/lobby.js`) implementa una guarda de identidad equivalente a `setLobbyWeapon`: si `showcaseHolder.children.length > 0` y coinciden `(weaponId, status, implementation)`, actualiza únicamente `updateShowcaseLights(options)` y retorna sin destruir ni reconstruir geometrías.
- En `js/main.js` se eliminaron llamadas duplicadas a `renderInspectedWeapon()` inmediatamente después de `renderArmoryWeapons()` (que ya invoca `renderInspectedWeapon()`) y se retiró la reconstrucción redundante del armamento dentro de `backToMenu()` cuando el usuario vuelve a la pestaña `JUGAR`.

---

## 3. Encuadre Responsivo, Interacción y Navegación de Categorías

### 3.1 Escalado por envergadura y centrado dinámico

En `setShowcaseWeapon(weaponId, options)`, la caja delimitadora real se normaliza al parámetro `SHOWCASE_SPANS[id]`:

| Arma | Envergadura normalizada (`SHOWCASE_SPANS`) | Estado en catálogo |
| :--- | :---: | :--- |
| `knife` | `0.68` | `PLANNED` (Prototipo) |
| `p12` | `0.72` | `IMPLEMENTED` |
| `mp5k` | `1.08` | `PLANNED` (Prototipo) |
| `vector9` | `1.15` | `IMPLEMENTED` |
| `mk7` | `1.42` | `IMPLEMENTED` |
| `ak12` | `1.44` | `PLANNED` (Prototipo) |
| `m870` | `1.48` | `IMPLEMENTED` |
| `mk48` | `1.50` | `PLANNED` (Prototipo) |
| `awm338` | `1.54` | `PLANNED` (Prototipo) |

`getShowcaseViewportMetrics()` mide las dimensiones reales de `#lobby-header` y `.loadout-panel` tras el layout con márgenes verticales de seguridad (`padTop`: `86 px` en `<= 1024 px` / `74 px` en escritorio; `padBottom`: `124 px` en `<= 1024 px` / `112 px` en escritorio). `recomputeShowcaseFraming(resetZoom = false)` proyecta la envergadura horizontal en reposo con profundidad cercana perspectiva (`nearDepth`) y factores de llenado (`0.68` horizontal y `0.60` vertical) para calcular `baseDist`, `minZoom` y `maxZoom`. Al redimensionar la ventana (`resize`), `targetZoom` y `zoom` se escalan proporcionalmente por `baseDist / prevBase` dentro de `[minZoom, maxZoom]` y se sincroniza de inmediato la cámara cuando `currentLobbyView === 'loadout'`.

### 3.2 Aislamiento de interacción y controles de cámara

`initShowcaseControls()` (`js/main.js`) restringe el arrastre y la rueda exclusivamente a `#armory-showcase-stage`:
- **Rotación:** `pointerdown` / `pointermove` llama a `rotateShowcase(dx * 0.0085, dy * 0.0065)`, acotando `targetPitch` a `[-0.55, 0.55]` rad.
- **Zoom aislado:** `wheel` usa `{ passive: false }`, invoca `e.preventDefault()` y `e.stopPropagation()`, y aplica pasos entre `0.12` y `0.45` a `zoomShowcase(step)`.
- **Recentración:** `#btn-showcase-reset` (`RECENTRAR VISTA`) y `dblclick` invocan `resetShowcaseView()`, restaurando `DEFAULT_SHOWCASE_YAW = -0.34`, `DEFAULT_SHOWCASE_PITCH = 0.08` y `targetZoom = baseDist`.

### 3.3 Separación visual en tres estados (`index.html`, `js/main.js`, `css/style.css`)

1. **Arma inspeccionada (`#showcase-hud-top`):** Etiqueta `INSPECCIONANDO`, estado dinámico (`#showcase-state-pill`: `EQUIPADA EN <CLASE>`, `DESBLOQUEADA`, `BLOQUEADA • NVL X` o `PROTOTIPO // EN DESARROLLO`), título (`#showcase-title`), categoría + calibre (`#showcase-sub`) y nota `#showcase-note` libre de `#diag`.
2. **Clase en edición (`#ctx-editing-card`):** Muestra `EDITANDO CLASE`, nombre y `[1] <Principal> • [2] <Secundaria>`.
3. **Clase activa de despliegue (`#ctx-deploy-card`):** Destacada en verde con `DESPLIEGUE ACTIVO ★` más el aviso `#showcase-diff-hint` cuando difiere de la clase editada.

### 3.4 Encuadre completo del operador (`js/lobby.js`)

`projectObjectScreenBounds(root)` unifica `getShowcaseScreenBounds()` y `getOperatorScreenBounds()` proyectando las 8 esquinas de `geometry.boundingBox` transformadas por `matrixWorld` de cada sub-malla visible. Esto calibró `setLobbyView('operator')` (`targetCam = (0.24, 1.20, 3.30)`, `targetLook = (0.64, 1.08, -0.05)`) y `setLobbyView('play')` (`targetCam = (0.12, 1.28, 3.30)`, `targetLook = (0.68, 1.10, 0)`) evitando cualquier recorte de casco o botas.

### 3.5 Navegación horizontal de categorías (`#armory-cat-bar`)

Para resolver la ocultación parcial de categorías en `#armory-cat-nav`, se implementó un contenedor dedicado con flechas tácticas y control aislado de desplazamiento (`index.html`, `css/style.css`, `js/main.js`):

- **Estructura HTML (`index.html`):** `#armory-cat-bar` envuelve `#armory-cat-prev` (`◀`), el área desplazable `#armory-cat-nav` y `#armory-cat-next` (`▶`) con `type="button"` y atributos `aria-label`.
- **Controles con flechas y acumulación suave (`scrollCategoryNavBy`):** Cada clic desplaza suavemente el ~70 % del ancho visible (mínimo `140 px`) acumulando `catScrollTarget` ante clics rápidos consecutivos con reinicio de respaldo a `700 ms`, sin cambiar jamás la categoría ni el arma seleccionada por el mero desplazamiento.
- **Límites y estado deshabilitado (`updateCategoryArrows`):** Recalcula `scrollLeft` vs. `maxScroll = Math.max(0, scrollWidth - clientWidth)` con tolerancia de `2 px` tras eventos `scroll`, `scrollend`, `resize` y cambios programáticos, deshabilitando (`disabled`) cada flecha en su extremo.
- **Rueda, trackpad, táctil y aislamiento 3D (`initArmoryUI`):** El listener `wheel` sobre `#armory-cat-bar` (`{ passive: false }`) convierte `deltaX`/`deltaY` en desplazamiento horizontal suave e invoca `e.preventDefault()` y `e.stopPropagation()` cuando el evento procede del ratón sobre la barra, impidiendo zoom en el arma 3D o desplazamiento vertical de `.loadout-panel`. La barra define `touch-action: pan-x` y `-webkit-overflow-scrolling: touch`.
- **Auto-centrado seguro (`ensureActiveCategoryVisible`):** Calcula mediante `getBoundingClientRect()` la posición del botón activo respecto a `#armory-cat-nav` y aplica `scrollTo({ left })` horizontal exclusivamente (margen de `10 px`), preservando intacto `.loadout-panel.scrollTop` y manteniendo la barra naranja activa (`box-shadow: inset 0 -2px 0 var(--accent)`).
- **Integridad de tarjetas en `1280×720` (`css/style.css`):** Se añadió `flex-shrink: 0` en `.loadouts-management-bar`, `.armory-cat-bar`, `.armory-weapon-strip` y `.armory-weapon-detail`, manteniendo sin compresión vertical la lista de armas y las barras de atributos.

---

## 4. Verificación Visual (Playwright) y Métricas de Encuadre

Se ejecutó captura automatizada con Playwright en `1920×1080`, `1280×720`, `1024×768` y `768×1024` generando 14 capturas inspeccionadas en `docs/assets/screenshots/sprint6_1/`:

- **Operador cuerpo completo:** `play_1280x720.png`, `operator_1280x720.png`, `operator_1024x768.png`.
- **Responsividad MK-7 y categorías:** `armory_mk7_1920x1080.png`, `armory_mk7_1280x720.png`, `armory_mk7_1024x768.png`, `armory_loadout_768x1024.png`.
- **Armas implementadas y prototipos:** `armory_m870_1280x720.png`, `armory_p12_1280x720.png`, `armory_awm338_planned_1280x720.png`, `armory_mk48_planned_1280x720.png`, `armory_knife_planned_1280x720.png`.
- **Estados diferenciados y rotación 3D:** `armory_diff_loadout_locked_1280x720.png`, `armory_mk7_rotated_1280x720.png`.

Métricas proyectadas reales en la última corrida de captura (`capture_sprint6_1.mjs`):

| Escena / Arma | Resolución | `minX` (px) | `maxX` (px) | `minY` (px) | `maxY` (px) | Ancho (px) | Barra categorías (`overflow` / `scrollLeft` / flechas) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Operador (`operator`) | `1280×720` | `664.8` | `875.1` | `75.8` | `639.5` | `210.3` | N/A |
| Operador (`operator`) | `1024×768` | `538.9` | `762.3` | `80.5` | `681.5` | `223.5` | N/A |
| `MK-7 CARBINE` | `1920×1080` | `826.9` | `1674.8` | `436.6` | `669.0` | `847.9` | `369 px` / `0` / `◀ off, ▶ on` |
| `MK-7 CARBINE` | `1280×720` | `674.4` | `1149.1` | `304.9` | `433.1` | `474.8` | `369 px` / `0` / `◀ off, ▶ on` |
| `MK-7 CARBINE` | `1024×768` | `536.1` | `914.7` | `341.4` | `447.1` | `378.6` | `469 px` / `0` / `◀ off, ▶ on` |
| `AWM-338` (`loadout` móvil) | `768×1024` | `174.3` | `613.2` | `484.5` | `595.3` | `438.9` | `83 px` / `0` / `◀ off, ▶ on` |
| `M870 BREACHER` | `1280×720` | `674.8` | `1147.0` | `323.2` | `412.9` | `472.3` | `369 px` / `172` / `◀ on, ▶ on` |
| `P-12 TACTICAL` | `1280×720` | `714.6` | `1096.3` | `255.3` | `472.1` | `381.7` | `369 px` / `250` / `◀ on, ▶ on` |
| `AWM-338` (Prototipo) | `1280×720` | `684.0` | `1132.4` | `325.5` | `429.5` | `448.4` | `369 px` / `250` / `◀ on, ▶ on` |
| `MK48 MOD 1` (Prototipo) | `1280×720` | `681.4` | `1136.5` | `318.1` | `427.4` | `455.1` | `369 px` / `250` / `◀ on, ▶ on` |
| `CUCHILLO TÁCTICO` (Prototipo) | `1280×720` | `726.0` | `1073.7` | `334.0` | `401.5` | `347.7` | `369 px` / `369` / `◀ on, ▶ off` |

Además de las capturas anteriores, se verificaron explícitamente los límites proyectados en pantalla de las 9 armas del catálogo (`mk7`, `ak12`, `vector9`, `mp5k`, `m870`, `mk48`, `awm338`, `p12`, `knife`) en `1920×1080`, `1280×720` y `1024×768` (incluyendo encogimiento consecutivo de viewport sobre la misma arma):

- **`1920×1080`** (borde panel `504 px`): `minX` entre `826.6 px` y `967.6 px`, `maxX` entre `1476.5 px` y `1677.6 px` (`MK-7: 826.9..1674.8 px`).
- **`1280×720`** (borde panel `504 px`): `minX` entre `673.9 px` y `725.8 px`, `maxX` entre `1073.0 px` y `1150.1 px` (`MK-7: 674.1..1148.9 px`).
- **`1024×768`** (borde panel `404 px`): `minX` entre `535.1 px` y `543.4 px`, `maxX` entre `903.0 px` y `916.0 px` (`MK-7: 535.1..915.8 px`).

Cero armas invaden el panel izquierdo ni los bordes superior, inferior o derecho en ninguna resolución objetivo.

---

## 5. Resultados de Pruebas Automatizadas (104/104 PASS)

Ejecución completa posterior a las últimas ediciones en código y pruebas con `node tests/run_all.mjs`:

### 5.1 Suite de Sprint 6.1 (`tests/test_sprint6_1.mjs`, 14/14 PASS en 71.0s)

| # | Prueba | Resultado | Validación ejecutada |
| :---: | :--- | :---: | :--- |
| **1** | `loadout_hides_operator_shows_showcase` | **PASS** | `operatorVisible === false` y `showcaseVisible && lightsVisible === true` en `loadout`; restauración exacta al regresar a `operator` |
| **2** | `inspection_never_modifies_equipped_loadouts` | **PASS** | Inspeccionar todas las categorías/armas del catálogo no altera clase activa (`loadout_1`), secundaria (`loadout_2`), arma de lobby ni arma de combate |
| **3** | `immediate_update_for_locked_and_planned_weapons` | **PASS** | Actualización inmediata para `m870` (`BLOQUEADA`, botón deshabilitado) y `awm338` (`PROTOTIPO`, `EN DESARROLLO`, `NO JUGABLE`) |
| **4** | `all_9_catalog_weapons_distinct_scaled_models` | **PASS** | Los 9 modelos generan geometría válida con escala/proporciones propias y silueta diferenciada |
| **5** | `responsive_centering_no_clipping_1920_1280_1024` | **PASS** | Encogimiento consecutivo en `mk7` (`1920×1080 -> 1280×720 -> 1024×768`) y las 9 armas del catálogo (`mk7`, `ak12`, `vector9`, `mp5k`, `m870`, `mk48`, `awm338`, `p12`, `knife`) sin solape ni recorte en `1920×1080`, `1280×720` y `1024×768` |
| **6** | `drag_rotation_clamped_zoom_and_recenter` | **PASS** | Rotación por arrastre dentro de pitch `[-0.55, 0.55]`, límites de zoom `minZoom`/`maxZoom` y restablecimiento con `#btn-showcase-reset` |
| **7** | `event_isolation_panel_scroll_and_combat` | **PASS** | Rueda/arrastre sobre panel izquierdo no mueve la exhibición 3D; rueda en combate sigue cambiando ranura principal/secundaria |
| **8** | `operator_full_body_framing_in_play_and_operator` | **PASS** | Casco por debajo de `#lobby-header`, botas dentro del viewport y sin invasión del panel izquierdo en `1280×720` y `1024×768` |
| **9** | `differentiate_inspected_edited_and_active_deploy_states` | **PASS** | Muestra simultáneamente inspección de `M870 BREACHER`, edición de `ASALTO 2` (`VECTOR-9`) y despliegue activo en `ASALTO 1` (`MK-7`) más aviso `#showcase-diff-hint` |
| **10** | `showcase_memory_stability_and_zero_errors` | **PASS** | Tras 3 ciclos × 9 armas (27 cambios de exhibición) + 4 alternancias entre `operator` y `loadout`, geometrías/texturas estables y 0 errores JS |
| **11** | `category_nav_arrows_scroll_and_boundary_disable` | **PASS** | Flechas `#armory-cat-prev`/`#armory-cat-next` visibles, deshabilitación precisa al inicio/fin y desplazamiento horizontal suave sin cambiar categoría ni arma seleccionada |
| **12** | `category_nav_wheel_trackpad_touch_and_zoom_isolation` | **PASS** | Rueda vertical (`deltaY`), trackpad horizontal (`deltaX`) y arrastre táctil sobre `#armory-cat-nav` desplazan la barra sin hacer zoom en `targetZoom` ni scroll vertical del panel |
| **13** | `category_auto_reveal_no_vertical_scroll_and_active_indicator` | **PASS** | Auto-revelado horizontal al seleccionar categorías/ranuras ocultas (`MELEE`, `SHOTGUN`, `PISTOL`), `.loadout-panel.scrollTop` invariable y barra naranja activa visible |
| **14** | `category_nav_responsive_1920_1280_1024_768` | **PASS** | Comportamiento correcto de `#armory-cat-bar` sin desbordes del panel izquierdo en `1920×1080`, `1280×720`, `1024×768` y `768×1024` |

### 5.2 Resumen Global de Regresión (`node tests/run_all.mjs`)

| Suite | Archivo | Pruebas | Pasadas | Tiempo | Cobertura |
| :--- | :--- | :---: | :---: | :---: | :--- |
| Progresión Unit | `tests/test_progression_unit.mjs` | 6 | 6 | 0.0s | Fórmulas XP, curvas 1–50 / 1–20, persistencia y catálogo |
| Progresión Browser | `tests/test_progression_browser.mjs` | 7 | 7 | 22.0s | UI Armamento, categorías, XP en combate real y recarga |
| Lobby Táctico | `tests/test_sprint3.mjs` | 10 | 10 | 10.1s | Navegación de lobby táctico, camuflajes, despliegue y responsive |
| Ciclo de Vida Motor | `tests/test_engine_lifecycle.mjs` | 14 | 14 | 41.1s | Ciclo de vida del motor, pausas, oleadas, S&D y estabilidad |
| Armamento Modular | `tests/test_sprint5.mjs` | 20 | 20 | 21.7s | 20 criterios de aceptación de armamento modular |
| Cierre Sprint 5.1 | `tests/test_sprint5_closure.mjs` | 5 | 5 | 7.4s | Cadencia 30/60/120 FPS, impactos mixtos M870, recarga, persistencia |
| Memoria Profunda | `tests/test_memory_deep.mjs` | 6 | 6 | 16.2s | Acumulador en navegador, anti-burst, 20 swaps, 10 oleadas, 10 S&D, retry |
| Sprint 6 Loadouts | `tests/test_sprint6.mjs` | 22 | 22 | 23.4s | Equipamientos personalizados, P-12 Tactical, cambio en combate y regresión |
| Sprint 6.1 Exhibición | `tests/test_sprint6_1.mjs` | 14 | 14 | 71.0s | Exhibición 3D, barra de categorías tácticas, responsividad, aislamiento y memoria |
| **TOTAL GENERAL** | **`tests/run_all.mjs`** | **104** | **104** | **212.9s (suma)** | **100% OK (código de salida 0)** |

---

## 6. Diagnóstico Final de Memoria (`4_memory_10_cycles_waves`) e Inicialización Diferida WebGL

Durante la integración de `test_sprint6_1.mjs`, el paso `4_memory_10_cycles_waves` de `tests/test_memory_deep.mjs` reportó esporádicamente `56 -> 93 (56,93,93,93,93,93,93,93,93,93)` únicamente bajo la ejecución secuencial completa de `node tests/run_all.mjs`.

### 6.1 Contadores observados por fase y desglose exacto de las +37 geometrías

| Momento de medición | `geometries` (`renderer.info`) | `textures` | `programs` | `calls` | Observación técnica |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Arranque en `JUGAR` (`BOOT_PLAY`) | `56` | `4` | `3` | `58` | Solo `lobbyScene` renderizada (hangar + operador + `mk7`); `showcaseRoot` y `scene` de combate aún sin renderizar |
| Tras paso 2 (`AFTER_STEP2` síncrono) | `56` | `4` | `3` | `58` | `startGame` y `backToMenu` en el mismo tick JS sin ceder a `requestAnimationFrame` |
| Entrar a `ARMAMENTO` (`AFTER_LOADOUT`) | `66` | `4` | `5` | `29` | Primera renderización del visor `mk7` (`+10` geometrías ya preconstruidas) |
| Tras 20 swaps antes del fix de guarda (`repro_run_all_race.mjs`) | `56` | `4` | `5` | `29` | `selectWeapon('mk7')` reconstruyó innecesariamente el visor `mk7` sin esperar a otro `rAF` (`66 -> 56`) |
| Tras 20 swaps con guarda de identidad en `setShowcaseWeapon` | `66` | `4` | `5` | `29` | Cero reconstrucciones del visor (`step3`: `66 -> 66`) |
| Reproducción fallo antiguo en `c=0` (`elapsed: 318ms`) | `56` | `4` | `5` | `29` | Ningún `rAF` renderizó `scene` antes de `backToMenu()` tras `sleep(150)` |
| Reproducción fallo antiguo en `c=1` (`elapsed: 635ms`) | `93` | `6` | `9` | `58` | Primer `renderer.render(scene, camera)` completo compila shaders (`5 -> 9`), sube mapa de sombras (`4 -> 6`) y los `+37` buffers |
| Línea base controlada tras calentamiento + `c=0..9` actuales | `103` | — | — | — | `midWarmupGeo=103`, `warmupBaselineGeo=103`, `geoSamples=[103,103,103,103,103,103,103,103,103,103]` |

Inspección directa de las `44` geometrías únicas presentes en `scene` al entrar en Oleadas:
- **`js/world.js` (33 estáticas creadas al importar el módulo):** `1` `BufferGeometry` (estrellas), `1` `SphereGeometry` (luna en `-Z`), `1` `PlaneGeometry` (suelo asfáltico), `4` `BoxGeometry` (muros), `15` `BoxGeometry` (4 edificios, 4 contenedores, 7 cajas), `1` `CylinderGeometry` compartida (7 barriles) y `10` de farolas (`5` postes `CylinderGeometry` + `5` cabezales `BoxGeometry`).
- **`js/main.js` (1 estática oculta):** `1` `PlaneGeometry` de `flashSprite` (`visible: false`).
- **`js/weapon.js` (10 del viewmodel activo):** `10` geometrías de `gunGroup` para `mk7`.
- **Diferencia visible en primera trama de Oleadas (`44 - 7 = 37`):** En `(0, 1.7, 40)` mirando a `+Z`, la luna (`1`) y los `5` cabezales de farola (`5`, `castShadow: false`) quedan fuera del frustum inicial y `flashSprite` (`1`) permanece invisible, por lo que `WebGLGeometries` registra exactamente `27` geometrías del mundo más `10` del viewmodel = **`+37` geometrías** (`56 -> 93` o `66 -> 103`), además de `4` shaders y `2` texturas (incluyendo el objetivo de sombra `2048×2048`). En Oleadas iniciales (`betweenWaves = true`, `waveDelay = 2.5s`) no hay enemigos, bomba ni trazadores activos (`0` fugas).

### 6.2 Diferenciación: inicialización diferida vs. fuga de memoria

- **Inicialización diferida legítima:** Tres indicadores confirman que las `+37` geometrías son recursos estáticos inicializados por WebGL en su primer cuadro visible: coinciden exactamente con el conteo estático de `world.js` + `mk7`, aparecen sincronizadas con la subida única de `programs` (`5 -> 9`) y `textures` (`4 -> 6`), y permanecen planas en `93` / `103` durante todos los ciclos posteriores (`c = 1..9`, los 10 ciclos S&D y muerte/reintento).
- **Causa raíz del fallo intermitente en `run_all.mjs`:** Sin fase previa de calentamiento de `scene`, `c = 0` (`sleep(150)`) quedaba por debajo de los `~208–320ms` que tarda la compilación inicial de shaders + mapa de sombras `2048×2048` en SwiftShader bajo carga de CPU; `c = 0` regresaba al menú con `calls = 29` antes de su primer renderizado de combate y el salto `+37` aparecía en `c = 1`.
- **Corrección aplicada (`tests/test_memory_deep.mjs` y `js/lobby.js`):**
  1. Se añadió en el paso `4_memory_10_cycles_waves` de `tests/test_memory_deep.mjs` una fase determinista de calentamiento previa a las 10 mediciones (`startGame('waves')` -> `2× requestAnimationFrame` -> `backToMenu()` -> `2× requestAnimationFrame`) para fijar `baseline`, manteniendo íntegras las aserciones estrictas (`Math.abs(last - first) > 1` y `peak - baseline.geometries > 1`) para detectar cualquier fuga real posterior.
  2. La guarda de identidad en `setShowcaseWeapon()` (`js/lobby.js`) fue verificada manteniendo UUIDs idénticos en las 10 mallas del visor a lo largo de `boot -> loadout -> roundtrips (operator/play/loadout) -> combate -> backToMenu -> loadout` (`boot_to_loadout: true`, `tab_roundtrips: true`, `combat_backToMenu: true`, `reenter_loadout_after_combat: true`).

---

## 7. Estado de Git y Riesgos Pendientes

1. **Rama y commit:** Cierre local confirmado sobre `develop` tomando `a89686c` como base; `main` permanece intacta en `6a29c8c`. No se ha ejecutado `git push` ni se ha publicado `v0.2.0-alpha`.
2. **Atajo de teclado para recenter:** En la exhibición 3D el restablecimiento de vista opera mediante `#btn-showcase-reset`, doble clic en `#armory-showcase-stage` y reingreso a `ARMAMENTO`; no se vinculó la tecla `R` en `MENU` para evitar conflictos con `#loadout-name-input`.
3. **Resolución móvil (`<= 768px`):** En `@media(max-width:768px)`, `.armory-showcase-stage` oculta el escenario interactivo cuando el ancho restringe el visor lateral, manteniendo plenamente operativa la barra horizontal `#armory-cat-bar` (validada en `768×1024`), tarjetas y estadísticas.
