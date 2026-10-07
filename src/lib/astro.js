// Cálculos astronómicos: catálogo → vectores, J2000 → horizonte local,
// planetas (astronomy-engine) y cometas (propagación kepleriana).
import * as A from 'astronomy-engine';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// ---------- Utilidades de vectores ----------
export function radecToVec(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}

export function vecToRadec(x, y, z) {
  const r = Math.hypot(x, y, z);
  let ra = Math.atan2(y, x) * RAD;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(z / r) * RAD };
}

// Matriz de rotación J2000 (EQJ) → horizonte local, convertida a marco ENU
// (x = Este, y = Norte, z = Cénit). Incluye precesión, nutación y tiempo sidéreo.
export function eqjToEnuMatrix(date, lat, lon, height = 0) {
  const obs = new A.Observer(lat, lon, height);
  const time = A.MakeTime(date);
  const m = A.Rotation_EQJ_HOR(time, obs).rot; // HOR: x=Norte, y=Oeste, z=Cénit
  // astronomy-engine aplica v' = Σ_i rot[i][j] * v_i
  const col = (j) => [m[0][j], m[1][j], m[2][j]];
  const N = col(0), W = col(1), Z = col(2);
  // Filas de la matriz ENU: E = -W, N, Z
  return [
    [-W[0], -W[1], -W[2]],
    [N[0], N[1], N[2]],
    [Z[0], Z[1], Z[2]],
  ];
}

// Refracción atmosférica (fórmula de Sæmundsson), en grados
export function refraction(altDeg) {
  if (altDeg < -1.5) return 0;
  const h = Math.max(altDeg, -1);
  return (1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG)) / 60;
}

// Aplica matriz + refracción. out recibe [e, n, u]
export function applyEnu(M, v, out, refract = true) {
  let e = M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2];
  let n = M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2];
  let u = M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2];
  if (refract && u > -0.03 && u < 0.5) {
    const alt = Math.asin(Math.max(-1, Math.min(1, u))) * RAD;
    const alt2 = (alt + refraction(alt)) * DEG;
    const h = Math.hypot(e, n) || 1e-9;
    const ch = Math.cos(alt2);
    e = (e / h) * ch; n = (n / h) * ch; u = Math.sin(alt2);
  }
  out[0] = e; out[1] = n; out[2] = u;
  return out;
}

export function enuToAltAz(e, n, u) {
  let az = Math.atan2(e, n) * RAD;
  if (az < 0) az += 360;
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) * RAD, az };
}

export function altAzToEnu(alt, az) {
  const a = alt * DEG, z = az * DEG;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}

const CARD = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const cardinal = (az) => CARD[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];

// Color aproximado de una estrella a partir del índice B-V
export function bvToRgb(bv) {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); // Ballesteros
  const k = t / 100;
  let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; }
  else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); }
  if (k >= 66) b = 255; else if (k <= 19) b = 0; else b = 138.52 * Math.log(k - 10) - 305.04;
  const c = (x) => Math.round(Math.max(0, Math.min(255, x)) * 0.55 + 255 * 0.45); // suavizado hacia blanco
  return `${c(r)},${c(g)},${c(b)}`;
}

// ---------- Catálogo ----------
export function buildCatalog(data) {
  const count = data.s.length / 4;
  const vec = new Float64Array(count * 3);
  const mag = new Float32Array(count);
  const color = new Array(count);
  for (let i = 0; i < count; i++) {
    const v = radecToVec(data.s[i * 4], data.s[i * 4 + 1]);
    vec[i * 3] = v[0]; vec[i * 3 + 1] = v[1]; vec[i * 3 + 2] = v[2];
    mag[i] = data.s[i * 4 + 2];
    color[i] = bvToRgb(data.s[i * 4 + 3]);
  }
  const names = {};
  for (const k in data.n) names[k] = { name: data.n[k][0], desig: data.n[k][1], con: data.n[k][2] };
  const conName = {};
  const conLabels = data.c.map(([id, name, ra, dec, rank]) => {
    conName[id] = name;
    return { id, name, rank, vec: radecToVec(ra, dec) };
  });
  const conLines = data.l.map(([id, segs]) =>
    ({ id, segs: segs.map((flat) => {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push(radecToVec(flat[i], flat[i + 1]));
      return pts;
    }) }));
  return { count, vec, mag, color, names, conLabels, conLines, conName, raw: data.s };
}

export function constellationOf(raDeg, decDeg, date) {
  try { return A.Constellation(raDeg / 15, decDeg).symbol; } catch { return ''; }
}

// Línea de la eclíptica en J2000
export const ECLIPTIC = (() => {
  const eps = 23.4392911 * DEG;
  const pts = [];
  for (let l = 0; l <= 360; l += 4) {
    const x = Math.cos(l * DEG), y = Math.sin(l * DEG);
    pts.push([x, y * Math.cos(eps), y * Math.sin(eps)]);
  }
  return pts;
})();

// ---------- Sistema solar ----------
export const BODIES = [
  { id: 'Sun', name: 'Sol', color: '255,236,160', kind: 'sun' },
  { id: 'Moon', name: 'Luna', color: '235,240,255', kind: 'moon' },
  { id: 'Mercury', name: 'Mercurio', color: '220,200,180', kind: 'planet' },
  { id: 'Venus', name: 'Venus', color: '255,250,220', kind: 'planet' },
  { id: 'Mars', name: 'Marte', color: '255,150,110', kind: 'planet' },
  { id: 'Jupiter', name: 'Júpiter', color: '255,225,190', kind: 'planet' },
  { id: 'Saturn', name: 'Saturno', color: '250,225,160', kind: 'planet' },
  { id: 'Uranus', name: 'Urano', color: '180,240,255', kind: 'planet' },
  { id: 'Neptune', name: 'Neptuno', color: '140,170,255', kind: 'planet' },
];

export function solarSystem(date, lat, lon, height = 0) {
  const obs = new A.Observer(lat, lon, height);
  const time = A.MakeTime(date);
  return BODIES.map((b) => {
    const eq = A.Equator(b.id, time, obs, false, true); // J2000, topocéntrico
    let mag = 0, phase = null, illum = null;
    try {
      const il = A.Illumination(b.id, time);
      mag = il.mag; illum = il.phase_fraction;
    } catch {}
    if (b.id === 'Moon') phase = A.MoonPhase(time);
    const ra = eq.ra * 15;
    return { ...b, ra, dec: eq.dec, dist: eq.dist, mag, illum, phase, vec: radecToVec(ra, eq.dec) };
  });
}

export function riseSet(bodyId, date, lat, lon) {
  const obs = new A.Observer(lat, lon, 0);
  const start = A.MakeTime(new Date(date.getTime() - 12 * 3600e3));
  const out = {};
  try { out.rise = A.SearchRiseSet(bodyId, obs, +1, start, 1.5)?.date || null; } catch {}
  try { out.set = A.SearchRiseSet(bodyId, obs, -1, start, 1.5)?.date || null; } catch {}
  try { out.transit = A.SearchHourAngle(bodyId, obs, 0, start)?.time?.date || null; } catch {}
  return out;
}

export function moonPhaseName(deg) {
  const p = ((deg % 360) + 360) % 360;
  if (p < 11.25 || p >= 348.75) return 'Luna nueva';
  if (p < 78.75) return 'Creciente';
  if (p < 101.25) return 'Cuarto creciente';
  if (p < 168.75) return 'Gibosa creciente';
  if (p < 191.25) return 'Luna llena';
  if (p < 258.75) return 'Gibosa menguante';
  if (p < 281.25) return 'Cuarto menguante';
  return 'Menguante';
}

// ---------- Cometas ----------
const K_GAUSS = 0.01720209895;
const OBLIQ = 23.4392911 * DEG;

function solveElliptic(M, e) {
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  let lo = -Math.PI, hi = Math.PI, E = M + e * Math.sin(M);
  for (let i = 0; i < 60; i++) {
    const f = E - e * Math.sin(E) - M;
    if (f > 0) hi = E; else lo = E;
    const d = f / (1 - e * Math.cos(E));
    let En = E - d;
    if (!(En > lo && En < hi)) En = (lo + hi) / 2;
    if (Math.abs(En - E) < 1e-13) return En;
    E = En;
  }
  return E;
}

function solveHyperbolic(M, e) {
  const sign = M < 0 ? -1 : 1; M = Math.abs(M);
  let lo = 0, hi = 1;
  while (e * Math.sinh(hi) - hi < M) hi *= 2;
  let H = Math.min(hi, Math.asinh(M / e) + 0.1);
  for (let i = 0; i < 100; i++) {
    const f = e * Math.sinh(H) - H - M;
    if (f > 0) hi = H; else lo = H;
    let Hn = H - f / (e * Math.cosh(H) - 1);
    if (!(Hn > lo && Hn < hi)) Hn = (lo + hi) / 2;
    if (Math.abs(Hn - H) < 1e-13) return sign * Hn;
    H = Hn;
  }
  return sign * H;
}

// Posición heliocéntrica eclíptica J2000 (UA) a partir de elementos orbitales
export function cometHelio(el, jd) {
  const { e, q, i, om, w, tp } = el;
  const dt = jd - tp;
  let x, y;
  if (Math.abs(e - 1) < 1e-6) {
    // Parabólica: ecuación de Barker
    const W = 3 * K_GAUSS * dt / Math.sqrt(2 * q * q * q);
    const Y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1));
    const s = Y - 1 / Y; // tan(v/2)
    x = q * (1 - s * s); y = 2 * q * s;
  } else if (e < 1) {
    const a = q / (1 - e);
    const E = solveElliptic(K_GAUSS * dt / Math.pow(a, 1.5), e);
    x = a * (Math.cos(E) - e); y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  } else {
    const a = q / (e - 1);
    const H = solveHyperbolic(K_GAUSS * dt / Math.pow(a, 1.5), e);
    x = a * (e - Math.cosh(H)); y = a * Math.sqrt(e * e - 1) * Math.sinh(H);
  }
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG);
  const cO = Math.cos(om * DEG), sO = Math.sin(om * DEG);
  const ci = Math.cos(i * DEG), si = Math.sin(i * DEG);
  const xp = x * cw - y * sw, yp = x * sw + y * cw;
  return [xp * cO - yp * ci * sO, xp * sO + yp * ci * cO, yp * si];
}

const eclToEq = ([x, y, z]) => [x, y * Math.cos(OBLIQ) - z * Math.sin(OBLIQ), y * Math.sin(OBLIQ) + z * Math.cos(OBLIQ)];

export function cometPositions(comets, date) {
  if (!comets?.length) return [];
  const time = A.MakeTime(date);
  const jd = time.tt + 2451545.0;
  const ev = A.HelioVector(A.Body.Earth, time);
  const earth = [ev.x, ev.y, ev.z];
  const out = [];
  for (const c of comets) {
    try {
      let helio = eclToEq(cometHelio(c, jd));
      let geo = [helio[0] - earth[0], helio[1] - earth[1], helio[2] - earth[2]];
      // Una iteración de tiempo-luz
      const delta0 = Math.hypot(...geo);
      helio = eclToEq(cometHelio(c, jd - delta0 * 0.0057755183));
      geo = [helio[0] - earth[0], helio[1] - earth[1], helio[2] - earth[2]];
      const r = Math.hypot(...helio), delta = Math.hypot(...geo);
      const mag = (c.M1 ?? 12) + 5 * Math.log10(delta) + (c.K1 ?? 10) * Math.log10(r);
      const { ra, dec } = vecToRadec(...geo);
      // Punto de la cola: dirección anti-solar, longitud proporcional a la cercanía al Sol
      const tailLen = Math.min(0.25, 0.08 / Math.max(r, 0.3)) * delta;
      const tailGeo = [geo[0] + (helio[0] / r) * tailLen, geo[1] + (helio[1] / r) * tailLen, geo[2] + (helio[2] / r) * tailLen];
      const tn = Math.hypot(...tailGeo);
      out.push({
        ...c, kind: 'comet', ra, dec, r, delta, mag,
        vec: radecToVec(ra, dec),
        tailVec: [tailGeo[0] / tn, tailGeo[1] / tn, tailGeo[2] / tn],
      });
    } catch {}
  }
  return out.filter((c) => Number.isFinite(c.mag)).sort((a, b) => a.mag - b.mag);
}

export function fmtRa(deg) {
  const h = ((deg / 15) % 24 + 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.round(((h - hh) * 60 - mm) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss % 60).padStart(2, '0')}s`;
}
export function fmtDec(deg) {
  const s = deg < 0 ? '−' : '+';
  const a = Math.abs(deg), d = Math.floor(a), m = Math.round((a - d) * 60);
  return `${s}${d}° ${String(m % 60).padStart(2, '0')}′`;
}
