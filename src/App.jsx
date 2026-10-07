import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import geomagnetism from 'geomagnetism';
import SkyView, { simNow } from './components/SkyView.jsx';
import Welcome from './components/Welcome.jsx';
import { Icon } from './components/Aero.jsx';
import { InfoPanel, SearchPanel, LayersPanel, TimePanel } from './components/Panels.jsx';
import { buildCatalog, cardinal } from './lib/astro.js';
import { OrientationTracker, requestMotionPermission } from './lib/sensors.js';
import { describe, altAzOf, shortComet } from './lib/objects.js';

const DEFAULT_SETTINGS = {
  lines: true, conNames: true, starNames: true, planets: true, comets: true,
  grid: false, ecliptic: false, ground: true, belowHorizon: false, refraction: true,
  magLimit: 5.5, compassOffset: 0,
};
const FALLBACK_LOCATION = { lat: 19.4326, lon: -99.1332, acc: null, source: 'default' };

const store = {
  get(k, d) { try { const v = localStorage.getItem('celeste.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('celeste.' + k, JSON.stringify(v)); } catch {} },
};

function declinationAt(lat, lon) {
  try { return geomagnetism.model(new Date()).point([lat, lon]).decl; } catch { return 0; }
}

export default function App() {
  const [phase, setPhase] = useState('loading');
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...store.get('settings', {}) }));
  const [location, setLocation] = useState(() => store.get('location', FALLBACK_LOCATION));
  const [perms, setPerms] = useState({ geo: 'idle', motion: 'idle' });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('manual');
  const [panel, setPanel] = useState(null); // 'search' | 'layers' | 'time'
  const [info, setInfo] = useState(null);
  const [target, setTarget] = useState(null);
  const [hud, setHud] = useState(null);
  const [night, setNight] = useState(false);
  const [toast, setToast] = useState(null);
  const [cometStatus, setCometStatus] = useState('Cargando datos de JPL…');
  const [clockState, setClockState] = useState({ speed: 1 });
  const watchId = useRef(null);
  const bestAcc = useRef(Infinity);

  const world = useMemo(() => ({
    cat: null, bodies: null, comets: null, cometElements: null,
    settings, location, mode: 'manual',
    clock: { base: performance.now(), sim: Date.now(), speed: 1 },
    manualView: { az: 180, alt: 35 }, fov: 75, target: null,
    tracker: new OrientationTracker(), Meqj: null,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const declination = useMemo(() => declinationAt(location.lat, location.lon), [location.lat, location.lon]);

  // Sincronizar estado de React → mundo mutable del render
  useEffect(() => { world.settings = settings; world.tracker.userOffset = settings.compassOffset; store.set('settings', settings); }, [settings, world]);
  useEffect(() => { world.location = location; world.tracker.declination = declination; }, [location, declination, world]);
  useEffect(() => { world.mode = mode; }, [mode, world]);
  useEffect(() => { world.target = target; }, [target, world]);

  const notify = useCallback((text, kind = 'info') => {
    setToast({ text, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(t);
  }, [toast]);

  // Cargar catálogo y cometas
  useEffect(() => {
    (window.__SKY_DATA__ ? Promise.resolve(window.__SKY_DATA__) : fetch('/data/sky.json').then((r) => r.json()))
      .then((d) => { world.cat = buildCatalog(d); setPhase('welcome'); })
      .catch(() => setPhase('error'));
    fetch('/api/comets')
      .then((r) => r.json())
      .then((d) => {
        world.cometElements = (d.comets || []).map((c) => {
          const m = c.name.match(/\(([^)]+)\)/);
          return { ...c, short: m && !/^\d/.test(m[1]) ? m[1] : c.name.replace(/\s*\([^)]*\)\s*$/, '') };
        });
        setCometStatus(d.error ? 'Sin conexión con JPL por ahora' : `${d.comets.length} cometas con perihelio cercano (JPL)`);
      })
      .catch(() => setCometStatus('No se pudieron cargar los cometas'));
    world.tracker.start();
    return () => world.tracker.stop();
  }, [world]);

  // ---------- Ubicación ----------
  const startGeo = useCallback(() => new Promise((resolve) => {
    if (!('geolocation' in navigator)) { setPerms((p) => ({ ...p, geo: 'unavailable' })); resolve(false); return; }
    setPerms((p) => ({ ...p, geo: 'asking' }));
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    setTimeout(() => finish(false), 9000);
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    bestAcc.current = Infinity;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        setPerms((p) => ({ ...p, geo: 'granted' }));
        // Solo actualizar si mejora la precisión o te mueves de forma notable
        setLocation((prev) => {
          const moved = prev.source !== 'gps' || Math.hypot(latitude - prev.lat, (longitude - prev.lon) * Math.cos(latitude * Math.PI / 180)) * 111000 > Math.max(80, accuracy);
          if (accuracy < bestAcc.current || moved) {
            bestAcc.current = accuracy;
            const loc = { lat: latitude, lon: longitude, acc: accuracy, alt: altitude, source: 'gps' };
            store.set('location', loc);
            return loc;
          }
          return prev;
        });
        finish(true);
      },
      (err) => {
        setPerms((p) => ({ ...p, geo: err.code === 1 ? 'denied' : 'unavailable' }));
        finish(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }), []);
  useEffect(() => () => watchId.current != null && navigator.geolocation.clearWatch(watchId.current), []);

  const waitForSensors = () => new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (world.tracker.active) resolve(true);
      else if (performance.now() - t0 > 1800) resolve(false);
      else setTimeout(check, 150);
    };
    check();
  });

  const keepAwake = async () => { try { await navigator.wakeLock?.request('screen'); } catch {} };

  const handleStart = async () => {
    setBusy(true);
    setPerms((p) => ({ ...p, motion: 'asking' }));
    const motionPromise = requestMotionPermission(); // debe llamarse dentro del gesto (iOS)
    const geoPromise = startGeo();
    const motion = await motionPromise;
    const sensorsOk = motion === 'granted' && (await waitForSensors());
    setPerms((p) => ({ ...p, motion: motion === 'denied' ? 'denied' : sensorsOk ? 'granted' : 'unavailable' }));
    const geoOk = await geoPromise;
    setBusy(false);
    setMode(sensorsOk ? 'sensor' : 'manual');
    setPhase('sky');
    keepAwake();
    if (!sensorsOk) notify('No se detectaron sensores de orientación. Arrastra con el dedo para explorar el cielo.');
    else notify('Apunta tu teléfono al cielo. Pellizca para hacer zoom y toca un objeto para ver sus datos.');
    if (!geoOk) notify('Sin ubicación GPS: se usa una ubicación aproximada. Puedes cambiarla en Capas.', 'warn');
  };

  const handleManual = async () => {
    setMode('manual');
    setPhase('sky');
    const ok = await startGeo();
    if (!ok) notify('Sin ubicación GPS: se usa una ubicación aproximada. Puedes cambiarla en Capas.', 'warn');
  };

  // ---------- Modo de cámara ----------
  const toggleMode = async () => {
    if (mode === 'sensor') {
      if (hud) world.manualView = { az: hud.az, alt: Math.max(-89, Math.min(89, hud.alt)) };
      world.fov = Math.max(world.fov, 60);
      setMode('manual');
      notify('Modo manual: arrastra para mover la vista.');
    } else {
      const motion = await requestMotionPermission();
      const ok = motion === 'granted' && (world.tracker.active || (await waitForSensors()));
      if (ok) { world.fov = Math.min(world.fov, 75); setMode('sensor'); notify('Modo sensores: mueve tu teléfono.'); }
      else notify('Los sensores de orientación no están disponibles en este dispositivo.', 'warn');
    }
  };

  // ---------- Selección ----------
  const currentDate = () => new Date(simNow(world.clock));
  const handleSelect = useCallback((obj) => {
    if (!obj) { setInfo(null); return; }
    setPanel(null);
    setInfo(describe(obj, world, currentDate()));
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!info) return;
    const t = setInterval(() => setInfo((i) => (i ? describe(i.obj, world, currentDate()) || i : i)), 2000);
    return () => clearInterval(t);
  }, [info?.obj, world]); // eslint-disable-line react-hooks/exhaustive-deps

  const centerOn = (vec) => {
    const aa = altAzOf(world, vec);
    if (!aa) return;
    world.manualView = { az: aa.az, alt: Math.max(-89, Math.min(89, aa.alt)) };
    if (world.fov > 70) world.fov = 60;
  };

  const pointAt = (inf) => {
    if (!inf) return;
    if (target?.title === inf.title) { setTarget(null); return; }
    setTarget({ vec: inf.vec, title: inf.title });
    if (mode === 'manual') centerOn(inf.vec);
  };

  const pick = (item) => {
    const d = describe(item.obj, world, currentDate());
    setPanel(null);
    setInfo(d);
    if (d) {
      setTarget({ vec: d.vec, title: d.title });
      if (mode === 'manual') centerOn(d.vec);
    }
  };

  // ---------- Tiempo ----------
  const rebase = (sim, speed) => {
    world.clock = { base: performance.now(), sim, speed };
    setClockState({ speed });
  };
  const timeShift = (ms) => rebase(simNow(world.clock) + ms, world.clock.speed);
  const timeSpeed = (s) => rebase(simNow(world.clock), s);
  const timeNow = () => rebase(Date.now(), 1);
  const timeSet = (ms) => rebase(ms, world.clock.speed);

  const setSetting = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setManualLocation = (lat, lon) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      notify('Coordenadas no válidas.', 'warn'); return;
    }
    if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    const loc = { lat, lon, acc: null, source: 'manual' };
    store.set('location', loc);
    setLocation(loc);
    notify('Ubicación actualizada.');
  };

  const togglePanel = (p) => { setInfo(null); setPanel((cur) => (cur === p ? null : p)); };

  // ---------- Render ----------
  if (phase === 'loading' || phase === 'error') {
    return (
      <div className="welcome">
        <div className="aero-bg"><div className="aero-rays" /><div className="aero-hill aero-hill-1" /><div className="aero-hill aero-hill-2" /></div>
        <div className="loader">
          <div className="hero-orb spin">{Icon.globe}</div>
          <p>{phase === 'error' ? 'No se pudo cargar el catálogo de estrellas. Revisa tu conexión y recarga.' : 'Cargando catálogo de estrellas…'}</p>
        </div>
      </div>
    );
  }

  if (phase === 'welcome') {
    return <Welcome perms={perms} location={location.source === 'gps' ? location : null} onStart={handleStart} onManual={handleManual} busy={busy} />;
  }

  const isNow = clockState.speed === 1 && hud && Math.abs(hud.date.getTime() - Date.now()) < 5000;
  const locLabel = location.source === 'gps' ? `±${Math.round(location.acc)} m` : location.source === 'manual' ? 'Manual' : 'Aprox.';
  const ti = hud?.target;

  return (
    <div className={`app ${night ? 'night' : ''}`}>
      <SkyView world={world} onSelect={handleSelect} onHud={setHud} />
      <div className="crosshair" />

      {/* Barra superior */}
      <header className="topbar glass">
        <div className="tb-brand"><span className="mini-orb" /> Celeste Aero</div>
        <div className="tb-heading">
          <span className="tb-az">{hud ? `${Math.round(hud.az)}° ${cardinal(hud.az)}` : '—'}</span>
          <span className="tb-alt">Altura {hud ? Math.round(hud.alt) : 0}°</span>
        </div>
        <div className="tb-status">
          <span className={`led ${mode === 'sensor' ? (hud?.sensorLive ? 'ok' : 'warn') : 'off'}`} title="Sensores" />
          <span className="tb-loc">{Icon.pin} {locLabel}</span>
        </div>
      </header>
      {!isNow && hud && (
        <button className="time-chip glass" onClick={() => togglePanel('time')}>
          ⏱ {hud.date.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {clockState.speed > 1 ? ` · ${clockState.speed}×` : clockState.speed === 0 ? ' · pausa' : ''}
        </button>
      )}

      {/* Indicador hacia el objetivo */}
      {target && ti && !ti.onScreen && (
        <div className="target-arrow" style={{ '--ang': `${ti.angle}rad` }}>
          <div className="ta-orb">➤</div>
        </div>
      )}
      {target && ti && !info && !panel && (
        <div className="target-pill glass" onClick={() => setTarget(null)}>
          <span className="tp-icon">{Icon.target}</span>
          <span><b>{target.title}</b> · {Math.round(ti.altAz.alt)}° {cardinal(ti.altAz.az)}{ti.onScreen ? '' : ' · sigue la flecha'}</span>
          <span className="tp-x">✕</span>
        </div>
      )}

      {/* Ventanas */}
      {info && (
        <InfoPanel info={info} mode={mode} isTarget={target?.title === info.title}
          onClose={() => setInfo(null)} onPoint={() => pointAt(info)} onCenter={() => centerOn(info.vec)} />
      )}
      {panel === 'search' && <SearchPanel world={world} onPick={pick} onClose={() => setPanel(null)} />}
      {panel === 'layers' && (
        <LayersPanel settings={settings} setSetting={setSetting} location={location} declination={declination}
          onClose={() => setPanel(null)} onRelocate={() => startGeo().then((ok) => notify(ok ? 'Ubicación GPS activada.' : 'No se pudo obtener la ubicación GPS.', ok ? 'info' : 'warn'))}
          setManualLocation={setManualLocation} cometStatus={cometStatus} />
      )}
      {panel === 'time' && hud && (
        <TimePanel date={hud.date} speed={clockState.speed} isNow={isNow} onShift={timeShift} onSpeed={timeSpeed}
          onNow={timeNow} onSet={timeSet} onClose={() => setPanel(null)} />
      )}

      {/* Notificación tipo globo de Vista */}
      {toast && (
        <div key={toast.id} className={`balloon glass balloon-${toast.kind}`} onClick={() => setToast(null)}>
          <span className="balloon-icon">{toast.kind === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Barra de tareas */}
      <nav className="taskbar">
        <button className={`tb-btn ${panel === 'layers' ? 'on' : ''}`} onClick={() => togglePanel('layers')}>{Icon.layers}<span>Capas</span></button>
        <button className={`tb-btn ${panel === 'time' ? 'on' : ''}`} onClick={() => togglePanel('time')}>{Icon.clock}<span>Tiempo</span></button>
        <button className={`orb-btn ${panel === 'search' ? 'on' : ''}`} onClick={() => togglePanel('search')} aria-label="Buscar">
          <span className="orb-glow" />{Icon.star}
        </button>
        <button className={`tb-btn ${mode === 'sensor' ? 'on' : ''}`} onClick={toggleMode}>
          {mode === 'sensor' ? Icon.phone : Icon.hand}<span>{mode === 'sensor' ? 'Sensores' : 'Manual'}</span>
        </button>
        <button className={`tb-btn ${night ? 'on' : ''}`} onClick={() => setNight((n) => !n)}>{Icon.moon}<span>Noche</span></button>
      </nav>

      {night && <div className="night-filter" />}
    </div>
  );
}
