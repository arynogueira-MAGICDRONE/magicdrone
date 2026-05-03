import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Layout.module.css';

const Logo = () => (
  <svg width="28" height="20" viewBox="0 0 64 44">
    <polyline points="2,38 18,8 32,26 46,8 62,38" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square"/>
  </svg>
);

const navItems = [
  { to: '/',            icon: '⬛', label: 'Painel',    module: null },
  { to: '/shows',       icon: '📅', label: 'Shows',     module: 'agenda' },
  { to: '/inventario',  icon: '📦', label: 'Inventário',module: 'inventario' },
  { to: '/equipe',      icon: '👥', label: 'Equipe',    module: 'equipe' },
  { to: '/orcamento',   icon: '💰', label: 'Budget',    module: 'orcamento' },
  { to: '/checklist',   icon: '✅', label: 'Check',     module: 'checklist' },
];

export default function Layout({ children }) {
  const { user, logout, isMaster } = useAuth();

  const initials = (name) => name?.split(' ').slice(0, 2).map(n => n[0]).join('') || 'MD';

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.logoArea}>
          <Logo />
          <span className={styles.brand}>MagicDrone</span>
          {isMaster() && <span className={styles.masterBadge}>Master</span>}
        </div>
        <div className={styles.userArea}>
          <span className={styles.userName}>{user?.name?.split(' ')[0]}</span>
          <button className={styles.avatar} onClick={logout} title="Sair">
            {initials(user?.name)}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>

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
