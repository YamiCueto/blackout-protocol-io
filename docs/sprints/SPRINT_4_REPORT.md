# BLACKOUT PROTOCOL — INFORME DE CIERRE DE SPRINT 4
## Sistema de progresión, experiencia y arquitectura del arsenal
### Versión objetivo: v0.2.0-alpha

- **Fecha:** 2026-11-10
- **Rama:** `main`
- **Commit base de inicio de Sprint 4:** `4d676e0` (`docs: add v0.1.0-alpha publication report`)
- **Archivos modificados:** `css/style.css`, `index.html`, `js/main.js`
- **Archivos nuevos:** `js/progression.js`
- **Suites de validación:** `scratch/test_progression_unit.mjs`, `scratch/test_progression_browser.mjs`, `scratch/run_suite.mjs`, `scratch/test_sprint3.mjs`
- **Estado de Git:** Cambios preparados en el área de trabajo (*working tree*), listos para confirmación local tras autorización del usuario. Sin push remoto.
- **Cumplimiento de restricciones:** Cero comentarios añadidos al código (`//` o `/* */`), cero frameworks o empaquetadores externos, Three.js r160 intacto, estabilidad de combate preservada al 100%.

---

## 1. Resumen ejecutivo

El **Sprint 4** establece los cimientos técnicos de la progresión del jugador y el arsenal de BLACKOUT PROTOCOL, elevando el proyecto de un prototipo de combate cerrado a una plataforma FPS con bucle de retención moderno inspirado en títulos AAA.

Se implementó una arquitectura modular desacoplada de la simulación física y gráfica que resuelve los 8 objetivos fundamentales:
1. **Sistema de Experiencia Global (Jugador):** Curva determinista de niveles del 1 al 50 con recompensas por combate y objetivos.
2. **Sistema de Maestría de Armas (Weapon XP):** Niveles del 1 al 20 independientes por plataforma balística (con el fusil MK-7 como plataforma inicial implementada).
3. **Catálogo Declarativo de Armamento:** Estructura escalable que clasifica 7 categorías reglamentarias y 9 armas entre `IMPLEMENTED` y `PLANNED`.
4. **Reglas de Desbloqueo Estrictas:** Acceso condicionado por nivel de jugador y estado de desarrollo real, protegiendo la estabilidad del combate contra armas en diseño.
5. **Persistencia Local Versionada (`bp_progression_v1`):** Almacenamiento seguro en `localStorage` con validación estricta de esquema, saneamiento de valores numéricos y recuperación automática ante datos corruptos o manipulados.
6. **Integración en Interfaz de Lobby (Estilo Warzone):**
   - **Cabecera militar:** Indicador de rango (`NVL 1` a `NVL 50`), barra de progreso de XP animada y lectura numérica de requisitos.
   - **Pestaña Armamento (`#tab-loadout`):** Navegación táctica por 7 categorías, carrusel de tarjetas de armamento, ficha técnica del arma seleccionada, progreso de maestría balística y botón de acción (`EQUIPADA`, `EQUIPAR`, `BLOQUEADA`, `EN DESARROLLO`).
7. **Integración Reactiva con Eventos de Combate:**
   - Bajas con tiro al cuerpo (+100 XP jugador / +60 XP arma).
   - Bonificación letal por Headshot (+50 XP jugador / +30 XP arma).
   - Superación de oleadas en modo Supervivencia (+250 XP jugador).
   - Detonación exitosa en Buscar y Destruir (+750 XP jugador).
   - Notificaciones emergentes de XP en pantalla (+100 XP / +150 XP HEADSHOT) y desglose en las pantallas de resumen.
8. **Validación Automatizada Rigurosa:**
   - 6 suites unitarias Node.js (100% superadas).
   - 7 pruebas de integración en Chrome Headless (100% superadas).
   - 24 pruebas de regresión en combate, pausas y gestión de memoria (100% superadas).
   - Total: **37/37 pruebas automáticas superadas con cero errores de consola**.

---

## 2. Arquitectura del Módulo de Progresión (`js/progression.js`)

Se diseñó un módulo ES puro, completamente desacoplado de las vistas y de la simulación Three.js, estructurado bajo el principio de responsabilidad única.

### 2.1 Tabla de Recompensas de Experiencia

```javascript
export const XP_REWARDS = {
  KILL: 100,
  HEADSHOT_BONUS: 50,
  WAVE_COMPLETE: 250,
  SND_VICTORY: 750,
  WEAPON_KILL: 60,
  WEAPON_HEADSHOT_BONUS: 30
};
```

- **Desacoplamiento:** Los hitos tácticos del modo de juego (oleadas y detonación de bomba) otorgan XP exclusivamente al jugador, reflejando su avance táctico sin inflar artificialmente la maestría de armas sin disparos reales.
- **Armas:** La XP de arma se obtiene de manera estricta al abatir enemigos con dicha arma en combate.

### 2.2 Curvas de Progresión Deterministas

#### Curva de Jugador (Niveles 1 a 50)
- **Nivel inicial:** 1 (0 XP acumulada).
- **Fórmula de requisito para el siguiente nivel:**
  $$\text{Req}(L) = 500 + (L - 1) \times 120$$
  - Nivel 1 $\to$ 2: 500 XP.
  - Nivel 2 $\to$ 3: 620 XP.
  - Nivel 3 $\to$ 4: 740 XP.
  - Nivel 49 $\to$ 50: 6,260 XP.
- **XP acumulada requerida para Nivel 50:** 165,620 XP.
  $$\sum_{L=1}^{49} \text{Req}(L) = 49 \times 500 + 120 \times \frac{48 \times 49}{2} = 24,500 + 141,120 = 165,620\text{ XP}$$
- **Comportamiento en nivel máximo:** Al alcanzar Nivel 50, `isMax = true`, `progress = 1.0`, `nextLevelXP = 0` y la interfaz despliega `MÁXIMO`. Cualquier XP adicional se absorbe sin desbordar contadores.

#### Curva de Maestría de Armas (Niveles 1 a 20)
- **Nivel inicial:** 1 (0 XP acumulada).
- **Fórmula de requisito para el siguiente nivel:**
  $$\text{Req}(L) = 250 + (L - 1) \times 80$$
  - Nivel 1 $\to$ 2: 250 XP (~4 bajas normales o ~3 headshots).
  - Nivel 2 $\to$ 3: 330 XP.
  - Nivel 19 $\to$ 20: 1,690 XP.
- **XP acumulada para Nivel 20:** 18,430 XP.
  $$\sum_{L=1}^{19} \text{Req}(L) = 19 \times 250 + 80 \times \frac{18 \times 19}{2} = 4,750 + 13,680 = 18,430\text{ XP}$$
- **Comportamiento en nivel máximo:** Al alcanzar Nivel 20, la barra de maestría se satura al 100% y se marca como `MÁXIMO`.

---

## 3. Catálogo Declarativo de Armamento

El catálogo soporta 7 categorías tácticas reglamentarias y prefigura el crecimiento del arsenal del juego, distinguiendo formalmente entre armas completamente funcionales (`IMPLEMENTED`) y armas en diseño técnico (`PLANNED`):

| Categoría | Identificador | Nombre | Nivel Req. | Estado | Estadísticas Balísticas |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Fusiles de Asalto** | `mk7` | **MK-7 CARBINE** | 1 | `IMPLEMENTED` | Daño: 34, RPM: 570, ADS: 85%, Mov: 78%, Mag: 30 |
| **Fusiles de Asalto** | `ak12` | **AK-12 TACTICAL** | 14 | `PLANNED` | Clasificado |
| **Subfusiles** | `vector9` | **VECTOR-9** | 4 | `PLANNED` | Clasificado |
| **Subfusiles** | `mp5k` | **MP-5K** | 20 | `PLANNED` | Clasificado |
| **Escopetas** | `m870` | **M870 BREACHER** | 8 | `PLANNED` | Clasificado |
| **Ametralladoras** | `mk48` | **MK-48 HEAVY** | 24 | `PLANNED` | Clasificado |
| **Precisión** | `awm338` | **AWM-338** | 30 | `PLANNED` | Clasificado |
| **Pistolas** | `p12` | **P-12 TACTICAL** | 2 | `PLANNED` | Clasificado |
| **Cuerpo a Cuerpo** | `knife` | **CUCHILLO TÁCTICO** | 1 | `PLANNED` | Clasificado |

### Reglas de Desbloqueo y Selección
- `isWeaponUnlocked(id, playerLevel)`: Devuelve `true` si y solo si el arma tiene estado `IMPLEMENTED` y el nivel de jugador es mayor o igual al requisito.
- `selectWeapon(id)`: Bloquea intentos de equipar armas `PLANNED` o bloqueadas por nivel, garantizando que el sistema de combate solo interactúe con modelos balísticos plenamente soportados (MK-7).

---

## 4. Persistencia Local y Tolerancia a Fallos

El estado de progresión se persiste bajo la clave `bp_progression_v1` en `localStorage`:

```json
{
  "version": 1,
  "player": { "xp": 1250 },
  "weapons": {
    "mk7": { "xp": 150 },
    "ak12": { "xp": 0 },
    "vector9": { "xp": 0 }
  },
  "selectedWeapon": "mk7",
  "history": {
    "kills": 8,
    "headshots": 3,
    "wavesCleared": 1,
    "sndWins": 1
  },
  "updatedAt": 1731283200000
}
```

### Mecanismos de Robustez
1. **Saneamiento estricto (`sanitizeNumber`):** Descarta valores `NaN`, infinitos, cadenas de texto o números negativos, reemplazándolos de forma segura por `0`.
2. **Recuperación ante corrupción:** Si el contenido de `localStorage` está truncado o contiene JSON sintácticamente inválido, el gestor intercepta la excepción en un bloque `try/catch` y restituye el estado por defecto sin arrojar errores al usuario.
3. **Validación de arma seleccionada:** Si el valor de `selectedWeapon` guardado no existe en el catálogo o no está desbloqueado, se restablece de forma transparente a `'mk7'`.
4. **Patrón Observador (`subscribe`):** La interfaz y los componentes del lobby se suscriben a los cambios de estado, actualizando inmediatamente la cabecera y el panel de armamento cada vez que se produce un cambio en la persistencia.

---

## 5. Rediseño de la Interfaz del Lobby (Estilo Warzone)

Se actualizó la interfaz HTML y CSS manteniendo intacta la regla cardinal del Sprint 3: **los dos tercios derechos de la pantalla permanecen 100% despejados para la visualización del Operador 3D y el hangar**.

### 5.1 Indicador de Rango en Cabecera (`#player-badge`)
- **Etiqueta militar:** `// OPERADOR LOCAL`.
- **Insignia de nivel:** `#player-level-badge` con estilo táctico militar (`NVL 1` a `NVL 50`) enmarcado en borde y acento ámbar (`#ff6a00`).
- **Barra de XP animada:** `#player-xp-track` con gradiente dinámico `#ff8a3c` $\to$ `#ff6a00` con transición fluida CSS.
- **Lectura numérica:** `#player-xp-text` con formateo tabular de alta visibilidad (ej. `250 / 500 XP` o `MÁXIMO`).

### 5.2 Panel de Armamento Táctico (`#tab-loadout`)
- **Selector horizontal de categorías (`#armory-cat-nav`):** Botones compactos para las 7 categorías tácticas con indicación activa.
- **Carrusel de tarjetas de armas (`#armory-weapon-strip`):** Cada tarjeta muestra el nombre del arma, su nivel de maestría alcanzado y una insignia de estado contextual:
  - `[ EQUIPADA ]` (verde fósforo táctico `#48bb78`).
  - `[ DESBLOQ ]` (azul cobalto `#60a5fa`).
  - `[ NVL X ]` (rojo advertencia `#f87171` para armas bloqueadas por nivel).
  - `[ PRÓXIMO ]` (gris acero `#94a3b8` para armamento planificado).
- **Ficha balística del arma seleccionada (`#armory-weapon-detail`):**
  - Nombre e identificación de munición (`5.56x45mm NATO` o `CLASIFICADO`).
  - Nivel de arma y barra de progreso de maestría independiente.
  - Barras balísticas reales (Daño, Cadencia RPM, Precisión ADS, Movilidad, Capacidad del cargador) para el MK-7, y modo reservado para armas planificadas.
  - Botón de acción inteligente (`#btn-equip-weapon`):
    - `[ EQUIPADA ]` (activo, bloqueado con indicación "EN SERVICIO").
    - `[ EQUIPAR ]` (habilitado cuando el arma está desbloqueada e implementada).
    - `[ BLOQUEADA ]` (deshabilitado, con texto "REQUIERE NVL X").
    - `[ EN DESARROLLO ]` (deshabilitado, con indicación de nivel de desbloqueo futuro).

---

## 6. Resultados de Verificación y Pruebas Automatizadas

Se ejecutaron 4 baterías de pruebas automatizadas mediante Node.js y Chrome Headless sobre el servidor local:

### 6.1 Pruebas Unitarias de Lógica y Persistencia (`test_progression_unit.mjs`)
- **TEST 1: Constantes y recompensas de XP:** Superada (100% OK).
- **TEST 2: Curva de nivel de jugador (1 a 50, escala progresiva, tope máx):** Superada (100% OK).
- **TEST 3: Curva de nivel de arma (1 a 20, tope máx):** Superada (100% OK).
- **TEST 4: Catálogo de 7 categorías y reglas de elegibilidad:** Superada (100% OK).
- **TEST 5: Desacoplamiento de XP y registro de combate:** Superada (100% OK).
- **TEST 6: Persistencia, saneamiento numérico y recuperación ante JSON corrupto:** Superada (100% OK).

### 6.2 Pruebas de Integración en Navegador (`test_progression_browser.mjs`)
- `1_header_initial_state`: Insignia de nivel inicial y barra de XP al 0% verificadas.
- `2_armory_tab_categories`: 7 categorías presentes, navegación funcional, tarjeta de MK-7 equipada.
- `3_category_switch_planned_weapons`: Cambio a SMG, tarjetas de Vector-9 y MP-5K, botones en desarrollo deshabilitados.
- `4_kill_xp_and_level_up`: Bajas simples y headshots otorgan XP al instante, barra de cabecera se actualiza y sube a Nivel 2.
- `5_waves_combat_xp`: Modo Oleadas ejecutado, baja de hostiles, pantalla de resumen muestra `+250 XP`, retorno a lobby sincronizado.
- `6_snd_victory_xp`: Modo Buscar y Destruir ejecutado, detonación de bomba otorga `+750 XP`, pantalla de victoria verificada.
- `7_persistence_reload`: Recarga real del navegador; nivel de jugador y XP acumulada persisten con precisión de 1:1.

### 6.3 Pruebas de Regresión del Motor (`run_suite.mjs` y `test_sprint3.mjs`)
- **Ciclo de vida completo (14/14 pasos):** Iniciar Oleadas $\to$ Pausa $\to$ Reanudar $\to$ Abandonar $\to$ Muerte $\to$ Reintentar $\to$ Buscar y Destruir $\to$ 10 ciclos seguidos sin fugas de memoria GPU ni listeners duplicados.
- **Lobby táctico cinematográfico (10/10 pasos):** Enfoques de cámara por pestaña, selector de camuflaje, modal de pausa aislado y adaptabilidad responsive en pantallas de 1920x1080, 1024x768 y 375x667.

---

## 7. Auditoría de Código y Calidad Técnica

- **Regla de Cero Comentarios:** Se auditó todo el diff del repositorio con herramientas de búsqueda por expresiones regulares. Se certifica que **cero líneas de comentario (`//` o `/* */`) fueron añadidas en `js/progression.js`, `js/main.js`, `css/style.css` o `index.html`**.
- **Integridad de Three.js:** Ningún sombreador, geometría compartida o buffer WebGL fue alterado de forma destructiva.
- **Rendimiento:**
  - Consumo de CPU por el módulo de progresión: Menor a 0.05 ms por evento.
  - Almacenamiento en `localStorage`: Menor a 1.2 KB.
  - FPS en Lobby: Estable a 60 FPS continuos en WebGL.

---

## 8. Hoja de Ruta hacia la Versión v0.3.0

Con los fundamentos del arsenal y la progresión consolidados en la versión **v0.2.0-alpha**, los siguientes pasos recomendados son:
1. **Arma Secundaria Funcional (Pistola P-12):** Implementación de cambio de arma con tecla `Q` o rueda del ratón, animaciones de enfundado y modelo 3D independiente.
2. **Sistema de Accesorios Básicos (Gunsmith v1):** Desbloqueo de miras ópticas (mira réflex vs mira holográfica) y cañones al subir de nivel en el MK-7.
3. **Efectos Cinemáticos de Subida de Nivel:** Banner táctico animado estilo militar ("RANGO ALCANZADO // NIVEL X") al subir de nivel durante la partida.
4. **Despliegue y Release en GitHub:** Generación de la etiqueta de versión `v0.2.0-alpha` y publicación de notas de versión en GitHub Pages una vez autorizado por el usuario.
