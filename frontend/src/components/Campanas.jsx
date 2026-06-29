// =========================================
// Campanas.jsx — Campañas de Exhibición con Auditoría IA
// =========================================
import { useState, useEffect, useRef } from 'react';
import {
  obtenerCampanaActiva,
  obtenerTodasCampanas,
  obtenerFotosGuia,
  obtenerMiEntrega,
  subirFotoTienda,
  crearCampanaAdmin,
  agregarFotoGuia,
  obtenerEntregasCampana,
  obtenerDetalleEntrega,
  darVistoBueno,
  depurarFotos,
  verificarGeminiStatus,
  obtenerResumenCampanaTiendas,
} from '../services/api';

const SEGMENTOS = [
  'Todos', 'Formato 6.000/2.0', 'Formato Inline 4.0', 'Formato Inline Skin',
  'Formato Inline Boxes', 'Formato Open Airs (Kioskos)', 'Formato Inline Skin Kiosko',
];

const ESTATUS_BADGE = {
  Pendiente:     { label: 'PENDIENTE',          color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  Auditando:     { label: 'AUDITANDO...',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  Aprobado_IA:   { label: 'APROBADO POR IA ✓',  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  Rechazado_IA:  { label: 'RECHAZADO POR IA ⚠',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  Visto_Bueno:   { label: 'VISTO BUENO 👑',      color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  Aprobado:      { label: 'APROBADO ✓',          color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  Corregir:      { label: 'CORREGIR ⚠',          color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  'Sin entrega': { label: 'SIN ENTREGA',         color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function StatusBadge({ estatus }) {
  const s = ESTATUS_BADGE[estatus] || { label: estatus, color: '#888', bg: 'rgba(136,136,136,0.1)' };
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '3px 12px',
      borderRadius: '20px', fontSize: '11px', fontWeight: 700,
    }}>
      {s.label}
    </span>
  );
}

// ============ VISTA GERENTE ============
function VistaGerente({ campana }) {
  const [entrega, setEntrega] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [segmento, setSegmento] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(null); // id_foto_guia
  const fileRef = useRef({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entData, fotosData] = await Promise.all([
        obtenerMiEntrega(campana.ID_Campana),
        obtenerFotosGuia(campana.ID_Campana, segmento === 'Todos' ? null : segmento),
      ]);
      setEntrega(entData);
      setFotos(fotosData);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [campana.ID_Campana, segmento]);

  const handleSubir = async (id_foto_guia, file) => {
    if (!file) return;
    setSubiendo(id_foto_guia);
    try {
      await subirFotoTienda(campana.ID_Campana, id_foto_guia, file);
      await fetchData();
    } catch (err) {
      alert('Error al subir: ' + err.message);
    } finally {
      setSubiendo(null);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando...</div>;

  const fotasSubidas = entrega?.fotos || {};

  return (
    <div>
      {/* Header campaña */}
      <div className="camp-header">
        <div>
          <h2 className="camp-title">📸 {campana.Nombre}</h2>
          {campana.Descripcion && <p className="camp-desc">{campana.Descripcion}</p>}
        </div>
        {entrega && <StatusBadge estatus={entrega.Estatus} />}
      </div>

      {/* Filtro segmento */}
      <div className="camp-filter">
        <label className="camp-filter-label">Filtrar por formato de tienda:</label>
        <select
          className="camp-select"
          value={segmento}
          onChange={e => setSegmento(e.target.value)}
        >
          {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {fotos.length === 0 ? (
        <div className="camp-empty">No hay fotos guía para este formato.</div>
      ) : (
        <div className="camp-fotos-grid">
          {fotos.map(foto => {
            const subida = fotasSubidas[String(foto.ID_Foto_Guia)];
            const estatus = subida?.Estatus_Auditoria;
            const borderColor =
              estatus === 'Aprobado' ? '#34d399'
              : estatus === 'Corregir' ? '#f87171'
              : 'rgba(255,255,255,0.1)';

            return (
              <div key={foto.ID_Foto_Guia} className="camp-foto-card" style={{ borderColor }}>
                <div className="camp-foto-header">
                  <span className="camp-foto-name">{foto.Nombre_Foto}</span>
                  <span className="camp-segmento-badge">{foto.Segmento}</span>
                </div>

                <div className="camp-img-row">
                  <div className="camp-img-col">
                    <p className="camp-img-label">GUÍA OFICIAL</p>
                    <img
                      src={`data:image/jpeg;base64,${foto.imagen_b64}`}
                      alt="Guía"
                      className="camp-img"
                    />
                  </div>
                  <div className="camp-img-col">
                    <p className="camp-img-label">TU TIENDA</p>
                    {subida
                      ? <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="subida" className="camp-img" style={{ opacity: 0.3 }} />
                      : (
                        <div className="camp-no-foto">
                          <span>📷</span>
                          <p>Sin foto</p>
                        </div>
                      )
                    }
                  </div>
                </div>

                {foto.Instrucciones && (
                  <p className="camp-instrucciones">📋 {foto.Instrucciones}</p>
                )}

                {estatus && (
                  <div className="camp-auditoria">
                    <StatusBadge estatus={estatus} />
                    {subida?.Resultado_IA && (
                      <p className="camp-resultado-ia">{subida.Resultado_IA}</p>
                    )}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    ref={el => (fileRef.current[foto.ID_Foto_Guia] = el)}
                    onChange={e => handleSubir(foto.ID_Foto_Guia, e.target.files[0])}
                  />
                  <button
                    className="camp-btn-subir"
                    onClick={() => fileRef.current[foto.ID_Foto_Guia]?.click()}
                    disabled={subiendo === foto.ID_Foto_Guia}
                  >
                    {subiendo === foto.ID_Foto_Guia
                      ? '⏳ Subiendo y auditando...'
                      : subida ? '🔄 Volver a subir' : '📤 Subir Foto'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ VISTA ADMIN ============
function VistaAdmin() {
  const [tab, setTab] = useState('crear'); // crear | entregas | config
  const [campanas, setCampanas] = useState([]);
  const [campanaSelec, setCampanaSelec] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [resumenTiendas, setResumenTiendas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [geminiOk, setGeminiOk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingResumen, setLoadingResumen] = useState(false);

  // Form crear
  const [nombre, setNombre] = useState('');
  const [desc, setDesc] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [creando, setCreando] = useState(false);
  const [msgCrear, setMsgCrear] = useState(null);

  // Fotos guía
  const [fotosGuia, setFotosGuia] = useState([{ nombre: '', instrucciones: '', segmento: 'Todos', file: null }]);

  useEffect(() => {
    cargarCampanas();
    verificarGeminiStatus().then(d => setGeminiOk(d.configurada)).catch(() => setGeminiOk(false));
  }, []);

  const cargarCampanas = async () => {
    try {
      const data = await obtenerTodasCampanas();
      setCampanas(data);
      if (data.length > 0 && !campanaSelec) setCampanaSelec(data[0]);
    } catch (_) {}
  };

  const cargarEntregas = async (id) => {
    setLoading(true);
    try {
      const data = await obtenerEntregasCampana(id);
      setEntregas(data);
    } finally { setLoading(false); }
  };

  const cargarResumen = async (id) => {
    setLoadingResumen(true);
    try {
      const data = await obtenerResumenCampanaTiendas(id);
      setResumenTiendas(data);
    } catch (_) {}
    finally { setLoadingResumen(false); }
  };

  const handleCrearCampana = async () => {
    if (!nombre.trim()) return;
    setCreando(true);
    setMsgCrear(null);
    try {
      const { id_campana } = await crearCampanaAdmin(nombre, desc, pdfFile);
      // Subir fotos guía
      for (const fg of fotosGuia) {
        if (fg.file && fg.nombre) {
          await agregarFotoGuia(id_campana, fg.nombre, fg.instrucciones, fg.segmento, fg.file);
        }
      }
      setMsgCrear({ tipo: 'ok', texto: `Campaña "${nombre}" creada y activada exitosamente.` });
      setNombre(''); setDesc(''); setPdfFile(null);
      setFotosGuia([{ nombre: '', instrucciones: '', segmento: 'Todos', file: null }]);
      await cargarCampanas();
    } catch (err) {
      setMsgCrear({ tipo: 'error', texto: err.message });
    } finally {
      setCreando(false);
    }
  };

  const handleVistoBueno = async (id_entrega) => {
    if (!confirm('¿Dar visto bueno a esta entrega?')) return;
    await darVistoBueno(id_entrega);
    await cargarEntregas(campanaSelec?.ID_Campana);
  };

  const handleDepurar = async () => {
    if (!confirm('¿Liberar espacio de fotos con más de 3 meses?')) return;
    const { fotos_depuradas } = await depurarFotos();
    alert(`✅ Liberadas ${fotos_depuradas} fotos antiguas.`);
  };

  const TABS = [
    { id: 'crear', label: '➕ Crear Campaña' },
    { id: 'entregas', label: '📋 Ver Entregas' },
    { id: 'resumen', label: '🏙️ Estado por Tienda' },
    { id: 'config', label: '⚙ Configuración' },
  ];

  return (
    <div>
      <div className="camp-admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setDetalle(null);
              if (t.id === 'entregas' && campanaSelec) cargarEntregas(campanaSelec.ID_Campana);
              if (t.id === 'resumen' && campanaSelec) cargarResumen(campanaSelec.ID_Campana);
            }}
            className={`camp-tab-btn ${tab === t.id ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: CREAR */}
      {tab === 'crear' && (
        <div className="camp-form">
          <h3 className="camp-form-title">Nueva Campaña de Exhibición</h3>
          {geminiOk === false && (
            <div className="camp-warn">⚠️ <b>GEMINI_API_KEY</b> no configurada. Las fotos no serán auditadas automáticamente.</div>
          )}
          {geminiOk === true && (
            <div className="camp-ok">✅ API de Gemini Vision configurada. Las fotos serán auditadas automáticamente.</div>
          )}

          <div className="camp-field">
            <label className="camp-label">Nombre de la Campaña *</label>
            <input className="camp-input" placeholder="Ej: Exhibición Junio 2025" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="camp-field">
            <label className="camp-label">Descripción</label>
            <textarea className="camp-textarea" rows={2} placeholder="Descripción opcional..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="camp-field">
            <label className="camp-label">Guía de instalación (PDF opcional)</label>
            <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} className="camp-file" />
          </div>

          <div className="camp-fotos-guia-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 className="camp-form-subtitle">📷 Fotos Guía de la Campaña</h4>
              <button
                className="camp-btn-add-foto"
                onClick={() => setFotosGuia(f => [...f, { nombre: '', instrucciones: '', segmento: 'Todos', file: null }])}
              >
                + Añadir Sección
              </button>
            </div>
            {fotosGuia.map((fg, i) => (
              <div key={i} className="camp-foto-guia-row">
                <div className="camp-foto-guia-fields">
                  <input
                    className="camp-input"
                    placeholder="Nombre sección (ej: Cabecera)"
                    value={fg.nombre}
                    onChange={e => setFotosGuia(prev => prev.map((p, idx) => idx === i ? { ...p, nombre: e.target.value } : p))}
                  />
                  <input
                    className="camp-input"
                    placeholder="Instrucciones de montaje..."
                    value={fg.instrucciones}
                    onChange={e => setFotosGuia(prev => prev.map((p, idx) => idx === i ? { ...p, instrucciones: e.target.value } : p))}
                  />
                  <select
                    className="camp-select"
                    value={fg.segmento}
                    onChange={e => setFotosGuia(prev => prev.map((p, idx) => idx === i ? { ...p, segmento: e.target.value } : p))}
                  >
                    {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="file"
                    accept="image/*"
                    className="camp-file"
                    onChange={e => setFotosGuia(prev => prev.map((p, idx) => idx === i ? { ...p, file: e.target.files[0] } : p))}
                  />
                </div>
                {fotosGuia.length > 1 && (
                  <button
                    className="camp-btn-del-foto"
                    onClick={() => setFotosGuia(f => f.filter((_, idx) => idx !== i))}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {msgCrear && (
            <div className={`camp-msg ${msgCrear.tipo}`}>{msgCrear.texto}</div>
          )}
          <button className="camp-btn-crear" onClick={handleCrearCampana} disabled={creando || !nombre.trim()}>
            {creando ? '⏳ Creando...' : '💾 Activar y Guardar Campaña'}
          </button>
        </div>
      )}

      {/* TAB: ENTREGAS */}
      {tab === 'entregas' && (
        <div>
          {/* Selector de campaña */}
          {campanas.length > 0 && (
            <div className="camp-field">
              <label className="camp-label">Seleccionar Campaña</label>
              <select
                className="camp-select"
                value={campanaSelec?.ID_Campana || ''}
                onChange={e => {
                  const c = campanas.find(x => x.ID_Campana === Number(e.target.value));
                  setCampanaSelec(c);
                  setDetalle(null);
                  if (c) cargarEntregas(c.ID_Campana);
                }}
              >
                {campanas.map(c => <option key={c.ID_Campana} value={c.ID_Campana}>{c.Nombre} ({c.Estatus})</option>)}
              </select>
            </div>
          )}

          {detalle ? (
            <div>
              <button className="camp-btn-back" onClick={() => setDetalle(null)}>← Volver</button>
              <h3 className="camp-form-title" style={{ marginBottom: '20px' }}>Detalle de Entrega</h3>
              {detalle.map((d, i) => (
                <div key={i} className="camp-detalle-card" style={{ borderColor: d.Estatus_Auditoria === 'Aprobado' ? '#34d399' : d.Estatus_Auditoria === 'Corregir' ? '#f87171' : '#333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <b style={{ color: '#d8b4fe' }}>{d.Nombre_Foto}</b>
                    <StatusBadge estatus={d.Estatus_Auditoria} />
                  </div>
                  {d.Instrucciones && <p style={{ color: '#aaa', fontSize: '12px', margin: '0 0 12px' }}>{d.Instrucciones}</p>}
                  <div className="camp-img-row">
                    {d.foto_guia_b64 && (
                      <div className="camp-img-col">
                        <p className="camp-img-label">FOTO GUÍA</p>
                        <img src={`data:image/jpeg;base64,${d.foto_guia_b64}`} alt="guia" className="camp-img" />
                      </div>
                    )}
                    {d.foto_tienda_b64 && (
                      <div className="camp-img-col">
                        <p className="camp-img-label">FOTO TIENDA</p>
                        <img src={`data:image/jpeg;base64,${d.foto_tienda_b64}`} alt="tienda" className="camp-img" />
                      </div>
                    )}
                  </div>
                  {d.Resultado_IA && (
                    <div className="camp-auditoria">
                      <p className="camp-resultado-ia">🤖 Análisis IA: {d.Resultado_IA}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando entregas...</div>
            ) : entregas.length === 0 ? (
              <div className="camp-empty">No hay entregas registradas para esta campaña.</div>
            ) : (
              <div className="camp-entregas-list">
                {entregas.map(e => (
                  <div key={e.ID_Entrega} className="camp-entrega-row">
                    <div>
                      <p className="camp-entrega-tienda">{e.Tienda}</p>
                      <p className="camp-entrega-gerente">👤 {e.Gerente} · {e.Fecha_Envio}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <StatusBadge estatus={e.Estatus} />
                      <button
                        className="camp-btn-ver"
                        onClick={async () => {
                          const d = await obtenerDetalleEntrega(e.ID_Entrega);
                          setDetalle(d);
                        }}
                      >
                        Ver Fotos
                      </button>
                      {e.Estatus !== 'Visto_Bueno' && (
                        <button className="camp-btn-vb" onClick={() => handleVistoBueno(e.ID_Entrega)}>
                          👑 Visto Bueno
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* TAB: RESUMEN POR TIENDA */}
      {tab === 'resumen' && (
        <div>
          {campanas.length > 0 && (
            <div className="camp-field">
              <label className="camp-label">Seleccionar Campaña</label>
              <select
                className="camp-select"
                value={campanaSelec?.ID_Campana || ''}
                onChange={e => {
                  const c = campanas.find(x => x.ID_Campana === Number(e.target.value));
                  setCampanaSelec(c);
                  if (c) cargarResumen(c.ID_Campana);
                }}
              >
                {campanas.map(c => <option key={c.ID_Campana} value={c.ID_Campana}>{c.Nombre} ({c.Estatus})</option>)}
              </select>
            </div>
          )}

          {loadingResumen ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando estado de tiendas...</div>
          ) : resumenTiendas.length === 0 ? (
            <div className="camp-empty">Selecciona una campaña para ver el estado.</div>
          ) : (
            <>
              {/* Resumen conteo por estatus */}
              {(() => {
                const conteos = resumenTiendas.reduce((acc, t) => {
                  acc[t.Estatus] = (acc[t.Estatus] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {Object.entries(conteos).map(([estatus, count]) => {
                      const s = ESTATUS_BADGE[estatus] || { color: '#888', bg: 'rgba(136,136,136,0.1)' };
                      return (
                        <div key={estatus} style={{
                          background: s.bg, borderRadius: '10px', padding: '8px 14px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{count}</span>
                          <span style={{ fontSize: '11px', color: s.color, fontWeight: 600 }}>{estatus.replace('_', ' ')}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {resumenTiendas.map((t, i) => {
                  const s = ESTATUS_BADGE[t.Estatus] || { label: t.Estatus, color: '#888', bg: 'rgba(136,136,136,0.1)' };
                  return (
                    <div key={i} style={{
                      background: s.bg,
                      border: `1px solid ${s.color}33`,
                      borderRadius: '12px',
                      padding: '14px',
                      transition: 'transform 0.15s',
                    }}>
                      <div style={{ fontWeight: 700, color: '#e0e0e0', fontSize: '13px', marginBottom: '4px' }}>
                        🏪 {t.Tienda}
                      </div>
                      {t.Zona && (
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>📍 {t.Zona}</div>
                      )}
                      <div style={{ marginBottom: '6px' }}>
                        <span style={{
                          background: s.bg, color: s.color,
                          borderRadius: '20px', padding: '3px 10px',
                          fontSize: '10px', fontWeight: 700, border: `1px solid ${s.color}55`,
                        }}>
                          {s.label}
                        </span>
                      </div>
                      {t.Gerente && (
                        <div style={{ fontSize: '11px', color: '#888' }}>👤 {t.Gerente}</div>
                      )}
                      {t.Fecha_Envio && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>🕒 {t.Fecha_Envio}</div>
                      )}
                      {t.Estatus !== 'Sin entrega' && t.ID_Entrega && (
                        <button
                          style={{
                            marginTop: '8px', width: '100%',
                            background: 'rgba(216,180,254,0.1)', border: '1px solid rgba(216,180,254,0.3)',
                            color: '#d8b4fe', borderRadius: '6px', padding: '5px 10px',
                            fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                          }}
                          onClick={async () => {
                            const d = await obtenerDetalleEntrega(t.ID_Entrega);
                            setDetalle(d);
                            setTab('entregas');
                          }}
                        >
                          Ver Fotos
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: CONFIG */}
      {tab === 'config' && (
        <div className="camp-form">
          <h3 className="camp-form-title">⚙ Configuración y Mantenimiento</h3>
          <div className="camp-config-section">
            <h4 className="camp-form-subtitle">🧹 Mantenimiento de Almacenamiento</h4>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Elimina los datos binarios de fotos enviadas hace más de 3 meses, liberando espacio en la BD.
              La metadata y los resultados de IA se conservan.
            </p>
            <button className="camp-btn-depurar" onClick={handleDepurar}>
              🧹 Liberar Almacenamiento (Fotos &gt; 3 Meses)
            </button>
          </div>
          <div className="camp-config-section">
            <h4 className="camp-form-subtitle">🤖 Estado de la IA de Visión</h4>
            {geminiOk === true
              ? <div className="camp-ok">✅ API Key de Gemini configurada. Las fotos serán auditadas automáticamente.</div>
              : <div className="camp-warn">⚠️ Configura GEMINI_API_KEY en el archivo .env del backend para activar la auditoría automática de fotos.</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTE PRINCIPAL ============
export default function Campanas({ rol }) {
  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rol !== 'Admin') {
      obtenerCampanaActiva()
        .then(data => setCampana(data && data.ID_Campana ? data : null))
        .catch(() => setCampana(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [rol]);

  return (
    <div>
      <div className="camp-page-header">
        <h2 className="camp-page-title">📸 Fotos de Campaña</h2>
        <p className="camp-page-subtitle">
          {rol === 'Admin'
            ? 'Administra las campañas de exhibición y audita las entregas de las tiendas'
            : 'Sube las fotos requeridas de tu tienda y recibe retroalimentación de la IA'
          }
        </p>
      </div>

      {rol === 'Admin' ? (
        <VistaAdmin />
      ) : loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando...</div>
      ) : !campana ? (
        <div className="camp-empty" style={{ padding: '60px', textAlign: 'center' }}>
          <span style={{ fontSize: '40px' }}>📸</span>
          <p style={{ color: '#888', marginTop: '12px' }}>No hay ninguna campaña activa en este momento.</p>
        </div>
      ) : (
        <VistaGerente campana={campana} />
      )}

      <style>{`
        .camp-page-header { margin-bottom: 24px; }
        .camp-page-title { font-size: 22px; font-weight: 800; color: #d8b4fe; margin: 0 0 6px; }
        .camp-page-subtitle { font-size: 13px; color: #888; margin: 0; }

        .camp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; }
        .camp-title { font-size: 18px; font-weight: 700; color: #00d4ff; margin: 0 0 4px; }
        .camp-desc { font-size: 13px; color: #888; margin: 0; }

        .camp-filter { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .camp-filter-label { font-size: 13px; color: #aaa; }
        .camp-select { background: #1a1a2e; border: 1px solid rgba(216,180,254,0.2); border-radius: 8px; color: #e0e0e0; padding: 8px 12px; font-size: 13px; cursor: pointer; }

        .camp-empty { color: #888; font-style: italic; padding: 20px; }

        .camp-fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
        .camp-foto-card { background: #1a1a2e; border: 1px solid; border-radius: 14px; padding: 16px; transition: border-color 0.3s; }
        .camp-foto-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .camp-foto-name { font-size: 14px; font-weight: 700; color: #d8b4fe; }
        .camp-segmento-badge { background: rgba(34,211,238,0.1); color: #22d3ee; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 700; }
        .camp-img-row { display: flex; gap: 12px; margin-bottom: 12px; }
        .camp-img-col { flex: 1; text-align: center; }
        .camp-img-label { font-size: 9px; color: #666; font-weight: 700; margin-bottom: 4px; letter-spacing: 1px; }
        .camp-img { width: 100%; max-height: 140px; object-fit: contain; border-radius: 6px; background: #0d0d1a; }
        .camp-no-foto { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 120px; background: #0d0d1a; border-radius: 6px; color: #444; font-size: 12px; gap: 4px; }
        .camp-instrucciones { font-size: 11px; color: #888; margin-bottom: 10px; }
        .camp-auditoria { background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px; margin-bottom: 10px; }
        .camp-resultado-ia { font-size: 12px; color: #ccc; margin: 8px 0 0; line-height: 1.5; }
        .camp-btn-subir { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
        .camp-btn-subir:disabled { opacity: 0.5; cursor: not-allowed; }
        .camp-btn-subir:hover:not(:disabled) { opacity: 0.85; }

        /* Admin */
        .camp-admin-tabs { display: flex; gap: 4px; margin-bottom: 24px; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 4px; }
        .camp-tab-btn { flex: 1; background: none; border: none; color: #888; padding: 10px; border-radius: 9px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }
        .camp-tab-btn.active { background: rgba(216,180,254,0.15); color: #d8b4fe; }
        .camp-tab-btn:hover:not(.active) { background: rgba(255,255,255,0.05); color: #ccc; }

        .camp-form { max-width: 700px; }
        .camp-form-title { font-size: 16px; font-weight: 700; color: #d8b4fe; margin: 0 0 20px; }
        .camp-form-subtitle { font-size: 14px; font-weight: 700; color: #aaa; margin: 0; }
        .camp-field { margin-bottom: 16px; }
        .camp-label { display: block; font-size: 12px; font-weight: 700; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .camp-input { width: 100%; box-sizing: border-box; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e0e0e0; padding: 10px 14px; font-size: 13px; outline: none; }
        .camp-input:focus { border-color: #d8b4fe; }
        .camp-textarea { width: 100%; box-sizing: border-box; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e0e0e0; padding: 10px 14px; font-size: 13px; outline: none; resize: vertical; font-family: inherit; }
        .camp-file { display: block; font-size: 13px; color: #aaa; }
        .camp-warn { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #fbbf24; margin-bottom: 16px; }
        .camp-ok { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #34d399; margin-bottom: 16px; }
        .camp-msg { border-radius: 10px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
        .camp-msg.ok { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .camp-msg.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }

        .camp-fotos-guia-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .camp-foto-guia-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .camp-foto-guia-fields { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .camp-btn-add-foto { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .camp-btn-del-foto { background: none; border: none; color: #555; cursor: pointer; font-size: 22px; padding: 0; }
        .camp-btn-del-foto:hover { color: #ef4444; }
        .camp-btn-crear { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 12px; padding: 13px 28px; font-size: 14px; font-weight: 800; cursor: pointer; transition: opacity 0.2s; }
        .camp-btn-crear:disabled { opacity: 0.5; cursor: not-allowed; }

        .camp-entregas-list { display: flex; flex-direction: column; gap: 10px; }
        .camp-entrega-row { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; flex-wrap: wrap; gap: 10px; }
        .camp-entrega-tienda { font-weight: 700; color: #e0e0e0; font-size: 14px; margin: 0 0 3px; }
        .camp-entrega-gerente { font-size: 12px; color: #888; margin: 0; }
        .camp-btn-ver { background: rgba(216,180,254,0.1); border: 1px solid rgba(216,180,254,0.3); color: #d8b4fe; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .camp-btn-vb { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .camp-btn-back { background: none; border: none; color: #888; cursor: pointer; font-size: 13px; margin-bottom: 16px; padding: 0; }
        .camp-btn-back:hover { color: #d8b4fe; }

        .camp-detalle-card { background: #1a1a2e; border: 1px solid; border-radius: 14px; padding: 16px; margin-bottom: 14px; }

        .camp-config-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .camp-btn-depurar { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .camp-btn-depurar:hover { background: rgba(239,68,68,0.2); }
      `}</style>
    </div>
  );
}
