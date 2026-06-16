import { useState, useEffect, useRef } from 'react';
import {
  obtenerManuales, subirPDF, actualizarPDF, borrarManual,
  obtenerPendientes, obtenerEstadisticas,
  obtenerUsuariosAdmin, actualizarTiendaUsuario,
  reindexarManuales,
} from '../services/api';
import { t } from '../services/i18n';

export default function AdminPanel({ onClose }) {
  // 'manuales' | 'pendientes' | 'estadisticas' | 'usuarios'
  const [activeTab, setActiveTab] = useState('manuales');

  // --- Manuales state ---
  const [manuales, setManuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);
  const [reindexando, setReindexando] = useState(false);
  const [mode, setMode] = useState('upload');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // --- Pendientes state ---
  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(false);

  // --- Estadísticas state ---
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // --- Usuarios state ---
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [tiendaEdits, setTiendaEdits] = useState({});
  const [tiendaSaved, setTiendaSaved] = useState({});

  useEffect(() => {
    cargarManuales();
  }, []);

  useEffect(() => {
    if (activeTab === 'pendientes' && pendientes.length === 0) {
      cargarPendientes();
    }
    if (activeTab === 'estadisticas' && !stats) {
      cargarEstadisticas();
    }
    if (activeTab === 'usuarios' && usuarios.length === 0) {
      cargarUsuarios();
    }
  }, [activeTab]);

  // =========================
  // MANUALES
  // =========================

  async function cargarManuales() {
    try {
      const data = await obtenerManuales();
      setManuales(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  }

  async function handleFile(file) {
    const nombre = file?.name.toLowerCase();
    const esValido = nombre?.endsWith('.pdf') || nombre?.endsWith('.xlsx') || nombre?.endsWith('.xls');
    if (!file || !esValido) {
      showMessage('Solo se permiten archivos PDF (.pdf) o Excel (.xlsx, .xls)', 'error');
      return;
    }
    setUploading(true);
    try {
      const fn = mode === 'update' ? actualizarPDF : subirPDF;
      const data = await fn(file);
      showMessage(data.message, 'success');
      cargarManuales();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleBorrar(id, nombre) {
    if (!confirm(`${t('admin_delete_confirm')} "${nombre}"?`)) return;
    try {
      const data = await borrarManual(id);
      showMessage(data.message, 'success');
      cargarManuales();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }

  async function handleReindexar() {
    if (!confirm('¿Re-indexar todos los documentos con el pipeline mejorado? Esto puede tardar unos minutos.')) return;
    setReindexando(true);
    showMessage('Re-indexando... esto puede tardar un momento.', 'success');
    try {
      const data = await reindexarManuales();
      showMessage(data.message, 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setReindexando(false);
    }
  }

  // =========================
  // PENDIENTES
  // =========================

  async function cargarPendientes() {
    setPendientesLoading(true);
    try {
      const data = await obtenerPendientes();
      setPendientes(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setPendientesLoading(false);
    }
  }

  // =========================
  // ESTADÍSTICAS
  // =========================

  async function cargarEstadisticas() {
    setStatsLoading(true);
    try {
      const data = await obtenerEstadisticas();
      setStats(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setStatsLoading(false);
    }
  }

  // =========================
  // USUARIOS
  // =========================

  async function cargarUsuarios() {
    setUsuariosLoading(true);
    try {
      const data = await obtenerUsuariosAdmin();
      setUsuarios(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUsuariosLoading(false);
    }
  }

  async function handleGuardarTienda(idUsuario) {
    const nuevaTienda = tiendaEdits[idUsuario] ?? '';
    try {
      await actualizarTiendaUsuario(idUsuario, nuevaTienda);
      setTiendaSaved(p => ({ ...p, [idUsuario]: true }));
      setUsuarios(prev => prev.map(u =>
        u.ID_Usuario === idUsuario ? { ...u, Tienda: nuevaTienda } : u
      ));
      setTimeout(() => setTiendaSaved(p => ({ ...p, [idUsuario]: false })), 2000);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }

  // =========================
  // UTILS
  // =========================

  function formatFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getFeedbackIcon(feedback) {
    if (feedback === true) return '👍';
    if (feedback === false) return '👎';
    return '—';
  }

  // Mini bar chart puro CSS
  function BarChart({ data }) {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => d.consultas), 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px', marginTop: '8px' }}>
        {data.map((d, i) => {
          const pct = (d.consultas / max) * 100;
          const day = d.dia ? new Date(d.dia + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit' }) : '—';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{d.consultas}</div>
              <div style={{
                width: '100%',
                height: `${Math.max(pct, 4)}%`,
                background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '4px 4px 0 0',
                minHeight: '4px',
                transition: 'height 0.5s ease',
              }} />
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>{day}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // Tarjeta de KPI
  function KpiCard({ icon, label, value, sub, color }) {
    return (
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: color || 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
        }} />
        <div style={{ fontSize: '22px', marginBottom: '2px' }}>{icon}</div>
        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '860px', width: '95vw' }}
      >
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{t('admin_title')}</h2>

        {/* Status message */}
        {message.text && (
          <div style={{
            padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
            background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color: message.type === 'error' ? 'var(--error)' : 'var(--success)',
            border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs" style={{ flexWrap: 'wrap' }}>
          {[
            ['manuales', t('admin_tab_manuals')],
            ['pendientes', t('admin_tab_pending')],
            ['estadisticas', t('admin_tab_stats')],
            ['usuarios', t('admin_tab_users')],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`admin-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {key === 'pendientes' && pendientes.length > 0 && (
                <span style={{
                  marginLeft: '6px',
                  background: 'var(--error)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {pendientes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: MANUALES ===== */}
        {activeTab === 'manuales' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className={mode === 'upload' ? 'btn-primary' : 'btn-admin'} style={{ flex: 1, padding: '8px' }} onClick={() => setMode('upload')}>
                {t('admin_upload_new')}
              </button>
              <button className={mode === 'update' ? 'btn-primary' : 'btn-admin'} style={{ flex: 1, padding: '8px' }} onClick={() => setMode('update')}>
                {t('admin_update')}
              </button>
            </div>

            <div
              className={`upload-area ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">{uploading ? '⏳' : '📄'}</div>
              <div className="upload-text">
                {uploading ? t('admin_processing') : mode === 'upload' ? t('admin_upload_hint') : t('admin_update_hint')}
              </div>
              <div className="upload-hint">{t('admin_file_types')}</div>
              <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                {t('admin_loaded')} ({manuales.length})
              </h3>
              <button
                className="btn-admin"
                style={{ fontSize: '12px', padding: '5px 12px' }}
                onClick={handleReindexar}
                disabled={reindexando}
                title="Re-procesa todos los documentos con OCR mejorado y chunking inteligente"
              >
                {reindexando ? '⏳ Re-indexando...' : '🔄 Re-indexar todo'}
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : manuales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>{t('admin_no_manuals')}</div>
            ) : (
              manuales.map((m) => (
                <div key={m.id} className="manual-item">
                  <div>
                    <span className="manual-name">{m.nombre_archivo || m.titulo}</span>
                    <span className="manual-version">v{m.version}</span>
                  </div>
                  <button className="btn-delete" onClick={() => handleBorrar(m.id, m.nombre_archivo)}>
                    {t('admin_delete')}
                  </button>
                </div>
              ))
            )}
          </>
        )}


        {/* ===== TAB: PENDIENTES ===== */}
        {activeTab === 'pendientes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                {pendientes.length} {t('admin_pending_total')}
              </h3>
              <button className="btn-admin" onClick={cargarPendientes} disabled={pendientesLoading}>
                🔄 Actualizar
              </button>
            </div>

            {pendientesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {t('admin_pending_loading')}
              </div>
            ) : pendientes.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)',
                fontSize: '15px',
              }}>
                {t('admin_pending_empty')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendientes.map((p) => (
                  <div key={p.ID_Pendiente} style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderLeft: '4px solid var(--error)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      💬 {p.Pregunta_Faltante}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {p.nombre_usuario && (
                        <span>{t('admin_pending_user')} {p.nombre_usuario}</span>
                      )}
                      {p.tienda && (
                        <span>{t('admin_pending_store')} {p.tienda}</span>
                      )}
                      {p.Fecha_Registro && (
                        <span>🕐 {formatFecha(p.Fecha_Registro)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== TAB: ESTADÍSTICAS ===== */}
        {activeTab === 'estadisticas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button className="btn-admin" onClick={cargarEstadisticas} disabled={statsLoading}>
                🔄 Actualizar
              </button>
            </div>

            {statsLoading || !stats ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {t('stats_loading')}
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  <KpiCard icon="💬" label={t('stats_total')} value={stats.consultas?.total ?? 0} />
                  <KpiCard icon="📅" label={t('stats_today')} value={stats.consultas?.hoy ?? 0} color="linear-gradient(90deg,#22c55e,#16a34a)" />
                  <KpiCard icon="📆" label={t('stats_week')} value={stats.consultas?.semana ?? 0} color="linear-gradient(90deg,#3b82f6,#2563eb)" />
                  <KpiCard icon="🗓️" label={t('stats_month')} value={stats.consultas?.mes ?? 0} color="linear-gradient(90deg,#f59e0b,#d97706)" />
                  <KpiCard icon="👥" label={t('stats_active_users')} value={stats.usuarios_activos ?? 0} sub={t('stats_last_30')} color="linear-gradient(90deg,#8b5cf6,#6d28d9)" />
                  <KpiCard
                    icon="😊"
                    label={t('stats_satisfaction')}
                    value={stats.feedback?.total > 0 ? `${Math.round((stats.feedback.positivos / stats.feedback.total) * 100)}%` : '—'}
                    color="linear-gradient(90deg,#ec4899,#be185d)"
                  />
                  <KpiCard icon="⚠️" label={t('stats_pending')} value={stats.pendientes ?? 0} color="linear-gradient(90deg,#ef4444,#dc2626)" />
                </div>

                {/* Chart */}
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    📊 {t('stats_chart')}
                  </div>
                  <BarChart data={stats.consultas_por_dia} />
                </div>

                {/* Top manuales + top usuarios */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      📚 {t('stats_top_manuals')}
                    </div>
                    {(stats.top_manuales || []).length === 0 ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>—</div>
                    ) : (
                      stats.top_manuales.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < stats.top_manuales.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                            {i + 1}. {m.nombre}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                            {m.consultas} {t('stats_queries')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      🏆 {t('stats_top_users')}
                    </div>
                    {(stats.top_usuarios || []).length === 0 ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>—</div>
                    ) : (
                      stats.top_usuarios.map((u, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < stats.top_usuarios.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{i + 1}. {u.nombre}</div>
                            {u.tienda && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🏪 {u.tienda}</div>}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                            {u.consultas} {t('stats_queries')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ===== TAB: USUARIOS ===== */}
        {activeTab === 'usuarios' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                {usuarios.length} {t('users_total')}
              </h3>
              <button className="btn-admin" onClick={cargarUsuarios} disabled={usuariosLoading}>
                🔄 Actualizar
              </button>
            </div>

            {usuariosLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {t('users_loading')}
              </div>
            ) : usuarios.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {t('users_empty')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {usuarios.map((u) => (
                  <div key={u.ID_Usuario} style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}>
                    {/* Avatar inicial */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(u.Nombre_Completo || u.Usuario || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.Nombre_Completo}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        @{u.Usuario} · {t('users_role')} {u.Rol}
                      </div>
                    </div>

                    {/* Editar tienda */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px' }}>🏪</span>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={t('users_store_placeholder')}
                        defaultValue={u.Tienda || ''}
                        onChange={(e) => setTiendaEdits(p => ({ ...p, [u.ID_Usuario]: e.target.value }))}
                        style={{ padding: '6px 10px', fontSize: '13px', width: '160px' }}
                      />
                      <button
                        className={tiendaSaved[u.ID_Usuario] ? 'btn-primary' : 'btn-admin'}
                        style={{ padding: '6px 12px', fontSize: '13px', minWidth: '52px' }}
                        onClick={() => handleGuardarTienda(u.ID_Usuario)}
                      >
                        {tiendaSaved[u.ID_Usuario] ? t('users_saved') : t('users_save')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
