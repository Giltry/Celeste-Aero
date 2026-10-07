import { AeroWindow, AeroButton, Icon } from './Aero.jsx';

const STATUS = {
  idle: { t: 'Pendiente', c: 'idle' },
  asking: { t: 'Solicitando…', c: 'asking' },
  granted: { t: 'Permitido', c: 'ok' },
  denied: { t: 'Denegado', c: 'bad' },
  unavailable: { t: 'No disponible', c: 'bad' },
};

function Step({ n, title, text, status, extra }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <div className="step">
      <div className="step-n">{n}</div>
      <div className="step-text">
        <strong>{title}</strong>
        <span>{text}</span>
        {extra && <em>{extra}</em>}
      </div>
      <span className={`chip chip-${s.c}`}>{s.t}</span>
    </div>
  );
}

export default function Welcome({ perms, location, onStart, onManual, busy }) {
  const acc = location?.acc ? `Precisión actual: ±${Math.round(location.acc)} m` : null;
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

      <AeroWindow title="Celeste Aero — Bienvenida" icon={<span className="mini-orb" />} className="welcome-window">
        <div className="welcome-hero">
          <div className="hero-orb">{Icon.globe}</div>
          <div>
            <h1>Celeste Aero</h1>
            <p>Apunta tu celular al cielo y descubre estrellas, constelaciones, planetas y cometas en tiempo real.</p>
          </div>
        </div>

        <div className="steps">
          <Step
            n="1"
            title="Ubicación precisa"
            text="Tu latitud y longitud definen qué parte del cielo ves. Se usa el GPS en alta precisión y no sale de tu dispositivo."
            status={perms.geo}
            extra={acc}
          />
          <Step
            n="2"
            title="Sensores de movimiento"
            text="Giroscopio, acelerómetro y brújula indican hacia dónde apuntas el teléfono."
            status={perms.motion}
          />
        </div>

        <div className="welcome-actions">
          <AeroButton onClick={onStart} disabled={busy}>
            {busy ? 'Activando…' : 'Permitir y ver el cielo'}
          </AeroButton>
          <button className="link-btn" onClick={onManual}>Explorar sin sensores (arrastrar con el dedo)</button>
        </div>
        <p className="fine">
          Consejo: aléjate de objetos metálicos y, si la brújula parece desviada, mueve el teléfono en forma de “8”.
        </p>
      </AeroWindow>
    </div>
  );
}
