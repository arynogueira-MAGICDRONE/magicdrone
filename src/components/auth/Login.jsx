import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { login, error, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className={styles.container}>
      <div className={styles.bg}>
        {[...Array(20)].map((_, i) => (
          <div key={i} className={styles.bgLine} style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <svg width="80" height="56" viewBox="0 0 64 44" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.logo}>
            <polyline points="2,38 18,8 32,26 46,8 62,38" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square"/>
          </svg>
          <div className={styles.brand}>MagicDrone</div>
          <div className={styles.tagline}>Created by Ary Nogueira</div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Senha</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
