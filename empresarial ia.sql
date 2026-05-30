-- =========================================
-- Base de datos LUXO — Sunglass Hut
-- =========================================

CREATE DATABASE IF NOT EXISTS sgh_portal;
USE sgh_portal;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    ID_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    Usuario VARCHAR(50) NOT NULL UNIQUE,
    Contrasena VARCHAR(255) NOT NULL,
    Nombre_Completo VARCHAR(100),
    Rol VARCHAR(20),
    Fecha_Creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    ID_Sesion INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario INT,
    Fecha_Login DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario)
);

-- Tabla de manuales (sincronizada con el código)
CREATE TABLE IF NOT EXISTS manuales (
    ID_Manual INT AUTO_INCREMENT PRIMARY KEY,
    Titulo VARCHAR(150),
    Nombre_Archivo VARCHAR(255),
    Archivo_PDF LONGBLOB,
    Contenido_Texto LONGTEXT,
    Categoria VARCHAR(50) DEFAULT 'General',
    Version VARCHAR(20) DEFAULT '1.0',
    Fecha_Carga DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de historial de conversaciones
CREATE TABLE IF NOT EXISTS historial_conversaciones (
    ID_Conversacion INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario INT,
    ID_Manual INT NULL,
    Pregunta_Usuario TEXT,
    Respuesta_IA TEXT,
    Fecha_Hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    Fue_Respondida_Con_Manual TINYINT(1),
    FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario),
    FOREIGN KEY (ID_Manual) REFERENCES manuales(ID_Manual) ON DELETE SET NULL
);

-- Tabla de pendientes de actualización
CREATE TABLE IF NOT EXISTS pendientes_actualizacion (
    ID_Pendiente INT AUTO_INCREMENT PRIMARY KEY,
    ID_Conversacion INT,
    Pregunta_Faltante TEXT,
    Estatus VARCHAR(30) DEFAULT 'Pendiente',
    Fecha_Registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Conversacion) REFERENCES historial_conversaciones(ID_Conversacion)
);

-- Tabla de feedback (NUEVA — para aprendizaje continuo)
CREATE TABLE IF NOT EXISTS feedback_respuestas (
    ID_Feedback INT AUTO_INCREMENT PRIMARY KEY,
    ID_Conversacion INT UNIQUE,
    Es_Positivo TINYINT(1) NOT NULL,
    Fecha_Feedback DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Conversacion) REFERENCES historial_conversaciones(ID_Conversacion)
);

-- =========================================
-- MIGRACIÓN: Agregar columnas si no existen
-- (ejecutar si la BD ya existe)
-- =========================================

-- ALTER TABLE manuales ADD COLUMN IF NOT EXISTS Nombre_Archivo VARCHAR(255) AFTER Titulo;
-- ALTER TABLE manuales ADD COLUMN IF NOT EXISTS Archivo_PDF LONGBLOB AFTER Nombre_Archivo;
-- ALTER TABLE manuales ADD COLUMN IF NOT EXISTS Categoria VARCHAR(50) DEFAULT 'General' AFTER Contenido_Texto;
-- ALTER TABLE manuales MODIFY COLUMN Contenido_Texto LONGTEXT;

-- =========================================
-- Usuario de prueba
-- =========================================

INSERT IGNORE INTO usuarios (Usuario, Contrasena, Nombre_Completo, Rol)
VALUES ('mx204562', 'sgh12345', 'Moises Garcia', 'Asociado');

-- Usuario admin de prueba
INSERT IGNORE INTO usuarios (Usuario, Contrasena, Nombre_Completo, Rol)
VALUES ('admin', 'admin123', 'Administrador', 'Admin');