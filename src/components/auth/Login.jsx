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
          <svg className={styles.logo} viewBox="0 0 64 44">
            <polyline
              points="2,38 18,8 32,26 46,8 62,38"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </svg>
          <div className={styles.brand}>MagicDrone</div>
          <div className={styles.tagline}>Drone Show Management</div>
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

        <div className={styles.hint}>
          <div>master@magicdrone.com / 123456</div>
          <div>ricardo@magicdrone.com / 123456</div>
        </div>
      </div>
    </div>
  );
}
