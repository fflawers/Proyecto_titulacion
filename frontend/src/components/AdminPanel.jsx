import { useState, useEffect, useRef } from 'react';
import { obtenerManuales, subirPDF, actualizarPDF, borrarManual } from '../services/api';

export default function AdminPanel({ onClose }) {
  const [manuales, setManuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState('upload'); // 'upload' | 'update'
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    cargarManuales();
  }, []);

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
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      showMessage('Solo se permiten archivos PDF', 'error');
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
              ? 'Procesando PDF...'
              : mode === 'upload'
                ? 'Arrastra un PDF aquí o haz click para seleccionar'
                : 'Arrastra el PDF actualizado o haz click para seleccionar'}
          </div>
          <div className="upload-hint">Solo archivos .pdf</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
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
      </div>
    </div>
  );
}
