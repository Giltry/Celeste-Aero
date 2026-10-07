import { useMemo, useState } from 'react';
import { AeroWindow, AeroButton, Toggle, Segmented, LangSwitch, Icon } from './Aero.jsx';
import { searchItems, fold, altAzOf, GROUPS } from '../lib/objects.js';
import { cardinal } from '../lib/astro.js';
import { t, locale } from '../lib/i18n.js';

// ---------- Información del objeto ----------
export function InfoPanel({ info, onClose, onPoint, onCenter, isTarget, mode }) {
  if (!info) return null;
  return (
    <AeroWindow title={info.kindLabel || t('info.object')} icon={Icon.star} onClose={onClose} className="panel panel-info">
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
          {isTarget ? t('info.pointed') : t('info.point')}
        </AeroButton>
        {mode === 'manual' && <AeroButton variant="glass" onClick={onCenter}>{t('info.center')}</AeroButton>}
      </div>
    </AeroWindow>
  );
}

// ---------- Búsqueda ----------
export function SearchPanel({ world, onPick, onClose, lang }) {
  const [q, setQ] = useState('');
  const [onlyVisible, setOnlyVisible] = useState(false);
  const all = useMemo(() => searchItems(world), [world, world.comets, world.bodies, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const f = fold(q.trim());
    const out = {};
    for (const it of all) {
      // Se busca en ambos idiomas: "Sirius" encuentra a Sirio y viceversa
      if (f && !fold(it.label).includes(f) && !fold(it.alt).includes(f) && !fold(it.sub).includes(f)) continue;
      const aa = altAzOf(world, it.vec);
      if (onlyVisible && (!aa || aa.alt < 0)) continue;
      (out[it.group] ||= []).push({ ...it, aa });
    }
    for (const g of ['stars', 'cons']) out[g]?.sort((a, b) => a.label.localeCompare(b.label, lang));
    return out;
  }, [q, all, onlyVisible, world, lang]);

  return (
    <AeroWindow title={t('search.title')} icon={Icon.star} onClose={onClose} className="panel panel-search">
      <div className="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#7fd8ff" strokeWidth="2.2" /><path d="M15 15l5 5" stroke="#7fd8ff" strokeWidth="2.6" strokeLinecap="round" /></svg>
        <input id="search-input" autoFocus placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Toggle label={t('search.onlyVisible')} checked={onlyVisible} onChange={setOnlyVisible} />
      <div className="search-list">
        {Object.keys(groups).length === 0 && <p className="empty">{t('search.none')}</p>}
        {GROUPS.map((g) =>
          groups[g]?.length ? (
            <section key={g}>
              <h3>{t('group.' + g)}</h3>
              {groups[g].slice(0, g === 'stars' && !q ? 60 : 200).map((it) => (
                <button key={it.key} className="search-item" onClick={() => onPick(it)}>
                  <span className={`dot dot-${it.obj.kind}`} />
                  <span className="si-text"><strong>{it.label}</strong><small>{it.sub}</small></span>
                  <span className={`si-alt ${it.aa?.alt >= 0 ? 'up' : 'down'}`}>
                    {it.aa ? (it.aa.alt >= 0 ? `↑ ${Math.round(it.aa.alt)}° ${cardinal(it.aa.az)}` : t('search.hidden')) : ''}
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
export function LayersPanel({ settings, setSetting, location, declination, onClose, onRelocate, setManualLocation, cometStatus, lang, onLang }) {
  const [lat, setLat] = useState(location.lat.toFixed(4));
  const [lon, setLon] = useState(location.lon.toFixed(4));
  const locSource = location.source === 'gps'
    ? t('layers.gpsAcc', { m: Math.round(location.acc) })
    : location.source === 'manual' ? t('layers.manual') : t('layers.approx');
  return (
    <AeroWindow title={t('layers.title')} icon={Icon.layers} onClose={onClose} className="panel panel-layers">
      <h3>{t('layers.language')}</h3>
      <LangSwitch lang={lang} onChange={onLang} />

      <h3>{t('layers.show')}</h3>
      <Toggle label={t('layers.lines')} checked={settings.lines} onChange={(v) => setSetting('lines', v)} />
      <Toggle label={t('layers.conNames')} checked={settings.conNames} onChange={(v) => setSetting('conNames', v)} />
      <Toggle label={t('layers.starNames')} checked={settings.starNames} onChange={(v) => setSetting('starNames', v)} />
      <Toggle label={t('layers.planets')} checked={settings.planets} onChange={(v) => setSetting('planets', v)} />
      <Toggle label={t('layers.comets')} hint={cometStatus} checked={settings.comets} onChange={(v) => setSetting('comets', v)} />
      <Toggle label={t('layers.grid')} checked={settings.grid} onChange={(v) => setSetting('grid', v)} />
      <Toggle label={t('layers.ecliptic')} hint={t('layers.eclipticHint')} checked={settings.ecliptic} onChange={(v) => setSetting('ecliptic', v)} />
      <Toggle label={t('layers.ground')} checked={settings.ground} onChange={(v) => setSetting('ground', v)} />
      <Toggle label={t('layers.below')} checked={settings.belowHorizon} onChange={(v) => setSetting('belowHorizon', v)} />
      <Toggle label={t('layers.refraction')} hint={t('layers.refractionHint')} checked={settings.refraction} onChange={(v) => setSetting('refraction', v)} />

      <h3>{t('layers.stars')}</h3>
      <div className="slider-row">
        <span>{t('layers.bright')}</span>
        <input id="mag-limit" type="range" min="2" max="6.5" step="0.5" value={settings.magLimit} onChange={(e) => setSetting('magLimit', +e.target.value)} />
        <span>{t('layers.all')}</span>
      </div>
      <p className="hint">{t('layers.magHint', { m: settings.magLimit.toFixed(1) })}</p>

      <h3>{t('layers.compass')}</h3>
      <p className="hint">{t('layers.declination', { d: `${declination >= 0 ? '+' : ''}${declination.toFixed(1)}` })}</p>
      <div className="slider-row">
        <span>−20°</span>
        <input id="compass-offset" type="range" min="-20" max="20" step="0.5" value={settings.compassOffset} onChange={(e) => setSetting('compassOffset', +e.target.value)} />
        <span>+20°</span>
      </div>
      <p className="hint">{t('layers.offsetHint', { o: settings.compassOffset.toFixed(1) })}</p>

      <h3>{t('layers.location')}</h3>
      <p className="hint">{location.lat.toFixed(4)}°, {location.lon.toFixed(4)}° · {locSource}</p>
      <div className="coord-row">
        <label>{t('layers.lat')}<input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label>{t('layers.lon')}<input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} /></label>
      </div>
      <div className="row-actions">
        <AeroButton variant="glass" onClick={() => setManualLocation(parseFloat(lat), parseFloat(lon))}>{t('layers.useCoords')}</AeroButton>
        <AeroButton onClick={onRelocate}>{t('layers.useGps')}</AeroButton>
      </div>
      <p className="credits">{t('layers.credits')}</p>
    </AeroWindow>
  );
}

// ---------- Máquina del tiempo ----------
export function TimePanel({ date, speed, isNow, onShift, onSpeed, onNow, onSet, onClose }) {
  const speeds = [
    { value: 0, label: '❚❚' },
    { value: 1, label: '1×' },
    { value: 60, label: t('time.perSec', { u: '1 ' + t('time.min') }) },
    { value: 600, label: t('time.perSec', { u: '10 ' + t('time.min') }) },
    { value: 3600, label: t('time.perSec', { u: '1 ' + t('time.h') }) },
  ];
  const shifts = [
    [`−1 ${t('time.d')}`, -864e5], [`−1 ${t('time.h')}`, -36e5], [`−10 ${t('time.min')}`, -6e5],
    [`+10 ${t('time.min')}`, 6e5], [`+1 ${t('time.h')}`, 36e5], [`+1 ${t('time.d')}`, 864e5],
  ];
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <AeroWindow title={t('time.title')} icon={Icon.clock} onClose={onClose} className="panel panel-time">
      <div className="time-display">
        <div className="time-big">{date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div className="time-date">{date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        {!isNow && <span className="chip chip-asking">{t('time.simulated')}</span>}
      </div>
      <div className="time-grid">
        {shifts.map(([l, ms]) => (
          <AeroButton key={ms} variant="glass" onClick={() => onShift(ms)}>{l}</AeroButton>
        ))}
      </div>
      <h3>{t('time.speed')}</h3>
      <Segmented options={speeds} value={speed} onChange={onSpeed} />
      <h3>{t('time.goto')}</h3>
      <input id="goto-date" className="aero-input" type="datetime-local" value={local} onChange={(e) => e.target.value && onSet(new Date(e.target.value).getTime())} />
      <div className="row-actions">
        <AeroButton onClick={onNow}>{t('time.now')}</AeroButton>
      </div>
    </AeroWindow>
  );
}
