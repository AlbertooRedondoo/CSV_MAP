# Mapa Interactivo 3D de Estaciones de Bicicletas - Las Palmas de Gran Canaria

## Descripción

Visualizador interactivo en 3D de las estaciones del sistema de bicicletas públicas **Sitycleta** de Las Palmas de Gran Canaria. El proyecto utiliza **Three.js** para renderizar un mapa georreferenciado con marcadores esféricos que representan cada estación, permitiendo búsqueda, selección y navegación fluida.

**Autor:** Alberto Redondo Álvarez de Sotomayor

**Vídeo y dirección del proyecto:**

https://drive.google.com/file/d/1hcbR6MwaUOXc1toQgjwP0-X0s40r1SsX/view?usp=sharing
https://codesandbox.io/p/sandbox/ig2526-s8-forked-x39z23

---

## Características Principales

### Texturas y Materiales

El proyecto utiliza una combinación de geometrías simples con materiales básicos optimizados para máximo rendimiento:

#### **Plano del Mapa Base**
- **Textura:** `mapaLPGC.png` (imagen del mapa de Las Palmas de Gran Canaria)
- **Geometría:** `PlaneGeometry` con dimensiones calculadas dinámicamente según aspect ratio
- **Material:** `MeshBasicMaterial` con `side: THREE.DoubleSide`
  - No requiere iluminación (auto-iluminado)
  - Renderizado de doble cara para visibilidad desde cualquier ángulo
  - Mapeo UV automático para proyección correcta de la textura
- **Escala:** Factor de 5 unidades como base
- **Posición:** Centro de la escena (0, 0, 0)

**Características del material del mapa:**
- Textura aplicada directamente sin transformaciones
- Color space automático según la imagen fuente
- Actualización manual con `needsUpdate = true` tras carga asíncrona
- Sin transparencia ni mezclas para máximo rendimiento

#### **Marcadores de Estaciones (Esferas)**
- **Geometría:** `SphereGeometry` con radio 0.02 unidades
- **Segmentos:** 12×12 (optimizado para balance calidad/rendimiento)
- **Material:** `MeshBasicMaterial` (emisivo, sin necesidad de luces)

**Estados visuales de los marcadores:**

**Estado por Defecto:**
- **Color:** #1976d2 (azul Material Design)
- **Escala:** 1.0× (tamaño base)
- **Propósito:** Representación neutra de estaciones disponibles

**Estado Seleccionado:**
- **Color:** #ff5252 (rojo vibrante)
- **Escala:** 1.6× (60% más grande)
- **Transición:** Instantánea mediante `setHex()` y `scale.set()`
- **Propósito:** Destacar la estación activa

**Estado Hover (implícito):**
- Cursor cambia a `pointer`
- Tooltip emergente con nombre de estación
- Sin cambios visuales en el marcador (rendimiento)

#### **Propiedades de Material (MeshBasicMaterial)**

Se utiliza `MeshBasicMaterial` estratégicamente por las siguientes razones:

1. **Rendimiento:** No requiere cálculos de iluminación
2. **Claridad:** Colores uniformes sin degradados por sombras
3. **Consistencia:** Apariencia idéntica desde cualquier ángulo de cámara
4. **Carga GPU:** Minimal shader complexity, ideal para muchos objetos

**Ventajas técnicas:**
- Sin necesidad de añadir luces a la escena
- Shader extremadamente simple (vertex + fragment básicos)
- Color uniforme calculado una sola vez
- Perfecto para elementos de interfaz/visualización de datos

---

### Sistema de Georreferenciación

El proyecto implementa un sistema de proyección cartográfica personalizado para mapear coordenadas GPS a espacio 3D:

#### **Área Geográfica Cubierta**
```javascript
Longitud: -15.46945° a -15.39203° (Este-Oeste)
Latitud:   28.07653° a  28.18235° (Sur-Norte)
```
*Nota: El CSV usa "altitud" como columna de longitud (posible error de nomenclatura)*

**Extensión aproximada:** 7.7 km × 11.8 km (zona urbana central de LPGC)

#### **Función de Mapeo: Map2Range()**

Convierte coordenadas geográficas (lat/lon) a coordenadas locales del plano 3D:

```javascript
// Fórmula
t = 1 - (max - value) / (max - min)
result = destMin + t × (destMax - destMin)
```

**Proceso de conversión:**
1. **Normalización:** Lat/Lon → [0, 1]
2. **Escalado:** [0, 1] → [-width/2, +width/2] y [-height/2, +height/2]
3. **Proyección:** Coordenadas del plano centrado en origen

**Ejemplo de conversión:**
- Longitud -15.43074° → X: ~0 (centro)
- Latitud 28.12944° → Y: ~0 (centro)
- Longitud -15.39203° → X: mapsx/2 (borde este)
- Latitud 28.18235° → Y: mapsy/2 (borde norte)

#### **Posicionamiento de Marcadores**

Cada estación se posiciona en el eje XY del plano:
- **Eje X:** Corresponde a Longitud (Este-Oeste)
- **Eje Y:** Corresponde a Latitud (Sur-Norte)
- **Eje Z:** Fijo en 0 (sobre el plano del mapa)
- **Radio:** 0.02 unidades (aproximadamente 40-80 metros a escala real)

---

### Sistema de Iluminación

#### **Enfoque Sin Iluminación (Unlit)**

El proyecto **no utiliza luces de Three.js** deliberadamente:

**Razones técnicas:**
- Todos los materiales son `MeshBasicMaterial` (emisivos)
- Los objetos no necesitan cálculos de Phong/Lambert
- Máxima claridad visual sin sombras que oculten información
- Rendimiento óptimo con cientos de marcadores

**Iluminación efectiva:**
- **Mapa:** Auto-iluminado mostrando la textura completa
- **Esferas:** Colores planos calculados directamente del color material
- **Fondo:** Negro por defecto (`scene.background = undefined`)

**Ventajas del modelo unlit:**
- Carga constante de GPU independiente del número de objetos
- Sin cálculos de normales o vectores de luz
- Colores 100% fieles al diseño (sin variación por ángulo)
- Ideal para aplicaciones de visualización de datos

---

### Interactividad

#### **Controles de Cámara (OrbitControls)**
- **Rotación:** Click izquierdo + arrastrar (órbita alrededor del mapa)
- **Zoom:** Rueda del ratón (límites: 1.2 - 30 unidades)
- **Pan:** Click derecho + arrastrar (desplazamiento lateral)
- **Damping:** Activado (factor 0.06) para movimiento suave e inercial
- **Ratios:** Pixel ratio limitado a 2× para rendimiento en pantallas HiDPI

#### **Sistema de Raycasting**

Detección precisa de intersecciones ratón-objeto mediante `THREE.Raycaster`:

**Pipeline de detección:**
1. Conversión de coordenadas pantalla → NDC (Normalized Device Coordinates)
2. Construcción del rayo desde la cámara a través del pixel
3. Test de intersección con todas las esferas (`objetos` array)
4. Ordenamiento por distancia (más cercano primero)

**Eventos implementados:**

**MouseMove (hover):**
```javascript
raycaster.intersectObjects(objetos, false)
→ Muestra tooltip con nombre de estación
→ Cambia cursor a "pointer"
```

**Click:**
```javascript
raycaster.intersectObjects(objetos, false)
→ Selecciona estación (cambia color/escala)
→ Anima cámara hacia el marcador
→ Muestra panel de información detallada
```

#### **Búsqueda en Tiempo Real**

Input de búsqueda con filtrado instantáneo:

**Características:**
- Búsqueda case-insensitive en nombres de estaciones
- Ocultación dinámica de marcadores no coincidentes (`mesh.visible = false`)
- Sin latencia (filtrado síncrono en cada keystroke)
- Mantiene selección activa durante búsqueda

**Algoritmo de búsqueda:**
```javascript
query.toLowerCase().indexOf(stationName.toLowerCase()) !== -1
```

#### **Panel de Información**

Overlay dinámico con datos completos de la estación seleccionada:

**Contenido visualizado:**
- **Nombre:** Título destacado en negrita (15px)
- **ID:** Identificador único de la base de datos
- **Coordenadas:** Latitud y Longitud con 6 decimales de precisión
- **Dirección:** Calle y número concatenados
- **Código Postal:** Zona postal de la estación

**Características UI:**
- Botón de cierre (×) en esquina superior derecha
- Cierre automático con click fuera del panel
- Cierre con tecla `Escape`
- Scroll interno si contenido excede altura
- Box-shadow suave para separación visual
- Sanitización HTML (`escapeHtml()`) para prevenir XSS

---

### Animaciones

#### **Transición de Cámara (animateCameraTo)**

Sistema de interpolación suave para enfocar estaciones:

**Parámetros:**
- **targetX, targetY:** Coordenadas 2D de la estación
- **dist:** Distancia de la cámara (calculada como 25% del span del mapa, mínimo 1.6)
- **durationMs:** Duración en milisegundos (600ms por defecto)

**Curva de easing:** Cubic In-Out
```javascript
t < 0.5 
  ? 4×t³ 
  : 1 - (-2t + 2)³ / 2
```
*Aceleración suave al inicio y desaceleración al final*

**Interpolación dual:**
1. **Posición de cámara:** Desde posición actual hasta punto elevado sobre estación
2. **Target de OrbitControls:** Desde target actual hasta centro de estación

**Ventajas técnicas:**
- Uso de `lerpVectors()` para interpolación vectorial eficiente
- `requestAnimationFrame` para sincronización con VSync
- Actualización de `camcontrols.target` para mantener coherencia

#### **Cambios de Estado de Marcadores**

Transiciones instantáneas (sin animación) para claridad:

```javascript
// Color: setHex() → cambio inmediato en GPU
marker.material.color.setHex(HIGHLIGHT_COLOR)

// Escala: scale.set() → transformación matricial inmediata
marker.scale.set(1.6, 1.6, 1.6)
```

**Justificación de instantaneidad:**
- Feedback inmediato al usuario
- Menor complejidad de código
- No requiere gestión de estados intermedios
- Marcadores pequeños hacen imperceptible la falta de transición

---

### Procesamiento de Datos CSV

#### **Estructura del Archivo CSV**
```
Geolocalización estaciones sitycleta.csv
Delimitador: punto y coma (;)
Encoding: UTF-8 (asumido)
```

**Columnas esperadas:**
- `idbase`: ID numérico único
- `nombre`: Nombre descriptivo de la estación
- `latitud`: Coordenada latitud decimal
- `altitud`: ⚠️ **Realmente contiene longitud** (inconsistencia de nomenclatura)
- `calle`: Nombre de la vía
- `numero`: Número de portal
- `codpostal`: Código postal de 5 dígitos
- `externalId`: ID para sistemas externos

#### **Pipeline de Procesamiento**

1. **Carga asíncrona:** `fetch()` → Promise chain
2. **Split por líneas:** Separación por `\n` con filtrado de vacías
3. **Parseo de encabezados:** Primera línea define estructura
4. **Mapeo de índices:** Búsqueda dinámica de columnas por nombre
5. **Iteración de filas:** Loop desde fila 2 (skip headers)
6. **Validación numérica:** `parseFloat()` con check `isNaN()`
7. **Creación de objetos:** Construcción del array `datosEstaciones`
8. **Renderizado:** Llamada a `Esfera()` por cada entrada válida

**Manejo de errores:**
- Filas vacías: Ignoradas silenciosamente
- Coordenadas inválidas: Skip con `continue`
- Columnas faltantes: Valor `undefined` (no crashea)
- Error de fetch: Capturado con `catch()` y log en consola

---

## Tecnologías

- **Three.js (r128):** Motor de renderizado 3D WebGL
- **OrbitControls:** Sistema de controles de cámara orbital
- **Raycaster:** Sistema de picking 3D para interacción
- **JavaScript ES6+:** Async/await, arrow functions, template literals
- **CSS-in-JS:** Estilos dinámicos mediante `Object.assign()`

---

## Funciones Principales

### `Map2Range(value, vMin, vMax, destMin, destMax)`
Mapea un valor de un rango a otro mediante interpolación lineal.
- **Uso:** Conversión lat/lon → coordenadas 3D

### `Esfera(px, py, pz, radius, nx, ny, color, data)`
Crea un marcador esférico con userData personalizada.
- **Geometría:** SphereGeometry
- **Material:** MeshBasicMaterial
- **Añade:** Al array `objetos` y a la escena

### `Plano(px, py, pz, sizeX, sizeY)`
Genera el plano base del mapa.
- **Geometría:** PlaneGeometry
- **Material:** MeshBasicMaterial doble cara
- **Referencia global:** `mapa`

### `animateCameraTo(x, y, dist, duration)`
Interpolación suave de cámara con easing cúbico.
- **Actualiza:** `camera.position` y `camcontrols.target`
- **Sincronización:** requestAnimationFrame

### `procesarCSVEstaciones(content)`
Parser personalizado de CSV con delimitador punto y coma.
- **Validación:** Coordenadas numéricas
- **Salida:** Array `datosEstaciones` + renderizado de esferas

### `onSearch()`
Filtrado en tiempo real del input de búsqueda.
- **Algoritmo:** Case-insensitive substring match
- **Efecto:** Modifica `visible` property de meshes

---
