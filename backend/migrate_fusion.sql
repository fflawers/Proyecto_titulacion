-- ============================================================
-- migrate_fusion.sql
-- Script de migración: fusión ProyectoTitulacionMoy → Proyecto_Titulacion
-- Ejecutar UNA SOLA VEZ sobre la BD sgh_portal (o la que uses)
-- ============================================================

-- 1. Columnas extra en tabla usuarios (si no existen)
ALTER TABLE usuarios
  ADD COLUMN Zona VARCHAR(100) DEFAULT NULL,
  ADD COLUMN Segmento VARCHAR(100) DEFAULT NULL;

-- 2. Columna Comentario_Feedback en historial_conversaciones
ALTER TABLE historial_conversaciones
  ADD COLUMN Comentario_Feedback TEXT DEFAULT NULL;

-- 3. Columna Categoria en pendientes_actualizacion
ALTER TABLE pendientes_actualizacion
  ADD COLUMN Categoria VARCHAR(100) DEFAULT NULL;

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  ID_Notificacion INT AUTO_INCREMENT PRIMARY KEY,
  ID_Usuario      INT NOT NULL,
  Titulo          VARCHAR(255) NOT NULL,
  Cuerpo          TEXT,
  Tipo            VARCHAR(50) DEFAULT 'general',
  Leida           TINYINT(1) DEFAULT 0,
  Fecha_Hora      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario) ON DELETE CASCADE
);

-- ============================================================
-- SESIONES / LOG DE LOGINS
-- ============================================================
CREATE TABLE IF NOT EXISTS sesiones (
  ID_Sesion        INT AUTO_INCREMENT PRIMARY KEY,
  ID_Usuario       INT NOT NULL,
  Fecha_Login      DATETIME DEFAULT CURRENT_TIMESTAMP,
  Direccion_IP     VARCHAR(64) DEFAULT NULL,
  Ubicacion_Ciudad VARCHAR(100) DEFAULT NULL,
  Ubicacion_Pais   VARCHAR(100) DEFAULT NULL,
  FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario) ON DELETE CASCADE
);

-- ============================================================
-- TICKETS DE SOPORTE
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets_soporte (
  ID_Ticket        INT AUTO_INCREMENT PRIMARY KEY,
  ID_Usuario       INT NOT NULL,
  Detalle_Problema TEXT NOT NULL,
  Respuesta_Soporte TEXT DEFAULT NULL,
  Estatus          VARCHAR(50) DEFAULT 'Abierto',
  Fecha_Creacion   DATETIME DEFAULT CURRENT_TIMESTAMP,
  Fecha_Resolucion DATETIME DEFAULT NULL,
  FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario) ON DELETE CASCADE
);

-- ============================================================
-- CHECKLISTS OPERATIVOS
-- ============================================================
CREATE TABLE IF NOT EXISTS plantillas_checklist (
  ID_Plantilla INT AUTO_INCREMENT PRIMARY KEY,
  Categoria    TINYINT NOT NULL COMMENT '1=Apertura, 2=Cierre, 3=Venta Exitosa',
  Descripcion  VARCHAR(500) NOT NULL,
  Activo       TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS registro_checklist (
  ID_Registro  INT AUTO_INCREMENT PRIMARY KEY,
  ID_Usuario   INT NOT NULL,
  ID_Plantilla INT NOT NULL,
  Completado   TINYINT(1) DEFAULT 0,
  Fecha        DATE NOT NULL,
  Fecha_Hora   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registro (ID_Usuario, ID_Plantilla, Fecha),
  FOREIGN KEY (ID_Usuario)   REFERENCES usuarios(ID_Usuario)             ON DELETE CASCADE,
  FOREIGN KEY (ID_Plantilla) REFERENCES plantillas_checklist(ID_Plantilla) ON DELETE CASCADE
);

-- ============================================================
-- TAREAS CONSOLIDADAS (con plantilla Excel)
-- ============================================================
CREATE TABLE IF NOT EXISTS tareas (
  ID_Tarea         INT AUTO_INCREMENT PRIMARY KEY,
  Titulo           VARCHAR(255) NOT NULL,
  Descripcion      TEXT DEFAULT NULL,
  Plantilla_Bytes  LONGBLOB DEFAULT NULL,
  Nombre_Plantilla VARCHAR(255) DEFAULT NULL,
  Columnas_JSON    TEXT DEFAULT NULL COMMENT 'JSON array de columnas del Excel',
  Fecha_Limite     DATETIME DEFAULT NULL,
  Estatus          VARCHAR(50) DEFAULT 'Activa' COMMENT 'Activa | Cerrada',
  Fecha_Creacion   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS respuestas_tarea (
  ID_Respuesta   INT AUTO_INCREMENT PRIMARY KEY,
  ID_Tarea       INT NOT NULL,
  ID_Usuario     INT NOT NULL,
  Tienda         VARCHAR(255) DEFAULT NULL,
  Respuestas_JSON TEXT NOT NULL COMMENT 'JSON key-value de columnas->valores',
  Fecha_Envio    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_respuesta (ID_Tarea, ID_Usuario),
  FOREIGN KEY (ID_Tarea)   REFERENCES tareas(ID_Tarea)     ON DELETE CASCADE,
  FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario) ON DELETE CASCADE
);

-- ============================================================
-- CAMPAÑAS DE EXHIBICIÓN (Foto-Auditoría IA)
-- ============================================================
CREATE TABLE IF NOT EXISTS campanas (
  ID_Campana      INT AUTO_INCREMENT PRIMARY KEY,
  Nombre          VARCHAR(255) NOT NULL,
  Descripcion     TEXT DEFAULT NULL,
  Guia_PDF_Nombre VARCHAR(255) DEFAULT NULL,
  Guia_PDF_Bytes  LONGBLOB DEFAULT NULL,
  Estatus         VARCHAR(50) DEFAULT 'Activa' COMMENT 'Activa | Cerrada',
  Fecha_Creacion  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campana_fotos_guia (
  ID_Foto_Guia  INT AUTO_INCREMENT PRIMARY KEY,
  ID_Campana    INT NOT NULL,
  Nombre_Foto   VARCHAR(255) NOT NULL,
  Instrucciones TEXT DEFAULT NULL,
  Imagen_Bytes  LONGBLOB NOT NULL,
  Segmento      VARCHAR(100) DEFAULT 'Todos',
  FOREIGN KEY (ID_Campana) REFERENCES campanas(ID_Campana) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campana_entregas_tienda (
  ID_Entrega   INT AUTO_INCREMENT PRIMARY KEY,
  ID_Campana   INT NOT NULL,
  Tienda       VARCHAR(255) NOT NULL,
  ID_Usuario   INT NOT NULL,
  Estatus      VARCHAR(50) DEFAULT 'Pendiente'
                 COMMENT 'Pendiente | Auditando | Aprobado_IA | Rechazado_IA | Visto_Bueno',
  Fecha_Envio  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entrega (ID_Campana, Tienda),
  FOREIGN KEY (ID_Campana) REFERENCES campanas(ID_Campana) ON DELETE CASCADE,
  FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campana_fotos_tienda (
  ID_Foto_Tienda    INT AUTO_INCREMENT PRIMARY KEY,
  ID_Entrega        INT NOT NULL,
  ID_Foto_Guia      INT NOT NULL,
  Imagen_Bytes      LONGBLOB DEFAULT NULL,
  Estatus_Auditoria VARCHAR(50) DEFAULT 'Auditando'
                      COMMENT 'Auditando | Aprobado | Corregir',
  Resultado_IA      TEXT DEFAULT NULL,
  Fecha_Auditoria   DATETIME DEFAULT NULL,
  UNIQUE KEY uq_foto (ID_Entrega, ID_Foto_Guia),
  FOREIGN KEY (ID_Entrega)   REFERENCES campana_entregas_tienda(ID_Entrega) ON DELETE CASCADE,
  FOREIGN KEY (ID_Foto_Guia) REFERENCES campana_fotos_guia(ID_Foto_Guia)   ON DELETE CASCADE
);

-- ============================================================
-- PRESUPUESTO MENSUAL Y DIARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS presupuesto_mensual (
  ID_Presupuesto  INT AUTO_INCREMENT PRIMARY KEY,
  Tienda          VARCHAR(255) NOT NULL,
  Anio            INT NOT NULL,
  Mes             TINYINT NOT NULL,
  Meta_Mensual    DECIMAL(15,2) DEFAULT 0,
  Venta_Real      DECIMAL(15,2) DEFAULT 0,
  UNIQUE KEY uq_mes (Tienda, Anio, Mes)
);

CREATE TABLE IF NOT EXISTS presupuesto_diario (
  ID_Dia        INT AUTO_INCREMENT PRIMARY KEY,
  Tienda        VARCHAR(255) NOT NULL,
  Fecha         DATE NOT NULL,
  Meta_Dia      DECIMAL(15,2) DEFAULT 0,
  Venta_Real    DECIMAL(15,2) DEFAULT 0,
  UNIQUE KEY uq_dia (Tienda, Fecha)
);

-- ============================================================
-- Insertar tareas de ejemplo en checklists (si la tabla está vacía)
-- ============================================================
INSERT IGNORE INTO plantillas_checklist (ID_Plantilla, Categoria, Descripcion) VALUES
  (1, 1, 'Revisar niveles de caja y efectivo inicial'),
  (2, 1, 'Verificar que todos los exhibidores estén limpios y ordenados'),
  (3, 1, 'Confirmar que el sistema POS esté operativo'),
  (4, 1, 'Revisar inventario de productos en exhibición'),
  (5, 1, 'Encender iluminación y música ambiental'),
  (6, 2, 'Realizar conteo de efectivo y cierre de caja'),
  (7, 2, 'Limpiar y cubrir los exhibidores'),
  (8, 2, 'Registrar ventas del día en el sistema'),
  (9, 2, 'Verificar que el local quede asegurado'),
  (10, 2, 'Reportar incidencias del día al jefe zonal'),
  (11, 3, 'Ofrecer prueba de los productos al cliente'),
  (12, 3, 'Presentar las opciones de garantía disponibles'),
  (13, 3, 'Verificar disponibilidad del producto deseado'),
  (14, 3, 'Registrar la venta correctamente en el sistema'),
  (15, 3, 'Entregar bolsa y comprobante al cliente');

SELECT 'Migración completada exitosamente.' AS resultado;
