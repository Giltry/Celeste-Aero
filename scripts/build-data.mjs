// Descarga los catálogos de d3-celestial (licencia BSD-3) y genera un JSON compacto
// en public/data/sky.json. Se ejecuta antes de cada build (también en Vercel).
// Para trabajar sin red: DATA_DIR=/ruta/con/los/json node scripts/build-data.mjs
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'public', 'data', 'sky.json');

const FILES = ['stars.6.json', 'constellations.lines.json', 'constellations.json', 'starnames.json'];
const SOURCES = [
  'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/',
  'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/',
];

async function load(name) {
  if (process.env.DATA_DIR) {
    return JSON.parse(await readFile(path.join(process.env.DATA_DIR, name), 'utf8'));
  }
  let lastErr;
  for (const base of SOURCES) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(base + name);
        if (!res.ok) throw new Error(`${res.status} ${base}${name}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const toRa = (lon) => (lon < 0 ? lon + 360 : lon);
const DATA_VERSION = 2; // v2: nombres en español e inglés

async function main() {
  if (!process.env.FORCE_DATA) {
    try {
      await access(outFile);
      const current = JSON.parse(await readFile(outFile, 'utf8'));
      if (current.v === DATA_VERSION) {
        console.log('[data] sky.json ya existe, se reutiliza (FORCE_DATA=1 para regenerar)');
        return;
      }
    } catch {}
  }
  const [stars, lines, cons, names] = await Promise.all(FILES.map(load));

  // Estrellas: arreglo plano [ra, dec, mag, bv, ...] ordenado por brillo
  const list = stars.features
    .map((f) => ({
      hip: f.id,
      ra: toRa(f.geometry.coordinates[0]),
      dec: f.geometry.coordinates[1],
      mag: f.properties.mag,
      bv: parseFloat(f.properties.bv),
    }))
    .filter((s) => Number.isFinite(s.mag))
    .sort((a, b) => a.mag - b.mag);

  const s = [];
  const n = {};
  list.forEach((st, i) => {
    s.push(r3(st.ra), r3(st.dec), r2(st.mag), Number.isFinite(st.bv) ? r2(st.bv) : 0.6);
    const info = names[String(st.hip)];
    if (info) {
      const proper = info.es || info.name || '';
      const properEn = info.name || info.es || '';
      const desig = info.desig ? `${info.desig} ${info.c}` : '';
      if (proper || st.mag < 3.5) n[i] = [proper, desig, info.c || '', properEn];
    }
  });

  const l = lines.features.map((f) => [
    f.id,
    f.geometry.coordinates.map((seg) => seg.flatMap(([lon, dec]) => [r2(toRa(lon)), r2(dec)])),
  ]);

  const c = cons.features.map((f) => [
    f.id,
    f.properties.es || f.properties.name,
    r2(toRa(f.geometry.coordinates[0])),
    r2(f.geometry.coordinates[1]),
    Number(f.properties.rank) || 3,
    f.properties.name || f.properties.en, // en inglés se usa el nombre latino (Ursa Major, Orion)
  ]);

  await mkdir(path.dirname(outFile), { recursive: true });
  const json = JSON.stringify({ v: DATA_VERSION, s, n, l, c, src: 'd3-celestial (BSD-3), Hipparcos' });
  await writeFile(outFile, json);
  console.log(`[data] ${list.length} estrellas, ${Object.keys(n).length} nombres, ${l.length} figuras → ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error('[data] Error generando catálogo:', e);
  process.exit(1);
});
