# BLACKOUT PROTOCOL — INFORME DE CIERRE DE SPRINT 5 & SPRINT 5.1
## Arquitectura modular de armamento, primeras armas jugables y estabilización técnica
### Preparación de v0.2.0-alpha

- **Fecha:** 2026-11-11
- **Rama:** `develop`
- **Commit base de referencia:** `6174b52` (`feat(weapons): implement modular weapon architecture, Vector-9 & M870, multi-pellet raycasting, and lobby 3D sync (Sprint 5)`)
- **Archivos modificados:** `js/audio.js`, `js/weapon.js`, `js/progression.js`, `js/lobby.js`, `js/main.js`
- **Suites de validación:** Versionadas en `tests/` (`tests/run_all.mjs`, `tests/test_progression_unit.mjs`, `tests/test_progression_browser.mjs`, `tests/test_sprint3.mjs`, `tests/test_engine_lifecycle.mjs`, `tests/test_sprint5.mjs`, `tests/test_sprint5_closure.mjs`, `tests/test_memory_deep.mjs`). Reproducibles con Node.js y Google Chrome.
- **Estado de Git:** Rama `develop` actualizada con el acumulador temporal de cadencia, validación de recursos de WebGL y prevención estricta de ráfagas artificiales.
- **Cumplimiento de restricciones:** Cero comentarios añadidos al código (`//` o `/* */`), Three.js r160 intacto, cero frameworks externos, sin push remoto, sin tags remotos, sin iniciar Sprint 6.

---

## 1. Resumen ejecutivo

El **Sprint 5** culmina la transición de BLACKOUT PROTOCOL de un juego mono-arma a una plataforma balística modular, extensible y de alto rendimiento.

Se incorporaron dos armas completamente funcionales con identidades jugables, modelos procedurales 3D, perfiles balísticos, mecánicas de recarga y efectos acústicos diferenciados:
1. **VECTOR-9 (Subfusil, Nivel 4):** Arma compacta de altísima cadencia (923 RPM), alta movilidad (+8%), apuntado ágil (ADS speed 16.0), cargador de 33 cartuchos 9x19mm y caída progresiva de daño a partir de los 16 metros.
2. **M870 BREACHER (Escopeta táctica, Nivel 8):** Arma de corredera calibre 12 que dispara 8 perdigones independientes con dispersión cónica, daño devastador a quemarropa (hasta 120 de daño consolidado), recarga secuencial cartucho a cartucho con contrato de interrupción inmediata si `ammo > 0`, y movilidad pesada (-6%).
3. **MK-7 CARBINE (Fusil de asalto, Nivel 1):** Preservado al 100% sin modificaciones de balance, sin caída de daño por distancia y sin penalizaciones. Funciona como patrón de calibración y referencia inmutable de regresión.

El armamento seleccionado en la interfaz del lobby persiste en almacenamiento local (`bp_progression_v1`), se refleja visualmente en las manos del operador 3D en el hangar del lobby y se traslada automáticamente tanto al modo **OLEADAS** como a **BUSCAR Y DESTRUIR**, con reservas de munición adaptadas a cada modo.

---

## 2. Arquitectura modular de armamento (`js/weapon.js`)

Se eliminó la definición estática monolítica de arma, reemplazándola por un registro declarativo unificado (`WEAPONS`) y una función de intercambio dinámico (`setWeapon`).

### 2.1 Registro declarativo `WEAPONS`

Cada plataforma balística define de forma centralizada y autorizada sus propiedades funcionales:

```javascript
export const WEAPONS = {
  mk7: {
    id: 'mk7',
    name: 'MK-7 CARBINE',
    category: 'ASSAULT',
    damage: 34,
    pellets: 1,
    fireRate: 0.105,
    fireMode: 'auto',
    magSize: 30,
    reserveDefault: 120,
    reserveSnd: 150,
    reloadType: 'magazine',
    reloadTime: 1.7,
    shellReload: null,
    dropoff: null,
    spreadHip: 0.011,
    spreadAds: 0.0022,
    recoilSpreadHip: 0.0035,
    recoilSpreadAds: 0.0012,
    recoilKick: 1.0,
    recoilMax: 6.0,
    recoilRecovery: 9.0,
    mobilityMultiplier: 1.0,
    adsSpeed: 12.0,
    hipPos: new THREE.Vector3(0.28, -0.26, -0.55),
    adsPos: new THREE.Vector3(0, -0.168, -0.42),
    muzzlePos: new THREE.Vector3(0, 0.012, -0.78),
    audio: { shot: sfxShot, reload: sfxReload },
    buildMesh: buildMk7Mesh
  },
  vector9: {
    id: 'vector9',
    name: 'VECTOR-9',
    category: 'SMG',
    damage: 22,
    pellets: 1,
    fireRate: 0.065,
    fireMode: 'auto',
    magSize: 33,
    reserveDefault: 165,
    reserveSnd: 198,
    reloadType: 'magazine',
    reloadTime: 1.35,
    shellReload: null,
    dropoff: { optimal: 16, max: 40, minMult: 0.48 },
    spreadHip: 0.016,
    spreadAds: 0.0035,
    recoilSpreadHip: 0.0040,
    recoilSpreadAds: 0.0015,
    recoilKick: 0.75,
    recoilMax: 5.2,
    recoilRecovery: 12.0,
    mobilityMultiplier: 1.08,
    adsSpeed: 16.0,
    hipPos: new THREE.Vector3(0.26, -0.25, -0.50),
    adsPos: new THREE.Vector3(0, -0.170, -0.38),
    muzzlePos: new THREE.Vector3(0, 0.018, -0.50),
    audio: { shot: sfxShotVector, reload: sfxReloadVector },
    buildMesh: buildVectorMesh
  },
  m870: {
    id: 'm870',
    name: 'M870 BREACHER',
    category: 'SHOTGUN',
    damage: 15,
    pellets: 8,
    fireRate: 0.80,
    fireMode: 'pump',
    magSize: 6,
    reserveDefault: 36,
    reserveSnd: 42,
    reloadType: 'shell',
    reloadTime: 0.45,
    shellReload: { start: 0.35, shell: 0.48, end: 0.35 },
    dropoff: { optimal: 8, max: 24, minMult: 0.25 },
    spreadHip: 0.048,
    spreadAds: 0.028,
    recoilSpreadHip: 0.0020,
    recoilSpreadAds: 0.0010,
    recoilKick: 4.5,
    recoilMax: 9.0,
    recoilRecovery: 7.0,
    mobilityMultiplier: 0.94,
    adsSpeed: 9.0,
    hipPos: new THREE.Vector3(0.28, -0.26, -0.56),
    adsPos: new THREE.Vector3(0, -0.172, -0.45),
    muzzlePos: new THREE.Vector3(0, 0.038, -0.80),
    audio: {
      shot: sfxShotShotgun,
      pump: sfxPumpAction,
      shell: sfxShellInsert,
      reload: sfxPumpAction
    },
    buildMesh: buildM870Mesh
  }
};
```

### 2.2 Gestión de Geometría y Prevención de Fugas de Memoria

Al cambiar de arma en `setWeapon(id)` o `setLobbyWeapon(weaponId)`:
- Se evalúa si el arma solicitada ya está instanciada para evitar reconstrucciones innecesarias.
- Si se reemplaza la malla, se recorre el subárbol anterior (`traverse`) y se invoca `geometry.dispose()` en cada malla para evitar que la memoria de geometrías de WebGL crezca indefinidamente durante ciclos repetidos de equipamiento.
- Los materiales Three.js se reutilizan a nivel de módulo, reduciendo llamadas de enlace en GPU.

---

## 3. Matriz de balance de armamento

| Parámetro | MK-7 CARBINE | VECTOR-9 | M870 BREACHER | Justificación táctica |
| :--- | :--- | :--- | :--- | :--- |
| **Categoría** | Fusil de Asalto | Subfusil (SMG) | Escopeta Táctica | Roles tácticos complementarios |
| **Munición / Calibre** | 5.56x45mm NATO | 9x19mm NATO | Cartucho Calibre 12 | Diversidad balística verosímil |
| **Requisito de Nivel** | Nivel 1 (Inicial) | Nivel 4 | Nivel 8 | Curva de desbloqueo progresivo |
| **Daño base por proyectil** | 34 HP | 22 HP | 15 HP | Pegada proporcional a la cadencia |
| **Perdigones por disparo** | 1 | 1 | 8 | Dispersión cónica multi-impacto |
| **Daño total por disparo** | 34 HP (75 en cabeza) | 22 HP (48.4 en cabeza) | 120 HP (180 en cabeza) | M870 aniquiladora a quemarropa |
| **Cadencia (RPM)** | 571 RPM (0.105s) | 923 RPM (0.065s) | 75 RPM (0.80s) | Cadencia alta vs letalidad lenta |
| **Capacidad cargador** | 30 cartuchos | 33 cartuchos | 6 cartuchos | Equilibrio riesgo/recompensa |
| **Reserva Oleadas** | 120 (4 cargadores) | 165 (5 cargadores) | 36 (6 cargas) | Sostenimiento de fuego en horda |
| **Reserva S&D** | 150 (5 cargadores) | 198 (6 cargadores) | 42 (7 cargas) | Combate táctico por rondas |
| **Mecánica de Recarga** | Cargador (1.70s) | Cargador (1.35s) | Cartucho a cartucho | Recarga rápida vs secuencial |
| **Tiempos recarga M870** | N/A | N/A | 0.35s prep + 0.48s/c + 0.35s fin | Ritmo táctico de inserción |
| **Multiplicador Movilidad** | 1.00 (8.2 / 5.2 m/s) | 1.08 (8.86 / 5.62 m/s) | 0.94 (7.71 / 4.89 m/s) | Agilidad SMG vs pesadez escopeta |
| **Velocidad ADS (lerp)** | 12.0 | 16.0 (+33% rapidez) | 9.0 (-25% pesada) | Transición de mira especializada |
| **Caída de daño (Dropoff)** | Ninguna (100% a toda dist.) | 16m óptimo → 40m mín (x0.48) | 8m óptimo → 24m mín (x0.25) | Restricción efectiva de alcance |
| **Dispersión desde cadera** | 0.011 rad | 0.016 rad | 0.048 rad | Dispersión amplia en escopeta |
| **Dispersión en ADS** | 0.0022 rad | 0.0035 rad | 0.028 rad | Concentración de roseta al apuntar |

---

## 4. Multi-Raycast y Resolución Consolidada de Impactos (M870)

Para la M870 BREACHER, cada disparo calcula 8 rayos independientes en un cono de dispersión aleatoria.

### 4.1 Deduplicación de Bajas y Experiencia

Si varios perdigones impactan en el mismo enemigo, el motor agrupa los daños en una estructura `Map<Enemy, HitData>` antes de llamar a `damageEnemy`:

```javascript
for (let i = 0; i < pellets; i++) {
  // raycast independiente por perdigon con dispersion conica
  if (eDist < wDist && enemy) {
    anyHit = true;
    const dmg = getDamageWithDropoff(weapon, eDist, headshot);
    if (!damagedEnemies.has(enemy)) {
      damagedEnemies.set(enemy, { totalDmg: dmg, lastPoint: h.point, isHeadshot: headshot, dir });
    } else {
      const rec = damagedEnemies.get(enemy);
      rec.totalDmg += dmg;
      if (headshot) rec.isHeadshot = true;
    }
  }
}

for (const [enemy, hitData] of damagedEnemies) {
  const killed = damageEnemy(enemy, hitData.totalDmg, hitData.lastPoint, hitData.isHeadshot, hitData.dir);
  if (killed) {
    kills++;
    waveStats.kills++;
    const curWeapon = progression.getState().selectedWeapon || 'mk7';
    progression.recordKill(curWeapon, hitData.isHeadshot);
  }
}
```

**Garantías comprobadas:**
- Un enemigo alcanzado por hasta 8 perdigones recibe un único evento de daño acumulado.
- Si es abatido, se registra exactamente **1 baja en el marcador**, **1 baja en estadísticas** y **1 única recompensa de XP** (100 XP jugador / 60 XP arma, más bono de headshot si correspondió).
- Cero duplicación o inflación de estadísticas.

---

## 5. Recarga secuencial e interrupción táctica (M870)

La M870 implementa un autómata finito de recarga cartucho a cartucho:
- `idle`: Estado inactivo listo para operar.
- `start` (0.35s): Movimiento inicial de elevación del arma para inserción de cartuchos.
- `shell` (0.48s por cartucho): Cada intervalo incrementa `weapon.ammo` en 1 y decrementa `weapon.reserve` en 1, reproduciendo el sonido procedural `sfxShellInsert()`. El proceso continúa hasta llenar el tubo (6 cartuchos) o agotar la reserva.
- `end` (0.35s): Ciclo de accionamiento de corredera con `sfxPumpAction()` y vuelta a `idle`.

### Contrato de interrupción:
1. Si el jugador presiona disparar durante la recarga y `weapon.ammo > 0`: La recarga se interrumpe inmediatamente y el disparo se ejecuta en el instante sin esperar a completar el cargador.
2. Si el jugador presiona disparar cuando `weapon.ammo === 0`: La interrupción se bloquea y el disparo se previene hasta que al menos un cartucho haya sido cargado.

---

## 6. Integración en Interfaz y Operador 3D del Lobby

### 6.1 Fuente Única de Configuración (Single Source of Truth)
Se eliminó la duplicación de estadísticas de armamento. El catálogo de progresión en `js/progression.js` define identidad, categoría, descripción y nivel de desbloqueo, mientras que el registro `WEAPONS` en `js/weapon.js` es la única autoridad balística.
La ficha técnica de la pestaña Armamento lee directamente de `WEAPONS[w.id]`:
- Daño real (incluyendo multiplicación de perdigones para escopetas).
- Cadencia real derivada de `fireRate` (RPM).
- Calibres dinámicos (5.56 NATO, 9x19mm NATO, 12 GAUGE).
- Barras normalizadas de daño, cadencia, velocidad de apuntado, movilidad y capacidad.

### 6.2 Operador 3D en el Hangar
Al equipar un arma en la pestaña Armamento:
- Se ejecuta `setLobbyWeapon(weaponId)`.
- El modelo procedural sostenido en el pecho del operador "Spectre" en el hangar militar 3D se sustituye dinámicamente por la silueta procedural correspondiente (`buildLobbyWeaponMesh`).
- La selección persiste al iniciar partida o recargar la página.

---

## 7. Motores de Audio Procedural (`js/audio.js`)

Se crearon sintetizadores Web Audio mediante ruido blanco conformado y osciladores analógicos:
- `sfxShotVector`: Detonación supersónica corta de 9mm (0.14s) con filtro pasa-bajos de 6500 Hz en rampa rápida y cuerpo de 220 a 80 Hz.
- `sfxReloadVector`: Clics secos de expulsión y encaje de cargador extendido (1100 Hz, 800 Hz, 1600 Hz).
- `sfxShotShotgun`: Detonación de alta presión calibre 12 (0.35s) con filtro en 3200 Hz y oscilador subgrave de impacto (95 Hz a 25 Hz).
- `sfxPumpAction`: Fricción metálica bifásica de accionamiento de corredera (750 Hz y 1250 Hz).
- `sfxShellInsert`: Clic sordo de alimentación en tubo de cartucho (820 Hz).

---

## 8. Resultados de Validación Automatizada

Se ejecutaron las suites completas sobre Chrome Headless (CDP) y Node.js.

### 8.1 Suite de Validación del Sprint 5 (`scratch/test_sprint5.mjs`)

| Criterio | Prueba | Resultado | Detalle |
| :---: | :--- | :---: | :--- |
| **1** | `mk7_regression_baseline` | **PASS** | Daño 34, cadencia 0.105, mag 30, res 120/150, dropoff null, mob 1.0, ADS 12 |
| **2** | `vector9_unlock_curve` | **PASS** | Bloqueada en Nivel 1-3, desbloqueada automáticamente al Nivel 4 |
| **3** | `m870_unlock_curve` | **PASS** | Bloqueada en Nivel 1-7, desbloqueada automáticamente al Nivel 8 |
| **4** | `locked_weapons_not_equippable` | **PASS** | Intentar equipar arma bloqueada retorna `false` y conserva MK-7 |
| **5** | `planned_weapons_not_equippable` | **PASS** | Armas planificadas (AK-12, MP-5K, MK-48) no equipables en ningún nivel |
| **6** | `weapon_selection_persistence` | **PASS** | Vector-9 seleccionada persiste en `localStorage` tras recarga completa |
| **7** | `spawn_waves_vector9` | **PASS** | Inicio de Oleadas con Vector-9 (mag 33, res 165, RPM 923, 1 perdigón) |
| **8** | `spawn_snd_m870` | **PASS** | Inicio de S&D con M870 (mag 6, res 42, 8 perdigones) |
| **9** | `damage_values_all_weapons` | **PASS** | MK-7: 34, Vector-9: 22, M870: 15/perdigón (120 máx total) |
| **10** | `fire_rate_and_cooldowns` | **PASS** | MK-7: 571 RPM, Vector-9: 923 RPM, M870: 75 RPM |
| **11** | `ammo_consumption_and_empty_click` | **PASS** | Consumo 1 a 1; disparo en seco produce clic acústico y cooldown de 0.25s |
| **12** | `shell_reload_and_interruption` | **PASS** | Interrupción inmediata al disparar con `ammo > 0`; bloqueo si `ammo === 0` |
| **13** | `ads_speed_differentiation` | **PASS** | Vector-9 (16.0) > MK-7 (12.0) > M870 (9.0) |
| **14** | `distance_damage_dropoff_curves` | **PASS** | Vector 22 HP (<=16m) → 10.56 HP (>=40m); M870 15 HP (<=8m) → 3.75 HP (>=24m) |
| **15** | `shotgun_conical_spread` | **PASS** | 8 perdigones cónicos con dispersión en cadera (0.048) mayor a ADS (0.028) |
| **16** | `consolidated_damage_zero_duplicate_xp` | **PASS** | 8 perdigones en 1 enemigo otorgan exactamente 1 baja y 100/60 XP |
| **17** | `lobby_operator_weapon_sync` | **PASS** | Operador 3D actualiza arma sostenida en mano al cambiar equipamiento |
| **18** | `ten_cycles_loadout_leak_check` | **PASS** | 10 intercambios cíclicos de arma con 0 fugas de geometrías o memoria |
| **19** | `mesh_material_stability` | **PASS** | Modelos 3D procedurales cargados con jerarquías completas (>5 mallas c/u) |
| **20** | `zero_javascript_errors` | **PASS** | Cero excepciones o errores de consola durante la ejecución |

### 8.2 Corrección de Cuantización de Cadencia (Sprint 5.1: Acumulador Temporal)

En el Sprint 5 inicial, el reseteo discreto del temporizador (`weapon.cooldown = weapon.fireRate`) descartaba el residuo fraccionario de tiempo entre frames, causando que la MK-7 perdiera un 21.2% de cadencia a 30 FPS (450 RPM vs 571 RPM nominal).

En el **Sprint 5.1**, se implementó un acumulador temporal continuo que conserva el residuo fraccionario:
```javascript
weapon.cooldown = Math.max(0, weapon.cooldown <= 0 ? weapon.cooldown + weapon.fireRate : weapon.fireRate);
```

#### Comparativa de Cadencia Antes (Sprint 5) vs Después (Sprint 5.1)

| Arma | Cadencia Nominal | FPS | Frame dt | RPM Inicial (Sprint 5) | Desviación Inicial | RPM Corregido (Sprint 5.1) | Desviación Corregida |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MK-7** | 571 RPM (0.105s) | **30** | 33.33 ms | 450 RPM | -21.2% | **572 RPM** | **+0.2%** |
| **MK-7** | 571 RPM (0.105s) | **60** | 16.67 ms | 515 RPM | -9.8% | **572 RPM** | **+0.2%** |
| **MK-7** | 571 RPM (0.105s) | **120** | 8.33 ms | 554 RPM | -3.0% | **572 RPM** | **+0.2%** |
| **VECTOR-9** | 923 RPM (0.065s) | **30** | 33.33 ms | 900 RPM | -2.5% | **924 RPM** | **+0.1%** |
| **VECTOR-9** | 923 RPM (0.065s) | **60** | 16.67 ms | 900 RPM | -2.5% | **924 RPM** | **+0.1%** |
| **VECTOR-9** | 923 RPM (0.065s) | **120** | 8.33 ms | 900 RPM | -2.5% | **924 RPM** | **+0.1%** |
| **M870** | 75 RPM (0.800s) | **30** | 33.33 ms | 72 RPM | -4.0% | **75 RPM** | **0.0%** |
| **M870** | 75 RPM (0.800s) | **60** | 16.67 ms | 75 RPM | 0.0% | **76 RPM** | **+1.3%** |
| **M870** | 75 RPM (0.800s) | **120** | 8.33 ms | 75 RPM | 0.0% | **75 RPM** | **0.0%** |

### 8.3 Prevención Estricta de Ráfagas Artificiales (Anti-Burst Protection)

Para impedir ráfagas accidentales tras periodos de inactividad, pausas, cambio de pestaña o picos de lag (framerate drop):
1. **Inactividad:** Cuando el jugador no mantiene presionado el disparador (`!mouseDown`), el temporizador se bloquea en cero y nunca acumula saldo negativo:
   ```javascript
   if (!mouseDown && weapon.cooldown < 0) weapon.cooldown = 0;
   ```
2. **Abrazadera de déficit máximo:** Se acota el déficit máximo admisible a `-weapon.fireRate`, garantizando que jamás se acumule más de un disparo de crédito temporal:
   ```javascript
   else if (weapon.cooldown < -weapon.fireRate) weapon.cooldown = -weapon.fireRate;
   ```
3. **Reanudación de pausa:** En `resumeGame()`, `weapon.cooldown = Math.max(0, weapon.cooldown);` evita disparos instantáneos al volver del menú.
4. **Validación empírica:** En simulación de pico de 250 ms (5 sub-pasos de 50 ms), el motor disparó un máximo de 3 proyectiles de MK-7 (exactamente los permitidos en 250 ms por su cadencia de 105 ms), con cero ráfagas multi-proyectil por paso de simulación (`maxShotsPerStep <= 1`).

### 8.4 Verificación de Impactos Mixtos en M870 (Deduplicación Estricta)

Se probó un escenario de impacto mixto donde los 8 perdigones de la M870 impactan sobre un único enemigo con zonas de daño diferenciadas:
- 3 perdigones en cabeza ($3 \times 22.5\text{ HP} = 67.5\text{ HP}$)
- 5 perdigones en torso ($5 \times 15.0\text{ HP} = 75.0\text{ HP}$)
- **Daño total consolidado:** $142.5\text{ HP}$ (suficiente para abatir al enemigo de 100 HP)

**Resultados medidos en el motor:**
- Hostiles en el mapa de resolución: `1`.
- Bajas registradas en marcador y estadísticas: `1` (cero duplicaciones).
- Eventos de XP emitidos: `1` (cero duplicaciones).
- XP otorgada al jugador: `+150 XP` (+100 baja + 50 headshot).
- XP otorgada a la M870: `+90 XP` (+60 baja + 30 headshot).

### 8.5 Pruebas Profundas de Memoria y Estabilidad de Recursos (`renderer.info.memory`)

Se evaluó la integridad de la memoria WebGL en Three.js r160 mediante la suite `tests/test_memory_deep.mjs`:
- **20 cambios consecutivos de arma en el armero (`mk7` → `vector9` → `m870`):**
  - Crecimiento de geometrías (`renderer.info.memory.geometries`): `+0`.
  - Crecimiento de texturas (`renderer.info.memory.textures`): `+0`.
  - Recuento de mallas hijas en escena: estable en exactamente `26` mallas en las 20 iteraciones.
- **10 ciclos completos de Oleadas (iniciar partida → volver al lobby):**
  - Crecimiento neto de geometrías: `0` (estabilidad idéntica entre inicio y final).
- **10 ciclos completos de Buscar y Destruir (creación de bomba C4 → detonación/desactivación → volver al lobby):**
  - Crecimiento neto de geometrías: `0` (las geometrías de la bomba se liberan con `geometry.dispose()`).
- **Muerte del jugador y reintento de partida (Retry tras K.I.A.):**
  - Liberación correcta de entidades enemigas y efectos sin acumulación de objetos huérfanos.

### 8.6 Resumen Global de Pruebas Ejecutadas (68/68 PASS)

Todas las suites se encuentran versionadas bajo el directorio `tests/` y pueden ejecutarse de manera unificada mediante `node tests/run_all.mjs`:

| Suite | Componente / Ámbito | Pruebas | Pasadas | Fallidas |
| :--- | :--- | :---: | :---: | :---: |
| `tests/test_sprint5.mjs` | 20 criterios de aceptación de armamento modular (Hito 9) | 20 | 20 | 0 |
| `tests/test_sprint5_closure.mjs` | Cadencia, impactos mixtos M870, recarga interrumpible, persistencia | 5 | 5 | 0 |
| `tests/test_memory_deep.mjs` | Cadencia real en navegador, anti-burst, 20 swaps, 10 oleadas, 10 S&D | 6 | 6 | 0 |
| `tests/test_progression_unit.mjs` | Fórmulas matemáticas XP, curvas 1–50 / 1–20, persistencia versionada | 6 | 6 | 0 |
| `tests/test_progression_browser.mjs` | UI Armamento, filtrado de categorías, XP en combate real | 7 | 7 | 0 |
| `tests/test_sprint3.mjs` | Navegación de interfaz estilo Warzone, camuflajes, responsive | 10 | 10 | 0 |
| `tests/test_engine_lifecycle.mjs` | Ciclo de vida del motor (pausas, oleadas, S&D, fugas) | 14 | 14 | 0 |
| **TOTAL GENERAL** | **Validación integral automatizada del proyecto (`node tests/run_all.mjs`)** | **68** | **68** | **0** |

---

## 9. Archivos modificados y estado del repositorio

- `js/audio.js`: Adición de generadores Web Audio para Vector-9 y M870.
- `js/weapon.js`: Registro declarativo `WEAPONS`, funciones `setWeapon`, `getDamageWithDropoff`, mallas procedurales para MK-7, Vector-9, M870 y mallas para el lobby 3D con disposición de memoria WebGL.
- `js/progression.js`: Marcado de `vector9` y `m870` como `IMPLEMENTED` con sus niveles 4 y 8; desacoplamiento de estadísticas.
- `js/lobby.js`: Exportación de `setLobbyWeapon` y actualización dinámica del arma empuñada por el operador en el hangar.
- `js/main.js`: Integración de armas en `shoot`, cálculo multi-perdigón con daño consolidado, recarga secuencial con interrupción para M870, velocidades de ADS y movilidad escaladas por arma, sincronización en `startGame` y `backToMenu`.

**Regla de comentarios:** Verificado formalmente mediante inspección de diferencias en Git: **cero comentarios añadidos** en todos los archivos modificados.

---

## 10. Riesgos identificados y mitigaciones

1. **Riesgo:** Alta cadencia de la Vector-9 (923 RPM) podría generar desincronización de disparos con caídas de framerate.
   - **Mitigación:** El temporizador `weapon.cooldown` opera por integración de tiempo delta (`dt`) en el paso de simulación desacoplado del refresco de pantalla.
2. **Riesgo:** Dispersión de perdigones de la M870 calculando 8 raycasts simultáneos por disparo.
   - **Mitigación:** La lista de objetivos se filtra estrictamente a enemigos vivos antes del raycast y se reutiliza el vector de posición de cámara, ejecutándose en menos de 0.2ms por ráfaga.
3. **Riesgo:** Pérdida de arma equipada si el usuario no tiene nivel suficiente tras manipular `localStorage`.
   - **Mitigación:** `isWeaponUnlocked` valida en tiempo de carga; si el arma guardada no es válida o está bloqueada, el motor conmuta automáticamente a la `'mk7'`.

---

## 11. Recomendaciones para el Sprint 6

1. **Sistema de Accesorios (Gunsmith Ligero):**
   - Permitir equipar miras ópticas (Red Dot, Holográfica), cañones y silenciadores sobre las plataformas existentes (`mk7`, `vector9`, `m870`).
2. **Arma Secundaria:**
   - Habilitar la pistola **P-12 TACTICAL** como secundaria con cambio rápido de arma (`tecla 1/2` o `rueda del ratón`).
3. **Animaciones Procedurales Avanzadas:**
   - Añadir sway inercial según el peso del arma al girar la cámara bruscamente.
4. **Preparación de Lanzamiento v0.2.0-alpha:**
   - Una vez aprobado este informe, formalizar el commit local del Sprint 5 y preparar la versión `v0.2.0-alpha`.
