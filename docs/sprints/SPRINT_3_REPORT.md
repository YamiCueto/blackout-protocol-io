# BLACKOUT PROTOCOL — INFORME DE CIERRE DE SPRINT 3
## Rediseño de interfaz: Lobby táctico cinematográfico

- **Fecha:** 2026-11-10
- **Rama:** `master`
- **Commit base de inicio de Sprint 3:** `4fa1e05` (`Sprint 2: Arquitectura de escenas y lobby cinematografico 3D`)
- **Archivos modificados:** `css/style.css`, `index.html`, `js/lobby.js`, `js/main.js`
- **Archivos nuevos:** Ninguno en el repositorio central (suites de validación y capturas almacenadas en `scratch/`)
- **Estado de Git:** Cambios de Sprint 3 en el área de trabajo (*working tree*), listos para confirmación local tras autorización del usuario. Sin push.
- **Cumplimiento de restricciones:** Cero comentarios añadidos al código (`//` o `/* */`), cero dependencias o librerías externas agregadas, Three.js r160 sin alteraciones, compatibilidad total con los selectores y mecánicas preexistentes.

---

## 1. Diagnóstico del problema y objetivo visual

### 1.1 Limitación previa (Sprint 2)
Al finalizar el Sprint 2, la escena tridimensional del hangar y el modelo procedural del operador táctico se encontraban plenamente renderizados en tiempo real. Sin embargo, la interfaz HTML heredada utilizaba un contenedor centralizado (`.screen { display: flex; flex-direction: column; align-items: center; justify-content: center; }`), ubicando el título gigante, subtítulo y las tarjetas de modo en el centro exacto de la pantalla. Esto producía un efecto de obstrucción visual casi total, tapando la silueta del soldado y relegando el entorno 3D a un papel secundario.

### 1.2 Objetivo del Sprint 3
Transformar el lobby hacia una composición inspirada en *Call of Duty: Warzone* y videojuegos FPS militares AAA, garantizando:
1. **Despejar completamente el centro y la derecha de la pantalla**, convirtiendo al operador táctico y al hangar 3D en los protagonistas visuales indiscutibles.
2. **Estructura en 4 capas tácticas:**
   - **Capa 1 (Fondo 3D):** Hangar industrial, iluminación dinámica, animación de reposo e interpolación de cámara.
   - **Capa 2 (Barra superior):** Identidad de marca, navegación modular (`JUGAR`, `OPERADOR`, `ARMAMENTO`, `AJUSTES`) e indicador de estado del operador local.
   - **Capa 3 (Información contextual izquierda):** Panel de inteligencia táctica (*Mission Intel*), descripción militar, reglas reales de la modalidad y botón de despliegue principal.
   - **Capa 4 (Bandeja inferior de selección):** Tarjetas horizontales compactas (`OLEADAS` y `BUSCAR Y DESTRUIR`) con indicación visual de selección activa.
3. **Pestañas interactivas adicionales:**
   - **OPERADOR:** Ficha técnica de servicio (*Dossier*) y selector de camuflajes tácticos en tiempo real (Urbano Nocturno, Operaciones Negras, Reconocimiento).
   - **ARMAMENTO:** Desglose balístico del fusil reglamentario MK-7 con barras de estadísticas y especificaciones de componentes.
4. **Aislamiento del menú de pausa:**
   - Modal militar táctico centralizado (`#pause-box`), visible únicamente al pausar la partida (`#menu.paused`), ocultando la interfaz del lobby para evitar confusiones de contexto.

---

## 2. Arquitectura de interfaz implementada

### 2.1 Capa 1: Fondo 3D y encuadre dinámico de cámara
- **Reposicionamiento del operador:** Se trasladó de `x = 0.85` a `x = 1.15, z = -0.05` con rotación `ry = -0.38 rad`, ubicándolo con precisión en el tercio derecho de la pantalla, dejando libres los dos tercios izquierdos para la interfaz.
- **Ajuste de atrezo (props):** La pila de cajas de suministros se desplazó de `x: 3.2` a `x: 4.1` para enmarcar la figura del operador sin interferir con la cámara.
- **Iluminación cinemática optimizada:**
  - **Luz de recorte (Rim Light):** Reubicada en `(0.4, 2.1, -1.4)` con intensidad 4.2 y tono cian táctico (`0x38bdf8`), perfilando nítidamente el casco, hombreras y fusil contra la penumbra del hangar.
  - **Luz de relleno (Fill Light):** Añadida en `(1.0, 1.6, 2.0)` con intensidad 1.5 y color neutro (`0xa0aec0`) para elevar los detalles del chaleco portaplacas y los bolsillos MOLLE.
  - **Visor táctico:** Intensidad de emisión incrementada a 1.6 con resplandor balístico activo.
- **Sistema de encuadre cinemático (`setLobbyView(view)`):**
  - **Vista `play`:** Cámara en `(0.12, 1.38, 3.1)` mirando a `(0.68, 1.18, 0)` (plano medio general con contexto amplio de hangar).
  - **Vista `operator`:** Cámara en `(0.72, 1.45, 2.2)` mirando a `(1.15, 1.32, 0)` (plano medio corto enfocado en el torso, rostro y camuflaje).
  - **Vista `loadout`:** Cámara en `(0.62, 1.25, 2.0)` mirando a `(1.1, 1.1, 0)` (encuadre enfocado en el fusil de asalto y empuñadura).
  - Las transiciones se realizan mediante interpolación esférica suave (`lerp`) con factor temporal `dt * 4`, garantizando un movimiento de cámara cinematográfico sin saltos bruscos.

### 2.2 Capa 2: Barra de navegación superior (`#lobby-header`)
- Barra fija superior a 64px de altura con fondo semi-transparente `linear-gradient` y línea divisoria militar táctica (`rgba(255,255,255,0.08)`).
- **Extremo izquierdo:** Tag táctico `// PROTOCOLO TÁCTICO` y logotipo de alta visibilidad `BLACKOUT/PROTOCOL` con barra inclinada de acento ámbar.
- **Centro:** Navegación modular por pestañas (`.nav-tab`):
  - `JUGAR`: Vista de despliegue y selección de misiones.
  - `OPERADOR`: Ficha de servicio y personalización.
  - `ARMAMENTO`: Inspección balística del fusil MK-7.
  - `AJUSTES`: Acceso directo al panel de configuración gráfica y sonora.
  - Indicador activo mediante subrayado en barra ámbar brillante con resplandor neón (`#ff6a00`).
- **Extremo derecho:** Indicador de sesión local `// OPERADOR LOCAL` con estado activo `• EN ESPERA` en verde fósforo militar (`#48bb78`).

### 2.3 Capa 3: Inteligencia táctica (`#mission-intel` y `.dossier-panel`)
- Panel fijo ubicado en el cuadrante superior izquierdo (`left: 44px; top: 92px; width: 420px;`).
- Construido con fondo táctico oscuro de baja opacidad (`rgba(8,12,18,0.78)`), borde izquierdo ámbar de 3px y filtro de desenfoque de fondo (*backdrop-filter: blur(6px)*).
- **Contenido dinámico sincronizado:**
  - Etiqueta de teatro de operaciones: `// OPERACIÓN NOCTURNA • ZONA INDUSTRIAL`.
  - Título del modo: `OLEADAS` o `BUSCAR Y DESTRUIR`.
  - Subtítulo balístico: `SUPERVIVENCIA TÁCTICA // HOSTILES CRECIENTES` o `DEFENSA DE OBJETIVO // DETONACIÓN A 90s`.
  - Descripción militar explicativa.
  - Tabla de parámetros reales de la simulación:
    - *Oleadas:* Recompensa de ronda (+60 munición / +35 salud) y condición de victoria.
    - *Buscar y Destruir:* Temporizador de detonación (90 segundos) y desactivación acumulada por bots (10 segundos).
  - Botón de despliegue táctico (`#deploy-btn`, `.btn-deploy`): Botón amplio con color ámbar, sombra luminosa (*glow*) y respuesta al cursor.

### 2.4 Capa 4: Selector horizontal inferior (`.modes` y `.mode-card`)
- Ubicado en la esquina inferior izquierda (`left: 44px; bottom: 42px; display: flex; gap: 16px;`).
- Tarjetas horizontales tácticas de 220px de ancho con encabezado militar (`MODO 01`, `MODO 02`), estado operativo (`LISTO`, `ARMADA`), tipografía condensada y llamada a la acción.
- **Estado seleccionado (`.selected`):** Borde ámbar sólido de 2px, fondo cálido atenuado y resplandor perimetral sutil.
- **Ergonomía de interacción triple:**
  1. *Hover:* Al pasar el ratón por encima de una tarjeta, se previsualiza inmediatamente su ficha de inteligencia táctica a la izquierda.
  2. *Click en tarjeta:* Inicia directamente la partida en esa modalidad (garantizando compatibilidad 100% con pruebas automatizadas y flujos rápidos).
  3. *Botón de despliegue / Barra espaciadora:* Permite iniciar la modalidad seleccionada en pantalla grande con tecla rápida.

### 2.5 Aislamiento del menú de pausa (`#pause-box`)
- Cuando la partida se pausa (`phase === 'PAUSED'`):
  - La clase `#menu.paused` se añade a `#menu`.
  - La barra superior `#lobby-header`, las vistas `.lobby-view`, las tarjetas `.modes` y las guías `#lobby-keys` quedan estrictamente ocultas (`display: none !important`).
  - Se despliega únicamente la ventana modal `#pause-box` en el centro de la pantalla, con fondo militar semi-opaco, borde sutil ámbar y los botones reglamentarios:
    - `Reanudar` (`#resume-btn`)
    - `Ajustes` (`#settings-btn`)
    - `Abandonar partida` (`#quit-btn`)
- Al regresar al lobby (`backToMenu()`), `#pause-box` se oculta, la barra superior y la pestaña `JUGAR` se reactivan de forma limpia, y la cámara vuelve suavemente a la perspectiva de lobby.

---

## 3. Matriz de atajos de teclado en el Lobby

Para enriquecer la experiencia de usuario táctica, se incorporó navegación ágil por teclado mientras se está en el menú (`phase === 'MENU'`):

| Tecla / Combinación | Acción realizada |
|---|---|
| `Q` | Cambiar a la pestaña anterior (hacia la izquierda) |
| `E` | Cambiar a la pestaña siguiente (hacia la derecha) |
| `1` o `Flecha Izquierda` | Seleccionar modalidad OLEADAS |
| `2` o `Flecha Derecha` | Seleccionar modalidad BUSCAR Y DESTRUIR |
| `Espacio` o `Enter` | Desplegar en combate (iniciar la modalidad seleccionada) |
| `Esc` | Abrir / cerrar menú de ajustes |

---

## 4. Adaptabilidad y diseño responsivo

Se implementaron puntos de ruptura (*media queries*) para preservar la composición en múltiples dispositivos y relaciones de aspecto:

- **Escritorio ancho (> 1024px):** Disposición completa con visión panorámica del operador a la derecha y paneles flotantes a la izquierda.
- **Portátiles / Pantallas medianas (769px – 1024px):** Reducción proporcionada del ancho de paneles a 360px y tarjetas a 190px para mantener despejado el campo visual del soldado.
- **Móviles y tabletas compactas (≤ 768px):**
  - La barra superior se compacta a 54px; se ocultan tags decorativos y badges secundarios para dar prioridad al título y pestañas.
  - El panel de misión se ajusta horizontalmente con ancho completo de márgenes simétricos (`14px`).
  - Las tarjetas de modo se adaptan horizontalmente en proporción flexible.
  - La guía de teclas del teclado se oculta automáticamente.

---

## 5. Resultados de verificación y pruebas automatizadas

Se ejecutaron tres baterías exhaustivas de pruebas mediante CDP (*Chrome DevTools Protocol*) en modo headless:

### 5.1 Suite de estabilidad de escenas del Lobby (`scratch/test_lobby.mjs`)
- `1_lobby_initial_load`: Carga inicial correcta en fase `MENU`, display `flex`, `#loading` ausente: **PASS**
- `2_lobby_idle_animation`: Verificación de draw calls continuos en el lobby (59 calls): **PASS**
- `3_start_waves_from_lobby`: Transición inmediata a combate `PLAYING`, HUD activo: **PASS**
- `4_pause_in_game`: Pausa correcta con Escape, clase `paused` activa, botones visibles: **PASS**
- `5_resume_game`: Reanudación fluida a `PLAYING`, HUD restaurado: **PASS**
- `6_quit_to_lobby`: Retorno seguro al lobby, fase `MENU`, 0 enemigos activos: **PASS**
- `7_start_snd_from_lobby`: Despliegue correcto en modalidad `snd`: **PASS**
- `8_quit_snd_to_lobby`: Retorno seguro desde S&D al lobby: **PASS**
- `9_ten_transitions_memory_stability`: 10 ciclos continuos de alternancia menú-juego sin fugas de memoria: **PASS**
- `10_window_resize`: Adaptación dinámica de proyecciones y resolución en resize: **PASS**
- **Resultado:** 10/10 pruebas superadas (100%).

### 5.2 Suite integral de mecánicas de combate (`scratch/run_suite.mjs`)
- Verificación completa de oleadas, ciclo de vida de IA, sistema de daño con flinch y viñeta, recolección de cadáveres a 9s, detonación de bomba S&D a 90s, derrota por desactivación a 10s, y verificación de fugas en 10 ciclos consecutivos.
- **Resultado:** 14/14 pruebas superadas (100%).

### 5.3 Suite específica de interfaz y navegación Sprint 3 (`scratch/test_sprint3.mjs`)
- `1_play_tab_layout`: Estructura Warzone inicial, título `OLEADAS`, modo predeterminado: **PASS**
- `2_mode_selection_intel`: Cambio a `snd`, actualización dinámica de títulos y parámetros: **PASS**
- `3_tab_operator`: Activación de pestaña de operador, aislamiento de vistas: **PASS**
- `4_operator_camo`: Conmutación de camuflaje a `specops`, actualización de materiales: **PASS**
- `5_tab_loadout`: Activación de pestaña de armamento, despliegue de estadísticas balísticas: **PASS**
- `6_return_to_play_tab`: Retorno a pestaña principal: **PASS**
- `7_deploy_button`: Despliegue en combate mediante el botón `#deploy-btn`: **PASS**
- `8_pause_box_isolation`: Aislamiento modal de `#pause-box` durante la pausa: **PASS**
- `9_quit_restores_lobby`: Restauración completa de la barra superior al abandonar: **PASS**
- `10_responsive_viewports`: Validación de adaptabilidad en viewports móvil y tableta: **PASS**
- **Resultado:** 10/10 pruebas superadas (100%).

**Balance total de pruebas automatizadas: 34 pruebas ejecutadas, 34 superadas (0 fallos, 0 regresiones).**

---

## 6. Métricas técnicas de renderizado

| Métrica | Lobby (`MENU`) | Combate (`PLAYING`) | Pausa (`PAUSED`) |
|---|---|---|---|
| **Escena activa** | `lobbyScene` | `scene` (combate) | `scene` (congelada) |
| **Draw calls** | 58 – 59 | 13 – 50 (según bots) | 13 – 26 |
| **Triángulos** | 876 – 888 | 326 – 962 | 326 |
| **Geometrías activas** | 57 | 102 – 108 | 102 |
| **Texturas activas** | 4 | 4 | 4 |
| **Tasa de refresco objetivo** | 60 FPS estables | 60 FPS estables | 60 FPS estables |

---

## 7. Registro de cambios por archivo

| Archivo | Tipo de cambio | Resumen de modificaciones |
|---|---|---|
| `css/style.css` | Modificado | Nueva arquitectura CSS por capas (barra superior `#lobby-header`, pestañas `.nav-tab`, panel `#mission-intel`, bandeja `.modes`, modal `#pause-box`, selectores de camuflaje, barras balísticas y media queries responsivas). Se reubicó `#diag` en el cuadrante superior derecho para evitar cualquier solapamiento. Cero comentarios añadidos. |
| `index.html` | Modificado | Reestructuración de `#menu` incorporando cabecera militar, vistas separadas (`#tab-play`, `#tab-operator`, `#tab-loadout`), caja de pausa aislada (`#pause-box`) y guía de controles tácticos. Conserva todos los IDs históricos requeridos. |
| `js/lobby.js` | Modificado | Reencuadre y reubicación del operador a la derecha (`x = 1.15`), atrezo reposicionado, luz de relleno frontal y recorte cian incrementada, sistema `setLobbyView(view)` con lerp y función `setOperatorCamo(scheme)`. Cero comentarios añadidos. |
| `js/main.js` | Modificado | Integración de navegación por pestañas (`switchTab`), selección y actualización de inteligencia de misiones (`selectMode`), botón de despliegue, conmutación de camuflajes, atajos por teclado (Q, E, 1, 2, Espacio, Enter) y ciclo de vida de pausa actualizado. Cero comentarios añadidos. |

---

## 8. Recomendaciones para el Sprint 4

1. **Efectos de audio tácticos en la interfaz:**
   - Incorporar pitidos sutiles de interfaz militar al cambiar de pestaña (`sfxClick` afinado o tono de radio militar suave).
   - Sonido de confirmación con mayor peso balístico al pulsar `DESPLEGAR EN COMBATE`.
2. **Animaciones de transición de interfaz:**
   - Añadir transiciones CSS sutiles de entrada (*fade-in slide-up* de 150ms) en los paneles de inteligencia al alternar entre misiones o pestañas.
3. **Persistencia local de selección:**
   - Guardar el camuflaje seleccionado y la última modalidad jugada en `localStorage` mediante el sistema de ajustes existente en `settings.js`.
