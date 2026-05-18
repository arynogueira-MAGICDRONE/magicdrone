import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/',          icon: '📅', label: 'Shows' },
  { to: '/orcamento', icon: '💰', label: 'Orçamento' },
  { to: '/checklist', icon: '✅', label: 'Checklist' },
  { to: '/manual',    icon: '📖', label: 'Manual' },
];

export default function SecundarioLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto', position: 'relative',
    }}>
      {/* Topbar */}
      <header style={{
        background: '#000', borderBottom: '1px solid #1a1a1a',
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" style={{ width: 36, height: 'auto' }} alt="MagicDrone" />
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: 3 }}>
            MagicDrone
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#888', letterSpacing: 1 }}>
            {user?.nome?.split(' ')[0] || 'Usuário'}
          </span>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid #f44336', color: '#f44336',
            fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 1,
            padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
          }}>Sair</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: '#000', borderTop: '1px solid #1a1a1a',
        display: 'flex', zIndex: 100, height: 64,
      }}>
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              textDecoration: 'none', padding: '8px 2px',
              color: isActive ? '#fff' : '#666',
              transition: 'color 0.15s',
            })}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Space Mono, monospace' }}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
