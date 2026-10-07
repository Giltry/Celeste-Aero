import { AeroWindow, AeroButton, LangSwitch, Icon } from './Aero.jsx';
import { t } from '../lib/i18n.js';

const STATUS_CLASS = { idle: 'idle', asking: 'asking', granted: 'ok', denied: 'bad', unavailable: 'bad' };

function Step({ n, title, text, status, extra }) {
  const key = STATUS_CLASS[status] ? status : 'idle';
  return (
    <div className="step">
      <div className="step-n">{n}</div>
      <div className="step-text">
        <strong>{title}</strong>
        <span>{text}</span>
        {extra && <em>{extra}</em>}
      </div>
      <span className={`chip chip-${STATUS_CLASS[key]}`}>{t('status.' + key)}</span>
    </div>
  );
}

export default function Welcome({ perms, location, onStart, onManual, busy, lang, onLang }) {
  const acc = location?.acc ? t('welcome.geo.acc', { m: Math.round(location.acc) }) : null;
  return (
    <div className="welcome">
      <div className="aero-bg">
        <div className="aero-rays" />
        <div className="aero-hill aero-hill-1" />
        <div className="aero-hill aero-hill-2" />
        <div className="aero-wave" />
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="bubble" style={{ '--i': i }} />
        ))}
      </div>

      <AeroWindow title={t('welcome.title')} icon={<span className="mini-orb" />} className="welcome-window">
        <div className="welcome-lang">
          <LangSwitch lang={lang} onChange={onLang} />
        </div>
        <div className="welcome-hero">
          <div className="hero-orb">{Icon.globe}</div>
          <div>
            <h1>Celeste Aero</h1>
            <p>{t('welcome.tagline')}</p>
          </div>
        </div>

        <div className="steps">
          <Step n="1" title={t('welcome.geo.title')} text={t('welcome.geo.text')} status={perms.geo} extra={acc} />
          <Step n="2" title={t('welcome.motion.title')} text={t('welcome.motion.text')} status={perms.motion} />
        </div>

        <div className="welcome-actions">
          <AeroButton onClick={onStart} disabled={busy}>
            {busy ? t('welcome.starting') : t('welcome.start')}
          </AeroButton>
          <button className="link-btn" onClick={onManual}>{t('welcome.manual')}</button>
        </div>
        <p className="fine">{t('welcome.tip')}</p>
      </AeroWindow>
    </div>
  );
}
