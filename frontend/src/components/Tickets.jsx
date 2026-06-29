// =========================================
// Tickets.jsx — Tickets de Soporte (con Prioridad)
// =========================================
import { useState, useEffect } from 'react';
import {
  crearTicket,
  obtenerMisTickets,
  obtenerTicketsAdmin,
  resolverTicket,
  cambiarPrioridadTicket,
} from '../services/api';

const ESTATUS_STYLE = {
  Abierto:  { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
  Resuelto: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
};

const PRIORIDAD_CONFIG = {
  Urgente: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', emoji: '🔴' },
  Alta:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', emoji: '🟡' },
  Normal:  { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', emoji: '⚪' },
};

export default function Tickets({ rol }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [resolviendo, setResolviendo] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [cambiandoPrioridad, setCambiandoPrioridad] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = rol === 'Admin' ? await obtenerTicketsAdmin() : await obtenerMisTickets();
      setTickets(data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, [rol]);

  const handleCrear = async () => {
    if (!detalle.trim()) return;
    setEnviando(true);
    try {
      await crearTicket(detalle.trim());
      setMsg({ tipo: 'ok', texto: 'Ticket creado. El equipo de soporte revisará tu caso.' });
      setDetalle('');
      await fetchTickets();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const handleResolver = async (id) => {
    if (!respuesta.trim()) return;
    try {
      await resolverTicket(id, respuesta.trim());
      setResolviendo(null);
      setRespuesta('');
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePrioridad = async (id, prioridad) => {
    setCambiandoPrioridad(id);
    try {
      await cambiarPrioridadTicket(id, prioridad);
      setTickets(prev => prev.map(t =>
        t.ID_Ticket === id ? { ...t, Prioridad: prioridad } : t
      ));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCambiandoPrioridad(null);
    }
  };

  const esAutoTicket = (detalle) => detalle?.startsWith('[AUTO]');

  return (
    <div className="tickets-container">
      <div className="tickets-header">
        <h2 className="tickets-title">🎫 Tickets de Soporte</h2>
        <p className="tickets-subtitle">
          {rol === 'Admin'
            ? 'Gestiona y resuelve los reportes de los gerentes de tienda'
            : 'Reporta un problema o situación que LUXO no pudo resolver'}
        </p>
      </div>

      {/* Crear ticket (usuario) */}
      {rol !== 'Admin' && (
        <div className="ticket-create-panel">
          <h3 className="ticket-section-title">📝 Nuevo Reporte</h3>
          <textarea
            className="ticket-textarea"
            rows={4}
            placeholder="Describe el problema o la pregunta que no pudo responder el sistema..."
            value={detalle}
            onChange={e => setDetalle(e.target.value)}
          />
          {msg && (
            <div className={`ticket-msg ${msg.tipo}`}>{msg.texto}</div>
          )}
          <button
            className="ticket-btn-send"
            onClick={handleCrear}
            disabled={enviando || !detalle.trim()}
          >
            {enviando ? 'Enviando...' : '📤 Enviar Ticket'}
          </button>
        </div>
      )}

      {/* Lista de tickets */}
      <div className="ticket-list-header">
        <h3 className="ticket-section-title">
          {rol === 'Admin' ? 'Todos los tickets' : 'Mis tickets'}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {rol === 'Admin' && (
            <span style={{ fontSize: '11px', color: '#888' }}>
              🔴 Urgentes primero
            </span>
          )}
          <span className="ticket-count">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando...</div>
      ) : tickets.length === 0 ? (
        <div className="ticket-empty">
          <span style={{ fontSize: '40px' }}>🎫</span>
          <p>No hay tickets de soporte</p>
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map(t => {
            const st = ESTATUS_STYLE[t.Estatus] || ESTATUS_STYLE.Abierto;
            const pr = PRIORIDAD_CONFIG[t.Prioridad || 'Normal'] || PRIORIDAD_CONFIG.Normal;
            const esAuto = esAutoTicket(t.Detalle_Problema);
            return (
              <div
                key={t.ID_Ticket}
                className="ticket-card"
                style={{
                  borderLeft: t.Prioridad === 'Urgente'
                    ? '3px solid #ef4444'
                    : t.Prioridad === 'Alta'
                      ? '3px solid #f59e0b'
                      : undefined,
                }}
              >
                <div className="ticket-card-header">
                  <div className="ticket-card-meta">
                    {/* Estatus */}
                    <span style={{
                      background: st.bg,
                      color: st.color,
                      border: `1px solid ${st.border}`,
                      borderRadius: '20px',
                      padding: '3px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {t.Estatus}
                    </span>

                    {/* Prioridad badge */}
                    <span style={{
                      background: pr.bg,
                      color: pr.color,
                      border: `1px solid ${pr.border}`,
                      borderRadius: '20px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {pr.emoji} {t.Prioridad || 'Normal'}
                    </span>

                    {/* Auto-ticket badge */}
                    {esAuto && (
                      <span style={{
                        background: 'rgba(139,92,246,0.12)',
                        color: '#a78bfa',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: '20px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        🤖 Auto-IA
                      </span>
                    )}

                    {rol === 'Admin' && (
                      <span className="ticket-usuario">
                        👤 {t.Nombre_Completo} — {t.Tienda || 'Sin tienda'}
                      </span>
                    )}
                  </div>
                  <span className="ticket-fecha">{t.Fecha_Creacion}</span>
                </div>

                <p className="ticket-detalle">
                  {esAuto
                    ? t.Detalle_Problema.replace('[AUTO]', '').trim()
                    : t.Detalle_Problema}
                </p>

                {t.Respuesta_Soporte && (
                  <div className="ticket-respuesta">
                    <p className="ticket-respuesta-label">✅ Respuesta del soporte:</p>
                    <p className="ticket-respuesta-texto">{t.Respuesta_Soporte}</p>
                    {t.Fecha_Resolucion && (
                      <p className="ticket-fecha-res">Resuelto: {t.Fecha_Resolucion}</p>
                    )}
                  </div>
                )}

                {/* Controles del admin (tickets abiertos) */}
                {rol === 'Admin' && t.Estatus === 'Abierto' && (
                  <div className="ticket-admin-controls">
                    {/* Cambiar prioridad */}
                    <div className="ticket-priority-btns">
                      <span style={{ fontSize: '11px', color: '#666', marginRight: '6px' }}>Prioridad:</span>
                      {['Normal', 'Alta', 'Urgente'].map(p => (
                        <button
                          key={p}
                          onClick={() => handlePrioridad(t.ID_Ticket, p)}
                          disabled={cambiandoPrioridad === t.ID_Ticket || t.Prioridad === p}
                          style={{
                            background: t.Prioridad === p ? PRIORIDAD_CONFIG[p].bg : 'transparent',
                            color: t.Prioridad === p ? PRIORIDAD_CONFIG[p].color : '#888',
                            border: `1px solid ${t.Prioridad === p ? PRIORIDAD_CONFIG[p].border : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '6px',
                            padding: '3px 10px',
                            fontSize: '11px',
                            fontWeight: t.Prioridad === p ? 700 : 400,
                            cursor: t.Prioridad === p ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {PRIORIDAD_CONFIG[p].emoji} {p}
                        </button>
                      ))}
                    </div>

                    {/* Resolver */}
                    <div className="ticket-resolve-area">
                      {resolviendo === t.ID_Ticket ? (
                        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                          <textarea
                            className="ticket-textarea"
                            rows={3}
                            placeholder="Escribe la solución o respuesta al problema..."
                            value={respuesta}
                            onChange={e => setRespuesta(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="ticket-btn-resolver"
                              onClick={() => handleResolver(t.ID_Ticket)}
                            >
                              ✅ Marcar como Resuelto
                            </button>
                            <button
                              className="ticket-btn-cancel"
                              onClick={() => setResolviendo(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="ticket-btn-open-resolve"
                          onClick={() => { setResolviendo(t.ID_Ticket); setRespuesta(''); }}
                        >
                          Resolver Ticket
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .tickets-container { padding: 0 4px; max-width: 720px; margin: 0 auto; }
        .tickets-header { margin-bottom: 24px; }
        .tickets-title { font-size: 22px; font-weight: 800; color: #d8b4fe; margin: 0 0 6px; }
        .tickets-subtitle { font-size: 13px; color: #888; margin: 0; }

        .ticket-create-panel { background: rgba(216,180,254,0.04); border: 1px solid rgba(216,180,254,0.15); border-radius: 14px; padding: 20px; margin-bottom: 28px; }
        .ticket-section-title { font-size: 15px; font-weight: 700; color: #d8b4fe; margin: 0 0 14px; }
        .ticket-textarea { width: 100%; box-sizing: border-box; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #e0e0e0; padding: 12px; font-size: 13px; resize: vertical; outline: none; font-family: inherit; }
        .ticket-textarea:focus { border-color: #d8b4fe; }
        .ticket-msg { margin: 10px 0; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
        .ticket-msg.ok { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .ticket-msg.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .ticket-btn-send { background: linear-gradient(135deg, #9333ea, #7e22ce); color: white; border: none; border-radius: 10px; padding: 10px 24px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 12px; transition: opacity 0.2s; }
        .ticket-btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .ticket-btn-send:hover:not(:disabled) { opacity: 0.85; }

        .ticket-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .ticket-count { font-size: 12px; background: rgba(216,180,254,0.1); color: #d8b4fe; border-radius: 20px; padding: 3px 12px; }

        .ticket-empty { text-align: center; padding: 60px; color: #666; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .ticket-list { display: flex; flex-direction: column; gap: 14px; }
        .ticket-card { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; transition: border-color 0.2s; }
        .ticket-card:hover { border-color: rgba(216,180,254,0.25); }
        .ticket-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
        .ticket-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ticket-usuario { font-size: 12px; color: #aaa; }
        .ticket-fecha { font-size: 11px; color: #666; white-space: nowrap; }
        .ticket-detalle { font-size: 14px; color: #ddd; line-height: 1.6; margin: 0 0 12px; }
        .ticket-respuesta { background: rgba(52,211,153,0.06); border: 1px solid rgba(52,211,153,0.2); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
        .ticket-respuesta-label { font-size: 12px; color: #34d399; font-weight: 700; margin: 0 0 6px; }
        .ticket-respuesta-texto { font-size: 13px; color: #ccc; margin: 0 0 6px; }
        .ticket-fecha-res { font-size: 11px; color: #666; margin: 0; }

        .ticket-admin-controls { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
        .ticket-priority-btns { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

        .ticket-resolve-area { margin-top: 0; }
        .ticket-btn-open-resolve { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .ticket-btn-open-resolve:hover { background: rgba(34,211,238,0.2); }
        .ticket-btn-resolver { background: #34d399; color: #0a1628; border: none; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .ticket-btn-cancel { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #888; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
      `}</style>
    </div>
  );
}
