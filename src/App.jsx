import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout';
import SecundarioLayout from './components/layout/SecundarioLayout';
import Dashboard from './pages/Dashboard';
import Shows from './pages/Shows';
import Inventario from './pages/Inventario';
import Equipe from './pages/Equipe';
import Orcamento from './pages/Orcamento';
import Checklist from './pages/Checklist';
import Documentacao from './pages/Documentacao';
import Manual from './pages/Manual';
import Relatorios from './pages/Relatorios';
import CRM from './pages/CRM';
import ProximosShows from './pages/secundario/ProximosShows';
import OrcamentoSecundario from './pages/secundario/OrcamentoSecundario';
import ChecklistSecundario from './pages/secundario/ChecklistSecundario';

// Aviso para secundário acessando via desktop
function DesktopWarning() {
  const { user, logout } = useAuth();
  return (
    <div style={{
      minHeight: '100vh', background: '#000', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <img src="/logo.png" style={{ width: 80, marginBottom: 24 }} alt="MagicDrone" />
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: 3, marginBottom: 8 }}>
        MagicDrone
      </div>
      <div style={{ fontSize: 14, color: '#888', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32, maxWidth: 320 }}>
        Este sistema deve ser acessado pelo celular
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>
        Olá, {user?.nome?.split(' ')[0] || 'usuário'}.<br />
        Use seu smartphone para acessar o sistema.
      </div>
      <button onClick={logout} style={{
        padding: '12px 24px', background: 'transparent', border: '1px solid #f44336',
        color: '#f44336', fontFamily: 'Space Mono, monospace', fontSize: 13,
        letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
      }}>
        Sair
      </button>
    </div>
  );
}

function AppRoutes() {
  const { user, isSecondary } = useAuth();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Não autenticado
  if (!user) return (
    <Routes>
      <Route path="*" element={<Login />} />
    </Routes>
  );

  // Secundário em desktop — aviso
  if (isSecondary() && isDesktop) {
    return <DesktopWarning />;
  }

  // Secundário em mobile — layout especial
  if (isSecondary()) {
    return (
      <AppProvider>
        <SecundarioLayout>
          <Routes>
            <Route path="/"          element={<ProximosShows />} />
            <Route path="/orcamento" element={<OrcamentoSecundario />} />
            <Route path="/checklist" element={<ChecklistSecundario />} />
            <Route path="/manual"    element={<Manual />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </SecundarioLayout>
      </AppProvider>
    );
  }

  // Perfil master / administrativo — layout normal
  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/shows"        element={<Shows />} />
          <Route path="/inventario"   element={<Inventario />} />
          <Route path="/equipe"       element={<Equipe />} />
          <Route path="/orcamento"    element={<Orcamento />} />
          <Route path="/checklist"    element={<Checklist />} />
          <Route path="/documentacao" element={<Documentacao />} />
          <Route path="/manual"       element={<Manual />} />
          <Route path="/relatorios"   element={<Relatorios />} />
          <Route path="/crm"          element={<CRM />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
