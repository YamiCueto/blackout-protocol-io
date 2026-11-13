# INFORME TÉCNICO DE CIERRE — SPRINT 8.1
## Cierre funcional, visual y técnico de equipamientos personalizados y calibración ADS

**Proyecto:** BLACKOUT PROTOCOL  
**Repositorio:** YamiCueto/blackout-protocol-io  
**Rama:** `develop`  
**Commit base:** `7adb98c24a4569f05814300862cec550758a0512`  
**Fecha:** 13 de noviembre de 2026  
**Resultado de suite automatizada:** 159/159 PASS (100%)

---

## 1. RESUMEN EJECUTIVO

El Sprint 8.1 culmina de manera integral el sistema de equipamientos tácticos, gestión de clases, soporte responsivo de la armería y precisión sub-milimétrica del sistema de apuntado (ADS).

Los objetivos alcanzados cubren:
1. **Gestión completa del ciclo de vida de clases (Hito 1):**
   - Restablecimiento a valores de fábrica (`resetLoadoutToDefault`) respetando estrictamente los valores base del juego sin forzar armas adicionales por estar desbloqueadas.
   - Copia profunda entre clases (`copyLoadout`) con aislamiento de referencias de accesorios y validación de desbloqueos por nivel de jugador.
   - Desequipado explícito de arma secundaria permitiendo despliegues tácticos con ranura vacía (`secondary = null`).
2. **Experiencia de usuario y controles tácticos (Hito 2):**
   - Diálogos modales de confirmación previa a la sobrescritura o restablecimiento de clases.
   - Botón directo de desequipado secundario en interfaz con actualización instantánea del HUD (`VACÍA`).
   - Diferenciación visual de estados mediante insignias contextuales (`st-active-deploy`, `st-editing-loadout`, `st-active-deploy-other`).
3. **Escenario de exhibición 3D adaptable para pantallas $\le 768\text{px}$ (Hito 3):**
   - Visualizador superior compacto activo (`height: 216px`) sin colapsos ni solapamientos con el panel de armamento.
   - Encuadre sub-pixel y métricas NDC específicas para dispositivos móviles y tabletas (`768x1024`).
   - Todas las acciones de interfaz (cambio de clase, renombramiento, despliegue, copia, reinicio, desequipado, inspección y personalización) permanecen dentro del viewport y 100% operativas.
   - Rotación táctil interactiva (`rotateShowcase`) y recentrado de cámara (`resetShowcaseView`).
4. **Auditoría y alineación geométrica del sistema ADS (Hito 4):**
   - Corrección matemática de `adsPos` y offsets de mira (`adsYOffset`) para las cuatro plataformas jugables (MK-7, VECTOR-9, M870 y P-12).
   - Error angular residual frente al centro de la cámara y raycast inferior a $0.0042$ unidades en todas las configuraciones.
   - Desvanecimiento dinámico de la retícula 2D (`#crosshair`) durante la transición ADS eliminando la duplicidad visual de miras ópticas.
5. **Verificación y suite de pruebas automatizadas (Hitos 5 y 6):**
   - 15 nuevas pruebas automatizadas en `tests/test_sprint8_1.mjs`.
   - Incorporación a la suite maestra `tests/run_all.mjs` con 159/159 pruebas aprobadas sin regresiones.
   - Evidencias gráficas registradas en `docs/assets/screenshots/sprint8_1/`.

---

## 2. MODIFICACIONES DE ARQUITECTURA Y DOMINIO

### 2.1 Dominio y Persistencia (`js/progression.js`)

Se incorporaron dos nuevos métodos en `ProgressionManager`:
- `resetLoadoutToDefault(loadoutId)`: Restaura el nombre base (`ASALTO 1` .. `ASALTO 5`), equipa `mk7` como arma principal, equipa `p12` como secundaria solo si el jugador tiene nivel $\ge 2$ (en caso contrario `null`), reinicia las ranuras de accesorios a valores nulos y emite el evento `'loadout_reset'` preservando `selectedLoadoutId`. No equipa armas de mayor nivel desbloqueadas.
- `copyLoadout(sourceId, targetId)`: Clona profundamente la configuración completa de armas y accesorios utilizando `cloneWeaponAttachmentMaps` y `normalizeLoadoutWeaponAttachments`. Valida los requisitos de nivel del jugador para las armas clonadas y mantiene `selectedLoadoutId` inalterado, emitiendo el evento `'loadout_copied'`.
- `setLoadoutSecondary(loadoutId, null)`: Permite almacenar de forma persistente un valor nulo para la ranura secundaria en Schema v3.

### 2.2 Integración en Sesión de Combate (`js/main.js`)

- Al desplegar en combate (`startCombat`), la ranura secundaria se inicializa respetando `activeLoadout.secondary` sin equipar `p12` automáticamente cuando la ranura está vacía.
- La función `switchWeaponSlot('secondary')` verifica `slot.id` y cancela el cambio devolviendo `false` cuando la ranura está vacía.
- Durante el ciclo de simulación (`stepSim`), la opacidad del elemento `#crosshair` se calcula como:
  $$\text{opacity} = \max(0, 1 - \text{adsAmount} \times 3)$$
  Garantizando visibilidad plena en disparo desde la cadera y desaparición limpia durante el encarado.

---

## 3. AUDITORÍA EMPÍRICA Y CALIBRACIÓN ADS (HITO 4)

Se validaron las cuatro plataformas jugables sobre blancos estáticos tanto con miras metálicas como con ópticas compatibles, midiendo el error residual frente al raycast central, la dispersión balística en $20\text{m}$, el desvanecimiento de retícula y el ajuste FOV por magnificación:

| Plataforma y Óptica | Óptica ID | `adsAmount` | Error Residual Raycast ($y$) | Dispersión Media a $20\text{m}$ | `spreadAds` Nominal | FOV Efectivo | Offset Zoom | Retícula Faded |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MK-7 Iron Sight** | `none` | $1.000$ | $0.00002$ | $0.0279$ | $0.00220$ | $50.00^\circ$ | $25$ | SÍ ($0.00$) |
| **MK-7 Red Dot** | `optic_reddot` | $0.999$ | $0.00024$ | $0.0174$ | $0.00187$ | $49.02^\circ$ | $26$ | SÍ ($0.00$) |
| **MK-7 Holo** | `optic_holo` | $0.999$ | $0.00027$ | $0.0235$ | $0.00167$ | $47.03^\circ$ | $28$ | SÍ ($0.00$) |
| **VECTOR-9 Iron Sight** | `none` | $1.000$ | $0.00002$ | $0.0325$ | $0.00350$ | $50.00^\circ$ | $25$ | SÍ ($0.00$) |
| **VECTOR-9 Red Dot** | `optic_reddot` | $1.000$ | $0.00005$ | $0.0324$ | $0.00298$ | $49.00^\circ$ | $26$ | SÍ ($0.00$) |
| **VECTOR-9 Holo** | `optic_holo` | $1.000$ | $0.00003$ | $0.0292$ | $0.00266$ | $47.00^\circ$ | $28$ | SÍ ($0.00$) |
| **M870 Iron Sight** | `none` | $0.986$ | $0.00414$ | $0.2920$ | $0.02800$ | $50.34^\circ$ | $25$ | SÍ ($0.00$) |
| **M870 Red Dot** | `optic_reddot` | $0.994$ | $0.00180$ | $0.2244$ | $0.02380$ | $49.16^\circ$ | $26$ | SÍ ($0.00$) |
| **P-12 Iron Sight** | `none` | $1.000$ | $0.00002$ | $0.0285$ | $0.00280$ | $50.00^\circ$ | $25$ | SÍ ($0.00$) |
| **P-12 Red Dot** | `optic_reddot` | $1.000$ | $0.00001$ | $0.0206$ | $0.00238$ | $49.00^\circ$ | $26$ | SÍ ($0.00$) |

### Transición de Encarado y Cancelación en Intercambio

- La transición de entrada progresa suavemente ($t = 0\text{ms} \to 200\text{ms}$), pasando `adsAmount` de $0.000$ a $0.999$ y atenuando la opacidad de la retícula de $1.000$ a $0.000$.
- La transición de salida restaura la opacidad a $0.985+$ en menos de $240\text{ms}$.
- El inicio de cambio de arma durante ADS cancela instantáneamente el estado (`adsAmount = 0`), reproduce la animación de transición vertical y transfiere el control sin pérdidas ni duplicaciones de munición entre la configuración principal y secundaria.

---

## 4. RESPONSIVIDAD Y VISUALIZADOR 3D COMPACTO (HITO 3)

En viewport de 768×1024, se comprobó que todos los elementos de control e interactividad permanecen dentro de los límites visuales:

| Elemento de Interfaz | Selector DOM | Display | Visibilidad | Estado en Viewport |
| :--- | :--- | :--- | :--- | :--- |
| Selector de ranuras de clase | `#loadout-slot-selector` | `flex` | Visible | Dentro de viewport |
| Campo de nombre de clase | `#loadout-name-input` | `block` | Visible | Dentro de viewport |
| Botón Copiar Clase | `#btn-copy-loadout` | `block` | Visible | Dentro de viewport |
| Botón Reiniciar Clase | `#btn-reset-loadout` | `block` | Visible | Dentro de viewport |
| Ranura Principal | `#btn-slot-primary` | `flex` | Visible | Dentro de viewport |
| Ranura Secundaria | `#btn-slot-secondary` | `flex` | Visible | Dentro de viewport |
| Botón Desequipar Secundaria | `#btn-unequip-secondary` | `block` | Visible | Dentro de viewport |
| Barra de Categorías | `#armory-cat-nav` | `flex` | Visible | Dentro de viewport |
| Tira de Armas | `#armory-weapon-strip` | `flex` | Visible | Dentro de viewport |
| Botón Equipar / Estado | `#btn-equip-weapon` | `block` | Visible | Dentro de viewport |
| Botón Personalizar | `#btn-customize-weapon` | `block` | Visible | Dentro de viewport |

---

## 5. RESULTADOS DE LA SUITE DE PRUEBAS AUTOMATIZADAS

| Suite de Pruebas | Pruebas | Resultado | Descripción |
| :--- | :---: | :---: | :--- |
| `test_progression_unit.mjs` | 6 | **PASS** | Curvas XP, niveles 1-50 y 1-20, persistencia y catálogo |
| `test_progression_browser.mjs` | 7 | **PASS** | UI Armamento, categorías, XP en combate real y recarga |
| `test_sprint3.mjs` | 10 | **PASS** | Navegación de lobby táctico, camuflajes y responsividad |
| `test_engine_lifecycle.mjs` | 14 | **PASS** | Ciclo de vida del motor, pausas, oleadas, S&D y estabilidad |
| `test_sprint5.mjs` | 20 | **PASS** | Criterios de aceptación de armamento modular |
| `test_sprint5_closure.mjs` | 5 | **PASS** | Cadencia, impactos mixtos M870, recarga interrumpible |
| `test_memory_deep.mjs` | 6 | **PASS** | Acumulador, anti-burst, 20 swaps, 10 oleadas, 10 S&D |
| `test_sprint6.mjs` | 22 | **PASS** | Equipamientos personalizados, P-12, cambio en combate |
| `test_sprint6_1.mjs` | 14 | **PASS** | Exhibición 3D, barra de categorías, aislamiento y memoria |
| `test_sprint7.mjs` | 20 | **PASS** | Sistema modular de accesorios, personalización 3D y WebGL |
| `test_sprint8.mjs` | 20 | **PASS** | Drops, suministros, consumibles y supervivencia |
| `test_sprint8_1.mjs` | 15 | **PASS** | Cierre de clases, responsividad 768px y calibración ADS |
| **TOTAL GENERAL** | **159** | **159/159 PASS** | **100% Satisfactorio** |

---

## 6. EVIDENCIAS GRÁFICAS CAPTURADAS

Las capturas de pantalla han sido almacenadas en `docs/assets/screenshots/sprint8_1/`:
1. `01_loadout_management_and_copy_modal.png`: Interfaz de gestión de clases y ventana modal interactiva para seleccionar clase de destino al copiar.
2. `02_loadout_reset_confirmation.png`: Modal de advertencia y confirmación para restablecer la clase a valores de fábrica.
3. `03_secondary_unequipped.png`: Estado de armamento con ranura secundaria desequipada (`VACÍA`) y botón de desequipado.
4. `04_compact_3d_viewer_768px.png`: Renderizado adaptado en viewport de 768×1024 con visor 3D superior e inventario inferior sin oclusiones.
5. `05_ads_iron_sight_aligned.png`: Alineación milimétrica del alza y poste con el centro del visor y retícula 2D desvanecida.

---

## 7. ESTADO DEL CONTROL DE VERSIONES

- Rama de trabajo: `develop`
- Commit base: `7adb98c24a4569f05814300862cec550758a0512`
- Estado del árbol: Código probado al 100%, limpio de comentarios sintácticos, listo para empaquetar o inspeccionar según instrucciones del usuario.
