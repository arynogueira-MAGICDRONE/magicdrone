import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Shows from './pages/Shows';
import Inventario from './pages/Inventario';
import Equipe from './pages/Equipe';
import Orcamento from './pages/Orcamento';
import Checklist from './pages/Checklist';
import Documentacao from './pages/Documentacao';
import Manual from './pages/Manual';
import Relatorios from './pages/Relatorios';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return (
    <Routes>
      <Route path="*" element={<Login />} />
    </Routes>
  );
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
