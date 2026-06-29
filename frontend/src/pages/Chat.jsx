import { useState, useRef, useEffect } from 'react';
import { enviarMensaje, enviarFeedback, clearSession, crearTicket, enviarSugerencia } from '../services/api';
import { t, getLang, setLang } from '../services/i18n';
import AdminPanel from '../components/AdminPanel';
import HistorialPanel from '../components/HistorialPanel';
import Notificaciones from '../components/Notificaciones';
import Checklists from '../components/Checklists';
import Campanas from '../components/Campanas';
import Tickets from '../components/Tickets';
import Tareas from '../components/Tareas';
import Presupuesto from '../components/Presupuesto';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [previewExcel, setPreviewExcel] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const [activeModule, setActiveModule] = useState('chat'); // chat | checklists | campanas | tickets | tareas
  const [speakingIdx, setSpeakingIdx] = useState(null); // indice del mensaje sonando
  const [creandoTicket, setCreandoTicket] = useState(null); // indice del mensaje
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [sugerenciaText, setSugerenciaText] = useState('');
  const [sugerenciaSending, setSugerenciaSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [feedbackCommentIdx, setFeedbackCommentIdx] = useState(null); // indice mostrando campo de comentario
  const [feedbackComment, setFeedbackComment] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function handleLogout() {
    clearSession();
    onLogout();
  }

  function handleLangChange(e) {
    const newLang = e.target.value;
    setLang(newLang);
    setLangState(newLang);
  }

  async function handleSend(e) {
    e?.preventDefault();
    const pregunta = input.trim();
    if ((!pregunta && !attachedFile) || thinking) return;

    setMessages((prev) => [...prev, { 
      type: 'user', 
      text: pregunta,
      fileName: attachedFile ? attachedFile.name : null
    }]);
    
    const fileToSend = attachedFile;
    setInput('');
    setAttachedFile(null);
    setThinking(true);

    try {
      const data = await enviarMensaje(pregunta, lang, fileToSend);

      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: data.respuesta,
          intencion: data.intencion,
          id_manual: data.id_manual,
          nombre_pdf: data.nombre_pdf,
          id_conversacion: data.id_conversacion,
          es_abierto: data.es_abierto,
          sugiere_ticket: data.sugiere_ticket || false,
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
      if (!esPositivo) {
        // Feedback negativo: mostrar campo de comentario antes de enviar
        await enviarFeedback(msg.id_conversacion, false);
        setMessages((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], feedback: false };
          return updated;
        });
        setFeedbackCommentIdx(index);
        setFeedbackComment('');
      } else {
        await enviarFeedback(msg.id_conversacion, true);
        setMessages((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], feedback: true };
          return updated;
        });
        setFeedbackCommentIdx(null);
      }
    } catch (err) {
      console.error('Error feedback:', err);
    }
  }

  async function handleFeedbackComment(index) {
    const msg = messages[index];
    if (!msg.id_conversacion || !feedbackComment.trim()) {
      setFeedbackCommentIdx(null);
      return;
    }
    try {
      await enviarFeedback(msg.id_conversacion, false, feedbackComment.trim());
    } catch (err) {
      console.error('Error feedback comment:', err);
    } finally {
      setFeedbackCommentIdx(null);
      setFeedbackComment('');
    }
  }

  async function handleSugerenciaSubmit(e) {
    e.preventDefault();
    if (!sugerenciaText.trim() || sugerenciaSending) return;
    setSugerenciaSending(true);
    try {
      await enviarSugerencia(sugerenciaText);
      alert("¡Gracias por tu sugerencia!");
      setShowSugerencias(false);
      setSugerenciaText('');
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSugerenciaSending(false);
    }
  }

  // TTS — Web Speech API
  function handleSpeak(idx, text) {
    if (!window.speechSynthesis) return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'es-MX';
    utter.rate = 0.95;
    utter.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  }

  // Crear ticket desde feedback negativo
  async function handleCrearTicketDesdeChat(idx) {
    const msg = messages[idx];
    const detalle = `Pregunta: ${messages[idx - 1]?.text || 'N/A'}\nRespuesta de LUXO: ${msg.text}`;
    setCreandoTicket(idx);
    try {
      await crearTicket(detalle);
      setMessages(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ticketCreado: true };
        return updated;
      });
    } catch (err) {
      alert('Error al crear el ticket: ' + err.message);
    } finally {
      setCreandoTicket(null);
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
          {/* Notificaciones */}
          <Notificaciones />

          {/* Sugerencias */}
          <button
            className="btn-admin"
            onClick={() => setShowSugerencias(true)}
            title="Enviar una sugerencia para mejorar LUXO"
          >
            💡
          </button>

          {/* Toggle idioma */}
          <select
            value={lang}
            onChange={handleLangChange}
            className="btn-admin"
            style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="es">🇪🇸 ES</option>
            <option value="en">🇺🇸 EN</option>
            <option value="pt">🇧🇷 PT</option>
            <option value="fr">🇫🇷 FR</option>
            <option value="zh">🇨🇳 ZH</option>
          </select>

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

      {/* Barra de navegación módulos */}
      <nav className="module-nav">
        {[
          { id: 'chat', label: '💬 Chat', show: true },
          { id: 'checklists', label: '✅ Checklist', show: true },
          { id: 'campanas', label: '📸 Campañas', show: true },
          { id: 'tickets', label: '🎫 Soporte', show: true },
          { id: 'tareas', label: '📊 Tareas', show: true },
          { id: 'presupuesto', label: '💰 Presupuesto', show: true },
        ].filter(m => m.show).map(m => (
          <button
            key={m.id}
            id={`nav-${m.id}`}
            className={`module-nav-btn ${activeModule === m.id ? 'active' : ''}`}
            onClick={() => setActiveModule(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {/* RENDERIZADO DE MÓDULOS */}
      {activeModule !== 'chat' && (
        <div className="module-content">
          {activeModule === 'checklists' && <Checklists rol={user.rol} />}
          {activeModule === 'campanas' && <Campanas rol={user.rol} />}
          {activeModule === 'tickets' && <Tickets rol={user.rol} />}
          {activeModule === 'tareas' && <Tareas rol={user.rol} />}
          {activeModule === 'presupuesto' && (
            <Presupuesto rol={user.rol} userTienda={user.tienda} />
          )}
        </div>
      )}
      {activeModule === 'chat' && (
        <>
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
                {msg.fileName && (
                  <div style={{ marginBottom: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', display: 'inline-block' }}>
                    📎 {msg.fileName}
                  </div>
                )}
                <div
                  className="message-bubble"
                  style={msg.isError ? { borderColor: 'var(--error)' } : {}}
                >
                  {msg.text}
                </div>

                {/* Acciones del archivo: solo vista previa */}
                {msg.type === 'bot' && msg.id_manual && msg.es_abierto !== false && (
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
                  <div>
                    <div className="feedback-row">
                      {/* TTS */}
                      {window.speechSynthesis && (
                        <button
                          className={`feedback-btn ${speakingIdx === i ? 'active-positive' : ''}`}
                          onClick={() => handleSpeak(i, msg.text)}
                          title={speakingIdx === i ? 'Detener' : 'Escuchar respuesta'}
                        >
                          {speakingIdx === i ? '🔇' : '🔊'}
                        </button>
                      )}
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
                      {/* Ticket desde feedback negativo */}
                      {msg.feedback === false && !msg.ticketCreado && (
                        <button
                          className="feedback-btn"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleCrearTicketDesdeChat(i)}
                          disabled={creandoTicket === i}
                          title="Reportar al soporte"
                        >
                          {creandoTicket === i ? '...' : '🎫 Reportar'}
                        </button>
                      )}
                      {msg.ticketCreado && (
                        <span style={{ fontSize: '11px', color: '#34d399' }}>✅ Ticket enviado</span>
                      )}
                    </div>

                    {/* Campo de comentario de falla (aparece tras 👎) */}
                    {feedbackCommentIdx === i && (
                      <div style={{
                        marginTop: '8px',
                        background: 'rgba(239,68,68,0.05)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '10px',
                        padding: '12px',
                      }}>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#f87171' }}>
                          ¿Qué esperabas resolver o qué falló? <span style={{ color: '#666' }}>(opcional)</span>
                        </p>
                        <textarea
                          value={feedbackComment}
                          onChange={e => setFeedbackComment(e.target.value)}
                          placeholder="Describe qué información necesitabas..."
                          rows={2}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: '#e0e0e0', padding: '8px',
                            fontSize: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={() => handleFeedbackComment(i)}
                            style={{
                              background: '#ef4444', color: 'white', border: 'none',
                              borderRadius: '6px', padding: '6px 14px', fontSize: '12px',
                              fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            Enviar reporte
                          </button>
                          <button
                            onClick={() => setFeedbackCommentIdx(null)}
                            style={{
                              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                              color: '#666', borderRadius: '6px', padding: '6px 12px',
                              fontSize: '12px', cursor: 'pointer',
                            }}
                          >
                            Omitir
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Banner de soporte — aparece si la IA detectó problema técnico */}
                    {msg.sugiere_ticket && !msg.ticketCreado && (
                      <div style={{
                        marginTop: '10px',
                        background: 'rgba(251,146,60,0.08)',
                        border: '1px solid rgba(251,146,60,0.3)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: '18px' }}>🔧</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#fb923c', fontWeight: 700 }}>
                            Problema técnico detectado
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#aaa' }}>
                            ¿El equipo o sistema sigue fallando? Crea un ticket para que soporte lo atienda.
                          </p>
                        </div>
                        <button
                          onClick={() => handleCrearTicketDesdeChat(i)}
                          disabled={creandoTicket === i}
                          style={{
                            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                            color: 'white', border: 'none', borderRadius: '8px',
                            padding: '7px 14px', fontSize: '12px', fontWeight: 700,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {creandoTicket === i ? '...' : '📤 Crear Ticket'}
                        </button>
                      </div>
                    )}
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
      <div className="chat-input-area" style={{ flexDirection: 'column', gap: 0 }}>
        {/* Preview adjunto */}
        {attachedFile && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>📎 {attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        )}
        <div className="chat-input-wrapper" style={{ borderRadius: attachedFile ? '0 0 8px 8px' : '8px' }}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 8px', color: 'var(--text-secondary)' }}
            title="Adjuntar imagen o video"
          >
            📎
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*,video/*"
            onChange={e => {
              if (e.target.files[0]) setAttachedFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
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
            disabled={(!input.trim() && !attachedFile) || thinking}
          >
            {t('chat_send')}
          </button>
        </div>
      </div>
        </>
      )}

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

      {/* SUGERENCIAS MODAL */}
      {showSugerencias && (
        <div className="modal-overlay" onClick={() => setShowSugerencias(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💡 Enviar Sugerencia</h2>
              <button className="close-btn" onClick={() => setShowSugerencias(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                ¿Tienes alguna idea para mejorar el sistema LUXO? ¡Queremos escucharte!
              </p>
              <textarea
                value={sugerenciaText}
                onChange={e => setSugerenciaText(e.target.value)}
                placeholder="Me gustaría que LUXO pudiera..."
                style={{
                  width: '100%',
                  height: '100px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '12px',
                  resize: 'none'
                }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSugerencias(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSugerenciaSubmit} disabled={!sugerenciaText.trim() || sugerenciaSending}>
                {sugerenciaSending ? 'Enviando...' : 'Enviar Sugerencia'}
              </button>
            </div>
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
