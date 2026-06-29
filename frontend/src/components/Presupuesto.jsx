import { useState, useEffect, useCallback } from 'react';
import {
  obtenerMetasPresupuesto,
  guardarMetasPresupuesto,
  obtenerVentasDiarias,
  guardarVentaDiaria,
  obtenerMesesLogrados,
  obtenerTiendasConZona,
} from '../services/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function pad(n) { return String(n).padStart(2, '0'); }

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function primerDiaSemana(anio, mes) {
  // 0=Dom, 1=Lun ... ajustamos para que empiece en Domingo
  return new Date(anio, mes - 1, 1).getDay();
}

function formatMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ————— Modal de edición del día —————
function DayModal({ dia, anio, mes, tienda, ventasMap, onClose, onSaved }) {
  const fechaStr = `${anio}-${pad(mes)}-${pad(dia)}`;
  const existing = ventasMap[dia] || {};
  const [ventaCon, setVentaCon] = useState(existing.Venta_Con_IVA > 0 ? String(existing.Venta_Con_IVA) : '');
  const [piezas, setPiezas] = useState(existing.Piezas > 0 ? String(existing.Piezas) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    const v = parseFloat(ventaCon) || 0;
    const p = parseInt(piezas) || 0;
    setSaving(true);
    setErr('');
    try {
      await guardarVentaDiaria(fechaStr, v, p, tienda);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '380px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 style={{ fontSize: '16px' }}>📅 Registrar Venta — Día {dia}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Fecha: <strong>{fechaStr}</strong>
            {tienda && <> · Tienda: <strong>{tienda}</strong></>}
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Venta del día con IVA ($)
            </label>
            <input
              className="input-field"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={ventaCon}
              onChange={e => setVentaCon(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Piezas vendidas
            </label>
            <input
              className="input-field"
              type="number"
              min="0"
              placeholder="0"
              value={piezas}
              onChange={e => setPiezas(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          {ventaCon > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
              Sin IVA (÷1.16): {formatMoney(parseFloat(ventaCon) / 1.16)}
            </div>
          )}
          {err && <div style={{ color: 'var(--error)', fontSize: '13px' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————— Barra de progreso —————
function ProgressBar({ value, max }) {
  const ratio = max > 0 ? value / max : 0;
  const pct = (ratio * 100).toFixed(1);
  // Rojo < 50%, Amarillo 50-99%, Verde >= 100%
  const color = ratio < 0.5 ? '#ef4444' : ratio < 1 ? '#f59e0b' : '#22c55e';
  
  return (
    <div>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ width: `${Math.min(ratio, 1) * 100}%`, height: '100%', background: color, borderRadius: '5px', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Avance: {pct}%</span>
        <span style={{ color }}>{ratio >= 1 ? '¡Meta lograda!' : ''}</span>
      </div>
    </div>
  );
}

export default function Presupuesto({ rol, userTienda }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);

  // Tienda/zona selector (admin)
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(userTienda || '');

  // Metas
  const [metaVenta, setMetaVenta] = useState('');
  const [metaPiezas, setMetaPiezas] = useState('');
  const [savingMetas, setSavingMetas] = useState(false);
  const [metaMsg, setMetaMsg] = useState('');

  // Ventas diarias
  const [ventasMap, setVentasMap] = useState({}); // { dia: { Venta_Con_IVA, Venta_Sin_IVA, Piezas } }

  // Meses logrados
  const [mesesLogrados, setMesesLogrados] = useState([]);

  // Modal día
  const [modalDia, setModalDia] = useState(null);

  const [loading, setLoading] = useState(false);

  const tiendaActual = rol === 'Admin' ? tiendaSeleccionada : (userTienda || '');

  // Cargar tiendas (admin)
  useEffect(() => {
    if (rol === 'Admin') {
      obtenerTiendasConZona()
        .then(data => {
          setTiendas(data);
          if (!tiendaSeleccionada && data.length > 0) {
            setTiendaSeleccionada(data[0].Tienda);
          }
        })
        .catch(() => {});
    }
  }, [rol]);

  // Cargar datos cuando cambia tienda/mes/año
  const cargarDatos = useCallback(async () => {
    if (!tiendaActual) return;
    setLoading(true);
    try {
      const [metas, ventas, meses] = await Promise.all([
        obtenerMetasPresupuesto(anio, mes, rol === 'Admin' ? tiendaActual : null),
        obtenerVentasDiarias(anio, mes, rol === 'Admin' ? tiendaActual : null),
        obtenerMesesLogrados(anio, rol === 'Admin' ? tiendaActual : null),
      ]);

      setMetaVenta(metas?.Meta_Venta > 0 ? String(metas.Meta_Venta) : '');
      setMetaPiezas(metas?.Meta_Piezas > 0 ? String(metas.Meta_Piezas) : '');

      const vMap = {};
      (ventas || []).forEach(v => { vMap[v.Dia] = v; });
      setVentasMap(vMap);

      setMesesLogrados(meses || []);
    } catch (e) {
      console.error('Error cargando presupuesto:', e);
    } finally {
      setLoading(false);
    }
  }, [anio, mes, tiendaActual, rol]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  async function handleGuardarMetas() {
    if (!tiendaActual) return;
    setSavingMetas(true);
    setMetaMsg('');
    try {
      await guardarMetasPresupuesto(
        anio, mes,
        parseFloat(metaVenta) || 0,
        parseInt(metaPiezas) || 0,
        rol === 'Admin' ? tiendaActual : null,
      );
      setMetaMsg('✅ Metas guardadas');
      cargarDatos();
    } catch (e) {
      setMetaMsg('❌ ' + e.message);
    } finally {
      setSavingMetas(false);
      setTimeout(() => setMetaMsg(''), 3000);
    }
  }

  // ——— Cálculos acumulados ———
  const totalDias = diasEnMes(anio, mes);
  let acumVentaSin = 0;
  let acumPiezas = 0;
  const dailyAccum = {};
  for (let d = 1; d <= totalDias; d++) {
    const v = ventasMap[d];
    if (v) {
      acumVentaSin += v.Venta_Sin_IVA || 0;
      acumPiezas += v.Piezas || 0;
    }
    dailyAccum[d] = { acumVentaSin, acumPiezas };
  }

  const metaVentaNum = parseFloat(metaVenta) || 0;
  const metaPiezasNum = parseInt(metaPiezas) || 0;

  // ——— Construir grilla del calendario ———
  const primerDia = primerDiaSemana(anio, mes); // 0=Dom
  const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= totalDias; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* ——— Encabezado ——— */}
      <div className="presupuesto-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            📊 Presupuesto Operativo
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Registra metas y ventas diarias por tienda
          </p>
        </div>
        <div className="presupuesto-header-controls">
          {/* Selector tienda (admin) */}
          {rol === 'Admin' && tiendas.length > 0 && (
            <select
              className="input-field"
              value={tiendaSeleccionada}
              onChange={e => setTiendaSeleccionada(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              {tiendas.map(t => (
                <option key={t.Tienda} value={t.Tienda}>{t.Tienda}{t.Zona ? ` (${t.Zona})` : ''}</option>
              ))}
            </select>
          )}
          {/* Selector mes */}
          <select
            className="input-field"
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            style={{ padding: '6px 10px', fontSize: '13px' }}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          {/* Selector año */}
          <select
            className="input-field"
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            style={{ padding: '6px 10px', fontSize: '13px' }}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {!tiendaActual && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
          ⚠️ No tienes una tienda asignada. Contacta al administrador.
        </div>
      )}

      {tiendaActual && (
        <div className="presupuesto-main-container">

          {/* ——— Panel Izquierdo ——— */}
          <div className="presupuesto-left-panel">

            {/* Tienda actual */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '10px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#c4b5fd' }}>{tiendaActual.toUpperCase()}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {MESES[mes - 1].toUpperCase()} {anio}
              </div>
            </div>

            {/* Definir Metas */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                🎯 Definir Metas del Mes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                    Meta Venta Sin IVA ($)
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaVenta}
                    onChange={e => setMetaVenta(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                    Meta Piezas
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaPiezas}
                    onChange={e => setMetaPiezas(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  onClick={handleGuardarMetas}
                  disabled={savingMetas}
                >
                  {savingMetas ? 'Guardando…' : '💾 Guardar Metas'}
                </button>
                {metaMsg && (
                  <div style={{ fontSize: '12px', color: metaMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)', textAlign: 'center' }}>
                    {metaMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Avance del período */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                📈 Avance del Período
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ventas</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatMoney(acumVentaSin)} / {metaVentaNum > 0 ? formatMoney(metaVentaNum) : 'Sin meta'}
                    </span>
                  </div>
                  <ProgressBar value={acumVentaSin} max={metaVentaNum} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Piezas</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {acumPiezas} / {metaPiezasNum > 0 ? metaPiezasNum : 'Sin meta'} pzs
                    </span>
                  </div>
                  <ProgressBar value={acumPiezas} max={metaPiezasNum} />
                </div>
              </div>
            </div>

            {/* Meses logrados */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
              flex: 1,
              overflow: 'auto',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                🏆 Meses Logrados {anio}
              </div>
              {mesesLogrados.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Sin datos de metas
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {mesesLogrados.filter(m => m.Meta_Venta > 0).map(m => {
                    const pct = m.Meta_Venta > 0 ? (m.Venta_Lograda / m.Meta_Venta) * 100 : 0;
                    const logrado = pct >= 100;
                    return (
                      <div key={m.Mes} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{logrado ? '✅' : '⏳'}</span>
                        <span style={{
                          fontSize: '12px',
                          color: logrado ? '#4ade80' : 'var(--text-secondary)',
                          fontWeight: logrado ? 700 : 400,
                        }}>
                          {MESES[m.Mes - 1]}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {logrado ? 'LOGRADO' : `${pct.toFixed(0)}%`}
                        </span>
                      </div>
                    );
                  })}
                  {mesesLogrados.every(m => m.Meta_Venta === 0) && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Ninguna meta definida este año
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ——— Panel Derecho: Calendario ——— */}
          <div className="presupuesto-right-panel">
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Toca un día para registrar su venta
            </div>

            {/* Encabezados días */}
            <div className="presupuesto-week-grid presupuesto-week-headers" style={{ gap: '4px' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--accent-tertiary)',
                  padding: '4px 0',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grilla de semanas */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Cargando…</div>
            ) : (
              semanas.map((semana, si) => (
                <div key={si} className="presupuesto-week-grid">
                  {semana.map((dia, di) => {
                    if (!dia) {
                      return (
                        <div key={di} className="presupuesto-empty-day" style={{
                          height: '95px',
                          background: 'rgba(255,255,255,0.01)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.03)',
                        }} />
                      );
                    }
                    const v = ventasMap[dia];
                    const tieneVenta = v && (v.Venta_Sin_IVA > 0 || v.Piezas > 0);
                    const acum = dailyAccum[dia] || { acumVentaSin: 0, acumPiezas: 0 };
                    const esHoy = anio === hoy.getFullYear() && mes === (hoy.getMonth() + 1) && dia === hoy.getDate();
                    
                    // Cálculo de color de avance acumulado
                    const ratio = metaVentaNum > 0 ? (acum.acumVentaSin / metaVentaNum) : 0;
                    const statusColor = ratio < 0.5 ? '#ef4444' : ratio < 1 ? '#f59e0b' : '#22c55e';

                    return (
                      <div
                        key={di}
                        onClick={() => setModalDia(dia)}
                        style={{
                          height: '95px',
                          background: tieneVenta
                            ? 'var(--bg-secondary)'
                            : 'rgba(20,20,30,0.4)',
                          border: esHoy
                            ? '1.5px solid rgba(139,92,246,0.7)'
                            : '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: esHoy ? '0 0 10px rgba(139,92,246,0.2)' : 'none',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                          e.currentTarget.style.zIndex = '2';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = esHoy ? '0 0 10px rgba(139,92,246,0.2)' : 'none';
                          e.currentTarget.style.zIndex = '1';
                        }}
                      >
                        {/* Barra lateral indicadora de color (solo si hay venta) */}
                        {tieneVenta && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            background: statusColor,
                            boxShadow: `1px 0 6px ${statusColor}40`
                          }} />
                        )}

                        {/* Número del día */}
                        <div style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: esHoy ? '#c4b5fd' : 'var(--text-muted)',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>{dia}</span>
                        </div>

                        {tieneVenta ? (
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 8px 6px 12px' }}>
                            {/* Venta del día (Arriba) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'white', fontWeight: 700, lineHeight: 1.1 }}>
                                {formatMoney(v.Venta_Sin_IVA)}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {v.Piezas} pzs
                              </span>
                            </div>

                            {/* Línea divisoria */}
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

                            {/* Acumulado (Abajo) */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                              <span style={{ fontSize: '10px', color: statusColor, fontWeight: 700 }}>
                                Σ {formatMoney(acum.acumVentaSin)}
                              </span>
                              <span style={{ fontSize: '9px', color: statusColor, opacity: 0.8 }}>
                                {acum.acumPiezas}p
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '20px', opacity: 0.05 }}>＋</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de edición del día */}
      {modalDia && (
        <DayModal
          dia={modalDia}
          anio={anio}
          mes={mes}
          tienda={tiendaActual}
          ventasMap={ventasMap}
          onClose={() => setModalDia(null)}
          onSaved={cargarDatos}
        />
      )}
    </div>
  );
}
