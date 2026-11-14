# BLACKOUT PROTOCOL — INFORME TÉCNICO HITO 8 / 8.1 (SPRINT 8.4)
## Validación Integral, Rendimiento Real en requestAnimationFrame y Corrección de Inconsistencias

**Proyecto:** BLACKOUT PROTOCOL  
**Repositorio:** YamiCueto/blackout-protocol-io  
**Directorio:** `c:\Users\YAMI\projects\game`  
**Rama de trabajo:** `develop`  
**Commit base:** `5ebc3394c4130cd96870c98cf81bad81cca04868`  
**Hito verificado:** HITO 8.1 (Auditoría visual, funcional y perfilado empírico en vivo)  
**Estado general:** CERRADO (5/5 puntos superados; 217/217 pruebas)  

---

## 1. MATRIZ DE AUDITORÍA HITO 8.1

| Nº | Aspecto Auditado | Resultado | Método de Verificación | Evidencia Clave |
|---|---|---|---|---|
| **1** | **Rendimiento real (`requestAnimationFrame`)** | **APROBADO** | 319 muestras rAF continuas tras calentamiento (5, 8, 12 enemigos) en GPU y SwiftShader | Tabla de percentiles (media, mediana, p95, p99) |
| **2** | **Buscar y Destruir (Desactivador y Escoltas)** | **APROBADO** | Calibración respecto a `bombPos (0, 0, -6)`, inicio a 2.22 m ($<2.3$ m), pico de 10.0 y decaimiento ante baja | `01_snd_defuse_validation.png` |
| **3** | **Navegación con llegada efectiva ($\le 1.0$ m)** | **APROBADO** | Simulación extendida en 3 rutas (N $\to$ S, S $\to$ N, O $\to$ E) hasta llegada demostrada | `02_navigation_full_arrival.png` |
| **4** | **Unificación de arquetipo Blindado (0.70x)** | **APROBADO** | Corrección a `resistanceMult: 0.70`, 240 HP, escala 1.15x; 50 daño $\to$ 35 recibido | `03_brute_audit.png` |
| **5** | **Regresión, capturas históricas y Git** | **APROBADO** | Ejecución 217/217 PASS (código 0), restauración de capturas históricas, cero comentarios | `git status --short` limpio |

---

## 2. DETALLE DE CORRECCIONES Y DATOS OBSERVADOS

### 2.1. Rendimiento Real en `requestAnimationFrame` (GPU vs SwiftShader)

Se erradica la conversión aislada de funciones a FPS. Se presentan las mediciones empíricas reales capturadas directamente desde los eventos `requestAnimationFrame` del navegador durante 319 fotogramas continuos tras un calentamiento de 350 ms:

#### A. GPU ANGLE (Hardware D3D11) — 60 FPS Estable
| Densidad | Muestras | Delta de Fotograma Real (ms)<br>[Media / Mediana / p95 / p99] | FPS Observados<br>[Media / Mediana] | Coste CPU del Sistema IA (ms)<br>[Media / Mediana / p95 / p99] | Draw Calls | Geometrías WebGL |
|---|---|---|---|---|---|---|
| **5 Enemigos** | 319 | 16.664 / 16.700 / 18.100 / 18.500 | **60.0 / 59.9 FPS** | 0.008 / 0.000 / 0.100 / 0.100 | 52 | 121 |
| **8 Enemigos** | 319 | 16.667 / 16.700 / 18.200 / 18.600 | **60.0 / 59.9 FPS** | 0.018 / 0.000 / 0.100 / 0.100 | 55 | 125 |
| **12 Enemigos** | 319 | 16.670 / 16.700 / 18.100 / 18.300 | **60.0 / 59.9 FPS** | 0.019 / 0.000 / 0.100 / 0.100 | 53 | 123 |

#### B. SwiftShader (Software GL por CPU) — Limitado por Rasterización Software
| Densidad | Muestras | Delta de Fotograma Real (ms)<br>[Media / Mediana / p95 / p99] | FPS Observados<br>[Media / Mediana] | Coste CPU del Sistema IA (ms)<br>[Media / Mediana / p95 / p99] | Draw Calls | Geometrías WebGL |
|---|---|---|---|---|---|---|
| **5 Enemigos** | 319 | 57.350 / 56.200 / 65.800 / 68.000 | **17.4 / 17.8 FPS** | 0.028 / 0.000 / 0.100 / 0.200 | 52 | 121 |
| **8 Enemigos** | 319 | 56.544 / 55.500 / 63.600 / 66.600 | **17.7 / 18.0 FPS** | 0.032 / 0.000 / 0.100 / 0.200 | 52 | 121 |
| **12 Enemigos** | 319 | 56.813 / 55.700 / 64.500 / 65.600 | **17.6 / 18.0 FPS** | 0.042 / 0.000 / 0.100 / 0.200 | 52 | 121 |

**Conclusión de Rendimiento:**
- El coste de CPU de la IA medido con performance.now() fue de 0.008–0.042 ms de media. Con resolución de temporizador de 0.1 ms, las medianas de 0.000 y los p95 de 0.100 solo indican que la duración queda por debajo de esa resolución; no son valores exactos. Esa magnitud NO equivale al coste del fotograma ni se convierte en FPS.
- Con la configuración de lanzamiento ANGLE/GPU, el intervalo entre callbacks de equestAnimationFrame fue ≈16.7 ms (p99 de 18.3–18.6 ms) con 5, 8 y 12 enemigos. El resultado está limitado por VSync (60 Hz): demuestra que se cumple el presupuesto de 16.7 ms en esas escenas, pero no indica cuánta holgura queda.
- La bajada a 17 FPS en SwiftShader no se debe a la IA ni al código JavaScript, sino a la sobrecarga de la rasterización por software de Three.js (sombreado e iluminación por CPU en emulación sin tarjeta gráfica).

---

### 2.2. Resolución de la Contradicción en Buscar y Destruir

#### Causa Raíz Identificada
El informe preliminar medía erróneamente la distancia euclidiana hacia el origen del mundo `(0, 0, 0)` en lugar de las coordenadas reales de la bomba definidas en `js/main.js`:
```javascript
const bombPos = new THREE.Vector3(0, 0, -6);
```
Cuando el operador desactivador se posicionaba a $1.0\text{ m}$ de la bomba en $Z = -5$, su distancia euclidiana respecto a `(0, 0, 0)` era $\sqrt{0^2 + (-5)^2} = 5.0\text{ m}$, generando la aparente contradicción entre la distancia reportada y el inicio de la desactivación.

#### Validación Corregida con Coordenadas Exactas
- **Distancia al artefacto en spawn inicial:** $53.26\text{ m}$.
- **Momento exacto en que `defusing` cambia a `true`:** $t = 18.20\text{ s}$.
- **Distancia al artefacto al iniciar la desactivación:** **$2.22\text{ m}$** (cumple estrictamente el umbral $< 2.30\text{ m}$).
- **Distancia al artefacto durante toda la desactivación:** **$2.22\text{ m}$** (permanece inmóvil trabajando sobre el artefacto).
- **Escoltas en defensa perimetral:** 3 operadores escolta custodiando activamente sin interferir con la bomba.
- **Progreso y final de ronda (Victoria / Derrota):**
  - *Derrota por desactivación:* Si el desactivador trabaja sin interrupción, `snd.defuse` alcanza el límite de **$10.0\text{ s}$**, la bomba se desactiva y el juego finaliza con `ended = true` ("BOMBA DESACTIVADA").
  - *Interrupción ante baja:* Al eliminar al desactivador en plena faena (`defuserAliveAfterKill = false`), `e.defusing` cambia inmediatamente a `false`, el progreso acumulado ($7.10\text{ s}$) decae linealmente a razón de $-0.6 \times dt$ (descendiendo a $5.27\text{ s}$ en $3\text{ s}$ de inactividad).
  - *Victoria por detonación:* Al expirar el tiempo de la bomba (`timeLeft <= 0`), se produce la detonación ("MISIÓN CUMPLIDA").

---

### 2.3. Demostración de Llegada Efectiva en Navegación (Tolerancia $\le 1.0\text{ m}$)

Se ejecutaron simulaciones completas en ambos sentidos alrededor de edificios y contenedores, demostrando la llegada física del agente dentro del margen de tolerancia:

```
Ruta 1: Edificio (-34, -30) — Norte a Sur
(-34, -18) ───────────────► (-42.8, -27.9) ───────────────► (-34, -42)
[Inicio: 24.0m]            [Evasión Oeste]               [Llegada: 0.98m en 11.9s]
```

1. **Ruta 1 — Edificio Norte a Sur (de `(-34, -18)` a `(-34, -42)`):**
   - Distancia inicial euclidiana: $24.00\text{ m}$.
   - Distancia final al objetivo: **$0.98\text{ m}$** (Llegada confirmada: `reached = true`).
   - Paso de llegada: **Paso 238** ($11.90\text{ s}$).
   - Trayectoria: circunnavegación limpia por el flanco oeste pasando por $(-36.7, -19.6)$, $(-40.8, -21.9)$, $(-42.6, -27.9)$, $(-42.8, -35.1)$ y doblando la esquina sur hacia $(-37.1, -40.0)$ y $(-34.0, -42.0)$.
   - Penetraciones de colisionadores: 0; saltos de posición mayores que un paso de movimiento: 0 (comprobado por las pruebas 16 y 17).

2. **Ruta 2 — Edificio Sur a Norte (de `(-34, -42)` a `(-34, -18)`):**
   - Distancia inicial euclidiana: $24.00\text{ m}$.
   - Distancia final al objetivo: **$0.98\text{ m}$** (Llegada confirmada: `reached = true`).
   - Paso de llegada: **Paso 238** ($11.90\text{ s}$).
   - Trayectoria inversa perfectamente simétrica, demostrando bidireccionalidad determinista.

3. **Ruta 3 — Contenedor Oeste a Este (de `(-16, -20)` a `(0, -20)`):**
   - Distancia inicial: $16.00\text{ m}$ (a través del contenedor en `-8, -20`).
   - Distancia final al objetivo: **$0.80\text{ m}$** (Llegada confirmada: `reached = true`).
   - Paso de llegada: **Paso 148** ($7.40\text{ s}$).
   - Trayectoria: desvío perimetral por el margen norte en $Z = -14.7$, rodeando la caja y enfilando directamente al punto final.

---

### 2.4. Arquetipo Blindado (Brute): Unificación de Balance a 0.70x

- **Código fuente corregido en `js/enemy-ai.js`:**
  ```javascript
  BRUTE: {
    id: 'brute',
    name: 'Blindado',
    speed: 2.2,
    hpBase: 240,
    attackRange: 32,
    preferredRange: 14,
    color: 0x42382e,
    visorColor: 0xff8800,
    scale: 1.15,
    burstShots: 7,
    fireCooldown: 1.6,
    resistanceMult: 0.70
  }
  ```
- **Auditoría balística empírica:**
  - Daño base infligido al Blindado: $50.0\text{ HP}$.
  - Daño real descontado: **$35.0\text{ HP}$**.
  - Razón observada: **$0.70\text{x}$** exacto.
  - El balance queda fijado en **240 HP** y **30% de reducción de daño (0.70x)**, proporcionando la identidad de tanque táctico requerida sin alterar el resto de arquetipos.

---


## 3. Pruebas permanentes incorporadas

Las comprobaciones del script temporal eliminado pasaron a `tests/test_sprint8_4.mjs` (de 15 a 22 pruebas). `tests/run_all.mjs` refleja el conteo real: 195 + 22 = 217.

| # | Prueba permanente | Criterio |
|---|---|---|
| 16 | Llegada alrededor de edificios, ambos sentidos | Llega a ≤1.2 m, 0 penetraciones, sin saltos de posición, menos de 25 s |
| 17 | Llegada alrededor de contenedores y fila de cajas, ambos sentidos | Llega a ≤1.2 m, 0 penetraciones, sin saltos de posición |
| 18 | Inicio de desactivación | `defusing` pasa a true con distancia a `bombPos` < 2.3 m y se mantiene dentro del radio |
| 19 | Muerte del desactivador | `defusing` pasa a false, el progreso decae, la ronda no termina |
| 20 | Fin por bomba desactivada | Progreso ≥ 10, fase RESULTS, pantalla de derrota con título "BOMBA DESACTIVADA" |
| 21 | Fin por detonación | Fase RESULTS, pantalla con clase `victory` |
| 22 | Resistencia del Blindado | `resistanceMult` = 0.7, 50 de daño base → 35 recibidos; el Tirador recibe 50 |

La suite 8.4 pasó 22/22 en 5 ejecuciones consecutivas (1 tras el ajuste, 3 de repetición y la de `run_all`).

Hallazgo corregido en producción: `damageEnemy` no limpiaba `defusing` al matar al operador y `stepSim` ignora a los muertos, de modo que la bandera quedaba activa y el progreso seguía subiendo. Se añadió `e.defusing = false` en la rama de muerte. Las pruebas 19 lo cubren.

La primera versión de la prueba de rutas incluía un Flanqueador hacia un punto fijo y no llegaba (9.67 m). No es un fallo de navegación: el Flanqueador desvía deliberadamente su objetivo (`flankBias`). La ruta se probó con un Perseguidor, que persigue el punto exacto.

## 4. Limitaciones conocidas del benchmark

- VSync limita `requestAnimationFrame` al refresco de pantalla; 60 FPS no mide holgura.
- La cadena del adaptador gráfico no se capturó; "GPU/ANGLE" refleja los argumentos de lanzamiento y la diferencia frente a SwiftShader.
- El coste de renderizado WebGL no se midió por separado; solo `draw calls` y geometrías de `renderer.info`. La atribución de la caída en SwiftShader a la rasterización por software es una inferencia, no una medición aislada.
- La IA se cronometró desde el gancho de medición, con resolución de 0.1 ms; es una cota superior aproximada.
- Las capturas de pantalla de Playwright validan escenas, no el rendimiento.

## 5. Verificación final y Git

- Rama: `develop`. HEAD antes del commit: `5ebc3394c4130cd96870c98cf81bad81cca04868`.
- `node tests/run_all.mjs`: 15 suites, **217/217 PASS, código de salida 0**.
- Capturas históricas de Sprints 7, 8, 8.1, 8.2 y 8.3 modificadas por las suites: restauradas con `git checkout --` antes del commit.
- Sin comentarios nuevos, sin dependencias nuevas, sin cambios en estadísticas de armas del jugador ni en el Schema v3.
