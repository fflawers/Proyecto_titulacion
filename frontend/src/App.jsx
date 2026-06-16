import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Chat from './pages/Chat';
import { getSession } from './services/api';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);

  // Restaurar sesión al cargar (incluye tienda)
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser({
        nombre: session.nombre,
        rol: session.rol,
        tienda: localStorage.getItem('luxo_tienda') || '',
      });
    }
  }, []);

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleLogout() {
    setUser(null);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Chat user={user} onLogout={handleLogout} />;
}
