# Celeste Aero

Mapa del cielo en tiempo real para el navegador del celular. Apuntas el teléfono hacia arriba y la app muestra las estrellas, constelaciones, el Sol, la Luna, los planetas y los cometas que hay en esa dirección, calculados para tu ubicación y tu hora exactas.

La interfaz usa una estética **Frutiger Aero** (inspirada en Windows Vista): ventanas de vidrio translúcido, botones brillantes tipo aqua, una barra de tareas con un orbe central y globos de notificación.

- **Producción:** https://celeste-aero.vercel.app
- **Nombre:** temporal

---

## Índice

1. [Funciones](#funciones)
2. [Tecnologías](#tecnologías)
3. [Cómo funciona](#cómo-funciona)
4. [Fuentes de datos](#fuentes-de-datos)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Desarrollo local](#desarrollo-local)
7. [Despliegue en Vercel](#despliegue-en-vercel)
8. [Permisos y compatibilidad](#permisos-y-compatibilidad)
9. [Pruebas](#pruebas)
10. [Solución de problemas](#solución-de-problemas)
11. [Licencias y créditos](#licencias-y-créditos)

---

## Funciones

| Área | Qué hace |
|---|---|
| Ubicación | Pide el GPS en alta precisión (`enableHighAccuracy`) y sigue actualizándolo mientras mejore la precisión o te muevas. Si se niega el permiso, permite escribir latitud y longitud a mano. |
| Orientación | Usa giroscopio, acelerómetro y brújula del teléfono para mover la vista. Corrige la brújula con la declinación magnética del lugar. |
| Modo manual | Sin sensores (o en computadora): arrastrar para mirar alrededor, pellizcar o rueda del mouse para zoom. |
| Cielo | ~5,000 estrellas hasta magnitud 6 con su color real, 88 constelaciones con nombres en español, eclíptica, cuadrícula altura/azimut, horizonte, suelo y puntos cardinales. |
| Sistema solar | Sol, Luna (con su fase dibujada) y los 8 planetas, con magnitud, distancia y horas de salida, culminación y puesta. |
| Cometas | Cometas con perihelio cercano, con su cola apuntando en dirección contraria al Sol y brillo estimado. |
| Búsqueda | Busca planetas, estrellas, constelaciones y cometas (sin importar acentos). Al elegir uno, una flecha indica hacia dónde girar. |
| Tiempo | Adelantar o atrasar minutos, horas o días; acelerar hasta 1 h por segundo; ir a cualquier fecha. |
| Modo noche | Filtro rojo para no perder la adaptación de los ojos a la oscuridad. |
| Idiomas | Español e inglés. Se elige en la bienvenida o en **Capas → Idioma**; por defecto usa el idioma del navegador y recuerda la elección. |
| Información | Al tocar un objeto se abre una ficha con sus datos y la opción de señalarlo en el cielo. |

---

## Tecnologías

### Frontend

| Paquete | Para qué se usa |
|---|---|
| **React 18** | Interfaz: pantallas, paneles y estado de la app. |
| **Vite 5** | Servidor de desarrollo y build de producción. |
| **Canvas 2D** (API del navegador) | Dibujo del cielo en cada cuadro (`requestAnimationFrame`). No se usa WebGL ni Three.js: con ~5,000 puntos, Canvas 2D es suficiente y más simple. |
| **astronomy-engine** | Tiempo sidéreo, precesión, nutación, posiciones del Sol, Luna y planetas, fases, magnitudes y horas de salida y puesta. |
| **geomagnetism** | Modelo WMM-2025 de NOAA para calcular la declinación magnética (diferencia entre norte magnético y norte geográfico). |

### APIs del navegador

| API | Uso |
|---|---|
| `navigator.geolocation.watchPosition` | Latitud, longitud y precisión del GPS. |
| `deviceorientationabsolute` / `deviceorientation` | Orientación del teléfono (Android y iOS). |
| `DeviceOrientationEvent.requestPermission()` | Permiso de sensores que exige iOS. |
| `navigator.wakeLock` | Evita que la pantalla se apague mientras observas. |
| `localStorage` | Guarda los ajustes y la última ubicación. |

### Backend

| Pieza | Uso |
|---|---|
| **Vercel Functions** (`api/comets.js`) | Consulta la base de datos de cuerpos menores de JPL, filtra los cometas relevantes y responde con JSON. Evita problemas de CORS y deja la respuesta en la caché del CDN 12 horas. |
| **Vercel CDN** | Sirve la app y el catálogo de estrellas con HTTPS, que es obligatorio para usar GPS y sensores. |

No hay base de datos ni cuentas de usuario. Todo el cálculo astronómico se hace en el teléfono.

---

## Cómo funciona

### 1. De catálogo a "dónde está en tu cielo"

Las estrellas vienen en **coordenadas ecuatoriales J2000** (ascensión recta y declinación), que son fijas respecto al cielo. Para saber dónde las ves tú, se convierten a **coordenadas horizontales** (azimut y altura):

```
AR/Dec J2000 ──► vector unitario 3D
             ──► matriz de rotación EQJ → horizonte local
                 (precesión + nutación + tiempo sidéreo + tu latitud/longitud)
             ──► vector en marco ENU (x = Este, y = Norte, z = Cénit)
             ──► corrección por refracción atmosférica cerca del horizonte
```

- La matriz se calcula una vez por cuadro con `Rotation_EQJ_HOR` de astronomy-engine y se aplica a todas las estrellas. Son solo 9 multiplicaciones por estrella.
- La refracción usa la fórmula de Sæmundsson. Eleva los objetos cerca del horizonte, unos 0.5° justo en el horizonte.
- Los vectores de las estrellas se calculan una sola vez al cargar el catálogo.

### 2. Hacia dónde apunta el teléfono

El sistema operativo ya fusiona acelerómetro, magnetómetro y giroscopio. El navegador entrega tres ángulos (`alpha`, `beta`, `gamma`) según la especificación W3C:

```
R = Rz(alpha) · Rx(beta) · Ry(gamma)      → orientación del teléfono
R = R · Rz(−ángulo de pantalla)           → compensa vertical u horizontal
alpha_real = alpha − declinación − ajuste → norte geográfico en vez de magnético
```

- La rotación se maneja como **cuaternión** y se suaviza con interpolación esférica (slerp), con una constante de unos 70 ms, para quitar el temblor de los sensores sin que se sienta lento.
- **Android (Chrome):** se usa `deviceorientationabsolute`, que ya viene referido al norte.
- **iOS (Safari):** `alpha` es relativo, así que se alinea con `webkitCompassHeading` (la brújula) y ese desfase se promedia poco a poco.
- La cámara virtual mira hacia donde apunta la parte trasera del teléfono (el eje −Z del dispositivo).

### 3. Del cielo a la pantalla

Se usa una **proyección estereográfica** centrada en la dirección de la cámara:

```
k = 2 / (1 + cos θ)        θ = ángulo entre el objeto y el centro de la vista
x = cx + F · k · dx
y = cy − F · k · dy
```

Se eligió estereográfica porque conserva las formas de las constelaciones incluso con campo de visión amplio (hasta 120°). Con zoom cercano se comporta casi igual que una cámara normal.

Orden de dibujo en cada cuadro:

1. Fondo sólido y degradado del cielo según la altura del Sol (día, crepúsculos, noche).
2. Cuadrícula y eclíptica (opcionales).
3. Líneas de constelaciones.
4. Estrellas: tamaño según magnitud, color según índice B‑V, brillo extra en las más brillantes. El catálogo está ordenado por brillo, así que el ciclo se detiene al pasar la magnitud límite.
5. Nombres de constelaciones.
6. Cometas con su cola.
7. Sol, Luna con fase y planetas (Saturno con anillo).
8. Suelo y línea del horizonte.
9. Puntos cardinales, etiquetas y retícula del objeto seleccionado.

La magnitud límite sube al hacer zoom (aparecen más estrellas) y baja durante el día o el crepúsculo.

### 4. Sistema solar

`astronomy-engine` calcula posiciones **topocéntricas** (vistas desde tu punto en la Tierra, no desde su centro), lo que importa sobre todo para la Luna. Se recalculan cada 2 segundos, o con más frecuencia cuando el tiempo va acelerado.

### 5. Cometas

1. `api/comets.js` descarga de JPL los elementos orbitales de todos los cometas: excentricidad `e`, distancia de perihelio `q`, inclinación `i`, nodo `Ω`, argumento del perihelio `ω`, fecha de perihelio `tp` y los parámetros de brillo `M1` y `K1`.
2. Filtra los que tienen perihelio a menos de ~18 meses de hoy, `q < 4.5 UA` y un brillo máximo posible razonable.
3. En el teléfono, cada cometa se propaga a la fecha actual resolviendo la **ecuación de Kepler**:
   - órbitas elípticas (`e < 1`): anomalía excéntrica,
   - hiperbólicas (`e > 1`): anomalía hiperbólica,
   - parabólicas (`e = 1`): ecuación de Barker.
4. Se rota del plano orbital a coordenadas eclípticas y luego ecuatoriales, se resta la posición de la Tierra y se corrige el tiempo de viaje de la luz.
5. El brillo se estima con `m = M1 + 5·log10(Δ) + K1·log10(r)`.

### 6. Declinación magnética

La brújula apunta al norte magnético, que en México está unos 4° a 6° al este del norte geográfico. El modelo WMM-2025 calcula ese valor para tu ubicación y se resta automáticamente. En **Capas → Brújula** hay un ajuste fino de ±20° por si un teléfono en particular tiene un desfase.

---

## Fuentes de datos

| Dato | Fuente | Cómo llega a la app |
|---|---|---|
| Estrellas (posición, magnitud, color) | Catálogo Hipparcos vía [d3-celestial](https://github.com/ofrohn/d3-celestial) | Se descarga **en el build** y se compacta en `public/data/sky.json` (~155 KB). |
| Nombres de estrellas (en español cuando existe) | d3-celestial `starnames.json` | Igual, dentro de `sky.json`. |
| Figuras y nombres de constelaciones | d3-celestial | Igual, dentro de `sky.json`. |
| Sol, Luna y planetas | astronomy-engine (modelos VSOP87 y lunares) | Calculado en el teléfono. No requiere red. |
| Cometas | [JPL Small-Body Database](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | `GET /api/comets`, con caché de 12 h en el CDN. |
| Declinación magnética | WMM-2025 (NOAA) incluido en `geomagnetism` | Calculado en el teléfono. |

### Formato de `sky.json`

```jsonc
{
  "v": 2,                                           // versión; si cambia, el build regenera el archivo
  "s": [ra, dec, mag, bv, ra, dec, mag, bv, ...],   // estrellas ordenadas por brillo
  "n": { "0": ["Sirio", "α CMa", "CMa", "Sirius"], ... }, // [español, designación, constelación, inglés]
  "l": [["Ori", [[ra, dec, ra, dec, ...], ...]], ...], // líneas de constelaciones
  "c": [["Ori", "Orión", ra, dec, rank, "Orion"], ...], // [id, español, ra, dec, rango, latín]
  "src": "d3-celestial (BSD-3), Hipparcos"
}
```

---

## Estructura del proyecto

```
celeste-aero/
├── api/
│   └── comets.js            Función de Vercel: JPL → lista de cometas filtrada
├── public/
│   ├── data/sky.json        Catálogo generado en el build (no se versiona)
│   ├── icon.svg             Icono de la app
│   └── manifest.webmanifest Manifiesto para instalar como app (PWA)
├── scripts/
│   └── build-data.mjs       Descarga y compacta el catálogo de estrellas
├── src/
│   ├── main.jsx             Punto de entrada de React
│   ├── App.jsx              Estado global, permisos, GPS, tiempo, paneles
│   ├── styles.css           Todo el estilo Frutiger Aero
│   ├── components/
│   │   ├── Aero.jsx         Ventana, botón, interruptor, control segmentado e iconos
│   │   ├── Welcome.jsx      Pantalla de bienvenida y permisos
│   │   ├── SkyView.jsx      Canvas, ciclo de dibujo y gestos
│   │   └── Panels.jsx       Paneles de información, búsqueda, capas y tiempo
│   └── lib/
│       ├── i18n.js          Textos en español e inglés, puntos cardinales y nombres por idioma
│       ├── astro.js         Coordenadas, refracción, planetas, cometas, formatos
│       ├── sensors.js       Cuaterniones y lectura de sensores de orientación
│       ├── renderer.js      Proyección y dibujo del cielo
│       └── objects.js       Fichas de información y elementos de búsqueda
├── tests/                   Pruebas en Node sin navegador
├── index.html
├── package.json
└── vite.config.js
```

### Idiomas (i18n)

No se usa una librería de traducción; el proyecto es pequeño y basta con `src/lib/i18n.js`:

- `t('clave', { variable })` devuelve el texto en el idioma activo, con respaldo al español si falta una clave.
- `setLang('es' | 'en')` cambia el idioma, lo guarda en `localStorage` (`celeste.lang`) y actualiza `<html lang>`.
- `localName(objeto)` elige `name` (español) o `nameEn` (inglés) de estrellas, constelaciones y planetas.
- `cardinal(az)` devuelve los puntos cardinales en el idioma activo (Oeste = **O** en español, **W** en inglés).
- `locale()` devuelve `es-MX` o `en-US` para fechas, horas y números.

El idioma vive en el módulo y no solo en el estado de React, porque el canvas lo lee en cada cuadro para las etiquetas del cielo. Al cambiarlo, `App.jsx` vuelve a generar la ficha abierta y el nombre del objeto señalado.

Nombres en el catálogo: las estrellas usan el nombre en español de d3-celestial cuando existe (Sirio, Proción) y el nombre propio internacional en inglés (Sirius, Procyon). Las constelaciones usan el nombre en español (Osa Mayor) y, en inglés, el nombre latino oficial de la IAU (Ursa Major). La búsqueda encuentra objetos por su nombre en cualquiera de los dos idiomas.

Para agregar otro idioma: añade su diccionario en `DICT`, su lista en `CARD`, la opción en `LANGS` y, si quieres nombres propios en ese idioma, un campo más en `scripts/build-data.mjs` (d3-celestial trae nombres en varios idiomas).

### Flujo de datos dentro de la app

`App.jsx` guarda un objeto mutable llamado `world` que comparte con `SkyView`. Contiene catálogo, ubicación, ajustes, reloj, cámara y objetivo. El ciclo de dibujo lee `world` en cada cuadro sin pasar por el estado de React, así que mover el teléfono no provoca re-renders. React solo se actualiza para la interfaz: barra superior unas 5 veces por segundo, paneles y notificaciones.

---

## Desarrollo local

Requisitos: **Node.js 18 o superior** (Vercel usa 22).

```bash
npm install
npm run dev
```

`npm run dev` descarga el catálogo la primera vez (lo genera en `public/data/sky.json`) y abre Vite en `http://localhost:5173`.

| Script | Qué hace |
|---|---|
| `npm run dev` | Genera el catálogo si falta y arranca Vite. |
| `npm run build` | Genera el catálogo si falta y compila a `dist/`. |
| `npm run preview` | Sirve `dist/` para revisarlo localmente. |
| `npm run data` | Solo genera el catálogo. |

Variables opcionales para `scripts/build-data.mjs`:

| Variable | Efecto |
|---|---|
| `FORCE_DATA=1` | Vuelve a descargar el catálogo aunque ya exista. |
| `DATA_DIR=/ruta` | Lee los JSON de d3-celestial desde una carpeta local en vez de internet. |

La función `/api/comets` no corre con `npm run dev`. En local la app sigue funcionando sin cometas. Para probarla usa `npx vercel dev`.

### Probar en el celular durante el desarrollo

Los sensores y el GPS **solo funcionan con HTTPS**. `http://192.168.x.x` desde el teléfono no sirve. Opciones:

- Desplegar una vista previa en Vercel (abrir una rama o PR crea una URL de preview).
- Usar un túnel HTTPS (por ejemplo `cloudflared tunnel --url http://localhost:5173`) junto con `npm run dev -- --host`.

---

## Despliegue en Vercel

El proyecto `celeste-aero` en Vercel se conecta al repositorio de Git: **cada push a la rama de producción (normalmente `main`) despliega automáticamente** y las demás ramas generan URLs de vista previa. Puedes confirmar la conexión en Vercel → *Settings → Git*.

Configuración que Vercel detecta sola:

| Ajuste | Valor |
|---|---|
| Framework | Vite |
| Comando de build | `npm run build` |
| Carpeta de salida | `dist` |
| Funciones | todo lo que está en `api/` |

Qué pasa en cada despliegue:

1. `npm install`
2. `scripts/build-data.mjs` descarga el catálogo de GitHub (con respaldo en jsDelivr) y genera `sky.json`.
3. `vite build` compila la app.
4. `api/comets.js` se publica como función.

No se necesitan variables de entorno. El plan gratuito de Vercel es suficiente.

Despliegue manual sin Git:

```bash
npm i -g vercel
vercel --prod
```

---

## Permisos y compatibilidad

| Plataforma | GPS | Sensores | Notas |
|---|---|---|---|
| Android + Chrome | ✅ | ✅ | Orientación absoluta (ya referida al norte). Es la combinación más precisa. |
| iPhone + Safari | ✅ | ✅ | Requiere tocar el botón de permisos; iOS no deja pedirlos automáticamente. La brújula se alinea en los primeros segundos. |
| Android + Firefox | ✅ | ⚠️ | Funciona, pero la referencia al norte puede variar según la versión. |
| Computadora | ✅ (aproximado, por IP o Wi‑Fi) | ❌ | Funciona en modo manual con mouse. |

Ninguna coordenada sale del dispositivo. La ubicación solo se usa para los cálculos locales y se guarda en `localStorage` para la siguiente visita.

---

## Pruebas

Pruebas en Node, sin navegador:

```bash
node tests/math.test.mjs      # Polaris a una altura ≈ latitud, Vega contra astronomy-engine,
                              # continuidad de órbitas elíptica / parabólica / hiperbólica
node tests/sensors.test.mjs   # ángulos W3C → dirección de la cámara
node tests/render.test.mjs    # dibujo con un canvas simulado y fichas de objetos en ES y EN
```

`render.test.mjs` necesita `public/data/sky.json`, así que corre antes `npm run data`.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "No se detectaron sensores" | Computadora, navegador sin soporte o permiso negado. | En el celular, recarga y toca "Permitir y ver el cielo". En iOS revisa Ajustes → Safari → Movimiento y orientación. |
| Las estrellas aparecen corridas a los lados | Brújula sin calibrar o interferencia magnética. | Aléjate de objetos metálicos, mueve el teléfono en forma de 8 y, si persiste, usa **Capas → Brújula → ajuste fino**. |
| Ubicación "Aprox." | Permiso de ubicación negado o sin señal GPS. | Activa la ubicación precisa del navegador o escribe las coordenadas en **Capas → Ubicación**. |
| No aparecen cometas | JPL no respondió o no hay cometas suficientemente brillantes. | En **Capas → Cometas** se muestra el estado. La caché se renueva cada 12 h. |
| El cielo deja estelas al moverse | Error ya corregido en `renderer.js`: el fondo no se borraba entre cuadros. | Asegúrate de tener la versión actual. |

---

## Licencias y créditos

| Recurso | Licencia |
|---|---|
| [d3-celestial](https://github.com/ofrohn/d3-celestial) (catálogo, nombres, figuras) | BSD-3-Clause |
| Catálogo Hipparcos (ESA) | Uso libre con atribución |
| [astronomy-engine](https://github.com/cosinekitty/astronomy) | MIT |
| [geomagnetism](https://github.com/naturalatlas/geomagnetism) + WMM-2025 (NOAA) | Apache-2.0 / dominio público |
| JPL Small-Body Database (NASA) | Dominio público |
| React, Vite | MIT |
