import { useState, useRef, useEffect } from 'react';
import { enviarMensaje, enviarFeedback, clearSession } from '../services/api';
import AdminPanel from '../components/AdminPanel';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function handleLogout() {
    clearSession();
    onLogout();
  }

  async function handleSend(e) {
    e?.preventDefault();
    const pregunta = input.trim();
    if (!pregunta || thinking) return;

    // Agregar mensaje del usuario
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

      if (!res.ok) {
        throw new Error('No se pudo descargar el PDF');
      }

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

  async function handlePreview(idManual, nombrePdf) {
    try {
      const token = localStorage.getItem('luxo_token');
      const res = await fetch(`/api/manuales/${idManual}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('No se pudo cargar el PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewPdf({ url, nombre: nombrePdf || 'manual.pdf' });
    } catch (err) {
      console.error('Error al previsualizar PDF:', err);
      alert('Error al cargar la vista previa del PDF.');
    }
  }

  function closePreview() {
    if (previewPdf?.url) {
      window.URL.revokeObjectURL(previewPdf.url);
    }
    setPreviewPdf(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Obtener iniciales para avatar
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
              Bienvenido, {user.nombre}
            </div>
          </div>
        </div>

        <div className="chat-header-right">
          {user.rol === 'Admin' && (
            <button
              className="btn-admin"
              onClick={() => setShowAdmin(true)}
            >
              ⚙️ Admin
            </button>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar Sesión
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
              ¡Hola! Soy LUXO
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px' }}>
              Tu asistente inteligente de Sunglass Hut. Pregúntame lo que necesites sobre los manuales operativos.
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

              {/* PDF actions: preview + download */}
              {msg.type === 'bot' && msg.id_manual && (
                <div className="pdf-actions">
                  <button
                    className="preview-btn"
                    onClick={() => handlePreview(msg.id_manual, msg.nombre_pdf)}
                  >
                    👁️ Vista previa: {msg.nombre_pdf}
                  </button>
                  <button
                    className="download-btn"
                    onClick={() => handleDownload(msg.id_manual, msg.nombre_pdf)}
                  >
                    📥 Descargar
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
              LUXO está pensando...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder="Escribe tu consulta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={thinking}
          />
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={!input.trim() || thinking}
          >
            Enviar
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
                  📥 Descargar
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

      {/* Admin Panel Modal */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
