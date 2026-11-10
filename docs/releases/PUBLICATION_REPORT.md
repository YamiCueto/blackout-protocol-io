# BLACKOUT PROTOCOL — INFORME DE PUBLICACIÓN
## Versión v0.1.0-alpha

- **Fecha:** 2026-11-10
- **Versión:** `v0.1.0-alpha` (Prerelease)
- **Rama:** `main`
- **Commit de publicación:** `77a0685dd92a40cdf295574cbfe3389e8fb6abd3`
- **Repositorio:** [https://github.com/YamiCueto/blackout-protocol-io](https://github.com/YamiCueto/blackout-protocol-io)
- **URL pública en GitHub Pages:** [https://yamicueto.github.io/blackout-protocol-io/](https://yamicueto.github.io/blackout-protocol-io/)
- **GitHub Release:** [https://github.com/YamiCueto/blackout-protocol-io/releases/tag/v0.1.0-alpha](https://github.com/YamiCueto/blackout-protocol-io/releases/tag/v0.1.0-alpha)
- **Estado de despliegue en GitHub Pages:** `built` (Activo y verificado con respuesta HTTP 200)

---

## 1. Resumen de acciones realizadas

1. **Inspección de línea base y configuración de GitHub Pages:**
   - Se verificó el repositorio remoto `origin` apuntando a `https://github.com/YamiCueto/blackout-protocol-io.git`.
   - Se auditó la compatibilidad de rutas (rutas relativas para CSS y módulos ES, CDN HTTPS para Three.js r160, cero llamadas a `localhost` o rutas absolutas de raíz).
   - Se activó y configuró GitHub Pages mediante GitHub CLI (`gh api -X POST repos/YamiCueto/blackout-protocol-io/pages -f "source[branch]=main" -f "source[path]=/"`), confirmando el build de despliegue estático.

2. **Capturas de pantalla auténticas con Playwright CLI:**
   - Se ejecutó un navegador Chromium en resolución nativa 1920 × 1080 para obtener imágenes 100% auténticas del juego en ejecución, sin overlays de depuración, sin elementos artificiales y con el renderizado completo de Three.js.
   - Capturas generadas y versionadas en `docs/assets/screenshots/`:
     - `lobby.png`: Interfaz Warzone completa, operador 3D en el tercio derecho, iluminación cian de recorte, hangar militar, navegación superior y selector de modalidades.
     - `operator.png`: Pestaña Operador activa con ficha de servicio (*Dossier*) del soldado Spectre, encuadre de cámara medio-corto y botones de camuflaje.
     - `loadout.png`: Pestaña Armamento activa con especificaciones técnicas y barras balísticas del fusil reglamentario MK-7 Carbine.
     - `settings.png`: Pantalla de ajustes con calibración de brillo, campo de visión (FOV), resolución de sombras y volumen maestro.
     - `waves.png`: Partida real en el modo Oleadas (*Survival*) con iluminación nocturna, farolas industriales, silueta del fusil en mano y HUD militar activo (Oleada 1, 5 enemigos, 100 HP, 30/120 munición).
     - `search-destroy.png`: Partida real en Buscar y Destruir (*Objective Defense*) con temporizador `DETONACIÓN 1:27`, 4 hostiles, complejo industrial y objetivo explosivo.

3. **Rediseño completo del README:**
   - Reescrito íntegramente en inglés técnico profesional para la comunidad de código abierto internacional.
   - Inclusión de insignias (*badges*) reales verificadas: versión `v0.1.0-alpha`, Three.js `r160`, JavaScript `ES Modules`, `WebGL 2.0` y `GitHub Pages Live`.
   - Botón destacado de juego online inmediato sin instalación.
   - Documentación exhaustiva y honesta de mecánicas, HUD, controles de combate y navegación por teclado en el lobby.
   - Tabla comparativa de galería visual con rutas relativas a GitHub.
   - Guía de ejecución local detallando la necesidad de servir por HTTP (`python -m http.server 8000`) debido a las restricciones CORS de los módulos ES en `file://`.
   - Hoja de ruta (*Roadmap*) oficial desde `v0.1.0-alpha` hasta `v1.0.0`.
   - Declaración transparente del estado Alpha y titularidad de derechos del autor Yamid Cueto.

4. **Preparación y publicación de la Release:**
   - Documento de versión creado en `docs/releases/v0.1.0-alpha.md`.
   - Commit de publicación `77a0685` (`docs: prepare BLACKOUT PROTOCOL v0.1.0-alpha release`) enviado a `origin/main`.
   - Tag anotado `v0.1.0-alpha` creado y publicado remotamente.
   - Creación de la GitHub Prerelease oficial vinculada al tag y documentada con las notas de versión.

---

## 2. Resultados de la validación en GitHub Pages (Producción)

Se ejecutó la suite automatizada de Playwright (`scratch/validate_github_pages.mjs`) directamente contra la URL pública `https://yamicueto.github.io/blackout-protocol-io/`.

| # | Verificación | Estado | Detalle |
|---|---|:---:|---|
| 1 | Código de respuesta HTTP | **PASS** | HTTP 200 OK |
| 2 | Página inicial visible | **PASS** | `#loading` en `display: none`, `#menu` en `display: flex` |
| 3 | Carga de Three.js r160 | **PASS** | Importmap resuelto desde CDN jsdelivr |
| 4 | Canvas WebGL operativo | **PASS** | Contexto WebGL activo, resolución 1920 × 1080 |
| 5 | Operador 3D visible | **PASS** | Grupo procedural renderizado en el hangar |
| 6 | Hangar 3D visible | **PASS** | Escena `lobbyScene` con iluminación y niebla |
| 7 | Barra de navegación superior | **PASS** | 4 pestañas detectadas y estilizadas |
| 8 | Pestaña Operador | **PASS** | Ficha de servicio visible al hacer clic |
| 9 | Pestaña Armamento | **PASS** | Desglose balístico del fusil MK-7 visible |
| 10 | Pantalla de Ajustes | **PASS** | Modal de configuración desplegado y botón volver operativo |
| 11 | Selección de modos | **PASS** | Ficha de misión sincronizada dinámicamente |
| 12 | Inicio de modo Oleadas | **PASS** | Transición limpia a `PLAYING`, HUD activo y menú oculto |
| 13 | Inicio de Buscar y Destruir | **PASS** | Transición a S&D, HUD con cuenta regresiva `DETONACIÓN` |
| 14 | Retorno al lobby | **PASS** | Pausa y abandono (`#quit-btn`) restauran el lobby intacto |
| 15 | Consola JavaScript | **PASS** | 0 errores propios en consola |
| 16 | Peticiones de recursos | **PASS** | 0 recursos fallidos (sin 404 / 500) |
| 17 | Adaptabilidad responsiva | **PASS** | Verificada en resoluciones de escritorio, tableta (768px) y móvil (375px) |

**Resultado global de producción: 17/17 verificaciones superadas exitosamente (100%).**

---

## 3. Limitaciones conocidas y consideraciones

1. **Activación de Pointer Lock en navegadores reales:**
   - La API de Pointer Lock requiere que el usuario interactúe físicamente (clic) con el elemento canvas. Si el navegador cancela o rechaza el bloqueo por falta de foco en la ventana, el juego maneja la excepción de forma segura abriendo el menú de pausa para permitir reintentar con un clic.
2. **Aceleración por hardware:**
   - El rendimiento a 60 FPS depende de la GPU del cliente y la activación de aceleración gráfica en el navegador. En pruebas headless sin aceleración por hardware el juego opera de forma estable, pero la tasa de cuadros por segundo se beneficia sustancialmente de GPUs dedicadas o integradas modernas.
3. **Ámbito de la versión Alpha:**
   - La versión `v0.1.0-alpha` está diseñada como una simulación táctica individual contra bots. La conectividad multijugador en red y el catálogo adicional de armas están planificados a partir de `v0.2.0-alpha` y `v0.3.0-alpha`.

---

## 4. Estado de artefactos de Git

- **Rama activa:** `main` (sincronizada con `origin/main`)
- **Último commit en remoto:** `77a0685`
- **Tag en remoto:** `v0.1.0-alpha`
- **Release en remoto:** `https://github.com/YamiCueto/blackout-protocol-io/releases/tag/v0.1.0-alpha`
- **URL activa:** `https://yamicueto.github.io/blackout-protocol-io/`
