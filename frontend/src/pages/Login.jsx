import { useState } from 'react';
import { login, saveSession } from '../services/api';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!usuario.trim() || !contrasena.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await login(usuario, contrasena);
      saveSession(data.token, data.nombre, data.rol);
      onLogin({ nombre: data.nombre, rol: data.rol });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          className="login-avatar"
          src="/avatar_luxo.png"
          alt="LUXO"
          onError={(e) => { e.target.style.display = 'none'; }}
        />

        <h1 className="login-title">SISTEMA LUXO</h1>
        <p className="login-subtitle">Asistente Inteligente — Sunglass Hut</p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              className="input-field"
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena"
              className="input-field"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'INGRESAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
