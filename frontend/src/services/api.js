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

export async function enviarMensaje(pregunta) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ pregunta }),
  });
  return handleResponse(res);
}

// =========================================
// FEEDBACK
// =========================================

export async function enviarFeedback(id_conversacion, es_positivo) {
  const res = await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_conversacion, es_positivo }),
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

