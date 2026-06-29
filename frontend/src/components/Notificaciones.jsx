// =========================================
// Notificaciones.jsx — Bell icon + panel deslizante
// =========================================
import { useState, useEffect, useRef } from 'react';
import {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarNotificacionesLeidas,
} from '../services/api';

const TIPO_ICONS = {
  campana: '📸',
  ticket: '🎫',
  tarea: '📋',
  general: '🔔',
};

export default function Notificaciones({ onCountChange }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchCount = async () => {
    try {
      const data = await contarNoLeidas();
      const n = data.count ?? 0;
      setCount(n);
      onCountChange?.(n);
    } catch (_) {}
  };

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await obtenerNotificaciones();
      setNotifs(data);
    } catch (_) {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Poll cada 30s
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    if (!open) {
      await fetchNotifs();
      if (count > 0) {
        await marcarNotificacionesLeidas();
        setCount(0);
        onCountChange?.(0);
      }
    }
    setOpen(!open);
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        id="btn-notificaciones"
        title="Notificaciones"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px',
          borderRadius: '50%',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(216,180,254,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ fontSize: '22px' }}>🔔</span>
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ff4757',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '17px',
              height: '17px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 1.5s infinite',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '44px',
            right: 0,
            width: '340px',
            maxHeight: '480px',
            overflowY: 'auto',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(216,180,254,0.25)',
            borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            zIndex: 9999,
            animation: 'slideDown 0.25s ease',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(216,180,254,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#d8b4fe', fontWeight: 700, fontSize: '14px' }}>
              🔔 Notificaciones
            </span>
            <span
              style={{ fontSize: '11px', color: '#888', cursor: 'pointer' }}
              onClick={async () => {
                await marcarNotificacionesLeidas();
                await fetchNotifs();
              }}
            >
              Marcar todas leídas
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
              Cargando...
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Sin notificaciones nuevas
            </div>
          ) : (
            notifs.map((n) => (
              <div
                key={n.ID_Notificacion}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: n.Leida ? 'transparent' : 'rgba(216,180,254,0.06)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>
                    {TIPO_ICONS[n.Tipo] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: n.Leida ? 400 : 700,
                        color: '#e8e8e8',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {n.Titulo}
                    </p>
                    <p style={{ margin: '3px 0 4px', fontSize: '12px', color: '#aaa', lineHeight: '1.4' }}>
                      {n.Cuerpo}
                    </p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>{n.Fecha_Hora}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
