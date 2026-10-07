import { useMemo, useState } from 'react';
import { AeroWindow, AeroButton, Toggle, Segmented, Icon } from './Aero.jsx';
import { searchItems, fold, altAzOf } from '../lib/objects.js';
import { cardinal } from '../lib/astro.js';

// ---------- Información del objeto ----------
export function InfoPanel({ info, onClose, onPoint, onCenter, isTarget, mode }) {
  if (!info) return null;
  return (
    <AeroWindow title={info.kindLabel || 'Objeto'} icon={Icon.star} onClose={onClose} className="panel panel-info">
      <div className="info-head">
        <div className={`info-badge badge-${info.kind}`} />
        <div>
          <h2>{info.title}</h2>
          {info.subtitle && <p>{info.subtitle}</p>}
        </div>
      </div>
      <dl className="info-rows">
        {info.rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="row-actions">
        <AeroButton onClick={onPoint} variant={isTarget ? 'green' : 'aqua'}>
          {isTarget ? 'Señalado ✓' : 'Señalar en el cielo'}
        </AeroButton>
        {mode === 'manual' && <AeroButton variant="glass" onClick={onCenter}>Centrar vista</AeroButton>}
      </div>
    </AeroWindow>
  );
}

// ---------- Búsqueda ----------
export function SearchPanel({ world, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [onlyVisible, setOnlyVisible] = useState(false);
  const all = useMemo(() => searchItems(world), [world, world.comets, world.bodies]);
  const groups = useMemo(() => {
    const f = fold(q.trim());
    const out = {};
    for (const it of all) {
      if (f && !fold(it.label).includes(f) && !fold(it.sub).includes(f)) continue;
      const aa = altAzOf(world, it.vec);
      if (onlyVisible && (!aa || aa.alt < 0)) continue;
      (out[it.group] ||= []).push({ ...it, aa });
    }
    for (const g in out) if (g === 'Estrellas' || g === 'Constelaciones') out[g].sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return out;
  }, [q, all, onlyVisible, world]);

  return (
    <AeroWindow title="Buscar en el cielo" icon={Icon.star} onClose={onClose} className="panel panel-search">
      <div className="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#7fd8ff" strokeWidth="2.2" /><path d="M15 15l5 5" stroke="#7fd8ff" strokeWidth="2.6" strokeLinecap="round" /></svg>
        <input autoFocus placeholder="Marte, Sirio, Orión, cometa…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Toggle label="Solo lo que está sobre el horizonte" checked={onlyVisible} onChange={setOnlyVisible} />
      <div className="search-list">
        {Object.keys(groups).length === 0 && <p className="empty">Sin resultados.</p>}
        {['Sistema solar', 'Cometas', 'Constelaciones', 'Estrellas'].map((g) =>
          groups[g]?.length ? (
            <section key={g}>
              <h3>{g}</h3>
              {groups[g].slice(0, g === 'Estrellas' && !q ? 60 : 200).map((it) => (
                <button key={it.key} className="search-item" onClick={() => onPick(it)}>
                  <span className={`dot dot-${it.obj.kind}`} />
                  <span className="si-text"><strong>{it.label}</strong><small>{it.sub}</small></span>
                  <span className={`si-alt ${it.aa?.alt >= 0 ? 'up' : 'down'}`}>
                    {it.aa ? (it.aa.alt >= 0 ? `↑ ${Math.round(it.aa.alt)}° ${cardinal(it.aa.az)}` : 'Oculto') : ''}
                  </span>
                </button>
              ))}
            </section>
          ) : null
        )}
      </div>
    </AeroWindow>
  );
}

// ---------- Capas y ajustes ----------
export function LayersPanel({ settings, setSetting, location, declination, onClose, onRelocate, setManualLocation, cometStatus }) {
  const [lat, setLat] = useState(location.lat.toFixed(4));
  const [lon, setLon] = useState(location.lon.toFixed(4));
  return (
    <AeroWindow title="Capas y ajustes" icon={Icon.layers} onClose={onClose} className="panel panel-layers">
      <h3>Qué mostrar</h3>
      <Toggle label="Figuras de constelaciones" checked={settings.lines} onChange={(v) => setSetting('lines', v)} />
      <Toggle label="Nombres de constelaciones" checked={settings.conNames} onChange={(v) => setSetting('conNames', v)} />
      <Toggle label="Nombres de estrellas" checked={settings.starNames} onChange={(v) => setSetting('starNames', v)} />
      <Toggle label="Sol, Luna y planetas" checked={settings.planets} onChange={(v) => setSetting('planets', v)} />
      <Toggle label="Cometas" hint={cometStatus} checked={settings.comets} onChange={(v) => setSetting('comets', v)} />
      <Toggle label="Cuadrícula altura/azimut" checked={settings.grid} onChange={(v) => setSetting('grid', v)} />
      <Toggle label="Eclíptica" hint="Camino aparente del Sol y los planetas" checked={settings.ecliptic} onChange={(v) => setSetting('ecliptic', v)} />
      <Toggle label="Suelo y horizonte" checked={settings.ground} onChange={(v) => setSetting('ground', v)} />
      <Toggle label="Objetos bajo el horizonte" checked={settings.belowHorizon} onChange={(v) => setSetting('belowHorizon', v)} />
      <Toggle label="Refracción atmosférica" hint="Eleva un poco los objetos cerca del horizonte" checked={settings.refraction} onChange={(v) => setSetting('refraction', v)} />

      <h3>Estrellas visibles</h3>
      <div className="slider-row">
        <span>Brillantes</span>
        <input type="range" min="2" max="6.5" step="0.5" value={settings.magLimit} onChange={(e) => setSetting('magLimit', +e.target.value)} />
        <span>Todas</span>
      </div>
      <p className="hint">Magnitud límite: {settings.magLimit.toFixed(1)} (un cielo urbano llega a ~3.5, uno oscuro a ~6.5)</p>

      <h3>Brújula</h3>
      <p className="hint">Declinación magnética en tu ubicación: <b>{declination >= 0 ? '+' : ''}{declination.toFixed(1)}°</b> (corregida automáticamente con el modelo WMM-2025).</p>
      <div className="slider-row">
        <span>−20°</span>
        <input type="range" min="-20" max="20" step="0.5" value={settings.compassOffset} onChange={(e) => setSetting('compassOffset', +e.target.value)} />
        <span>+20°</span>
      </div>
      <p className="hint">Ajuste fino: {settings.compassOffset.toFixed(1)}°. Úsalo si las estrellas aparecen desplazadas a los lados.</p>

      <h3>Ubicación</h3>
      <p className="hint">
        {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}° · {location.source === 'gps' ? `GPS ±${Math.round(location.acc)} m` : location.source === 'manual' ? 'manual' : 'aproximada (sin permiso)'}
      </p>
      <div className="coord-row">
        <label>Lat<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label>Lon<input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} /></label>
      </div>
      <div className="row-actions">
        <AeroButton variant="glass" onClick={() => setManualLocation(parseFloat(lat), parseFloat(lon))}>Usar estas coordenadas</AeroButton>
        <AeroButton onClick={onRelocate}>Usar GPS</AeroButton>
      </div>
      <p className="credits">Datos: Hipparcos / d3-celestial (BSD), JPL Small-Body Database, astronomy-engine (MIT), WMM-2025 (NOAA).</p>
    </AeroWindow>
  );
}

// ---------- Máquina del tiempo ----------
const SPEEDS = [
  { value: 0, label: '❚❚' },
  { value: 1, label: '1×' },
  { value: 60, label: '1 min/s' },
  { value: 600, label: '10 min/s' },
  { value: 3600, label: '1 h/s' },
];

export function TimePanel({ date, speed, isNow, onShift, onSpeed, onNow, onSet, onClose }) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <AeroWindow title="Fecha y hora del cielo" icon={Icon.clock} onClose={onClose} className="panel panel-time">
      <div className="time-display">
        <div className="time-big">{date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div className="time-date">{date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        {!isNow && <span className="chip chip-asking">Tiempo simulado</span>}
      </div>
      <div className="time-grid">
        {[['−1 d', -864e5], ['−1 h', -36e5], ['−10 min', -6e5], ['+10 min', 6e5], ['+1 h', 36e5], ['+1 d', 864e5]].map(([l, ms]) => (
          <AeroButton key={l} variant="glass" onClick={() => onShift(ms)}>{l}</AeroButton>
        ))}
      </div>
      <h3>Velocidad</h3>
      <Segmented options={SPEEDS} value={speed} onChange={onSpeed} />
      <h3>Ir a una fecha</h3>
      <input className="aero-input" type="datetime-local" value={local} onChange={(e) => e.target.value && onSet(new Date(e.target.value).getTime())} />
      <div className="row-actions">
        <AeroButton onClick={onNow}>Volver a ahora</AeroButton>
      </div>
    </AeroWindow>
  );
}
