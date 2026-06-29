-- Creación de la base de datos
CREATE DATABASE IF NOT EXISTS sgh_portal;
USE sgh_portal;

-- Tabla de usuarios
CREATE TABLE usuarios (
    ID_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    Usuario VARCHAR(50) NOT NULL UNIQUE,
    Contrasena VARCHAR(255) NOT NULL,
    Nombre_Completo VARCHAR(100),
    Rol VARCHAR(20),
    Fecha_Creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones
CREATE TABLE sesiones (
    ID_Sesion INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario INT,
    Fecha_Login DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario)
);

-- Tabla de manuales
CREATE TABLE manuales (
    ID_Manual INT AUTO_INCREMENT PRIMARY KEY,
    Titulo VARCHAR(150),
    Nombre_Archivo VARCHAR(255) NOT NULL,
    Archivo_PDF LONGBLOB NOT NULL,
    Contenido_Texto TEXT,
    Categoria VARCHAR(100) DEFAULT 'General',
    Version VARCHAR(20),
    Fecha_Carga DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de historial de conversaciones
CREATE TABLE historial_conversaciones (
    ID_Conversacion INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario INT,
    ID_Manual INT,
    Pregunta_Usuario TEXT,
    Respuesta_IA TEXT,
    Fecha_Hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    Fue_Respondida_Con_Manual TINYINT(1),
    FOREIGN KEY (ID_Usuario) REFERENCES usuarios(ID_Usuario),
    FOREIGN KEY (ID_Manual) REFERENCES manuales(ID_Manual)
);

-- Tabla de pendientes de actualización
CREATE TABLE pendientes_actualizacion (
    ID_Pendiente INT AUTO_INCREMENT PRIMARY KEY,
    ID_Conversacion INT,
    Pregunta_Faltante TEXT,
    Estatus VARCHAR(30) DEFAULT 'Pendiente',
    Fecha_Registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Conversacion) REFERENCES historial_conversaciones(ID_Conversacion)
);

-- Inserción del usuario solicitado
INSERT INTO usuarios (Usuario, Contrasena, Nombre_Completo, Rol) 
VALUES ('mx204562', 'sgh12345', 'Moises Garcia', 'Asociado');