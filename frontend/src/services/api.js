// =========================================
// api.js — Cliente HTTP para el backend
// =========================================

const API_URL = '';

// =========================================
// HELPERS
// =========================================

function getToken() {
  return localStorage.getItem('luxo_token');
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Error en el servidor');
  }
  return data;
}

// =========================================
// AUTH
// =========================================

export async function login(usuario, contrasena) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, contrasena }),
  });
  return handleResponse(res);
}

export async function getMe() {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

// =========================================
// CHAT
// =========================================

export async function enviarMensaje(pregunta, idioma = 'es', file = null) {
  const formData = new FormData();
  formData.append('pregunta', pregunta);
  formData.append('idioma', idioma);
  if (file) {
    formData.append('archivo', file);
  }

  const headers = getHeaders();
  // Remove Content-Type so fetch can set the correct boundary for multipart/form-data
  delete headers['Content-Type'];

  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: headers,
    body: formData,
  });
  return handleResponse(res);
}

// =========================================
// FEEDBACK
// =========================================

export async function enviarFeedback(id_conversacion, es_positivo, comentario = null) {
  const res = await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_conversacion, es_positivo, comentario }),
  });
  return handleResponse(res);
}

// =========================================
// MANUALES
// =========================================

export async function obtenerManuales() {
  const res = await fetch(`${API_URL}/api/manuales`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function subirPDF(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${API_URL}/api/manuales/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: formData,
  });
  return handleResponse(res);
}

export async function actualizarPDF(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${API_URL}/api/manuales/update`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: formData,
  });
  return handleResponse(res);
}

export async function borrarManual(id) {
  const res = await fetch(`${API_URL}/api/manuales/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function toggleManualAbierto(id) {
  const res = await fetch(`${API_URL}/api/admin/manuales/${id}/toggle-abierto`, {
    method: 'PUT',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export function getDownloadUrl(id) {
  return `${API_URL}/api/manuales/${id}/download?token=${getToken()}`;
}

export async function obtenerHistorialAdmin(limite = 100, password = '') {
  const res = await fetch(
    `${API_URL}/api/admin/historial?limite=${limite}&x_historial_password=${encodeURIComponent(password)}`,
    { headers: getHeaders() }
  );
  return handleResponse(res);
}

export async function verificarPasswordHistorial(password) {
  const res = await fetch(`${API_URL}/api/admin/verify-historial`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ password }),
  });
  return handleResponse(res);
}

// =========================================
// SUGERENCIAS
// =========================================

export async function enviarSugerencia(sugerencia) {
  const res = await fetch(`${API_URL}/api/sugerencias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ sugerencia }),
  });
  return handleResponse(res);
}

export async function obtenerSugerenciasAdmin() {
  const res = await fetch(`${API_URL}/api/admin/sugerencias`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

// =========================================
// SESSION
// =========================================

export function saveSession(token, nombre, rol) {
  localStorage.setItem('luxo_token', token);
  localStorage.setItem('luxo_nombre', nombre);
  localStorage.setItem('luxo_rol', rol);
}

export function getSession() {
  const token = localStorage.getItem('luxo_token');
  if (!token) return null;
  return {
    token,
    nombre: localStorage.getItem('luxo_nombre') || '',
    rol: localStorage.getItem('luxo_rol') || '',
  };
}

export function clearSession() {
  localStorage.removeItem('luxo_token');
  localStorage.removeItem('luxo_nombre');
  localStorage.removeItem('luxo_rol');
}


// =========================================
// HISTORIAL DEL USUARIO PROPIO
// =========================================

export async function obtenerHistorialPropio(limite = 50) {
  const res = await fetch(`${API_URL}/api/historial/me?limite=${limite}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}


// =========================================
// ADMIN — PENDIENTES, ESTADÍSTICAS, USUARIOS
// =========================================

export async function obtenerPendientes(limite = 200) {
  const res = await fetch(
    `${API_URL}/api/admin/pendientes?limite=${limite}`,
    { headers: getHeaders() }
  );
  return handleResponse(res);
}

export async function obtenerEstadisticas() {
  const res = await fetch(`${API_URL}/api/admin/estadisticas`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function obtenerUsuariosAdmin() {
  const res = await fetch(`${API_URL}/api/admin/usuarios`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function actualizarTiendaUsuario(id, tienda) {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/tienda`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ tienda }),
  });
  return handleResponse(res);
}

export async function reindexarManuales() {
  const res = await fetch(`${API_URL}/api/admin/reindexar`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}


// =========================================
// NOTIFICACIONES
// =========================================

export async function obtenerNotificaciones() {
  const res = await fetch(`${API_URL}/api/notificaciones`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function contarNoLeidas() {
  const res = await fetch(`${API_URL}/api/notificaciones/no-leidas-count`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function marcarNotificacionesLeidas() {
  const res = await fetch(`${API_URL}/api/notificaciones/marcar-leidas`, {
    method: 'POST', headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function enviarNotificacionAdmin(id_usuario, titulo, cuerpo, tipo = 'general') {
  const res = await fetch(`${API_URL}/api/admin/notificaciones`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_usuario, titulo, cuerpo, tipo }),
  });
  return handleResponse(res);
}

export async function enviarNotificacionRol(rol, titulo, cuerpo, tipo = 'general') {
  const res = await fetch(`${API_URL}/api/admin/notificaciones/rol`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ rol, titulo, cuerpo, tipo }),
  });
  return handleResponse(res);
}


// =========================================
// SESIONES
// =========================================

export async function obtenerSesionesAdmin(limite = 50) {
  const res = await fetch(`${API_URL}/api/admin/sesiones?limite=${limite}`, { headers: getHeaders() });
  return handleResponse(res);
}


// =========================================
// TICKETS
// =========================================

export async function crearTicket(detalle) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ detalle }),
  });
  return handleResponse(res);
}

export async function obtenerMisTickets() {
  const res = await fetch(`${API_URL}/api/tickets/mis-tickets`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerTicketsAdmin() {
  const res = await fetch(`${API_URL}/api/admin/tickets`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function resolverTicket(id_ticket, respuesta) {
  const res = await fetch(`${API_URL}/api/admin/tickets/${id_ticket}/resolver`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ respuesta }),
  });
  return handleResponse(res);
}

export async function cambiarPrioridadTicket(id_ticket, prioridad) {
  const res = await fetch(`${API_URL}/api/admin/tickets/${id_ticket}/prioridad`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ prioridad }),
  });
  return handleResponse(res);
}


// =========================================
// CHECKLISTS
// =========================================

export async function obtenerChecklists() {
  const res = await fetch(`${API_URL}/api/checklists`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function toggleChecklist(id_plantilla, completado) {
  const res = await fetch(`${API_URL}/api/checklists/toggle`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_plantilla, completado }),
  });
  return handleResponse(res);
}

export async function agregarTareaChecklist(categoria, descripcion, prioridad = 'Normal', notas = null) {
  const res = await fetch(`${API_URL}/api/admin/checklists/tarea`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ categoria, descripcion, prioridad, notas }),
  });
  return handleResponse(res);
}

export async function eliminarTareaChecklist(id_plantilla) {
  const res = await fetch(`${API_URL}/api/admin/checklists/tarea/${id_plantilla}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
}


// =========================================
// TAREAS CONSOLIDADAS
// =========================================

export async function obtenerTareas() {
  const res = await fetch(`${API_URL}/api/tareas`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function responderTarea(id_tarea, respuestas) {
  const res = await fetch(`${API_URL}/api/tareas/responder`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_tarea, respuestas }),
  });
  return handleResponse(res);
}

export async function crearTareaAdmin(titulo, descripcion, fecha_limite, plantilla) {
  const formData = new FormData();
  let url = `${API_URL}/api/admin/tareas/crear?titulo=${encodeURIComponent(titulo)}`;
  if (descripcion) url += `&descripcion=${encodeURIComponent(descripcion)}`;
  if (fecha_limite) url += `&fecha_limite=${encodeURIComponent(fecha_limite)}`;
  if (plantilla) formData.append('plantilla', plantilla);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: plantilla ? formData : undefined,
  });
  return handleResponse(res);
}

export async function obtenerRespuestasTarea(id_tarea) {
  const res = await fetch(`${API_URL}/api/admin/tareas/${id_tarea}/respuestas`, { headers: getHeaders() });
  return handleResponse(res);
}

export function getConsolidadoUrl(id_tarea) {
  return `${API_URL}/api/admin/tareas/${id_tarea}/consolidado?token=${getToken()}`;
}


// =========================================
// CAMPAÑAS
// =========================================

export async function obtenerCampanaActiva() {
  const res = await fetch(`${API_URL}/api/campanas`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerTodasCampanas() {
  const res = await fetch(`${API_URL}/api/campanas/todas`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerFotosGuia(id_campana, segmento) {
  let url = `${API_URL}/api/campanas/${id_campana}/fotos-guia`;
  if (segmento) url += `?segmento=${encodeURIComponent(segmento)}`;
  const res = await fetch(url, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerMiEntrega(id_campana) {
  const res = await fetch(`${API_URL}/api/campanas/${id_campana}/mi-entrega`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function subirFotoTienda(id_campana, id_foto_guia, foto) {
  const formData = new FormData();
  formData.append('foto', foto);
  const res = await fetch(
    `${API_URL}/api/campanas/${id_campana}/fotos?id_foto_guia=${id_foto_guia}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    }
  );
  return handleResponse(res);
}

export async function crearCampanaAdmin(nombre, descripcion, guia_pdf) {
  const formData = new FormData();
  let url = `${API_URL}/api/admin/campanas/crear?nombre=${encodeURIComponent(nombre)}`;
  if (descripcion) url += `&descripcion=${encodeURIComponent(descripcion)}`;
  if (guia_pdf) formData.append('guia_pdf', guia_pdf);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: guia_pdf ? formData : undefined,
  });
  return handleResponse(res);
}

export async function agregarFotoGuia(id_campana, nombre_foto, instrucciones, segmento, imagen) {
  const formData = new FormData();
  formData.append('imagen', imagen);
  let url = `${API_URL}/api/admin/campanas/${id_campana}/fotos-guia`;
  url += `?nombre_foto=${encodeURIComponent(nombre_foto)}`;
  url += `&instrucciones=${encodeURIComponent(instrucciones || '')}`;
  url += `&segmento=${encodeURIComponent(segmento || 'Todos')}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: formData,
  });
  return handleResponse(res);
}

export async function obtenerEntregasCampana(id_campana) {
  const res = await fetch(`${API_URL}/api/admin/campanas/${id_campana}/entregas`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerDetalleEntrega(id_entrega) {
  const res = await fetch(`${API_URL}/api/admin/campanas/entregas/${id_entrega}/detalle`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function darVistoBueno(id_entrega) {
  const res = await fetch(`${API_URL}/api/admin/campanas/entregas/${id_entrega}/visto-bueno`, {
    method: 'PUT',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function obtenerResumenCampanaTiendas(id_campana) {
  const res = await fetch(`${API_URL}/api/admin/campanas/${id_campana}/resumen-tiendas`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function depurarFotos() {
  const res = await fetch(`${API_URL}/api/admin/campanas/depurar-fotos`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function verificarGeminiStatus() {
  const res = await fetch(`${API_URL}/api/admin/gemini-status`, { headers: getHeaders() });
  return handleResponse(res);
}


// =========================================
// PRESUPUESTO
// =========================================

export async function obtenerPresupuestoMensual(anio, mes) {
  const res = await fetch(`${API_URL}/api/presupuesto/mensual?anio=${anio}&mes=${mes}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function upsertPresupuestoMensual(anio, mes, meta, venta_real = 0) {
  const res = await fetch(`${API_URL}/api/presupuesto/mensual`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ anio, mes, meta, venta_real }),
  });
  return handleResponse(res);
}

// --- Presupuesto Operativo completo (Meta_Venta, Meta_Piezas, ventas diarias) ---

export async function obtenerMetasPresupuesto(anio, mes, tienda = null) {
  const params = new URLSearchParams({ anio, mes });
  if (tienda) params.append('tienda', tienda);
  const res = await fetch(`${API_URL}/api/presupuesto/metas?${params}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function guardarMetasPresupuesto(anio, mes, meta_venta, meta_piezas, tienda = null) {
  const res = await fetch(`${API_URL}/api/presupuesto/metas`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ anio, mes, meta_venta, meta_piezas, tienda }),
  });
  return handleResponse(res);
}

export async function obtenerVentasDiarias(anio, mes, tienda = null) {
  const params = new URLSearchParams({ anio, mes });
  if (tienda) params.append('tienda', tienda);
  const res = await fetch(`${API_URL}/api/presupuesto/ventas-diarias?${params}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function guardarVentaDiaria(fecha, venta_con_iva, piezas, tienda = null) {
  const res = await fetch(`${API_URL}/api/presupuesto/venta-diaria`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ fecha, venta_con_iva, piezas, tienda }),
  });
  return handleResponse(res);
}

export async function obtenerMesesLogrados(anio, tienda = null) {
  const params = new URLSearchParams({ anio });
  if (tienda) params.append('tienda', tienda);
  const res = await fetch(`${API_URL}/api/presupuesto/meses-logrados?${params}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function obtenerTiendasConZona() {
  const res = await fetch(`${API_URL}/api/presupuesto/tiendas`, { headers: getHeaders() });
  return handleResponse(res);
}

// =========================================
// PENDIENTES — RESOLVER
// =========================================

export async function resolverPendiente(idPendiente) {
  const res = await fetch(`${API_URL}/api/pendientes/${idPendiente}/resolver`, {
    method: 'PUT',
    headers: getHeaders(),
  });
  return handleResponse(res);
}
