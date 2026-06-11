-- =========================================
-- Migración: Soporte de archivos Excel
-- Ejecutar en tu base de datos MySQL
-- =========================================

-- 1. Agregar columna para el binario del archivo Excel
ALTER TABLE manuales
    ADD COLUMN Archivo_Excel LONGBLOB NULL COMMENT 'Binario del archivo Excel (.xlsx/.xls)';

-- 2. Agregar columna para distinguir el tipo de archivo
ALTER TABLE manuales
    ADD COLUMN Tipo_Archivo VARCHAR(10) NOT NULL DEFAULT 'PDF'
    COMMENT 'Tipo de archivo: PDF o EXCEL';

-- 3. Marcar los registros existentes como PDF
UPDATE manuales SET Tipo_Archivo = 'PDF' WHERE Archivo_PDF IS NOT NULL;
