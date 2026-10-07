// Dibujo del cielo en Canvas 2D con proyección estereográfica centrada en la cámara.
import { applyEnu, altAzToEnu, enuToAltAz, ECLIPTIC, DEG, cardinal } from './astro.js';

const tmp = [0, 0, 0];

export function makeProjector(M, W, H, fovDeg) {
  // M: matriz cámara (filas = mundo ENU, columnas = ejes del dispositivo)
  const F = (Math.min(W, H) / 2) / (2 * Math.tan((fovDeg * DEG) / 4));
  const cx = W / 2, cy = H / 2;
  const p = { x: 0, y: 0, c: 0, dx: 0, dy: 0, ok: false };
  return {
    F, cx, cy,
    project(w, cull = -0.15) {
      const dx = M[0][0] * w[0] + M[1][0] * w[1] + M[2][0] * w[2];
      const dy = M[0][1] * w[0] + M[1][1] * w[1] + M[2][1] * w[2];
      const dz = M[0][2] * w[0] + M[1][2] * w[1] + M[2][2] * w[2];
      const c = -dz;
      p.c = c; p.dx = dx; p.dy = dy;
      if (c < cull) { p.ok = false; return p; }
      const k = 2 / Math.max(1e-4, 1 + c);
      p.x = cx + F * k * dx;
      p.y = cy - F * k * dy;
      p.ok = p.x > -60 && p.x < W + 60 && p.y > -60 && p.y < H + 60;
      return p;
    },
  };
}

function skyColors(sunAlt) {
  // Degradado del cielo según la altura del Sol
  if (sunAlt > 0) return ['#2f8fe0', '#7cc7f5', '#cfefff'];
  if (sunAlt > -6) return ['#18396e', '#3b6ea8', '#e3a46d'];
  if (sunAlt > -12) return ['#0a1838', '#1a3360', '#4a5b85'];
  if (sunAlt > -18) return ['#050c22', '#0c1a3c', '#1d2a50'];
  return ['#02050f', '#050d22', '#0c1834'];
}

function polyline(ctx, proj, pts, refract, M_eqj, cull = -0.1) {
  let drawing = false;
  let last = null;
  for (const v of pts) {
    const w = M_eqj ? applyEnu(M_eqj, v, tmp, refract) : v;
    const p = proj.project(w, cull);
    const visible = p.c >= cull;
    if (visible) {
      if (drawing && last && Math.hypot(p.x - last[0], p.y - last[1]) < 2000) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      drawing = true; last = [p.x, p.y];
    } else { drawing = false; last = null; }
  }
}

export function drawSky(ctx, env) {
  const { W, H, cam, fov, Meqj, cat, bodies, comets, settings, target, sunAlt, dpr } = env;
  const proj = makeProjector(cam, W, H, fov);
  const hits = [];
  const zoom = Math.max(1, 70 / fov);
  const dayDim = sunAlt > -4 ? 0.15 : sunAlt > -10 ? 0.55 : sunAlt > -16 ? 0.85 : 1;

  // ---- Fondo ----
  const [c0, c1, c2] = skyColors(sunAlt);
  const up = proj.project(altAzToEnu(90, 0), -2);
  const hor = proj.project(altAzToEnu(0, enuToAltAz(-cam[0][2], -cam[1][2], 0).az), -2);
  const g = ctx.createLinearGradient(up.x, up.y, hor.x, hor.y);
  g.addColorStop(0, c0); g.addColorStop(0.75, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // ---- Cuadrícula alt-az ----
  if (settings.grid) {
    ctx.strokeStyle = 'rgba(120,200,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let alt = 15; alt < 90; alt += 15) {
      const pts = [];
      for (let az = 0; az <= 360; az += 4) pts.push(altAzToEnu(alt, az));
      polyline(ctx, proj, pts);
    }
    for (let az = 0; az < 360; az += 30) {
      const pts = [];
      for (let alt = -10; alt <= 90; alt += 4) pts.push(altAzToEnu(alt, az));
      polyline(ctx, proj, pts);
    }
    ctx.stroke();
  }

  // ---- Eclíptica ----
  if (settings.ecliptic) {
    ctx.strokeStyle = 'rgba(255,200,90,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    polyline(ctx, proj, ECLIPTIC, false, Meqj);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- Figuras de constelaciones ----
  if (settings.lines) {
    ctx.strokeStyle = `rgba(140,215,255,${0.38 * (0.4 + 0.6 * dayDim)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const con of cat.conLines) for (const seg of con.segs) polyline(ctx, proj, seg, settings.refraction, Meqj, 0);
    ctx.stroke();
  }

  // ---- Estrellas ----
  const limit = Math.min(settings.magLimit + Math.log2(zoom) * 1.2, 6.5) - (1 - dayDim) * 3;
  const sizeK = 0.62 * Math.min(2.2, Math.sqrt(zoom));
  const labels = [];
  const v = [0, 0, 0];
  for (let i = 0; i < cat.count; i++) {
    const m = cat.mag[i];
    if (m > limit) break; // ordenadas por brillo
    v[0] = cat.vec[i * 3]; v[1] = cat.vec[i * 3 + 1]; v[2] = cat.vec[i * 3 + 2];
    const w = applyEnu(Meqj, v, tmp, settings.refraction);
    if (!settings.belowHorizon && w[2] < -0.02) continue;
    const p = proj.project(w, 0);
    if (!p.ok) continue;
    const r = Math.max(0.55, (limit + 1.2 - m) * sizeK);
    const a = Math.min(1, 0.35 + (limit - m) * 0.35) * (w[2] < 0 ? 0.3 : 1);
    const col = cat.color[i];
    if (m < 1.6 && dayDim > 0.5) {
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      gr.addColorStop(0, `rgba(${col},${0.55 * a})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
    const nm = cat.names[i];
    hits.push({ x: p.x, y: p.y, r: r + 6, pri: 1 + (5 - m) * 0.1, obj: { kind: 'star', idx: i } });
    if (settings.starNames && nm?.name && m < 2.2 + Math.log2(zoom) * 1.3) labels.push([p.x + r + 4, p.y + 4, nm.name]);
  }

  // ---- Nombres de constelaciones ----
  if (settings.conNames) {
    ctx.font = `600 ${11}px "Segoe UI", "Open Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(150,220,255,${0.55 * (0.5 + 0.5 * dayDim)})`;
    for (const c of cat.conLabels) {
      if (fov > 80 && c.rank > 2) continue;
      const w = applyEnu(Meqj, c.vec, tmp, false);
      if (w[2] < -0.05 && !settings.belowHorizon) continue;
      const p = proj.project(w, 0);
      if (p.ok) ctx.fillText(c.name.toUpperCase(), p.x, p.y);
    }
    ctx.textAlign = 'left';
  }

  // ---- Cometas ----
  if (settings.comets && comets) {
    for (const c of comets) {
      if (c.mag > Math.max(limit + 4, 11)) continue;
      const w = applyEnu(Meqj, c.vec, [0, 0, 0], settings.refraction);
      if (!settings.belowHorizon && w[2] < -0.02) continue;
      const p = proj.project(w, 0);
      if (!p.ok) continue;
      const x = p.x, y = p.y;
      const tw = applyEnu(Meqj, c.tailVec, [0, 0, 0], false);
      const tp = proj.project(tw, -1);
      let tx = tp.x - x, ty = tp.y - y;
      const len = Math.hypot(tx, ty) || 1;
      const L = Math.max(14, Math.min(90, len));
      tx = (tx / len) * L; ty = (ty / len) * L;
      const gr = ctx.createLinearGradient(x, y, x + tx, y + ty);
      gr.addColorStop(0, 'rgba(160,255,230,0.75)');
      gr.addColorStop(1, 'rgba(160,255,230,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tx, y + ty); ctx.stroke();
      ctx.fillStyle = 'rgba(200,255,240,0.95)';
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.2832); ctx.fill();
      hits.push({ x, y, r: 16, pri: 3, obj: { kind: 'comet', ref: c } });
      if (settings.starNames || fov < 60) labels.push([x + 7, y - 6, c.short || c.name, 'comet']);
    }
  }

  // ---- Sistema solar ----
  if (settings.planets && bodies) {
    const sun = bodies.find((b) => b.id === 'Sun');
    for (const b of bodies) {
      const w = applyEnu(Meqj, b.vec, [0, 0, 0], settings.refraction);
      if (!settings.belowHorizon && w[2] < -0.02 && b.id !== 'Sun') continue;
      const p = proj.project(w, 0);
      if (!p.ok) continue;
      const x = p.x, y = p.y;
      const dim = w[2] < 0 ? 0.35 : 1;
      let r;
      if (b.kind === 'sun' || b.kind === 'moon') {
        r = Math.max(7, proj.F * 0.0047 * 2);
        const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * (b.kind === 'sun' ? 5 : 3));
        glow.addColorStop(0, `rgba(${b.color},${0.45 * dim})`);
        glow.addColorStop(1, `rgba(${b.color},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, r * (b.kind === 'sun' ? 5 : 3), 0, 6.2832); ctx.fill();
        if (b.kind === 'moon' && sun) {
          const sw = applyEnu(Meqj, sun.vec, [0, 0, 0], false);
          const sp = proj.project(sw, -1);
          drawMoon(ctx, x, y, r, Math.atan2(sp.y - y, sp.x - x), b.illum ?? 0.5, dim);
        } else {
          const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
          sg.addColorStop(0, '#fffef0'); sg.addColorStop(1, '#ffd65a');
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        }
      } else {
        r = Math.max(2.4, (4 - Math.min(b.mag, 6)) * 0.9 * Math.min(2, Math.sqrt(zoom)));
        const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
        gl.addColorStop(0, `rgba(${b.color},${0.5 * dim})`);
        gl.addColorStop(1, `rgba(${b.color},0)`);
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = `rgba(${b.color},${dim})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        if (b.id === 'Saturn' && r > 3) {
          ctx.strokeStyle = `rgba(${b.color},${0.7 * dim})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.7, -0.4, 0, 6.2832); ctx.stroke();
        }
      }
      hits.push({ x, y, r: r + 12, pri: 5, obj: { kind: b.kind, id: b.id } });
      labels.push([x + r + 5, y - r - 2, b.name, 'planet']);
    }
  }

  // ---- Horizonte y suelo ----
  if (settings.ground) drawGround(ctx, proj, W, H, sunAlt, cam);

  // ---- Puntos cardinales ----
  ctx.font = `700 13px "Segoe UI", "Open Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let az = 0; az < 360; az += 45) {
    const p = proj.project(altAzToEnu(1.5, az), 0);
    if (!p.ok) continue;
    const t = cardinal(az);
    ctx.fillStyle = t === 'N' ? 'rgba(255,120,110,0.95)' : 'rgba(170,235,255,0.9)';
    ctx.fillText(t, p.x, p.y);
  }
  ctx.textAlign = 'left';

  // ---- Etiquetas ----
  ctx.font = `500 12px "Segoe UI", "Open Sans", system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
  for (const [x, y, t, k] of labels) {
    ctx.fillStyle = k === 'planet' ? 'rgba(255,236,170,0.95)' : k === 'comet' ? 'rgba(170,255,225,0.95)' : 'rgba(225,240,255,0.85)';
    ctx.fillText(t, x, y);
  }
  ctx.shadowBlur = 0;

  // ---- Objetivo seleccionado ----
  let targetInfo = null;
  if (target?.vec) {
    const w = applyEnu(Meqj, target.vec, [0, 0, 0], settings.refraction);
    const p = proj.project(w, -2);
    const onScreen = p.c > 0 && p.x > 20 && p.x < W - 20 && p.y > 90 && p.y < H - 110;
    if (onScreen) {
      drawReticle(ctx, p.x, p.y, env.t);
      targetInfo = { onScreen: true, dist: Math.hypot(p.x - W / 2, p.y - H / 2) };
    } else {
      let ang = Math.atan2(-p.dy, p.dx);
      if (Math.hypot(p.dx, p.dy) < 1e-3) ang = Math.PI / 2;
      targetInfo = { onScreen: false, angle: ang };
    }
    targetInfo.altAz = enuToAltAz(w[0], w[1], w[2]);
  }

  return { hits, targetInfo };
}

function drawMoon(ctx, x, y, r, sunAngle, f, dim) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sunAngle);
  ctx.globalAlpha = dim;
  ctx.fillStyle = '#2a3242';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
  const lit = ctx.createRadialGradient(r * 0.3, -r * 0.2, 0, 0, 0, r);
  lit.addColorStop(0, '#ffffff'); lit.addColorStop(1, '#d9e2f2');
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fill();
  const rx = r * Math.abs(2 * f - 1);
  ctx.fillStyle = f > 0.5 ? lit : '#2a3242';
  ctx.beginPath(); ctx.ellipse(0, 0, rx, r, 0, 0, 6.2832); ctx.fill();
  ctx.restore();
}

function drawGround(ctx, proj, W, H, sunAlt, cam) {
  const pts = [];
  for (let az = 0; az <= 360; az += 3) {
    const p = proj.project(altAzToEnu(0, az), -0.999);
    const x = Math.max(-1e5, Math.min(1e5, p.x)), y = Math.max(-1e5, Math.min(1e5, p.y));
    pts.push([x, y]);
  }
  // Si la cámara mira por encima del horizonte, el punto antípoda (∞ en la proyección)
  // está bajo tierra: el suelo es el exterior del círculo del horizonte.
  const lookingUp = -cam[2][2] > 0;
  ctx.save();
  ctx.beginPath();
  if (lookingUp) ctx.rect(-10, -10, W + 20, H + 20);
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  const day = sunAlt > -6;
  ctx.fillStyle = day ? 'rgba(30,70,40,0.82)' : 'rgba(4,16,14,0.78)';
  ctx.fill('evenodd');
  ctx.restore();
  // Línea del horizonte con brillo aqua
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = 'rgba(120,255,200,0.55)';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(80,255,190,0.8)'; ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawReticle(ctx, x, y, t) {
  const pulse = 1 + 0.12 * Math.sin(t / 250);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(120,230,255,0.95)';
  ctx.shadowColor = 'rgba(80,200,255,1)'; ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 18 * pulse, 0, 6.2832); ctx.stroke();
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(24 * pulse, 0); ctx.lineTo(32 * pulse, 0); ctx.stroke();
  }
  ctx.restore();
}

export function hitTest(hits, x, y) {
  let best = null, bestScore = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d > Math.max(h.r, 22)) continue;
    const score = d - h.pri * 4;
    if (score < bestScore) { bestScore = score; best = h; }
  }
  return best?.obj || null;
}
