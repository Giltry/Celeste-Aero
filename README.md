# Celeste Aero

Mapa del cielo en tiempo real para el celular, con estética Frutiger Aero (estilo Windows Vista).
Usa el GPS (alta precisión) y los sensores de orientación del teléfono para mostrar estrellas,
constelaciones, Sol, Luna, planetas y cometas en la dirección a la que apuntas.

## Stack

- React 18 + Vite (JavaScript)
- Canvas 2D con proyección estereográfica
- `astronomy-engine`: tiempo sidéreo, precesión/nutación, planetas, Luna, salidas y puestas
- `geomagnetism` (WMM-2025): declinación magnética para corregir la brújula
- Catálogo Hipparcos vía d3-celestial (≈5,000 estrellas hasta magnitud 6, 88 constelaciones con nombres en español)
- Función serverless `api/comets.js`: elementos orbitales de la JPL Small-Body Database, cacheados 12 h en el CDN de Vercel

## Estructura

```
api/comets.js            Función de Vercel (JPL → cometas con perihelio cercano)
scripts/build-data.mjs   Descarga y compacta el catálogo en public/data/sky.json (corre en cada build)
src/lib/astro.js         Coordenadas, refracción, planetas, propagación kepleriana de cometas
src/lib/sensors.js       Orientación del dispositivo → cuaternión de cámara (Android absoluto, iOS con brújula)
src/lib/renderer.js      Dibujo del cielo, suelo, etiquetas, retícula del objetivo
src/lib/objects.js       Fichas de información y lista de búsqueda
src/components/          Pantallas: bienvenida/permisos, cielo, búsqueda, capas, tiempo, información
```

## Desarrollo local

```bash
npm install
npm run dev      # descarga el catálogo la primera vez y abre Vite
```

Los sensores del teléfono solo funcionan con **HTTPS**; para probar en el celular usa el despliegue de Vercel
(o `vite --host` con un túnel HTTPS).

## Desplegar en Vercel

Opción A, desde la terminal:

```bash
npm i -g vercel
vercel --prod
```

Opción B, desde el panel: sube la carpeta a un repositorio de GitHub e impórtalo en vercel.com/new.
Vercel detecta Vite automáticamente (build `npm run build`, salida `dist`) y publica `api/comets.js` como función.

## Pruebas rápidas

```bash
node tests/math.test.mjs      # Polaris ≈ latitud, Vega vs. astronomy-engine, continuidad de órbitas
node tests/sensors.test.mjs   # orientación W3C → dirección de la cámara
node tests/render.test.mjs    # render sin navegador y fichas de objetos
```
