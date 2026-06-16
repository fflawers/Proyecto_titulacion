// =========================================
// i18n.js — Internacionalización ES / EN
// =========================================

const translations = {
  es: {
    // Login
    login_title: 'Bienvenido a LUXO',
    login_subtitle: 'Asistente inteligente de Sunglass Hut',
    login_user: 'Usuario',
    login_password: 'Contraseña',
    login_btn: 'Iniciar Sesión',
    login_loading: 'Verificando...',
    login_user_placeholder: 'Tu usuario',
    login_password_placeholder: 'Tu contraseña',

    // Header
    header_welcome: 'Bienvenido,',
    header_admin: '⚙️ Admin',
    header_history: '📋 Mi Historial',
    header_logout: 'Cerrar Sesión',

    // Chat
    chat_placeholder: 'Escribe tu consulta...',
    chat_send: 'Enviar',
    chat_thinking: 'LUXO está pensando...',
    chat_empty_title: '¡Hola! Soy LUXO',
    chat_empty_sub: 'Tu asistente inteligente de Sunglass Hut. Pregúntame lo que necesites sobre los manuales operativos.',
    chat_preview: '👁️ Vista previa:',
    chat_download: '📥 Descargar',

    // Historial panel
    history_title: 'Mi Historial',
    history_empty: 'Aún no tienes consultas registradas.',
    history_loading: 'Cargando historial...',
    history_answer_label: 'Respuesta de LUXO:',
    history_manual: '📄 Manual:',

    // Admin panel
    admin_title: '⚙️ Panel de Administración',
    admin_tab_manuals: '📚 Manuales',
    admin_tab_history: '📋 Historial',
    admin_tab_pending: '⚠️ Sin Respuesta',
    admin_tab_stats: '📊 Estadísticas',
    admin_tab_users: '👥 Usuarios',

    // Manuales
    admin_upload_new: '📤 Cargar Nuevo',
    admin_update: '🔄 Actualizar',
    admin_processing: 'Procesando archivo...',
    admin_upload_hint: 'Arrastra un PDF o Excel aquí o haz click para seleccionar',
    admin_update_hint: 'Arrastra el archivo actualizado o haz click para seleccionar',
    admin_file_types: 'Archivos permitidos: .pdf · .xlsx · .xls',
    admin_loaded: 'Manuales cargados',
    admin_no_manuals: 'No hay manuales cargados',
    admin_delete: '🗑️ Borrar',
    admin_delete_confirm: '¿Seguro que deseas borrar',

    // Historial admin
    admin_history_lock_title: 'Acceso Restringido',
    admin_history_lock_text: 'Ingresa la contraseña de desarrollador para ver el historial de consultas.',
    admin_history_password_placeholder: 'Contraseña...',
    admin_history_unlock: '🔓 Desbloquear',
    admin_history_search: '🔍 Buscar por pregunta, usuario o manual...',
    admin_history_refresh: '🔄 Actualizar',
    admin_history_total: 'Total consultas',
    admin_history_positive: '👍 Positivos',
    admin_history_negative: '👎 Negativos',
    admin_history_users: 'Usuarios',
    admin_history_results: 'resultados encontrados',
    admin_history_last: 'Últimas',
    admin_history_queries: 'consultas',
    admin_history_loading: '⏳ Cargando historial...',
    admin_history_no_results: 'No se encontraron resultados',
    admin_history_empty: 'No hay consultas registradas',
    admin_history_answer: 'Respuesta de LUXO:',

    // Pendientes
    admin_pending_loading: '⏳ Cargando preguntas sin respuesta...',
    admin_pending_empty: '✅ No hay preguntas sin respuesta. ¡LUXO lo está haciendo bien!',
    admin_pending_total: 'preguntas sin respuesta',
    admin_pending_store: '🏪 Tienda:',
    admin_pending_user: '👤',

    // Estadísticas
    stats_total: 'Total Consultas',
    stats_today: 'Hoy',
    stats_week: 'Esta Semana',
    stats_month: 'Este Mes',
    stats_active_users: 'Usuarios Activos',
    stats_satisfaction: 'Satisfacción',
    stats_pending: 'Sin Respuesta',
    stats_top_manuals: 'Top 5 Manuales más Consultados',
    stats_top_users: 'Top 5 Usuarios más Activos',
    stats_chart: 'Consultas — Últimos 7 días',
    stats_queries: 'consultas',
    stats_loading: '⏳ Cargando estadísticas...',
    stats_last_30: '(últimos 30 días)',

    // Usuarios
    users_loading: '⏳ Cargando usuarios...',
    users_empty: 'No hay usuarios registrados.',
    users_store_placeholder: 'Asignar tienda...',
    users_save: 'Guardar',
    users_saved: '✓',
    users_total: 'usuarios registrados',
    users_role: 'Rol:',
    users_store: 'Tienda:',
    users_no_store: 'Sin tienda asignada',
  },

  en: {
    // Login
    login_title: 'Welcome to LUXO',
    login_subtitle: 'Sunglass Hut Smart Assistant',
    login_user: 'Username',
    login_password: 'Password',
    login_btn: 'Sign In',
    login_loading: 'Verifying...',
    login_user_placeholder: 'Your username',
    login_password_placeholder: 'Your password',

    // Header
    header_welcome: 'Welcome,',
    header_admin: '⚙️ Admin',
    header_history: '📋 My History',
    header_logout: 'Sign Out',

    // Chat
    chat_placeholder: 'Type your question...',
    chat_send: 'Send',
    chat_thinking: 'LUXO is thinking...',
    chat_empty_title: 'Hello! I\'m LUXO',
    chat_empty_sub: 'Your Sunglass Hut smart assistant. Ask me anything about the operational manuals.',
    chat_preview: '👁️ Preview:',
    chat_download: '📥 Download',

    // Historial panel
    history_title: 'My History',
    history_empty: 'No queries registered yet.',
    history_loading: 'Loading history...',
    history_answer_label: 'LUXO\'s answer:',
    history_manual: '📄 Manual:',

    // Admin panel
    admin_title: '⚙️ Admin Panel',
    admin_tab_manuals: '📚 Manuals',
    admin_tab_history: '📋 History',
    admin_tab_pending: '⚠️ Unanswered',
    admin_tab_stats: '📊 Statistics',
    admin_tab_users: '👥 Users',

    // Manuales
    admin_upload_new: '📤 Upload New',
    admin_update: '🔄 Update',
    admin_processing: 'Processing file...',
    admin_upload_hint: 'Drag a PDF or Excel here or click to select',
    admin_update_hint: 'Drag the updated file or click to select',
    admin_file_types: 'Allowed files: .pdf · .xlsx · .xls',
    admin_loaded: 'Loaded manuals',
    admin_no_manuals: 'No manuals loaded',
    admin_delete: '🗑️ Delete',
    admin_delete_confirm: 'Are you sure you want to delete',

    // Historial admin
    admin_history_lock_title: 'Restricted Access',
    admin_history_lock_text: 'Enter the developer password to view the query history.',
    admin_history_password_placeholder: 'Password...',
    admin_history_unlock: '🔓 Unlock',
    admin_history_search: '🔍 Search by question, user or manual...',
    admin_history_refresh: '🔄 Refresh',
    admin_history_total: 'Total queries',
    admin_history_positive: '👍 Positive',
    admin_history_negative: '👎 Negative',
    admin_history_users: 'Users',
    admin_history_results: 'results found',
    admin_history_last: 'Last',
    admin_history_queries: 'queries',
    admin_history_loading: '⏳ Loading history...',
    admin_history_no_results: 'No results found',
    admin_history_empty: 'No queries registered',
    admin_history_answer: 'LUXO\'s answer:',

    // Pendientes
    admin_pending_loading: '⏳ Loading unanswered questions...',
    admin_pending_empty: '✅ No unanswered questions. LUXO is doing great!',
    admin_pending_total: 'unanswered questions',
    admin_pending_store: '🏪 Store:',
    admin_pending_user: '👤',

    // Estadísticas
    stats_total: 'Total Queries',
    stats_today: 'Today',
    stats_week: 'This Week',
    stats_month: 'This Month',
    stats_active_users: 'Active Users',
    stats_satisfaction: 'Satisfaction',
    stats_pending: 'Unanswered',
    stats_top_manuals: 'Top 5 Most Consulted Manuals',
    stats_top_users: 'Top 5 Most Active Users',
    stats_chart: 'Queries — Last 7 days',
    stats_queries: 'queries',
    stats_loading: '⏳ Loading statistics...',
    stats_last_30: '(last 30 days)',

    // Usuarios
    users_loading: '⏳ Loading users...',
    users_empty: 'No users registered.',
    users_store_placeholder: 'Assign store...',
    users_save: 'Save',
    users_saved: '✓',
    users_total: 'registered users',
    users_role: 'Role:',
    users_store: 'Store:',
    users_no_store: 'No store assigned',
  },
};

// Idioma activo — se lee de localStorage (default: 'es')
let currentLang = localStorage.getItem('luxo_lang') || 'es';

/**
 * Traduce una clave al idioma activo.
 * @param {string} key — Clave de traducción
 * @returns {string}
 */
export function t(key) {
  return (translations[currentLang] || translations['es'])[key] || key;
}

/**
 * Cambia el idioma activo y lo persiste en localStorage.
 * @param {'es'|'en'} lang
 */
export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('luxo_lang', lang);
  }
}

/** Retorna el idioma activo ('es' o 'en'). */
export function getLang() {
  return currentLang;
}
