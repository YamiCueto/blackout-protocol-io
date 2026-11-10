# BLACKOUT PROTOCOL — Traspaso de contexto técnico (autocontenido)

Destinatario: otro agente de IA que continuará el trabajo.
Origen: auditoría Fase 0 (2026-11-10). Informe completo: `docs/audit/BLACKOUT_PROTOCOL_BASELINE.md`.
No contiene secretos ni credenciales (el proyecto no tiene ninguno).

## 0. Estado y reglas vigentes

- **Fase actual: Fase 0 (auditoría) terminada. Nada del lobby está implementado ni aprobado.** Esperar aprobación explícita del usuario antes de implementar.
- Durante la auditoría solo se escribieron los dos documentos de `docs/audit/`. El código de producción está intacto.
- Git: rama `master` **sin commits**; todo sin seguimiento; sin remoto; sin `.gitignore`. No se ha commiteado ni hecho push. Crear un commit base requiere autorización del usuario.
- El juego **no se ejecutó en navegador** durante la auditoría; no hay métricas (FPS, `renderer.info`). No afirmar valores de rendimiento sin medirlos.
- Etiquetas: `[CÓDIGO]` confirmado en el repositorio; `[HIPÓTESIS]` no demostrado; `[NO MEDIDO]` rendimiento sin métricas.
- Idioma del producto: español (UI y comentarios).

## 1. Producto

FPS de navegador, ambientado en una zona industrial nocturna. Dos modos: **OLEADAS** y **BUSCAR Y DESTRUIR**. Objetivo futuro (no aprobado): lobby inspirado en la estructura de UX de Warzone (operador 3D, navegación superior, tarjetas de modo, panel lateral, estadísticas, transiciones) con identidad visual propia y sin copiar recursos protegidos.

## 2. Tecnología (verificada)

| Tema | Valor |
|---|---|
| Lenguaje | JavaScript vanilla, módulos ES. **Sin TypeScript** |
| Build | **Ninguno.** Sin `package.json`, sin Vite, sin npm |
| Three.js | r160 desde `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` vía `importmap` en `index.html` (L178-180). Sin SRI, sin copia local |
| Addons de three | **No mapeados** (`three/addons/` no existe en el importmap): sin `GLTFLoader`, `EffectComposer`, etc. |
| Física | Ninguna librería. Colisión propia (círculo vs `Box3`) y raycasts de three |
| Audio | WebAudio propio, procedural, sin archivos |
| Animación | Sin librerías ni `AnimationMixer`; manual en `tick()`; CSS para HUD |
| Estado | Sin librería; variables `let` privadas en `main.js` + objetos exportados |
| Assets externos | Ninguno (texturas por canvas 2D, sonido sintetizado) |
| Persistencia | `localStorage['bp_settings']` (solo ajustes) |
| Pruebas / lint / CI | **Ninguno** |
| Ejecutar | `python -m http.server 8000` y abrir `http://localhost:8000` (necesita servidor por los módulos ES) |
| Hosting previsto | GitHub Pages (estático) |
| Verificación hecha | Sintaxis ES-module de los 9 `.js`: OK (`vm.SourceTextModule`) |

## 3. Mapa de archivos

```
index.html        Shell + HUD + pantallas (menu, death-screen, wave-summary, settings-screen, loading) + importmap + <script type=module src=js/main.js>
css/style.css     HUD, pantallas, tarjetas de modo, ajustes. 0 @media
js/core.js        $(id), renderer, scene, camera, resize
js/settings.js    SETTINGS_DEFAULTS, settings, saveSettings
js/audio.js       audio(), applyVolume, sfx*
js/textures.js    makeCanvas + texturas procedurales
js/world.js       luces + escenario + colisión + solidMeshes()  (todo al importar)
js/weapon.js      weapon (estado), gunGroup/muzzleFlash/flashSprite (modelo)
js/enemies.js     enemies[], makeEnemy, damageEnemy, popHead, enemyLOS, clearEnemies
js/effects.js     trazadoras, partículas, decals, escombros
js/main.js        798 L, 0 exports: jugador, entrada, disparo, IA, modos, HUD, pantallas, bucle
```

### API exportada

| Módulo | Exports |
|---|---|
| `core.js` | `$`, `renderer`, `scene`, `camera` |
| `settings.js` | `SETTINGS_DEFAULTS` = `{brightness:100, fov:75, shadows:'high', volume:80}`, `settings`, `saveSettings()` |
| `audio.js` | `audio()`, `applyVolume()`, `sfxShot`, `sfxClick(freq,vol,dur)`, `sfxReload`, `sfxHit`, `sfxHurt`, `sfxExplosion`, `sfxEnemyShot` |
| `textures.js` | `makeCanvas(size, fn)`, `texAsphalt` (repeat 22×22), `texConcrete`, `texMetal`, `texCrate`, `flashTex`, `sparkTex`, `decalTex` |
| `world.js` | `ARENA`=58, `colliders` (`Box3[]`), `moon` (DirectionalLight), `pushOutCircle(p, radius, yBottom, yTop)`, `pointBlocked(x,z,r)`, `solidMeshes()` |
| `weapon.js` | `GUN_HIP`, `GUN_ADS`, `weapon`, `gunGroup`, `muzzleFlash`, `flashSprite` |
| `enemies.js` | `enemies`, `makeEnemy(x,z)`, `damageEnemy(e,dmg,point,headshot,impulse)`, `enemyLOS(e,targetPos)`, `clearEnemies()` |
| `effects.js` | `spawnTracer`, `spawnBurst(pos,color,n,speed,size,life,gravity)`, `spawnDecal`, `spawnDebris`, `updateEffects(dt)`, `resetEffects()` |
| `main.js` | ninguno |

Grafo de importación (sin ciclos): `main` → todos; `audio→settings`; `textures→core`; `world→core,textures`; `effects→core,textures`; `weapon→core,textures`; `enemies→core,world,effects,audio`.

Efectos secundarios al importar: `core` crea el renderer/escena/cámara; `world` construye el escenario y marca sólidos; `weapon` hace `camera.add(gunGroup)`; `main` resuelve IDs DOM, registra listeners y arranca `tick()`.

## 4. Motor 3D

- **Renderer único** (`core.js` L6-13): `antialias:true`, `setPixelRatio(min(dpr,2))`, ACES filmic, `toneMappingExposure = 1.15 * brillo/100` (en `applySettings`), `SRGBColorSpace`, `PCFSoftShadowMap`, `shadowMap.enabled=true`.
- **Escena única** con `Color(0x0a0e18)` y `FogExp2(0x0a0e18, 0.016)`; **cámara única** `PerspectiveCamera(75, aspect, 0.08, 400)`, hija de la escena; `gunGroup` hijo de la cámara.
- **Luces:** Hemisférica, DirectionalLight "luna" (única que proyecta sombra; ortográfica ±70, far 180; mapa 2048/1024 según ajustes), 5 PointLight de farolas, PointLight del fogonazo (siempre en escena, intensidad 0), +1 PointLight de la bomba en S&D. `[CÓDIGO]`
- **Bucle:** `tick()` con `requestAnimationFrame` (única invocación en `main.js` L798). `dt = min(clock.getDelta(), 0.05)`. La simulación solo corre si `!paused && player.alive`; **`updateEffects` y `renderer.render` corren siempre**, incluso con el menú visible (L791-792). El id de `rAF` no se guarda (no cancelable).
- **Resize:** `core.js` L22-26 (aspect + setSize). No gestiona más de una cámara.
- **Recursos:** `effects.js` libera bien lo suyo; `clearEnemies` y `removeBomb` **no** hacen `dispose`. Cada enemigo crea 8 `BoxGeometry` propias (materiales compartidos).
- **Contexto WebGL:** three r160 lo maneja internamente (`webglcontextlost/restored`); el proyecto no añade nada.
- **Decisión recomendada (no implementada):** lobby con **el mismo renderer** y **otra `Scene`/`Camera`**; no crear un segundo renderer (duplica cachés de GPU y consume otro contexto). `world.js` no es reutilizable como fábrica (escribe en el singleton al importar); `texAsphalt.repeat` vive en la textura, clonar para otro `repeat`.

## 5. Estado de juego y ciclo de vida (`main.js`)

### Variables de módulo relevantes
`player {pos, vel, yaw, pitch, hp, grounded, radius:0.45, eye:1.7, alive}`, `keys`, `locked`, `paused`, `mouseDown`, `adsDown`, `adsAmount`, `wave`, `kills`, `waveDelay`, `betweenWaves`, `inSummary`, `waveStats`, `waveStartT`, `gameMode` (`'waves'|'snd'`), `snd`, `bombGroup`, `bombLight`, `bombPos(0,0,-6)`, `flashTimer`, `shake`, `hitFlash`, `bobT`, `dmgIndicators[]`.

### Funciones clave (líneas aproximadas)
| Función | Líneas | Rol |
|---|---|---|
| `applySettings` / `refreshSettingsUI` | 12-33 | Aplica ajustes a renderer/cámara/luna/audio |
| `shoot` / `tryReload` | 170-232 | Hitscan, dispersión, daño, impactos |
| `spawnWave` / `showWaveSummary` | 315-355 | Oleadas |
| `createBomb` / `removeBomb` / `spawnSndEnemy` / `detonateBomb` | 251-313 | Buscar y Destruir |
| `damagePlayer` / `die` / `showEndScreen` | 406-416, 464-480 | Daño y fin de partida |
| `startGame(mode)` | 419-462 | Inicia/reinicia sin recargar |
| `showMenuPause` / `resumeGame` / `backToMenu` | 482-507 | Pausa, reanudar, volver |
| `tick` | 520-793 | Entrada, movimiento, disparo, cámara, IA inline, reglas de modo, HUD, render |

### Cómo se pausa
No existe handler de `Escape`. `pointerlockchange` (L84-87): si se pierde el lock y `player.alive && !inSummary` → `showMenuPause()`. No hay handler de `pointerlockerror`.

### ¿Reiniciar/cambiar de modo sin recargar? **Sí.**
`startGame(mode)` (L419-462) limpia enemigos, efectos, indicadores y bomba, reinicia jugador/arma/contadores, muestra HUD y pide Pointer Lock. Se enlaza a `#mode-waves`, `#mode-snd`, `#retry-btn` (L509-511). `backToMenu()` (L495-507) vuelve al menú. Listeners y bucle no se duplican. Salvedades: no se liberan geometrías de enemigos/bomba; `adsAmount`, `mouseDown`, `adsDown`, `flashTimer`, `shake`, `bobT`, `weapon.cooldown/reloadT`, decals no se reinician; la pausa **no** permite abandonar la partida.

## 6. Reglas de los modos (valores reales del código)

### OLEADAS
- Inicio: pos `(0,1.7,40)`, yaw π; `waveDelay=2.5`. Oleada `w`: `3+2w` enemigos en bordes (≥20 m del jugador).
- Escalado: HP `100+(w-1)*12`; velocidad `+min(0.12w, 1.4)` sobre base `2.4+rand*1.2`; intervalo de disparo enemigo `0.9+rand*1.6 - min(0.04w, 0.5)`; error de puntería `max(0.12, 0.30+dist*0.026+(mov?0.45)+(sprint?0.35) - min(0.05*lvl, 0.45))`; daño `(7+rand*6+lvl)*mult`.
- Al limpiar: +60 de reserva, +35 HP (máx 100), `showWaveSummary()`; "Continuar" → `waveDelay=1.5`.
- Victoria: **ninguna**. Derrota: HP ≤ 0 (`die()`, "K.I.A.").
- Cadáveres: **nunca se eliminan** de `enemies[]` ni de la escena hasta `clearEnemies()`.

### BUSCAR Y DESTRUIR
- Jugador defiende una bomba ya armada; **no puede interactuar con ella**. Inicio: pos `(0,1.7,18)`, yaw 0, reserva 150.
- `SND_DURATION=90` s (cuenta atrás con `dt`); `SND_DEFUSE_TIME=10` s.
- Bots: máx. 9 vivos; primer spawn 4, luego 1 (65 %) o 2 (35 %) cada 4.5-7.5 s. Van en línea recta a la bomba; a <2.3 m se quedan "desactivando" y no disparan. Fuera de la bomba disparan al jugador con LOS y dist <38.
- Escalado por `elapsed = performance.now() - snd.startT`: HP `100+0.8*s`, velocidad `+min(0.02*s,1.2)`, `lvl=min(s/20,4)`.
- Desactivación: `defuse += dt*(1+(n-1)*0.5)` con n bots activos; sin bots decae `0.6*dt`.
- Victoria: `timeLeft ≤ 0` → `detonateBomb()` (mata hostiles en radio 30) y a los 1 600 ms `showEndScreen(true,'OBJETIVO CUMPLIDO')`. Derrota: HP ≤ 0, o `defuse ≥ 10` ("BOMBA DESACTIVADA").
- El HUD reutiliza `#wave-num` como temporizador.

### Contrato común de modos
**No existe.** Los modos son ramas `if (gameMode === ...)` en `startGame`, `tick` y `die`. Propuesta (sin implementar): `GameMode { id, label, description, rules, start(ctx), update(dt,ctx), navTarget(enemy,ctx), hud(ctx), result(), dispose(ctx) }`.

## 7. Interfaz (contratos DOM)

- Pantallas: `#loading` (z20), `#menu`, `#settings-screen`, `#death-screen`, `#wave-summary` (z10, `.screen`), `#hud` (+ `#damage-vignette`, `#hit-flash`).
- Se muestran/ocultan con `style.display` directo. `#menu` es menú **y** pausa (alterna `#modes` y `#resume-btn`). `settings-back` siempre vuelve a `#menu`. `#menu` tiene fondo opaco que tapa el canvas.
- **Contrato de 50 IDs** resueltos con `getElementById` (`$`) por `main.js`; 13 handlers (`oninput/onclick/onchange`) se asignan al importar, y `refreshSettingsUI()` también usa IDs al arrancar: **si falta uno, `main.js` lanza `TypeError` y el juego no arranca.** Lista: `ammo-num, ammo-reserve, continue-btn, damage-vignette, death-screen, death-stats, death-title, defuse-fill, defuse-panel, dmg-indicators, enemies-left, headshot-banner, health-fill, health-num, hit-flash, hitmarker, hud, kills, loading, menu, menu-btn, modes, mode-snd, mode-waves, msg, reload-hint, resume-btn, retry-btn, set-brightness, set-fov, set-shadows, settings-back, settings-btn, settings-reset, settings-screen, set-volume, val-brightness, val-fov, val-volume, wave-num, wave-summary, ws-accuracy, ws-dmg-dealt, ws-dmg-taken, ws-headshots, ws-kills, ws-shots, ws-time, ws-title` + `c` (canvas, `core.js`).
- HUD **no desacoplado**: se escribe desde `shoot`, `damagePlayer`, `spawnWave`, `tick`, `updateHUD`.
- Pointer Lock siempre sobre `renderer.domElement`, pedido en clicks de `startGame`/`resumeGame`/`continue-btn`.
- Eventos globales en `window`/`document`: `keydown`, `keyup` (`keys[e.code]`; `R` → `tryReload`), `mousemove`/`mousedown`/`mouseup` (requieren `locked` salvo `mouseup`), `contextmenu` (`preventDefault`), `pointerlockchange`, `resize`. **No hay** `blur`, `visibilitychange`, `pointerlockerror`, handler de `Escape`.
- Accesibilidad/adaptabilidad: tarjetas `div.mode-card` sin `tabindex`; CSS sin `@media`; juego solo escritorio.

## 8. Hallazgos (resumen; detalle en el informe base §10)

| ID | Sev. | Título |
|---|---|---|
| F-001 | HIGH | Sin commits ni línea base en Git |
| F-002 | HIGH | `main.js` monolítico, sin exports ni API de partida |
| F-003 | HIGH | Cadáveres nunca se eliminan en Oleadas (acumulan meshes y trabajo) |
| F-004 | MEDIUM | Geometrías/materiales de enemigos y bomba sin `dispose` |
| F-005 | MEDIUM | Contrato rígido de 50 IDs; `#menu` compartido por menú y pausa |
| F-006 | MEDIUM | No se puede abandonar la partida desde la pausa |
| F-007 | MEDIUM | La escena de juego se renderiza siempre (aun tras un menú opaco) |
| F-008 | MEDIUM | Sin manejo de fallo de Pointer Lock (efecto `[HIPÓTESIS]`) |
| F-009 | MEDIUM | Dos relojes (`performance.now()` vs `dt`): la pausa distorsiona dificultad y tiempos |
| F-010 | LOW | Entrada sin reset en `blur`; reinicio incompleto |
| F-011 | MEDIUM | three.js solo desde CDN, sin fallback ni mensaje de error |
| F-012 | MEDIUM | Asignaciones y búsquedas repetidas por fotograma `[NO MEDIDO]` |
| F-013 | LOW | Luces dinámicas (bomba) y 6-7 point lights |
| F-014 | LOW | Colisión vs raycast inconsistentes (cabezas de farola sólidas sin collider; barriles/suelo no sólidos) |
| F-015 | LOW | Sombras re-renderizadas cada fotograma; el arma proyecta sombra |
| F-016 | LOW | `updateHUD` sin diffing |
| F-017 | LOW | Ajustes sin validación; sensibilidad/teclas fijas |
| F-018 | LOW | Timers no cancelables; `R` recarga en pausa |
| F-019 | LOW | `resetEffects` no limpia decals |
| F-020 | LOW | Accesibilidad y diseño adaptable ausentes |
| F-021 | MEDIUM | Sin pruebas ni lint |
| F-022 | LOW | IA de S&D sin pathfinding (atascos `[HIPÓTESIS]`) |
| F-023 | INFO | Contexto WebGL: solo manejo interno de three |
| F-024 | INFO | Aspectos sanos: un solo bucle, listeners únicos, `effects.js` libera bien |
| F-025 | INFO | Discrepancias con el brief: un mapa, un arma, sin operador |

Cero hallazgos CRITICAL.

## 9. Decisiones arquitectónicas recomendadas (no implementadas)

1. **Un solo `WebGLRenderer`**, varias escenas/cámaras, **un solo `requestAnimationFrame`** propiedad de un `SceneManager` mínimo que solo renderiza la escena activa.
2. **StateMachine mínima** (`BOOT, LOBBY, LOADING, PLAYING, PAUSED, SUMMARY, RESULTS`) que reemplace los booleanos sueltos.
3. **Fachada `Game`** (`startMatch(modeId)`, `stopMatch()`, `pause()`, `resume()`, eventos de fin de partida) en lugar de un `GameManager` grande.
4. **Registro de modos** (`waves`, `snd`) con contrato común; no una clase gestora.
5. **ScreenManager + Hud** que reciba un modelo de datos; eliminar `style.display` dispersos.
6. **InputManager** (teclas, ratón, Pointer Lock con `pointerlockerror`, reset en `blur`).
7. **`profile.js`** sobre `localStorage` (esquema versionado) siguiendo el patrón de `settings.js`. **Sin backend**: juego de un jugador, estático, sin cuentas.
8. **Diferir** `AssetManager` (solo si se adopta un GLB, lo que exigiría `three/addons/` en el importmap) y `AudioManager` (`audio.js` ya es el bus maestro).
9. **Operador procedural primero** (cajas, como `makeEnemy`), GLB después si el usuario lo aprueba.
10. Refactor en modo "mover código sin cambiar comportamiento", con checklist de regresión y commit base previo.

## 10. Limitaciones conocidas

- Un único mapa y una única arma: "Armamento" sería informativo hasta que exista un sistema de armas; "Operador" no tiene respaldo hoy (no hay personaje visible).
- `makeEnemy` añade a la `scene` y a `enemies[]` global: no sirve para dibujar un personaje en otra escena sin refactor.
- Sin métricas reales; sin ejecución en navegador; sin pruebas automáticas.
- `three` depende de CDN; sin conexión no hay juego.
- Solo escritorio (Pointer Lock + teclado/ratón).

## 11. Hoja de ruta preliminar

S0/S1 Línea base y estabilización (commit base con autorización, panel de métricas con `renderer.info`, cadáveres/recursos, Pointer Lock, entrada, reloj único, abandonar partida) → S2 Estados y escenas → S3 Contrato de modos → S4 Infraestructura del lobby → S5 Diseño visual → S6 Integración y transiciones → S7 Perfil y personalización → S8 Optimización → S9 Pruebas. No todos son obligatorios. **Primer sprint recomendado: S0/S1.**

## 12. Preguntas abiertas para el usuario

1. ¿Commit base y `.gitignore` autorizados? ¿Remoto previsto?
2. ¿Se permite cambiar comportamientos (retirar cadáveres, reloj único, abandonar partida)?
3. Operador: ¿procedural o GLB (origen, licencia, peso)?
4. ¿Se acepta añadir `three/addons/` y/o vendorizar three?
5. ¿Más armas? ¿Más mapas? ¿Progresión (XP) o solo estadísticas?
6. Dispositivos objetivo; ¿táctil? ¿Solo español?
7. ¿Debe el jugador poder actuar sobre la bomba en S&D?

## 13. Instrucciones para el siguiente agente

- Leer `docs/audit/BLACKOUT_PROTOCOL_BASELINE.md` para el detalle y las referencias de líneas.
- No implementar nada del lobby sin aprobación explícita del usuario.
- Antes de refactorizar: pedir autorización para el commit base.
- Medir en navegador (`renderer.info`, panel Performance) antes y después de cualquier optimización; marcar como hipótesis todo lo no medido.
- Mantener los 50 IDs del DOM hasta que exista una capa de UI que los reemplace.
- No añadir comentarios al código salvo petición expresa; conservar los comentarios y docstrings existentes.
