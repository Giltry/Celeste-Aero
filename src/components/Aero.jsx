// Componentes base con estética Frutiger Aero (vidrio, brillo, burbujas).
import { useEffect } from 'react';

export function AeroWindow({ title, icon, onClose, children, className = '', footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className={`aero-window ${className}`} role="dialog" aria-label={title}>
      <div className="aero-titlebar">
        <span className="aero-title">
          {icon && <span className="aero-title-icon">{icon}</span>}
          {title}
        </span>
        {onClose && (
          <button className="aero-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 2l8 8M10 2l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      <div className="aero-body">{children}</div>
      {footer && <div className="aero-footer">{footer}</div>}
    </div>
  );
}

export function AeroButton({ children, variant = 'aqua', className = '', ...p }) {
  return (
    <button className={`aero-btn aero-btn-${variant} ${className}`} {...p}>
      <span className="aero-btn-shine" />
      <span className="aero-btn-label">{children}</span>
    </button>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="aero-toggle">
      <span className="aero-toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="aero-toggle-track"><span className="aero-toggle-orb" /></span>
    </label>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="aero-seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Iconos con brillo ----------
const Grad = ({ id, a, b }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  </defs>
);

export const Icon = {
  layers: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <Grad id="gl1" a="#bff3ff" b="#2aa7e8" />
      <path d="M12 3l9 5-9 5-9-5z" fill="url(#gl1)" stroke="#0b5f9a" strokeWidth=".8" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" fill="none" stroke="#9fe6ff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <Grad id="gc1" a="#e9fbff" b="#5cc4f2" />
      <circle cx="12" cy="12" r="9" fill="url(#gc1)" stroke="#0b5f9a" strokeWidth=".8" />
      <path d="M12 7v5l3.5 2" stroke="#0b4f80" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="12" cy="7.5" rx="6" ry="3" fill="#fff" opacity=".45" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" width="26" height="26">
      <Grad id="gs1" a="#fffbe0" b="#ffc928" />
      <path d="M12 2.5l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4-4.9-4.4 6.5-.7z" fill="url(#gs1)" stroke="#a86c00" strokeWidth=".7" />
    </svg>
  ),
  hand: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <Grad id="gh1" a="#d9fff0" b="#3fd0a0" />
      <circle cx="12" cy="12" r="9" fill="url(#gh1)" stroke="#0e7a5a" strokeWidth=".8" />
      <path d="M12 6v12M6 12h12M12 6l-2 2M12 6l2 2M12 18l-2-2M12 18l2-2M6 12l2-2M6 12l2 2M18 12l-2-2M18 12l-2 2" stroke="#0a5a43" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <Grad id="gp1" a="#d6f6ff" b="#3aa9e6" />
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="url(#gp1)" stroke="#0b5f9a" strokeWidth=".8" />
      <rect x="8.6" y="5" width="6.8" height="12.5" rx="1" fill="#0b2a4a" />
      <path d="M3 8a10 10 0 000 8M21 8a10 10 0 010 8" stroke="#7fe0ff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <Grad id="gm1" a="#ffd6d6" b="#e5484d" />
      <path d="M15.5 3.5a8.5 8.5 0 108 11.2A7 7 0 0115.5 3.5z" fill="url(#gm1)" stroke="#8e1f22" strokeWidth=".8" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <Grad id="gpin" a="#c9ffd9" b="#21b35a" />
      <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7z" fill="url(#gpin)" stroke="#0d6b33" strokeWidth=".8" />
      <circle cx="12" cy="9" r="2.6" fill="#fff" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <defs>
        <radialGradient id="orbG" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#e8fdff" />
          <stop offset=".45" stopColor="#3fb8f0" />
          <stop offset="1" stopColor="#0a3d7a" />
        </radialGradient>
        <linearGradient id="orbS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#orbG)" stroke="#06305f" strokeWidth="1.2" />
      <path d="M14 38c8-4 14 6 22 2s10-10 16-6" stroke="#8ff7c8" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M32 14l2 6 6 .6-4.6 4 1.4 6-4.8-3-4.8 3 1.4-6-4.6-4 6-.6z" fill="#fff8d0" />
      <circle cx="46" cy="22" r="1.6" fill="#fff" /><circle cx="20" cy="24" r="1.1" fill="#fff" /><circle cx="44" cy="44" r="1.2" fill="#fff" />
      <ellipse cx="32" cy="17" rx="20" ry="11" fill="url(#orbS)" />
    </svg>
  ),
};
