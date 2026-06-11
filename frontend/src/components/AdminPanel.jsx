import { useState, useEffect, useRef } from 'react';
import { obtenerManuales, subirPDF, actualizarPDF, borrarManual, obtenerHistorialAdmin, verificarPasswordHistorial } from '../services/api';

export default function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('manuales'); // 'manuales' | 'historial'

  // --- Manuales state ---
  const [manuales, setManuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState('upload'); // 'upload' | 'update'
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // --- Historial state ---
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [historialUnlocked, setHistorialUnlocked] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    cargarManuales();
  }, []);

  // Cargar historial cuando se desbloquea
  useEffect(() => {
    if (activeTab === 'historial' && historialUnlocked && historial.length === 0) {
      cargarHistorial();
    }
  }, [activeTab, historialUnlocked]);

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
    if (!confirm(`¿Seguro que deseas borrar "${nombre}"?`)) return;

    try {
      const data = await borrarManual(id);
      showMessage(data.message, 'success');
      cargarManuales();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }

  // =========================
  // HISTORIAL
  // =========================

  async function handleUnlockHistorial(e) {
    e?.preventDefault();
    if (!devPassword.trim()) return;
    setPasswordError('');
    try {
      await verificarPasswordHistorial(devPassword);
      setHistorialUnlocked(true);
    } catch (err) {
      setPasswordError(err.message || 'Contraseña incorrecta');
    }
  }

  async function cargarHistorial() {
    setHistorialLoading(true);
    try {
      const data = await obtenerHistorialAdmin(200, devPassword);
      setHistorial(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setHistorialLoading(false);
    }
  }

  const historialFiltrado = historial.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (h.Pregunta_Usuario || '').toLowerCase().includes(q) ||
      (h.nombre_usuario || '').toLowerCase().includes(q) ||
      (h.usuario || '').toLowerCase().includes(q) ||
      (h.nombre_manual || '').toLowerCase().includes(q)
    );
  });

  function formatFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getFeedbackIcon(feedback) {
    if (feedback === true) return '👍';
    if (feedback === false) return '👎';
    return '—';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '800px' }}
      >
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">⚙️ Panel de Administración</h2>

        {/* Status message */}
        {message.text && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
              background: message.type === 'error'
                ? 'rgba(239, 68, 68, 0.1)'
                : 'rgba(34, 197, 94, 0.1)',
              color: message.type === 'error' ? 'var(--error)' : 'var(--success)',
              border: `1px solid ${message.type === 'error'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(34, 197, 94, 0.3)'}`,
            }}
          >
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'manuales' ? 'active' : ''}`}
            onClick={() => setActiveTab('manuales')}
          >
            📚 Manuales
          </button>
          <button
            className={`admin-tab ${activeTab === 'historial' ? 'active' : ''}`}
            onClick={() => setActiveTab('historial')}
          >
            📋 Historial de Consultas
          </button>
        </div>

        {/* ===== TAB: MANUALES ===== */}
        {activeTab === 'manuales' && (
          <>
            {/* Upload mode toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                className={mode === 'upload' ? 'btn-primary' : 'btn-admin'}
                style={{ flex: 1, padding: '8px' }}
                onClick={() => setMode('upload')}
              >
                📤 Cargar Nuevo
              </button>
              <button
                className={mode === 'update' ? 'btn-primary' : 'btn-admin'}
                style={{ flex: 1, padding: '8px' }}
                onClick={() => setMode('update')}
              >
                🔄 Actualizar
              </button>
            </div>

            {/* Upload area */}
            <div
              className={`upload-area ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                {uploading ? '⏳' : '📄'}
              </div>
              <div className="upload-text">
                {uploading
                  ? 'Procesando archivo...'
                  : mode === 'upload'
                    ? 'Arrastra un PDF o Excel aquí o haz click para seleccionar'
                    : 'Arrastra el archivo actualizado o haz click para seleccionar'}
              </div>
              <div className="upload-hint">Archivos permitidos: .pdf · .xlsx · .xls</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {/* Manual list */}
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '12px',
            }}>
              Manuales cargados ({manuales.length})
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Cargando...
              </div>
            ) : manuales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No hay manuales cargados
              </div>
            ) : (
              manuales.map((m) => (
                <div key={m.id} className="manual-item">
                  <div>
                    <span className="manual-name">{m.nombre_archivo || m.titulo}</span>
                    <span className="manual-version">v{m.version}</span>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleBorrar(m.id, m.nombre_archivo)}
                  >
                    🗑️ Borrar
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {/* ===== TAB: HISTORIAL ===== */}
        {activeTab === 'historial' && (
          <>
            {/* Password gate */}
            {!historialUnlocked ? (
              <div className="historial-lock">
                <div className="historial-lock-icon">🔒</div>
                <h3 className="historial-lock-title">Acceso Restringido</h3>
                <p className="historial-lock-text">
                  Ingresa la contraseña de desarrollador para ver el historial de consultas.
                </p>
                <form onSubmit={handleUnlockHistorial} style={{ width: '100%', maxWidth: '300px' }}>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Contraseña..."
                    value={devPassword}
                    onChange={(e) => { setDevPassword(e.target.value); setPasswordError(''); }}
                    style={{ marginBottom: '12px' }}
                    autoFocus
                  />
                  {passwordError && (
                    <div style={{
                      color: 'var(--error)',
                      fontSize: '13px',
                      marginBottom: '12px',
                      textAlign: 'center',
                    }}>
                      ❌ {passwordError}
                    </div>
                  )}
                  <button type="submit" className="btn-primary" disabled={!devPassword.trim()}>
                    🔓 Desbloquear
                  </button>
                </form>
              </div>
            ) : (
            <>
            {/* Search + Refresh */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="🔍 Buscar por pregunta, usuario o manual..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-admin"
                onClick={cargarHistorial}
                style={{ whiteSpace: 'nowrap' }}
                disabled={historialLoading}
              >
                🔄 Actualizar
              </button>
            </div>

            {/* Stats */}
            <div className="historial-stats">
              <div className="historial-stat">
                <span className="historial-stat-number">{historial.length}</span>
                <span className="historial-stat-label">Total consultas</span>
              </div>
              <div className="historial-stat">
                <span className="historial-stat-number">
                  {historial.filter((h) => h.feedback === true).length}
                </span>
                <span className="historial-stat-label">👍 Positivos</span>
              </div>
              <div className="historial-stat">
                <span className="historial-stat-number">
                  {historial.filter((h) => h.feedback === false).length}
                </span>
                <span className="historial-stat-label">👎 Negativos</span>
              </div>
              <div className="historial-stat">
                <span className="historial-stat-number">
                  {new Set(historial.map((h) => h.usuario)).size}
                </span>
                <span className="historial-stat-label">Usuarios</span>
              </div>
            </div>

            {/* Results count */}
            <h3 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}>
              {searchQuery
                ? `${historialFiltrado.length} resultados encontrados`
                : `Últimas ${historial.length} consultas`}
            </h3>

            {historialLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                ⏳ Cargando historial...
              </div>
            ) : historialFiltrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                {searchQuery ? 'No se encontraron resultados' : 'No hay consultas registradas'}
              </div>
            ) : (
              <div className="historial-list">
                {historialFiltrado.map((h) => (
                  <div
                    key={h.ID_Conversacion}
                    className={`historial-item ${expandedRow === h.ID_Conversacion ? 'expanded' : ''}`}
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === h.ID_Conversacion ? null : h.ID_Conversacion
                      )
                    }
                  >
                    {/* Row header */}
                    <div className="historial-item-header">
                      <div className="historial-item-user">
                        <span className="historial-user-badge">
                          {(h.nombre_usuario || 'Usuario')
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div>
                          <div className="historial-item-name">
                            {h.nombre_usuario || 'Usuario desconocido'}
                          </div>
                          <div className="historial-item-date">
                            {formatFecha(h.Fecha_Hora)}
                          </div>
                        </div>
                      </div>
                      <div className="historial-item-meta">
                        <span className="historial-feedback-badge">
                          {getFeedbackIcon(h.feedback)}
                        </span>
                        <span className="historial-expand-icon">
                          {expandedRow === h.ID_Conversacion ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>

                    {/* Question */}
                    <div className="historial-item-question">
                      💬 {h.Pregunta_Usuario}
                    </div>

                    {/* Manual badge */}
                    {h.nombre_manual && (
                      <div className="historial-item-manual">
                        📄 {h.nombre_manual}
                      </div>
                    )}

                    {/* Expanded: Full answer */}
                    {expandedRow === h.ID_Conversacion && (
                      <div className="historial-item-answer">
                        <div className="historial-answer-label">Respuesta de LUXO:</div>
                        <div className="historial-answer-text">
                          {h.Respuesta_IA}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
