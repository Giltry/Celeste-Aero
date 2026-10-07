// Describe objetos del cielo para la ventana de información y la búsqueda.
import { applyEnu, enuToAltAz, fmtRa, fmtDec, cardinal, constellationOf, riseSet, moonPhaseName, radecToVec } from './astro.js';
import { t, locale, localName } from './i18n.js';

export const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function bvLabel(bv) {
  if (bv < 0) return t('bv.blue');
  if (bv < 0.3) return t('bv.white');
  if (bv < 0.6) return t('bv.yellowWhite');
  if (bv < 0.9) return t('bv.yellow');
  if (bv < 1.4) return t('bv.orange');
  return t('bv.red');
}

const hhmm = (d) => (d ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '—');

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

const conLabel = (cat, id) => localName(cat.conName[id]);
const AU = () => (locale() === 'en-US' ? 'AU' : 'UA'); // unidad astronómica

// `key` identifica el objeto sin depender del idioma (para el objetivo señalado)
export function objectKey(obj) {
  if (!obj) return '';
  if (obj.kind === 'star') return 's' + obj.idx;
  if (obj.kind === 'comet') return 'c' + obj.ref.name;
  return obj.kind + ':' + obj.id;
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
    const proper = localName(nm);
    title = proper || nm?.desig || t('star.generic');
    subtitle = [proper && nm?.desig, conLabel(cat, con)].filter(Boolean).join(' · ');
    vec = radecToVec(ra, dec);
    rows.push([t('row.magnitude'), mag.toFixed(2) + (mag < 1 ? t('mag.veryBright') : mag > 5 ? t('mag.faint') : '')]);
    rows.push([t('row.color'), bvLabel(bv)]);
  } else if (obj.kind === 'comet') {
    const c = obj.ref;
    ra = c.ra; dec = c.dec; vec = c.vec;
    title = shortComet(c.name);
    subtitle = c.name;
    rows.push([t('row.estMag'), c.mag.toFixed(1) + (c.mag < 6 ? t('mag.naked') : c.mag < 10 ? t('mag.binoculars') : t('mag.telescope'))]);
    rows.push([t('row.sunDist'), `${c.r.toFixed(2)} ${AU()}`]);
    rows.push([t('row.earthDist'), `${c.delta.toFixed(2)} ${AU()}`]);
    const tp = new Date((c.tp - 2440587.5) * 86400000);
    rows.push([t('row.perihelion'), tp.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })]);
    rows.push([t('row.orbit'), t(c.e < 1 ? 'orbit.elliptic' : 'orbit.open', { e: c.e.toFixed(3) })]);
  } else if (obj.kind === 'con') {
    const c = cat.conLabels.find((x) => x.id === obj.id);
    vec = c.vec; title = localName(c); subtitle = t('con.sub', { id: c.id });
    const p = vecToRaDecQuick(vec); ra = p.ra; dec = p.dec;
  } else {
    const b = world.bodies?.find((x) => x.id === obj.id);
    if (!b) return null;
    ra = b.ra; dec = b.dec; vec = b.vec; title = localName(b); kind = b.kind;
    const cn = conLabel(cat, constellationOf(ra, dec));
    subtitle = cn ? t('in.con', { c: cn }) : '';
    rows.push([t('row.magnitude'), b.mag.toFixed(1)]);
    if (b.id === 'Moon') {
      rows.push([t('row.phase'), t('moon.illum', { phase: moonPhaseName(b.phase), p: Math.round((b.illum ?? 0) * 100) })]);
      rows.push([t('row.distance'), `${Math.round(b.dist * 149597870.7).toLocaleString(locale())} km`]);
    } else {
      rows.push([t('row.distance'), `${b.dist.toFixed(3)} ${AU()}`]);
      if (b.illum != null && b.id !== 'Sun') rows.push([t('row.illum'), `${Math.round(b.illum * 100)}%`]);
    }
    const { lat, lon } = world.location;
    const rs = riseSet(b.id, date, lat, lon);
    rows.push([t('row.riseSet'), `${hhmm(rs.rise)} · ${hhmm(rs.transit)} · ${hhmm(rs.set)}`]);
  }

  const aa = altAzOf(world, vec);
  if (aa) {
    rows.push([t('row.altitude'), `${aa.alt.toFixed(1)}° ${aa.alt < 0 ? t('alt.below') : ''}`]);
    rows.push([t('row.azimuth'), `${aa.az.toFixed(1)}° (${cardinal(aa.az)})`]);
  }
  if (ra != null) rows.push([t('row.radec'), `${fmtRa(ra)} · ${fmtDec(dec)}`]);

  return { title, subtitle, kind, kindLabel: t('kind.' + kind), vec, rows, aa, obj, key: objectKey(obj) };
}

function vecToRaDecQuick([x, y, z]) {
  let ra = (Math.atan2(y, x) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  return { ra, dec: (Math.asin(z) * 180) / Math.PI };
}

// Grupos de búsqueda: el id es fijo y la etiqueta se traduce al mostrarla
export const GROUPS = ['solar', 'comets', 'cons', 'stars'];

export function searchItems(world) {
  const items = [];
  for (const b of world.bodies || []) {
    items.push({ key: 'b' + b.id, label: localName(b), alt: b.nameEn === b.name ? '' : (localName(b) === b.name ? b.nameEn : b.name), sub: t('sub.' + b.kind), obj: { kind: b.kind, id: b.id }, vec: b.vec, group: 'solar' });
  }
  for (const c of world.comets || []) {
    if (c.mag > 14) continue;
    items.push({ key: 'c' + c.name, label: shortComet(c.name), sub: t('sub.comet', { m: c.mag.toFixed(1) }), obj: { kind: 'comet', ref: c }, vec: c.vec, group: 'comets' });
  }
  const { cat } = world;
  for (const k in cat.names) {
    const n = cat.names[k];
    if (!n.name) continue;
    const i = +k;
    const label = localName(n);
    items.push({ key: 's' + i, label, alt: label === n.name ? n.nameEn : n.name, sub: `${n.desig} · mag ${cat.mag[i].toFixed(1)}`, obj: { kind: 'star', idx: i }, vec: [cat.vec[i * 3], cat.vec[i * 3 + 1], cat.vec[i * 3 + 2]], group: 'stars' });
  }
  for (const c of cat.conLabels) {
    const label = localName(c);
    items.push({ key: 'k' + c.id, label, alt: label === c.name ? c.nameEn : c.name, sub: t('sub.con'), obj: { kind: 'con', id: c.id }, vec: c.vec, group: 'cons' });
  }
  return items;
}
