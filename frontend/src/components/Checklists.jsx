// =========================================
// Checklists.jsx — Checklists Operativos Diarios
// =========================================
import { useState, useEffect } from 'react';
import {
  obtenerChecklists,
  toggleChecklist,
  agregarTareaChecklist,
  eliminarTareaChecklist,
} from '../services/api';

const CATEGORIAS = {
  1: { label: 'Apertura de Tienda', emoji: '🌅', color: '#22d3ee' },
  2: { label: 'Cierre de Tienda', emoji: '🌙', color: '#818cf8' },
  3: { label: 'Venta Exitosa', emoji: '⭐', color: '#34d399' },
};

export default function Checklists({ rol }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // id_plantilla siendo guardado

  // Admin: agregar tarea
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaCat, setNuevaCat] = useState(1);
  const [nuevaPrio, setNuevaPrio] = useState('Normal');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchChecklists = async () => {
    try {
      const data = await obtenerChecklists();
      setItems(data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChecklists(); }, []);

  const handleToggle = async (id_plantilla, actual) => {
    setSaving(id_plantilla);
    // Optimistic update
    setItems(prev =>
      prev.map(it => it.ID_Plantilla === id_plantilla ? { ...it, completado: !actual } : it)
    );
    try {
      await toggleChecklist(id_plantilla, !actual);
    } catch (_) {
      // Revert
      setItems(prev =>
        prev.map(it => it.ID_Plantilla === id_plantilla ? { ...it, completado: actual } : it)
      );
    } finally {
      setSaving(null);
    }
  };

  const handleAgregar = async () => {
    if (!nuevaDesc.trim()) return;
    setAddLoading(true);
    try {
      await agregarTareaChecklist(nuevaCat, nuevaDesc.trim(), nuevaPrio, nuevasNotas.trim());
      setNuevaDesc('');
      setNuevaPrio('Normal');
      setNuevasNotas('');
      await fetchChecklists();
    } finally {
      setAddLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta tarea del checklist?')) return;
    await eliminarTareaChecklist(id);
    await fetchChecklists();
  };

  const grouped = {};
  for (const cat of Object.keys(CATEGORIAS)) {
    grouped[cat] = items.filter(it => String(it.Categoria) === cat);
  }

  const totalItems = items.length;
  const completados = items.filter(it => it.completado).length;
  const porcentaje = totalItems > 0 ? Math.round((completados / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div className="checklist-loading">
        <div className="checklist-spinner" />
        <p>Cargando checklists...</p>
      </div>
    );
  }

  return (
    <div className="checklist-container">
      {/* Header con progreso global */}
      <div className="checklist-header">
        <div>
          <h2 className="checklist-title">Checklists Operativos</h2>
          <p className="checklist-subtitle">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="checklist-progress-circle">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke={porcentaje === 100 ? '#34d399' : '#d8b4fe'}
              strokeWidth="6"
              strokeDasharray={`${(porcentaje / 100) * 175.9} 175.9`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="checklist-circle-text">
            <span>{porcentaje}%</span>
          </div>
        </div>
      </div>

      {/* Barra de progreso lineal */}
      <div className="checklist-bar-bg">
        <div
          className="checklist-bar-fill"
          style={{
            width: `${porcentaje}%`,
            background: porcentaje === 100
              ? 'linear-gradient(90deg, #34d399, #22d3ee)'
              : 'linear-gradient(90deg, #9333ea, #d8b4fe)',
          }}
        />
      </div>
      <p className="checklist-bar-label">
        {completados} de {totalItems} tareas completadas hoy
      </p>

      {/* Panel agregar tarea (solo admin) */}
      {rol === 'Admin' && (
        <div className="checklist-add-panel">
          <h3 className="checklist-add-title">➕ Agregar Tarea</h3>
          <div className="checklist-add-row" style={{ marginBottom: '10px' }}>
            <select
              value={nuevaCat}
              onChange={e => setNuevaCat(Number(e.target.value))}
              className="checklist-select"
            >
              {Object.entries(CATEGORIAS).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
            <select
              value={nuevaPrio}
              onChange={e => setNuevaPrio(e.target.value)}
              className="checklist-select"
            >
              <option value="Alta">🔴 Alta</option>
              <option value="Normal">🟡 Normal</option>
              <option value="Baja">🔵 Baja</option>
            </select>
            <input
              className="checklist-input"
              placeholder="Descripción de la tarea..."
              value={nuevaDesc}
              onChange={e => setNuevaDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            />
          </div>
          <div className="checklist-add-row">
            <input
              className="checklist-input"
              placeholder="Notas (opcional)..."
              value={nuevasNotas}
              onChange={e => setNuevasNotas(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            />
            <button
              className="checklist-btn-add"
              onClick={handleAgregar}
              disabled={addLoading || !nuevaDesc.trim()}
            >
              {addLoading ? '...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {/* Secciones por categoría */}
      {Object.entries(CATEGORIAS).map(([catNum, catInfo]) => {
        const catItems = grouped[catNum] || [];
        if (catItems.length === 0) return null;
        const catComp = catItems.filter(i => i.completado).length;

        return (
          <div key={catNum} className="checklist-section">
            <div className="checklist-section-header">
              <span style={{ fontSize: '20px' }}>{catInfo.emoji}</span>
              <h3 style={{ color: catInfo.color, margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {catInfo.label}
              </h3>
              <span className="checklist-section-count" style={{ color: catInfo.color }}>
                {catComp}/{catItems.length}
              </span>
            </div>

            <div className="checklist-items">
              {catItems.map(item => (
                <div
                  key={item.ID_Plantilla}
                  className={`checklist-item ${item.completado ? 'done' : ''}`}
                  onClick={() => handleToggle(item.ID_Plantilla, item.completado)}
                  role="checkbox"
                  aria-checked={item.completado}
                  tabIndex={0}
                  onKeyDown={e => e.key === ' ' && handleToggle(item.ID_Plantilla, item.completado)}
                >
                  <div className={`checklist-checkbox ${item.completado ? 'checked' : ''}`}>
                    {saving === item.ID_Plantilla ? (
                      <span className="checklist-saving-dot" />
                    ) : item.completado ? (
                      <span>✓</span>
                    ) : null}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span
                      style={{
                        color: item.completado ? '#666' : '#e0e0e0',
                        textDecoration: item.completado ? 'line-through' : 'none',
                        fontSize: '14px',
                        transition: 'all 0.3s',
                      }}
                    >
                      {item.Descripcion}
                      {item.Prioridad && (
                        <span style={{ 
                          marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', 
                          background: item.Prioridad === 'Alta' ? 'rgba(239,68,68,0.2)' : item.Prioridad === 'Baja' ? 'rgba(59,130,246,0.2)' : 'rgba(234,179,8,0.2)',
                          color: item.Prioridad === 'Alta' ? '#ef4444' : item.Prioridad === 'Baja' ? '#3b82f6' : '#eab308'
                        }}>
                          {item.Prioridad}
                        </span>
                      )}
                    </span>
                    {item.Notas && (
                      <span style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
                        📝 {item.Notas}
                      </span>
                    )}
                  </div>
                  {rol === 'Admin' && (
                    <button
                      className="checklist-btn-del"
                      onClick={e => { e.stopPropagation(); handleEliminar(item.ID_Plantilla); }}
                      title="Eliminar tarea"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <style>{`
        .checklist-container { padding: 0 4px; max-width: 700px; margin: 0 auto; }
        .checklist-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; color: #888; }
        .checklist-spinner { width: 40px; height: 40px; border: 3px solid rgba(216,180,254,0.2); border-top-color: #d8b4fe; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .checklist-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .checklist-title { font-size: 22px; font-weight: 800; color: #d8b4fe; margin: 0 0 4px; }
        .checklist-subtitle { font-size: 13px; color: #888; margin: 0; text-transform: capitalize; }
        .checklist-progress-circle { position: relative; display: flex; align-items: center; justify-content: center; }
        .checklist-circle-text { position: absolute; font-size: 14px; font-weight: 800; color: #d8b4fe; }

        .checklist-bar-bg { height: 8px; border-radius: 6px; background: rgba(255,255,255,0.07); overflow: hidden; margin-bottom: 6px; }
        .checklist-bar-fill { height: 100%; border-radius: 6px; transition: width 0.6s ease; }
        .checklist-bar-label { font-size: 12px; color: #888; margin-bottom: 24px; }

        .checklist-add-panel { background: rgba(216,180,254,0.05); border: 1px solid rgba(216,180,254,0.15); border-radius: 12px; padding: 16px; margin-bottom: 24px; }
        .checklist-add-title { font-size: 14px; color: #d8b4fe; margin: 0 0 12px; font-weight: 700; }
        .checklist-add-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .checklist-select { background: #1e1e2e; border: 1px solid rgba(216,180,254,0.2); border-radius: 8px; color: #e0e0e0; padding: 8px 10px; font-size: 13px; cursor: pointer; }
        .checklist-input { flex: 1; min-width: 200px; background: #1e1e2e; border: 1px solid rgba(216,180,254,0.2); border-radius: 8px; color: #e0e0e0; padding: 8px 12px; font-size: 13px; outline: none; }
        .checklist-input:focus { border-color: #d8b4fe; }
        .checklist-btn-add { background: #9333ea; color: white; border: none; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
        .checklist-btn-add:hover:not(:disabled) { background: #7e22ce; }
        .checklist-btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

        .checklist-section { margin-bottom: 24px; }
        .checklist-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .checklist-section-count { font-size: 12px; margin-left: auto; font-weight: 700; }

        .checklist-items { display: flex; flex-direction: column; gap: 6px; }
        .checklist-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: all 0.2s; user-select: none; }
        .checklist-item:hover { background: rgba(255,255,255,0.07); transform: translateX(3px); }
        .checklist-item.done { background: rgba(52,211,153,0.04); border-color: rgba(52,211,153,0.15); }

        .checklist-checkbox { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(216,180,254,0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.25s; font-size: 12px; color: #fff; font-weight: bold; }
        .checklist-checkbox.checked { background: #34d399; border-color: #34d399; }
        .checklist-saving-dot { width: 8px; height: 8px; background: #d8b4fe; border-radius: 50%; animation: pulse 0.8s infinite; }

        .checklist-btn-del { background: none; border: none; color: #555; cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1; transition: color 0.2s; }
        .checklist-btn-del:hover { color: #ef4444; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
