-- =========================================
-- Migración: Añadir campo Tienda a usuarios
-- Ejecutar una sola vez en la BD sgh_portal
-- =========================================

-- 1. Añadir columna Tienda si no existe
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS Tienda VARCHAR(100) DEFAULT NULL;

-- 2. Verificar que la tabla pendientes_actualizacion existe con los campos necesarios
--    (ya debería existir, esto es solo para asegurar)
CREATE TABLE IF NOT EXISTS pendientes_actualizacion (
  ID_Pendiente      INT AUTO_INCREMENT PRIMARY KEY,
  ID_Conversacion   INT NOT NULL,
  Pregunta_Faltante TEXT NOT NULL,
  Fecha_Registro    DATETIME DEFAULT NOW(),
  Resuelto          TINYINT(1) DEFAULT 0
);

-- 3. Confirmar cambios
SELECT 'Migración completada: columna Tienda añadida a usuarios' AS mensaje;
