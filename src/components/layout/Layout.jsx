import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import styles from './Layout.module.css';

const navItems = [
  { to: '/',            icon: '⬛', label: 'Painel',    module: null },
  { to: '/shows',       icon: '📅', label: 'Shows',     module: 'agenda' },
  { to: '/inventario',  icon: '📦', label: 'Inventário',module: 'inventario' },
  { to: '/equipe',      icon: '👥', label: 'Equipe',    module: 'equipe' },
  { to: '/orcamento',   icon: '💰', label: 'Budget',    module: 'orcamento' },
  { to: '/checklist',   icon: '✅', label: 'Check',     module: 'checklist' },
];

const MODAL_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
  zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: 16, overflowY: 'auto',
};
const PANEL_STYLE = {
  background: '#111', border: '1px solid #333', padding: 16,
  width: '100%', maxWidth: 360, marginTop: 60,
};
const FIELD_STYLE = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '8px 10px', fontFamily: 'Space Mono, monospace', fontSize: 12,
  outline: 'none', width: '100%', marginTop: 4, marginBottom: 10, boxSizing: 'border-box',
};
const LABEL_STYLE = { fontSize: 9, letterSpacing: 3, color: '#666', textTransform: 'uppercase' };
const BTN = (variant = 'ghost') => ({
  flex: 1, fontFamily: 'Space Mono, monospace', letterSpacing: 2, textTransform: 'uppercase',
  fontSize: 9, padding: '8px 0', cursor: 'pointer', border: '1px solid',
  background: 'transparent',
  ...(variant === 'primary' ? { color: '#fff',     borderColor: '#fff' } :
      variant === 'danger'  ? { color: '#f44336', borderColor: '#f44336' } :
                              { color: '#888',     borderColor: '#333' }),
});

export default function Layout({ children }) {
  const { user, logout, isMaster } = useAuth();
  const [modal, setModal] = useState(null); // null | 'menu' | 'password'
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState(null); // { ok, msg }
  const [pwLoading, setPwLoading] = useState(false);

  const initials = (name) => name?.split(' ').slice(0, 2).map(n => n[0]).join('') || 'MD';

  const openPassword = () => {
    setPwForm({ current: '', next: '', confirm: '' });
    setPwStatus(null);
    setModal('password');
  };

  const handleChangePassword = async () => {
    if (!pwForm.next.trim()) { setPwStatus({ ok: false, msg: 'Informe a nova senha.' }); return; }
    if (pwForm.next !== pwForm.confirm) { setPwStatus({ ok: false, msg: 'Nova senha e confirmação não coincidem.' }); return; }
    setPwLoading(true);
    setPwStatus(null);
    const { data } = await supabase.from('usuarios').select('id').eq('email', user.email).eq('senha', pwForm.current).single();
    if (!data) { setPwStatus({ ok: false, msg: 'Senha atual incorreta.' }); setPwLoading(false); return; }
    await supabase.from('usuarios').update({ senha: pwForm.next }).eq('id', user.id);
    setPwLoading(false);
    setPwStatus({ ok: true, msg: 'Senha alterada com sucesso!' });
    setPwForm({ current: '', next: '', confirm: '' });
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.logoArea}>
          <svg width="32" height="22" viewBox="0 0 64 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="2,38 18,8 32,26 46,8 62,38" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square"/>
          </svg>
          <span className={styles.brand}>MagicDrone</span>
          {isMaster() && <span className={styles.masterBadge}>Master</span>}
        </div>
        <div className={styles.userArea}>
          <span className={styles.userName}>{user?.name?.split(' ')[0]}</span>
          <button className={styles.avatar} onClick={() => setModal('menu')} title="Minha Conta">
            {initials(user?.name)}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>

      {modal === 'menu' && (
        <div style={MODAL_STYLE} onClick={() => setModal(null)}>
          <div style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>Minha Conta</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{user?.nome || user?.name}</div>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 16, marginTop: -12 }}>{user?.email}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ ...BTN('ghost'), textAlign: 'left', padding: '10px 12px' }} onClick={openPassword}>
                Alterar Senha
              </button>
              <button style={{ ...BTN('danger'), textAlign: 'left', padding: '10px 12px' }} onClick={logout}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'password' && (
        <div style={MODAL_STYLE} onClick={() => setModal(null)}>
          <div style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>Alterar Senha</div>
            <label style={LABEL_STYLE}>Senha Atual</label>
            <input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
              style={FIELD_STYLE} onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#333'} />
            <label style={LABEL_STYLE}>Nova Senha</label>
            <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
              style={FIELD_STYLE} onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#333'} />
            <label style={LABEL_STYLE}>Confirmar Nova Senha</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              style={FIELD_STYLE} onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#333'} />
            {pwStatus && (
              <div style={{ fontSize: 11, marginBottom: 10, color: pwStatus.ok ? '#4caf50' : '#f44336' }}>
                {pwStatus.msg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={BTN('ghost')} onClick={() => setModal('menu')}>Voltar</button>
              <button style={BTN('primary')} onClick={handleChangePassword} disabled={pwLoading}>
                {pwLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={styles.bottomNav}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
