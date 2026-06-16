import { useState } from 'react';
import { login, saveSession } from '../services/api';
import { t, getLang, setLang } from '../services/i18n';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLangState] = useState(getLang());

  function toggleLang() {
    const newLang = lang === 'es' ? 'en' : 'es';
    setLang(newLang);
    setLangState(newLang);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!usuario.trim() || !contrasena.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await login(usuario, contrasena);
      // Guardar tienda junto con los datos de sesión
      saveSession(data.token, data.nombre, data.rol);
      localStorage.setItem('luxo_tienda', data.tienda || '');
      onLogin({ nombre: data.nombre, rol: data.rol, tienda: data.tienda || '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Toggle de idioma (top-right) */}
      <button
        id="btn-login-lang"
        onClick={toggleLang}
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px',
          padding: '6px 14px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.target.style.background = 'rgba(139,92,246,0.18)'; e.target.style.color = 'var(--accent-tertiary)'; }}
        onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = 'var(--text-secondary)'; }}
        title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      >
        🌐 {lang === 'es' ? 'EN' : 'ES'}
      </button>

      <div className="login-card">
        <img
          className="login-avatar"
          src="/avatar_luxo.png"
          alt="LUXO"
          onError={(e) => { e.target.style.display = 'none'; }}
        />

        <h1 className="login-title">SISTEMA LUXO</h1>
        <p className="login-subtitle">{t('login_subtitle')}</p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="usuario">{t('login_user')}</label>
            <input
              id="usuario"
              className="input-field"
              type="text"
              placeholder={t('login_user_placeholder')}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="contrasena">{t('login_password')}</label>
            <input
              id="contrasena"
              className="input-field"
              type="password"
              placeholder={t('login_password_placeholder')}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? t('login_loading') : t('login_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}
