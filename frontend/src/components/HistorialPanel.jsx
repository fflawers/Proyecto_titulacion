import { useState, useEffect } from 'react';
import { obtenerHistorialPropio } from '../services/api';
import { t } from '../services/i18n';

export default function HistorialPanel({ onClose }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    cargarHistorial();
  }, []);

  async function cargarHistorial() {
    setLoading(true);
    try {
      const data = await obtenerHistorialPropio(50);
      setHistorial(data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getFeedbackIcon(feedback) {
    if (feedback === true) return '👍';
    if (feedback === false) return '👎';
    return '';
  }

  return (
    <>
      {/* Overlay oscuro */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          maxWidth: '100vw',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          animation: 'slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header del panel */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📋</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('history_title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {historial.length} {historial.length === 1 ? 'consulta' : 'consultas'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.target.style.background = 'var(--bg-secondary)'; e.target.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
              {t('history_loading')}
            </div>
          ) : historial.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>💬</div>
              {t('history_empty')}
            </div>
          ) : (
            historial.map((item) => (
              <div
                key={item.ID_Conversacion}
                style={{
                  background: expandedId === item.ID_Conversacion
                    ? 'var(--bg-tertiary)'
                    : 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
                onClick={() => setExpandedId(
                  expandedId === item.ID_Conversacion ? null : item.ID_Conversacion
                )}
              >
                {/* Fila principal */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                      flex: 1,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: expandedId === item.ID_Conversacion ? 'unset' : 2,
                      WebkitBoxOrient: 'vertical',
                      textOverflow: 'ellipsis',
                    }}>
                      💬 {item.Pregunta_Usuario}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      marginLeft: '8px',
                      paddingTop: '2px',
                    }}>
                      {formatFecha(item.Fecha_Hora)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {item.nombre_manual && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: 'rgba(139,92,246,0.12)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(139,92,246,0.2)',
                      }}>
                        📄 {item.nombre_manual}
                      </span>
                    )}
                    {item.feedback !== null && item.feedback !== undefined && (
                      <span style={{ fontSize: '14px' }}>{getFeedbackIcon(item.feedback)}</span>
                    )}
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}>
                      {expandedId === item.ID_Conversacion ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Respuesta expandida */}
                {expandedId === item.ID_Conversacion && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: '12px 14px',
                    background: 'rgba(139,92,246,0.04)',
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('history_answer_label')}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.Respuesta_IA}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
