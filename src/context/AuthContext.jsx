import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Mock users - in production, replace with real API calls
const MOCK_USERS = [
  {
    id: 1,
    name: 'Admin Master',
    email: 'master@magicdrone.com',
    password: '123456',
    role: 'master',
    permissions: {
      inventario: true,
      agenda: true,
      checklist: true,
      equipe: true,
      orcamento: true,
      documentacao: true,
      manual: true,
    }
  },
  {
    id: 2,
    name: 'Ricardo Costa',
    email: 'ricardo@magicdrone.com',
    password: '123456',
    role: 'secondary',
    permissions: {
      inventario: true,
      agenda: true,
      checklist: true,
      equipe: false,
      orcamento: false,
      documentacao: true,
      manual: true,
    }
  },
  {
    id: 3,
    name: 'Ana Lima',
    email: 'ana@magicdrone.com',
    password: '123456',
    role: 'secondary',
    permissions: {
      inventario: false,
      agenda: false,
      checklist: true,
      equipe: false,
      orcamento: false,
      documentacao: false,
      manual: true,
    }
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    setError('');
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    const found = MOCK_USERS.find(u => u.email === email && u.password === password);
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      setLoading(false);
      return true;
    } else {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return false;
    }
  };

  const logout = () => setUser(null);

  const isMaster = () => user?.role === 'master';

  const hasPermission = (module) => {
    if (!user) return false;
    if (user.role === 'master') return true;
    return user.permissions?.[module] === true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isMaster, hasPermission, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
