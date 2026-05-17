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
          <img src="/logo.png" style={{ width: '120px', height: 'auto' }} alt="MagicDrone" />
          <div className={styles.brand}>MagicDrone</div>
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

      <div style={{
        position: 'fixed', bottom: 16, left: 0, right: 0,
        textAlign: 'center', fontSize: 14, letterSpacing: 3,
        color: '#333', textTransform: 'uppercase', pointerEvents: 'none',
      }}>
        Created by Ary Nogueira
      </div>
    </div>
  );
}
