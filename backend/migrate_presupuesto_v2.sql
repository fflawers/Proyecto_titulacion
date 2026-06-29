-- ============================================================
-- migrate_presupuesto_v2.sql (v3 — crea tablas si no existen)
-- Compatible con MySQL 9.7
-- ============================================================

-- ——— presupuesto_mensual ———
CREATE TABLE IF NOT EXISTS presupuesto_mensual (
    ID_Presupuesto  INT AUTO_INCREMENT PRIMARY KEY,
    Tienda          VARCHAR(255) NOT NULL,
    Anio            INT NOT NULL,
    Mes             TINYINT NOT NULL,
    Meta_Mensual    DECIMAL(15,2) DEFAULT 0.00,
    Venta_Real      DECIMAL(15,2) DEFAULT 0.00,
    Meta_Venta      DECIMAL(15,2) DEFAULT 0.00,
    Meta_Piezas     INT DEFAULT 0,
    UNIQUE KEY uq_mes (Tienda, Anio, Mes)
);

-- ——— presupuesto_diario ———
CREATE TABLE IF NOT EXISTS presupuesto_diario (
    ID_Diario       INT AUTO_INCREMENT PRIMARY KEY,
    Tienda          VARCHAR(255) NOT NULL,
    Fecha           DATE NOT NULL,
    Meta_Dia        DECIMAL(15,2) DEFAULT 0.00,
    Venta_Real      DECIMAL(15,2) DEFAULT 0.00,
    Venta_Con_IVA   DECIMAL(15,2) DEFAULT 0.00,
    Venta_Sin_IVA   DECIMAL(15,2) DEFAULT 0.00,
    Piezas          INT DEFAULT 0,
    UNIQUE KEY uq_dia (Tienda, Fecha)
);

-- ——— Agregar columnas si las tablas ya existían sin ellas ———

DROP PROCEDURE IF EXISTS add_col_if_missing;

DELIMITER //
CREATE PROCEDURE add_col_if_missing(
    IN tbl_name   VARCHAR(100),
    IN col_name   VARCHAR(100),
    IN col_def    VARCHAR(200)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = tbl_name
          AND COLUMN_NAME  = col_name
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `', col_name, '` ', col_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Columna ', col_name, ' agregada a ', tbl_name) AS resultado;
    ELSE
        SELECT CONCAT('OK: ', col_name, ' ya existe en ', tbl_name) AS resultado;
    END IF;
END //
DELIMITER ;

CALL add_col_if_missing('presupuesto_mensual', 'Meta_Venta',  'DECIMAL(15,2) DEFAULT 0.00');
CALL add_col_if_missing('presupuesto_mensual', 'Meta_Piezas', 'INT DEFAULT 0');
CALL add_col_if_missing('presupuesto_diario',  'Venta_Con_IVA', 'DECIMAL(15,2) DEFAULT 0.00');
CALL add_col_if_missing('presupuesto_diario',  'Venta_Sin_IVA', 'DECIMAL(15,2) DEFAULT 0.00');
CALL add_col_if_missing('presupuesto_diario',  'Piezas',        'INT DEFAULT 0');

DROP PROCEDURE IF EXISTS add_col_if_missing;

SELECT 'Migracion presupuesto completada.' AS resultado;
