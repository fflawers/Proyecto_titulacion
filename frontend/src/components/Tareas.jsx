// =========================================
// Tareas.jsx — Tareas Consolidadas con Excel
// =========================================
import { useState, useEffect } from 'react';
import {
  obtenerTareas,
  responderTarea,
  crearTareaAdmin,
  obtenerRespuestasTarea,
  getConsolidadoUrl,
} from '../services/api';

const ESTATUS_STYLE = {
  Activa:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  Cerrada: { color: '#888',    bg: 'rgba(136,136,136,0.1)' },
};

export default function Tareas({ rol }) {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respuestas, setRespuestas] = useState({});   // { id_tarea: {} }
  const [enviando, setEnviando] = useState(null);
  const [msg, setMsg] = useState({});                  // { id_tarea: {tipo, texto} }

  // Admin: crear tarea
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [plantillaFile, setPlantillaFile] = useState(null);
  const [creando, setCreando] = useState(false);
  const [msgCrear, setMsgCrear] = useState(null);
  const [showCrear, setShowCrear] = useState(false);

  // Admin: ver respuestas
  const [respuestasAdmin, setRespuestasAdmin] = useState({});
  const [verRespuestasId, setVerRespuestasId] = useState(null);

  const fetchTareas = async () => {
    setLoading(true);
    try {
      const data = await obtenerTareas();
      setTareas(data);
      // Inicializar respuestas vacías
      const init = {};
      data.forEach(t => {
        if (!init[t.ID_Tarea]) {
          const cols = safeParseJson(t.Columnas_JSON, []);
          const r = {};
          cols.forEach(c => (r[c] = ''));
          init[t.ID_Tarea] = r;
        }
      });
      setRespuestas(init);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTareas(); }, []);

  const safeParseJson = (str, fallback = []) => {
    try { return JSON.parse(str) || fallback; }
    catch { return fallback; }
  };

  const handleResponder = async (id_tarea) => {
    const r = respuestas[id_tarea] || {};
    setEnviando(id_tarea);
    try {
      await responderTarea(id_tarea, r);
      setMsg(prev => ({ ...prev, [id_tarea]: { tipo: 'ok', texto: '✅ Respuesta enviada exitosamente.' } }));
    } catch (err) {
      setMsg(prev => ({ ...prev, [id_tarea]: { tipo: 'error', texto: '❌ ' + err.message } }));
    } finally {
      setEnviando(null);
    }
  };

  const handleVerRespuestas = async (id_tarea) => {
    try {
      const data = await obtenerRespuestasTarea(id_tarea);
      setRespuestasAdmin(prev => ({ ...prev, [id_tarea]: data }));
      setVerRespuestasId(id_tarea);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCrearTarea = async () => {
    if (!titulo.trim()) return;
    setCreando(true);
    setMsgCrear(null);
    try {
      await crearTareaAdmin(titulo, desc, fechaLimite, plantillaFile);
      setMsgCrear({ tipo: 'ok', texto: 'Tarea creada y notificada a los gerentes.' });
      setTitulo(''); setDesc(''); setFechaLimite(''); setPlantillaFile(null);
      setShowCrear(false);
      await fetchTareas();
    } catch (err) {
      setMsgCrear({ tipo: 'error', texto: err.message });
    } finally {
      setCreando(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando tareas...</div>;
  }

  return (
    <div className="tareas-container">
      <div className="tareas-header">
        <div>
          <h2 className="tareas-title">📊 Tareas Consolidadas</h2>
          <p className="tareas-subtitle">
            {rol === 'Admin'
              ? 'Crea tareas con plantillas Excel y consolida las respuestas de los gerentes'
              : 'Completa las tareas asignadas por el equipo de administración'
            }
          </p>
        </div>
        {rol === 'Admin' && (
          <button
            className="tareas-btn-crear"
            onClick={() => setShowCrear(!showCrear)}
          >
            {showCrear ? 'Cancelar' : '➕ Nueva Tarea'}
          </button>
        )}
      </div>

      {/* Form crear tarea (admin) */}
      {rol === 'Admin' && showCrear && (
        <div className="tareas-crear-panel">
          <h3 className="tareas-panel-title">Crear Nueva Tarea</h3>
          <div className="tareas-field">
            <label className="tareas-label">Título *</label>
            <input className="tareas-input" placeholder="Ej: Inventario mensual de productos" value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div className="tareas-field">
            <label className="tareas-label">Descripción</label>
            <textarea className="tareas-textarea" rows={2} placeholder="Instrucciones adicionales..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="tareas-field" style={{ flex: 1 }}>
              <label className="tareas-label">Fecha límite</label>
              <input type="datetime-local" className="tareas-input" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} />
            </div>
            <div className="tareas-field" style={{ flex: 1 }}>
              <label className="tareas-label">Plantilla Excel (opcional)</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setPlantillaFile(e.target.files[0])} className="tareas-file" />
            </div>
          </div>
          {plantillaFile && (
            <p style={{ fontSize: '12px', color: '#34d399', marginBottom: '12px' }}>
              ✅ {plantillaFile.name} — Se extraerán las columnas automáticamente
            </p>
          )}
          {msgCrear && (
            <div className={`tareas-msg ${msgCrear.tipo}`}>{msgCrear.texto}</div>
          )}
          <button className="tareas-btn-guardar" onClick={handleCrearTarea} disabled={creando || !titulo.trim()}>
            {creando ? '⏳ Creando...' : '💾 Guardar y Notificar Gerentes'}
          </button>
        </div>
      )}

      {/* Lista de tareas */}
      {tareas.length === 0 ? (
        <div className="tareas-empty">
          <span style={{ fontSize: '40px' }}>📊</span>
          <p>No hay tareas disponibles.</p>
        </div>
      ) : (
        tareas.map(tarea => {
          const cols = safeParseJson(tarea.Columnas_JSON, []);
          const st = ESTATUS_STYLE[tarea.Estatus] || ESTATUS_STYLE.Cerrada;
          const rAdmin = respuestasAdmin[tarea.ID_Tarea] || [];

          return (
            <div key={tarea.ID_Tarea} className="tarea-card">
              <div className="tarea-card-header">
                <div>
                  <h3 className="tarea-titulo">{tarea.Titulo}</h3>
                  {tarea.Descripcion && <p className="tarea-desc">{tarea.Descripcion}</p>}
                </div>
                <span style={{ background: st.bg, color: st.color, borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {tarea.Estatus}
                </span>
              </div>

              {(tarea.Fecha_Limite || tarea.Nombre_Plantilla) && (
                <div className="tarea-meta">
                  {tarea.Fecha_Limite && (
                    <span className="tarea-meta-item">🗓 Límite: {tarea.Fecha_Limite}</span>
                  )}
                  {tarea.Nombre_Plantilla && (
                    <span className="tarea-meta-item">📎 {tarea.Nombre_Plantilla}</span>
                  )}
                </div>
              )}

              {/* Admin: ver respuestas y consolidado */}
              {rol === 'Admin' ? (
                <div className="tarea-admin-actions">
                  <button className="tarea-btn-ver-resp" onClick={() => {
                    if (verRespuestasId === tarea.ID_Tarea) {
                      setVerRespuestasId(null);
                    } else {
                      handleVerRespuestas(tarea.ID_Tarea);
                    }
                  }}>
                    {verRespuestasId === tarea.ID_Tarea ? 'Ocultar' : '👁 Ver Respuestas'}
                    {` (${rAdmin.length})`}
                  </button>
                  {tarea.Nombre_Plantilla && (
                    <a
                      href={getConsolidadoUrl(tarea.ID_Tarea)}
                      className="tarea-btn-consolidado"
                      download
                    >
                      📥 Descargar Consolidado
                    </a>
                  )}
                </div>
              ) : (
                /* Usuario: formulario de respuesta */
                tarea.Estatus === 'Activa' && cols.length > 0 && (
                  <div className="tarea-form">
                    <h4 className="tarea-form-title">Completar Tarea</h4>
                    <div className="tarea-form-fields">
                      {cols.map(col => (
                        <div key={col} className="tarea-field">
                          <label className="tareas-label">{col}</label>
                          <input
                            className="tareas-input"
                            placeholder={`Ingresa ${col}...`}
                            value={respuestas[tarea.ID_Tarea]?.[col] || ''}
                            onChange={e => setRespuestas(prev => ({
                              ...prev,
                              [tarea.ID_Tarea]: { ...prev[tarea.ID_Tarea], [col]: e.target.value },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                    {msg[tarea.ID_Tarea] && (
                      <div className={`tareas-msg ${msg[tarea.ID_Tarea].tipo}`}>{msg[tarea.ID_Tarea].texto}</div>
                    )}
                    <button
                      className="tarea-btn-enviar"
                      onClick={() => handleResponder(tarea.ID_Tarea)}
                      disabled={enviando === tarea.ID_Tarea}
                    >
                      {enviando === tarea.ID_Tarea ? '⏳ Enviando...' : '📤 Enviar Respuesta'}
                    </button>
                  </div>
                )
              )}

              {/* Tabla de respuestas (admin) */}
              {rol === 'Admin' && verRespuestasId === tarea.ID_Tarea && (
                <div className="tarea-resp-panel">
                  <h4 className="tarea-form-title">Respuestas recibidas</h4>
                  {rAdmin.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '13px' }}>Sin respuestas aún.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tarea-table">
                        <thead>
                          <tr>
                            <th>Tienda</th>
                            <th>Gerente</th>
                            <th>Fecha</th>
                            {safeParseJson(rAdmin[0]?.Respuestas_JSON || '{}', {}) &&
                              Object.keys(JSON.parse(rAdmin[0]?.Respuestas_JSON || '{}')).map(k => <th key={k}>{k}</th>)
                            }
                          </tr>
                        </thead>
                        <tbody>
                          {rAdmin.map((r, i) => {
                            const vals = safeParseJson(r.Respuestas_JSON, {});
                            return (
                              <tr key={i}>
                                <td>{r.Tienda}</td>
                                <td>{r.Gerente}</td>
                                <td>{r.Fecha_Envio}</td>
                                {Object.values(vals).map((v, j) => <td key={j}>{v}</td>)}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <style>{`
        .tareas-container { padding: 0 4px; max-width: 780px; margin: 0 auto; }
        .tareas-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; }
        .tareas-title { font-size: 22px; font-weight: 800; color: #d8b4fe; margin: 0 0 6px; }
        .tareas-subtitle { font-size: 13px; color: #888; margin: 0; }
        .tareas-btn-crear { background: linear-gradient(135deg, #9333ea, #7e22ce); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }

        .tareas-crear-panel { background: rgba(216,180,254,0.04); border: 1px solid rgba(216,180,254,0.15); border-radius: 14px; padding: 20px; margin-bottom: 28px; }
        .tareas-panel-title { font-size: 16px; font-weight: 700; color: #d8b4fe; margin: 0 0 16px; }
        .tareas-field { margin-bottom: 14px; }
        .tareas-label { display: block; font-size: 11px; font-weight: 700; color: #888; margin-bottom: 5px; text-transform: uppercase; }
        .tareas-input { width: 100%; box-sizing: border-box; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e0e0e0; padding: 10px 14px; font-size: 13px; outline: none; }
        .tareas-input:focus { border-color: #d8b4fe; }
        .tareas-textarea { width: 100%; box-sizing: border-box; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e0e0e0; padding: 10px 14px; font-size: 13px; outline: none; resize: vertical; font-family: inherit; }
        .tareas-file { font-size: 13px; color: #aaa; }
        .tareas-msg { border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
        .tareas-msg.ok { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .tareas-msg.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .tareas-btn-guardar { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 10px; padding: 11px 24px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .tareas-btn-guardar:disabled { opacity: 0.5; cursor: not-allowed; }

        .tareas-empty { text-align: center; padding: 60px; color: #666; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .tarea-card { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin-bottom: 16px; transition: border-color 0.2s; }
        .tarea-card:hover { border-color: rgba(216,180,254,0.2); }
        .tarea-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
        .tarea-titulo { font-size: 16px; font-weight: 700; color: #e0e0e0; margin: 0 0 4px; }
        .tarea-desc { font-size: 13px; color: #888; margin: 0; }
        .tarea-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
        .tarea-meta-item { font-size: 12px; color: #aaa; background: rgba(255,255,255,0.04); border-radius: 6px; padding: 4px 10px; }

        .tarea-admin-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .tarea-btn-ver-resp { background: rgba(216,180,254,0.1); border: 1px solid rgba(216,180,254,0.3); color: #d8b4fe; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .tarea-btn-ver-resp:hover { background: rgba(216,180,254,0.2); }
        .tarea-btn-consolidado { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; text-decoration: none; transition: all 0.2s; }
        .tarea-btn-consolidado:hover { background: rgba(34,211,238,0.2); }

        .tarea-form { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-top: 14px; }
        .tarea-form-title { font-size: 13px; font-weight: 700; color: #aaa; margin: 0 0 14px; }
        .tarea-form-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .tarea-field { display: flex; flex-direction: column; }
        .tarea-btn-enviar { background: linear-gradient(135deg, #9333ea, #7e22ce); color: white; border: none; border-radius: 10px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .tarea-btn-enviar:disabled { opacity: 0.5; cursor: not-allowed; }

        .tarea-resp-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-top: 16px; }
        .tarea-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .tarea-table th { background: rgba(216,180,254,0.08); color: #d8b4fe; padding: 8px 12px; text-align: left; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .tarea-table td { padding: 8px 12px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .tarea-table tr:last-child td { border-bottom: none; }
        .tarea-table tr:hover td { background: rgba(255,255,255,0.03); }
      `}</style>
    </div>
  );
}
