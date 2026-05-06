import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    setError('');
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('senha', password)
      .single();

    if (error || !data) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return false;
    }

    const { senha: _, ...safeUser } = data;
    setUser(safeUser);
    setLoading(false);
    return true;
  };

  const logout = () => setUser(null);
  const isMaster = () => user?.perfil === 'master';
  const isAdmin = () => user?.perfil === 'administrativo';
  const hasPermission = (module) => {
    if (!user) return false;
    if (user.perfil === 'master') return true;
    if (user.perfil === 'administrativo') return true;
    return user.permissoes?.[module] === true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isMaster, isAdmin, hasPermission, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}