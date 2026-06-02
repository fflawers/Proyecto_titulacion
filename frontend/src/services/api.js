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
