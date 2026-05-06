import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import bcrypt from 'bcryptjs';

const AuthContext = createContext(null);
const SESSION_KEY = 'magicdrone_user';
const ACTIVITY_KEY = 'magicdrone_last_activity';
const TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    timerRef.current = setTimeout(() => {
      setUser(null);
      clearSession();
    }, TIMEOUT_MS);
  };

  // Restaurar sessão ao inicializar
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    const lastActivity = localStorage.getItem(ACTIVITY_KEY);
    if (saved && lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed < TIMEOUT_MS) {
        try {
          setUser(JSON.parse(saved));
          startTimer();
        } catch {
          clearSession();
        }
      } else {
        clearSession();
      }
    }
  }, []);

  // Rastrear atividade para resetar timeout
  useEffect(() => {
    if (!user) return;
    const onActivity = () => startTimer();
    window.addEventListener('click', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity);
    return () => {
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    setError('');

    const { data, error: dbError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (dbError || !data) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return false;
    }

    // Tenta bcrypt primeiro, fallback para texto puro (compatibilidade)
    let match = false;
    try {
      match = await bcrypt.compare(password, data.senha);
    } catch {
      match = false;
    }
    if (!match) match = (data.senha === password);

    if (!match) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return false;
    }

    const { senha: _, ...safeUser } = data;
    setUser(safeUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    startTimer();
    setLoading(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    clearSession();
  };

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
