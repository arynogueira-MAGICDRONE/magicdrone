import React from 'react';

// ─── Button ─────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', full }) {
  const base = {
    fontFamily: 'Space Mono, monospace',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid',
    transition: 'all 0.15s',
    width: full ? '100%' : undefined,
    minWidth: 80,
  };
  const sizes = {
    sm: { fontSize: '11px', padding: '6px 12px' },
    md: { fontSize: '12px', padding: '8px 16px' },
    lg: { fontSize: '13px', padding: '12px 22px' },
  };
  const variants = {
    primary:  { background: '#fff',        color: '#000', borderColor: '#fff' },
    outline:  { background: 'transparent', color: '#fff', borderColor: '#fff' },
    ghost:    { background: 'transparent', color: '#bbb', borderColor: '#555' },
    danger:   { background: 'transparent', color: '#f44336', borderColor: '#f44336' },
    success:  { background: 'transparent', color: '#4caf50', borderColor: '#4caf50' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

// ─── Input ──────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type = 'text', maxLength, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      {label && <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        maxLength={maxLength} required={required}
        style={{
          background: '#000', border: '1px solid #333', color: '#fff',
          padding: '9px 12px', fontFamily: 'Space Mono, monospace', fontSize: 14,
          outline: 'none', width: '100%',
        }}
        onFocus={e => e.target.style.borderColor = '#fff'}
        onBlur={e => e.target.style.borderColor = '#333'}
      />
    </div>
  );
}

// ─── Select ─────────────────────────────────────────
export function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      {label && <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{
          background: '#000', border: '1px solid #333', color: '#fff',
          padding: '9px 12px', fontFamily: 'Space Mono, monospace', fontSize: 14, outline: 'none', width: '100%',
        }}>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o} style={{ background: '#111' }}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      zIndex: 200, overflowY: 'auto', padding: '16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#111', border: '1px solid #333', padding: 20,
        width: '100%', maxWidth: 420, marginTop: 60, animation: 'slideUp 0.25s ease',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#bbb' }}>{title}</div>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
              fontSize: 20, lineHeight: 1, padding: '0 2px', fontFamily: 'monospace',
            }}>✕</button>
          )}
        </div>
        {children}
        <style>{`@keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>
      </div>
    </div>
  );
}

// ─── ModalBtns ──────────────────────────────────────
export function ModalBtns({ onCancel, onSave, saveLabel = 'Salvar', disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <Btn variant="ghost" full onClick={onCancel}>Cancelar</Btn>
      <Btn variant="primary" full onClick={onSave} disabled={disabled}>{saveLabel}</Btn>
    </div>
  );
}

// ─── PageHeader ─────────────────────────────────────
export function PageHeader({ label, title, action }) {
  return (
    <div style={{
      padding: '16px 16px 12px', borderBottom: '1px solid #111',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#bbb', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// ─── Section ────────────────────────────────────────
export function Section({ title, children, action }) {
  return (
    <div style={{ padding: '14px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #111' }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: '#bbb', textTransform: 'uppercase' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── StatusPill ─────────────────────────────────────
export function StatusPill({ status }) {
  const map = {
    ok:        { label: 'Bom',         color: '#4caf50' },
    bad:       { label: 'Ruim',        color: '#f44336' },
    manut:     { label: 'Manutenção',  color: '#ff9800' },
    conf:      { label: 'Confirmado',  color: '#4caf50' },
    neg:       { label: 'Negociando',  color: '#ff9800' },
    exec:      { label: 'Executado',   color: '#aaa' },
    cancelado: { label: 'Cancelado',   color: '#f44336' },
  };
  const s = map[status] || { label: status, color: '#888' };
  return (
    <span style={{
      fontSize: 11, letterSpacing: 1, padding: '3px 9px',
      border: `1px solid ${s.color}`, color: s.color, textTransform: 'uppercase',
    }}>{s.label}</span>
  );
}

// ─── Toggle ─────────────────────────────────────────
export function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 32, height: 18, borderRadius: 9, background: on ? '#4caf50' : '#222',
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', width: 14, height: 14, background: '#fff',
        borderRadius: '50%', top: 2, left: on ? 16 : 2, transition: 'left 0.2s',
      }} />
    </div>
  );
}

// ─── Empty ──────────────────────────────────────────
export function Empty({ text = 'Nenhum item' }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: '#888', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
      {text}
    </div>
  );
}

// ─── Avatar ─────────────────────────────────────────
export function Avatar({ name, size = 36 }) {
  const initials = name?.split(' ').slice(0, 2).map(n => n[0]).join('') || '??';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#1a1a1a', border: '1px solid #333',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{initials}</div>
  );
}
