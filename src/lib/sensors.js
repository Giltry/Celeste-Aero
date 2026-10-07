// Orientación del dispositivo (acelerómetro + magnetómetro + giroscopio, fusionados
// por el sistema operativo) convertida a una matriz de cámara en el marco ENU.
import { DEG, RAD } from './astro.js';

// ---------- Cuaterniones [w, x, y, z] ----------
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qaxis = (ax, ang) => {
  const s = Math.sin(ang / 2);
  return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s];
};
export function qslerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (dot < 0) { b = b.map((v) => -v); dot = -dot; }
  if (dot > 0.9995) {
    const r = a.map((v, i) => v + (b[i] - v) * t);
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const th = Math.acos(dot), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
}
// Matriz 3x3 (filas = ejes del mundo ENU, columnas = ejes del dispositivo)
export function qToMat(q) {
  const [w, x, y, z] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}
export function matToQ(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let w, x, y, z;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s;
  }
  const n = Math.hypot(w, x, y, z);
  return [w / n, x / n, y / n, z / n];
}

// W3C: R = Rz(alpha) · Rx(beta) · Ry(gamma), luego compensar la rotación de pantalla
export function eulerToQ(alpha, beta, gamma, screenAngle = 0) {
  let q = qmul(qmul(qaxis([0, 0, 1], alpha * DEG), qaxis([1, 0, 0], beta * DEG)), qaxis([0, 1, 0], gamma * DEG));
  if (screenAngle) q = qmul(q, qaxis([0, 0, 1], -screenAngle * DEG));
  return q;
}

// Cámara manual: azimut / altitud del centro de la vista
export function lookToQ(az, alt, roll = 0) {
  const a = az * DEG, h = alt * DEG;
  const f = [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)]; // adelante
  let r = [Math.cos(a), -Math.sin(a), 0]; // derecha
  let u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  if (roll) {
    const c = Math.cos(roll * DEG), s = Math.sin(roll * DEG);
    const r2 = r.map((v, i) => v * c + u[i] * s), u2 = u.map((v, i) => u[i] * c - r[i] * s);
    r = r2; u = u2;
  }
  // columnas: x = derecha, y = arriba, z = atrás (-adelante)
  return matToQ([
    [r[0], u[0], -f[0]],
    [r[1], u[1], -f[1]],
    [r[2], u[2], -f[2]],
  ]);
}

export function viewDirection(m) {
  // Hacia dónde mira la cámara (−z del dispositivo) → alt/az
  const f = [-m[0][2], -m[1][2], -m[2][2]];
  let az = Math.atan2(f[0], f[1]) * RAD;
  if (az < 0) az += 360;
  return { az, alt: Math.asin(Math.max(-1, Math.min(1, f[2]))) * RAD, f };
}

const headingOf = (v) => (Math.atan2(v[0], v[1]) * RAD + 360) % 360;
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;

export const isIOS = () =>
  typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

export async function requestMotionPermission() {
  try {
    if (isIOS()) {
      const r = await DeviceOrientationEvent.requestPermission();
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try { await DeviceMotionEvent.requestPermission(); } catch {}
      }
      return r === 'granted' ? 'granted' : 'denied';
    }
    return 'granted';
  } catch {
    return 'denied';
  }
}

// Seguidor de orientación: produce un cuaternión objetivo filtrado
export class OrientationTracker {
  constructor() {
    this.target = null;
    this.mode = null; // 'absolute' | 'compass' | 'relative'
    this.declination = 0; // grados, positivo al Este
    this.userOffset = 0; // calibración manual del usuario
    this.iosOffset = null;
    this.lastEvent = 0;
    this.accuracy = null;
    this._abs = this._abs.bind(this);
    this._rel = this._rel.bind(this);
  }

  start() {
    window.addEventListener('deviceorientationabsolute', this._abs, true);
    window.addEventListener('deviceorientation', this._rel, true);
  }
  stop() {
    window.removeEventListener('deviceorientationabsolute', this._abs, true);
    window.removeEventListener('deviceorientation', this._rel, true);
  }
  get active() {
    return this.target && performance.now() - this.lastEvent < 2500;
  }

  _screenAngle() {
    return (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  }

  _abs(e) {
    if (e.alpha == null) return;
    this.mode = 'absolute';
    this._set(e.alpha, e.beta, e.gamma);
  }

  _rel(e) {
    if (e.alpha == null) return;
    if (e.absolute === true && this.mode !== 'absolute') {
      this.mode = 'absolute';
      this._set(e.alpha, e.beta, e.gamma);
      return;
    }
    if (this.mode === 'absolute' && performance.now() - this.lastEvent < 1000) return;
    const heading = e.webkitCompassHeading;
    if (typeof heading === 'number' && heading >= 0) {
      // iOS: alpha es relativo; se alinea con la brújula (norte magnético)
      this.mode = 'compass';
      this.accuracy = e.webkitCompassAccuracy;
      const m = qToMat(eulerToQ(e.alpha, e.beta, e.gamma));
      const flat = Math.abs(m[2][2]) > 0.7; // pantalla mirando arriba/abajo
      const v = flat ? [m[0][1], m[1][1]] : [-m[0][2], -m[1][2]];
      const offset = angDiff(headingOf(v), heading);
      this.iosOffset = this.iosOffset == null ? offset : this.iosOffset + angDiff(offset, this.iosOffset) * 0.05;
      this._set(e.alpha + this.iosOffset, e.beta, e.gamma);
    } else {
      this.mode = 'relative';
      this._set(e.alpha, e.beta, e.gamma);
    }
  }

  _set(alpha, beta, gamma) {
    // alpha crece en sentido antihorario: rumbo verdadero = magnético + declinación
    const a = alpha - this.declination - this.userOffset;
    this.target = eulerToQ(a, beta, gamma, this._screenAngle());
    this.lastEvent = performance.now();
  }
}
