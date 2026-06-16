import { useState, useRef, useEffect } from 'react';
import { enviarMensaje, enviarFeedback, clearSession } from '../services/api';
import { t, getLang, setLang } from '../services/i18n';
import AdminPanel from '../components/AdminPanel';
import HistorialPanel from '../components/HistorialPanel';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [previewExcel, setPreviewExcel] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const messagesEndRef = useRef(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function handleLogout() {
    clearSession();
    onLogout();
  }

  function toggleLang() {
    const newLang = lang === 'es' ? 'en' : 'es';
    setLang(newLang);
    setLangState(newLang);
  }

  async function handleSend(e) {
    e?.preventDefault();
    const pregunta = input.trim();
    if (!pregunta || thinking) return;

    setMessages((prev) => [...prev, { type: 'user', text: pregunta }]);
    setInput('');
    setThinking(true);

    try {
      const data = await enviarMensaje(pregunta);

      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: data.respuesta,
          intencion: data.intencion,
          id_manual: data.id_manual,
          nombre_pdf: data.nombre_pdf,
          id_conversacion: data.id_conversacion,
          feedback: null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: `Error: ${err.message}`, isError: true },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function handleFeedback(index, esPositivo) {
    const msg = messages[index];
    if (!msg.id_conversacion) return;

    try {
      await enviarFeedback(msg.id_conversacion, esPositivo);
      setMessages((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], feedback: esPositivo };
        return updated;
      });
    } catch (err) {
      console.error('Error feedback:', err);
    }
  }

  async function handleDownload(idManual, nombrePdf) {
    try {
      const token = localStorage.getItem('luxo_token');
      const res = await fetch(`/api/manuales/${idManual}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('No se pudo descargar el PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombrePdf || 'manual.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      alert('Error al descargar el PDF. Intenta de nuevo.');
    }
  }

  async function handlePreview(idManual, nombreArchivo) {
    const esExcel = nombreArchivo?.toLowerCase().endsWith('.xlsx') ||
                    nombreArchivo?.toLowerCase().endsWith('.xls');
    try {
      const token = localStorage.getItem('luxo_token');

      if (esExcel) {
        const res = await fetch(`/api/manuales/${idManual}/download-excel`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('No se pudo cargar el Excel');

        const arrayBuffer = await res.arrayBuffer();
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const hojas = workbook.SheetNames.map((sheetName) => {
          const ws = workbook.Sheets[sheetName];
          const html = XLSX.utils.sheet_to_html(ws, { id: `sheet-${sheetName}` });
          return { nombre: sheetName, html };
        });

        setPreviewExcel({ hojas, nombre: nombreArchivo, hojaActiva: 0, idManual });
      } else {
        const res = await fetch(`/api/manuales/${idManual}/download`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('No se pudo cargar el PDF');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewPdf({ url, nombre: nombreArchivo || 'manual.pdf', idManual });
      }
    } catch (err) {
      console.error('Error al previsualizar:', err);
      alert('Error al cargar la vista previa. Intenta de nuevo.');
    }
  }

  function closePreview() {
    if (previewPdf?.url) window.URL.revokeObjectURL(previewPdf.url);
    setPreviewPdf(null);
    setPreviewExcel(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const initials = user.nombre
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <img
            className="chat-header-avatar"
            src="/avatar_luxo.png"
            alt="LUXO"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <div className="chat-header-title">LUXO</div>
            <div className="chat-header-subtitle">
              {t('header_welcome')} {user.nombre}
              {user.tienda && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '11px',
                  padding: '1px 7px',
                  borderRadius: '20px',
                  background: 'rgba(139,92,246,0.18)',
                  color: 'var(--accent-tertiary)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  fontWeight: 500,
                  verticalAlign: 'middle',
                }}>
                  🏪 {user.tienda}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="chat-header-right">
          {/* Toggle idioma */}
          <button
            id="btn-lang-toggle"
            className="btn-admin"
            onClick={toggleLang}
            title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            style={{ minWidth: '52px', fontWeight: 700, letterSpacing: '0.5px' }}
          >
            🌐 {lang === 'es' ? 'EN' : 'ES'}
          </button>

          {/* Historial del usuario */}
          <button
            id="btn-historial-propio"
            className="btn-admin"
            onClick={() => setShowHistorial(true)}
          >
            {t('header_history')}
          </button>

          {user.rol === 'Admin' && (
            <button
              id="btn-admin-panel"
              className="btn-admin"
              onClick={() => setShowAdmin(true)}
            >
              {t('header_admin')}
            </button>
          )}
          <button id="btn-logout" className="btn-logout" onClick={handleLogout}>
            {t('header_logout')}
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            opacity: 0.5,
          }}>
            <div style={{ fontSize: '48px' }}>🕶️</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-tertiary)' }}>
              {t('chat_empty_title')}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px' }}>
              {t('chat_empty_sub')}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.type}`}>
            <div className="message-avatar">
              {msg.type === 'user' ? initials : '🤖'}
            </div>
            <div className="message-content">
              <div
                className="message-bubble"
                style={msg.isError ? { borderColor: 'var(--error)' } : {}}
              >
                {msg.text}
              </div>

              {/* Acciones del archivo: solo vista previa */}
              {msg.type === 'bot' && msg.id_manual && (
                <div className="pdf-actions">
                  <button
                    className="preview-btn"
                    onClick={() => handlePreview(msg.id_manual, msg.nombre_pdf)}
                  >
                    {t('chat_preview')} {msg.nombre_pdf}
                  </button>
                </div>
              )}

              {/* Feedback buttons */}
              {msg.type === 'bot' && msg.id_conversacion && (
                <div className="feedback-row">
                  <button
                    className={`feedback-btn ${msg.feedback === true ? 'active-positive' : ''}`}
                    onClick={() => handleFeedback(i, true)}
                    title="Respuesta útil"
                  >
                    👍
                  </button>
                  <button
                    className={`feedback-btn ${msg.feedback === false ? 'active-negative' : ''}`}
                    onClick={() => handleFeedback(i, false)}
                    title="Respuesta no útil"
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {thinking && (
          <div className="message message-bot">
            <div className="message-avatar">🤖</div>
            <div className="thinking">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              {t('chat_thinking')}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            id="chat-input"
            className="chat-input"
            placeholder={t('chat_placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={thinking}
          />
          <button
            id="btn-send"
            className="btn-send"
            onClick={handleSend}
            disabled={!input.trim() || thinking}
          >
            {t('chat_send')}
          </button>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewPdf && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-preview-header">
              <span className="pdf-preview-title">📄 {previewPdf.nombre}</span>
              <div className="pdf-preview-actions">
                <button
                  className="download-btn"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewPdf.url;
                    a.download = previewPdf.nombre;
                    a.click();
                  }}
                >
                  {t('chat_download')}
                </button>
                <button className="modal-close" onClick={closePreview}>✕</button>
              </div>
            </div>
            <iframe
              src={previewPdf.url}
              className="pdf-preview-iframe"
              title={previewPdf.nombre}
            />
          </div>
        </div>
      )}

      {/* Excel Preview Modal */}
      {previewExcel && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-preview-header">
              <span className="pdf-preview-title">📊 {previewExcel.nombre}</span>
              <div className="pdf-preview-actions">
                <button
                  className="download-btn"
                  onClick={async () => {
                    const token = localStorage.getItem('luxo_token');
                    const res = await fetch(`/api/manuales/${previewExcel.idManual}/download-excel`, {
                      headers: { 'Authorization': `Bearer ${token}` },
                    });
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = previewExcel.nombre;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  }}
                >
                  {t('chat_download')}
                </button>
                <button className="modal-close" onClick={closePreview}>✕</button>
              </div>
            </div>

            {previewExcel.hojas.length > 1 && (
              <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {previewExcel.hojas.map((h, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewExcel((p) => ({ ...p, hojaActiva: idx }))}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: previewExcel.hojaActiva === idx ? 700 : 400,
                      background: previewExcel.hojaActiva === idx ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: previewExcel.hojaActiva === idx ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {h.nombre}
                  </button>
                ))}
              </div>
            )}

            <div
              className="pdf-preview-iframe"
              style={{ overflow: 'auto', padding: '16px', background: '#fff' }}
              dangerouslySetInnerHTML={{ __html: previewExcel.hojas[previewExcel.hojaActiva]?.html }}
            />
          </div>
        </div>
      )}

      {/* Historial Panel */}
      {showHistorial && (
        <HistorialPanel onClose={() => setShowHistorial(false)} />
      )}

      {/* Admin Panel Modal */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
