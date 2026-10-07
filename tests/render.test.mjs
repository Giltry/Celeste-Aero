import fs from 'node:fs';
import { buildCatalog, eqjToEnuMatrix, solarSystem, cometPositions } from '../src/lib/astro.js';
import { drawSky, hitTest } from '../src/lib/renderer.js';
import { lookToQ, qToMat } from '../src/lib/sensors.js';
import { describe, searchItems } from '../src/lib/objects.js';
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k.startsWith('create') ? () => grad : noop)), set: (t, k, v) => { t[k] = v; return true; } });
const cat = buildCatalog(JSON.parse(fs.readFileSync('public/data/sky.json', 'utf8')));
const date = new Date('2026-10-07T04:00:00Z');
const world = { cat, location: { lat: 25.54, lon: -103.41 }, settings: { lines: true, conNames: true, starNames: true, planets: true, comets: true, grid: true, ecliptic: true, ground: true, belowHorizon: false, refraction: true, magLimit: 5.5 } };
world.bodies = solarSystem(date, 25.54, -103.41);
world.comets = cometPositions([{ name: 'C/2025 X1 (Prueba)', short: 'Prueba', e: 0.99, q: 0.8, i: 40, om: 100, w: 50, tp: 2461330, M1: 6, K1: 10 }], date);
world.Meqj = eqjToEnuMatrix(date, 25.54, -103.41);
let total = 0;
for (const [az, alt, fov] of [[0, 30, 75], [180, 60, 40], [90, -30, 100], [270, 89, 120], [45, 0, 10]]) {
  const cam = qToMat(lookToQ(az, alt));
  const t0 = performance.now();
  const r = drawSky(ctx, { W: 400, H: 800, cam, fov, Meqj: world.Meqj, cat, bodies: world.bodies, comets: world.comets, settings: world.settings, target: { vec: world.bodies[4].vec }, sunAlt: -30, dpr: 2, t: 0 });
  total += performance.now() - t0;
  console.log(az, alt, fov, 'hits', r.hits.length, 'target', JSON.stringify(r.targetInfo));
  if (r.hits[0]) console.log('  sample', describe(r.hits[0].obj, world, date)?.title);
}
console.log('avg ms', (total / 5).toFixed(1));
const items = searchItems(world); console.log('search items', items.length);
for (const o of [{kind:'planet',id:'Mars'},{kind:'moon',id:'Moon'},{kind:'comet',ref:world.comets[0]},{kind:'con',id:'Ori'},{kind:'star',idx:0}]) { const d = describe(o, world, date); console.log(d.title, '|', d.subtitle, '|', d.rows.map(r=>r.join(': ')).join(' ; ')); }
