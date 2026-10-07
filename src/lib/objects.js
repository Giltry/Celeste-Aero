// Describe objetos del cielo para la ventana de información y la búsqueda.
import { applyEnu, enuToAltAz, fmtRa, fmtDec, cardinal, constellationOf, riseSet, moonPhaseName, radecToVec } from './astro.js';

const KIND_LABEL = { star: 'Estrella', planet: 'Planeta', moon: 'Satélite natural', sun: 'Estrella (Sol)', comet: 'Cometa', con: 'Constelación' };

export const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function bvLabel(bv) {
  if (bv < 0) return 'Azul-blanca (muy caliente)';
  if (bv < 0.3) return 'Blanca';
  if (bv < 0.6) return 'Blanco-amarilla';
  if (bv < 0.9) return 'Amarilla (como el Sol)';
  if (bv < 1.4) return 'Naranja';
  return 'Roja (fría)';
}

const hhmm = (d) => (d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—');

export function altAzOf(world, vec) {
  if (!world.Meqj || !vec) return null;
  const w = applyEnu(world.Meqj, vec, [0, 0, 0], world.settings.refraction);
  return enuToAltAz(w[0], w[1], w[2]);
}

export function shortComet(name) {
  const m = name.match(/\(([^)]+)\)/);
  const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return m && !/^\d/.test(m[1]) ? `${m[1]} (${base})` : base;
}

export function describe(obj, world, date) {
  if (!obj) return null;
  const { cat } = world;
  let title, subtitle, vec, rows = [], ra, dec, kind = obj.kind;

  if (obj.kind === 'star') {
    const i = obj.idx;
    ra = cat.raw[i * 4]; dec = cat.raw[i * 4 + 1];
    const mag = cat.raw[i * 4 + 2], bv = cat.raw[i * 4 + 3];
    const nm = cat.names[i];
    const con = nm?.con || constellationOf(ra, dec);
    title = nm?.name || nm?.desig || 'Estrella';
    subtitle = [nm?.name && nm?.desig, cat.conName[con]].filter(Boolean).join(' · ');
    vec = radecToVec(ra, dec);
    rows.push(['Magnitud', mag.toFixed(2) + (mag < 1 ? ' (muy brillante)' : mag > 5 ? ' (débil)' : '')]);
    rows.push(['Color', bvLabel(bv)]);
  } else if (obj.kind === 'comet') {
    const c = obj.ref;
    ra = c.ra; dec = c.dec; vec = c.vec;
    title = shortComet(c.name);
    subtitle = c.name;
    rows.push(['Magnitud estimada', c.mag.toFixed(1) + (c.mag < 6 ? ' (a simple vista)' : c.mag < 10 ? ' (binoculares)' : ' (telescopio)')]);
    rows.push(['Distancia al Sol', `${c.r.toFixed(2)} UA`]);
    rows.push(['Distancia a la Tierra', `${c.delta.toFixed(2)} UA`]);
    const tp = new Date((c.tp - 2440587.5) * 86400000);
    rows.push(['Perihelio', tp.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })]);
    rows.push(['Órbita', c.e < 1 ? `Elíptica (e = ${c.e.toFixed(3)})` : `Abierta (e = ${c.e.toFixed(3)})`]);
  } else if (obj.kind === 'con') {
    const c = cat.conLabels.find((x) => x.id === obj.id);
    vec = c.vec; title = c.name; subtitle = `Constelación · ${c.id}`;
    const p = vecToRaDecQuick(vec); ra = p.ra; dec = p.dec;
  } else {
    const b = world.bodies?.find((x) => x.id === obj.id);
    if (!b) return null;
    ra = b.ra; dec = b.dec; vec = b.vec; title = b.name; kind = b.kind;
    subtitle = cat.conName[constellationOf(ra, dec)] ? `En ${cat.conName[constellationOf(ra, dec)]}` : '';
    rows.push(['Magnitud', b.mag.toFixed(1)]);
    if (b.id === 'Moon') {
      rows.push(['Fase', `${moonPhaseName(b.phase)} · ${Math.round((b.illum ?? 0) * 100)}% iluminada`]);
      rows.push(['Distancia', `${Math.round(b.dist * 149597870.7).toLocaleString('es-MX')} km`]);
    } else {
      rows.push(['Distancia', `${b.dist.toFixed(3)} UA`]);
      if (b.illum != null && b.id !== 'Sun') rows.push(['Iluminación', `${Math.round(b.illum * 100)}%`]);
    }
    const { lat, lon } = world.location;
    const rs = riseSet(b.id, date, lat, lon);
    rows.push(['Sale / Culmina / Se pone', `${hhmm(rs.rise)} · ${hhmm(rs.transit)} · ${hhmm(rs.set)}`]);
  }

  const aa = altAzOf(world, vec);
  if (aa) {
    rows.push(['Altura', `${aa.alt.toFixed(1)}° ${aa.alt < 0 ? '(bajo el horizonte)' : ''}`]);
    rows.push(['Azimut', `${aa.az.toFixed(1)}° (${cardinal(aa.az)})`]);
  }
  if (ra != null) rows.push(['AR / Dec (J2000)', `${fmtRa(ra)} · ${fmtDec(dec)}`]);

  return { title, subtitle, kind, kindLabel: KIND_LABEL[kind] || '', vec, rows, aa, obj };
}

function vecToRaDecQuick([x, y, z]) {
  let ra = (Math.atan2(y, x) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  return { ra, dec: (Math.asin(z) * 180) / Math.PI };
}

export function searchItems(world) {
  const items = [];
  for (const b of world.bodies || []) items.push({ key: 'b' + b.id, label: b.name, sub: b.kind === 'planet' ? 'Planeta' : b.kind === 'moon' ? 'Luna' : 'Sol', obj: { kind: b.kind, id: b.id }, vec: b.vec, group: 'Sistema solar' });
  for (const c of world.comets || []) {
    if (c.mag > 14) continue;
    items.push({ key: 'c' + c.name, label: shortComet(c.name), sub: `Cometa · mag ${c.mag.toFixed(1)}`, obj: { kind: 'comet', ref: c }, vec: c.vec, group: 'Cometas' });
  }
  const { cat } = world;
  for (const k in cat.names) {
    const n = cat.names[k];
    if (!n.name) continue;
    const i = +k;
    items.push({ key: 's' + i, label: n.name, sub: `${n.desig} · mag ${cat.mag[i].toFixed(1)}`, obj: { kind: 'star', idx: i }, vec: [cat.vec[i * 3], cat.vec[i * 3 + 1], cat.vec[i * 3 + 2]], group: 'Estrellas' });
  }
  for (const c of cat.conLabels) items.push({ key: 'k' + c.id, label: c.name, sub: 'Constelación', obj: { kind: 'con', id: c.id }, vec: c.vec, group: 'Constelaciones' });
  return items;
}
