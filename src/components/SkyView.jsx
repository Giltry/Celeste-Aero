import { useEffect, useRef } from 'react';
import { eqjToEnuMatrix, applyEnu, enuToAltAz, solarSystem, cometPositions } from '../lib/astro.js';
import { qslerp, qToMat, lookToQ, viewDirection } from '../lib/sensors.js';
import { drawSky, hitTest } from '../lib/renderer.js';

export function simNow(clock) {
  return clock.sim + (performance.now() - clock.base) * clock.speed;
}

export default function SkyView({ world, onSelect, onHud }) {
  const canvasRef = useRef(null);
  const cbRef = useRef({ onSelect, onHud });
  cbRef.current = { onSelect, onHud };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf, W = 0, H = 0, dpr = 1;
    let q = lookToQ(world.manualView.az, world.manualView.alt);
    let lastT = performance.now();
    let lastHud = 0, lastBodies = { sim: -1e15, real: 0 }, lastComets = { sim: -1e15, real: 0, src: null };
    let hits = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
      const { lat, lon } = world.location;
      const simMs = simNow(world.clock);
      const date = new Date(simMs);

      // Recalcular sistema solar y cometas con la frecuencia necesaria
      if (Math.abs(simMs - lastBodies.sim) > 20000 || t - lastBodies.real > 2000) {
        world.bodies = solarSystem(date, lat, lon);
        lastBodies = { sim: simMs, real: t };
      }
      if (world.cometElements && (lastComets.src !== world.cometElements || Math.abs(simMs - lastComets.sim) > 600000 || t - lastComets.real > 15000)) {
        world.comets = cometPositions(world.cometElements, date);
        lastComets = { sim: simMs, real: t, src: world.cometElements };
      }

      const Meqj = eqjToEnuMatrix(date, lat, lon);
      world.Meqj = Meqj;

      // Cámara: sensores filtrados o vista manual
      const tracker = world.tracker;
      const sensorLive = world.mode === 'sensor' && tracker?.active;
      const goal = sensorLive ? tracker.target : lookToQ(world.manualView.az, world.manualView.alt);
      const tau = sensorLive ? 0.07 : 0.1;
      q = qslerp(q, goal, 1 - Math.exp(-dt / tau));
      const cam = qToMat(q);

      const sun = world.bodies?.find((b) => b.id === 'Sun');
      const sunEnu = sun ? applyEnu(Meqj, sun.vec, [0, 0, 0], false) : [0, 0, -1];
      const sunAlt = enuToAltAz(...sunEnu).alt;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const res = drawSky(ctx, {
        W, H, cam, fov: world.fov, Meqj, cat: world.cat, bodies: world.bodies, comets: world.comets,
        settings: world.settings, target: world.target, sunAlt, dpr, t,
      });
      hits = res.hits;

      if (t - lastHud > 180) {
        lastHud = t;
        const v = viewDirection(cam);
        cbRef.current.onHud?.({ az: v.az, alt: v.alt, sensorLive, mode: tracker?.mode, date, sunAlt, target: res.targetInfo });
      }
    };
    raf = requestAnimationFrame(frame);

    // ---- Gestos: arrastrar (modo manual), pellizcar para zoom, tocar para seleccionar ----
    const ptrs = new Map();
    let gesture = null;
    const down = (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), fov0: world.fov };
      }
    };
    const move = (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2 && gesture) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        world.fov = Math.max(4, Math.min(120, gesture.fov0 * (gesture.pinch / Math.max(d, 1))));
      } else if (ptrs.size === 1 && world.mode === 'manual') {
        const k = world.fov / Math.min(W, H) * 1.1;
        world.manualView.az = (world.manualView.az - dx * k + 360) % 360;
        world.manualView.alt = Math.max(-89, Math.min(89, world.manualView.alt + dy * k));
      }
    };
    const up = (e) => {
      const p = ptrs.get(e.pointerId);
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) gesture = null;
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (moved < 10 && performance.now() - p.t0 < 450 && ptrs.size === 0) {
        cbRef.current.onSelect?.(hitTest(hits, e.clientX, e.clientY));
      }
    };
    const wheel = (e) => {
      e.preventDefault();
      world.fov = Math.max(4, Math.min(120, world.fov * Math.exp(e.deltaY * 0.0012)));
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [world]);

  return <canvas ref={canvasRef} className="sky-canvas" />;
}
