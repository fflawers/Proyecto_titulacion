# =========================================
# database.py — Módulo de Base de Datos
# =========================================

import mysql.connector
from config import DB_CONFIG


def conectar_db():
    """Establece conexión con MySQL."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Exception as e:
        print("ERROR MYSQL:", e)
        return None


# =========================================
# AUTENTICACIÓN
# =========================================

def buscar_usuario(usuario):
    """Busca un usuario por nombre. Retorna dict con datos o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Usuario, Nombre_Completo, Rol, Contrasena, Tienda
            FROM usuarios
            WHERE Usuario = %s
            """,
            (usuario,),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR BUSCAR USUARIO:", e)
        return None
    finally:
        db.close()


def usuario_existe(usuario):
    """Verifica si un usuario existe (para mensajes de error específicos)."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "SELECT ID_Usuario FROM usuarios WHERE Usuario = %s",
            (usuario,),
        )
        return cursor.fetchone() is not None
    except Exception as e:
        print("ERROR VERIFICAR USUARIO:", e)
        return False
    finally:
        db.close()


def actualizar_contrasena_hash(id_usuario, hash_contrasena):
    """Actualiza la contraseña de un usuario con su hash bcrypt."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE usuarios SET Contrasena = %s WHERE ID_Usuario = %s",
            (hash_contrasena, id_usuario),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR ACTUALIZAR HASH:", e)
        return False
    finally:
        db.close()


# =========================================
# MANUALES
# =========================================

def obtener_manuales():
    """Retorna lista de todos los manuales (metadata, sin binario)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Manual, Titulo, Nombre_Archivo, Version,
                   Contenido_Texto, Categoria, Tipo_Archivo
            FROM manuales
            ORDER BY Nombre_Archivo
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER MANUALES:", e)
        return []
    finally:
        db.close()


def obtener_manuales_listado():
    """Retorna lista ligera de manuales (sin texto ni binario)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Manual, Nombre_Archivo, Titulo, Version
            FROM manuales
            ORDER BY Nombre_Archivo
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR LISTAR MANUALES:", e)
        return []
    finally:
        db.close()


def insertar_manual(nombre_archivo, pdf_binario, texto_extraido):
    """Inserta un nuevo manual en la BD. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO manuales
        (Titulo, Nombre_Archivo, Archivo_PDF, Contenido_Texto, Categoria, Version)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            sql,
            (nombre_archivo, nombre_archivo, pdf_binario, texto_extraido, "General", "1.0"),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR INSERTAR MANUAL:", e)
        return None
    finally:
        db.close()


def actualizar_manual_pdf(id_manual, pdf_binario, texto_extraido, nueva_version):
    """Actualiza el PDF y texto de un manual existente."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE manuales
            SET Archivo_PDF = %s, Contenido_Texto = %s, Version = %s
            WHERE ID_Manual = %s
            """,
            (pdf_binario, texto_extraido, nueva_version, id_manual),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR ACTUALIZAR MANUAL:", e)
        return False
    finally:
        db.close()


def buscar_manual_por_nombre(nombre_archivo):
    """Busca un manual por nombre de archivo (case-insensitive)."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT ID_Manual, Version FROM manuales WHERE UPPER(Nombre_Archivo) = UPPER(%s)",
            (nombre_archivo,),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR BUSCAR MANUAL:", e)
        return None
    finally:
        db.close()


def borrar_manual(id_manual):
    """Borra un manual y desvincula su historial."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        # Desvincular historial (FK constraint)
        cursor.execute(
            "UPDATE historial_conversaciones SET ID_Manual = NULL WHERE ID_Manual = %s",
            (id_manual,),
        )
        cursor.execute(
            "DELETE FROM manuales WHERE ID_Manual = %s",
            (id_manual,),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR BORRAR MANUAL:", e)
        return False
    finally:
        db.close()


def obtener_pdf_binario(id_manual):
    """Retorna nombre y binario del PDF para descarga."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT Nombre_Archivo, Archivo_PDF
            FROM manuales
            WHERE ID_Manual = %s
            """,
            (id_manual,),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR OBTENER PDF:", e)
        return None
    finally:
        db.close()


def insertar_manual_excel(nombre_archivo, excel_binario, texto_extraido):
    """Inserta un nuevo manual Excel en la BD. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO manuales
        (Titulo, Nombre_Archivo, Archivo_Excel, Contenido_Texto, Categoria, Version, Tipo_Archivo)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            sql,
            (nombre_archivo, nombre_archivo, excel_binario, texto_extraido, "General", "1.0", "EXCEL"),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR INSERTAR MANUAL EXCEL:", e)
        return None
    finally:
        db.close()


def actualizar_manual_excel(id_manual, excel_binario, texto_extraido, nueva_version):
    """Actualiza el Excel y texto de un manual existente."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE manuales
            SET Archivo_Excel = %s, Contenido_Texto = %s, Version = %s
            WHERE ID_Manual = %s
            """,
            (excel_binario, texto_extraido, nueva_version, id_manual),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR ACTUALIZAR MANUAL EXCEL:", e)
        return False
    finally:
        db.close()


def obtener_excel_binario(id_manual):
    """Retorna nombre y binario del Excel para descarga."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT Nombre_Archivo, Archivo_Excel
            FROM manuales
            WHERE ID_Manual = %s
            """,
            (id_manual,),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR OBTENER EXCEL:", e)
        return None
    finally:
        db.close()



# =========================================
# HISTORIAL DE CONVERSACIONES
# =========================================

def guardar_historial(id_usuario, id_manual, pregunta, respuesta, fue_con_manual=1):
    """Guarda una conversación en el historial. Retorna ID."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO historial_conversaciones
        (ID_Usuario, ID_Manual, Pregunta_Usuario, Respuesta_IA,
         Fecha_Hora, Fue_Respondida_Con_Manual)
        VALUES (%s, %s, %s, %s, NOW(), %s)
        """
        cursor.execute(sql, (id_usuario, id_manual, pregunta, respuesta, fue_con_manual))
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR GUARDAR HISTORIAL:", e)
        return None
    finally:
        db.close()


def guardar_pendiente(id_conversacion, pregunta_faltante):
    """Registra una pregunta que no pudo ser respondida."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO pendientes_actualizacion
        (ID_Conversacion, Pregunta_Faltante)
        VALUES (%s, %s)
        """
        cursor.execute(sql, (id_conversacion, pregunta_faltante))
        db.commit()
    except Exception as e:
        print("ERROR GUARDAR PENDIENTE:", e)
    finally:
        db.close()


def obtener_historial_reciente(id_usuario, limite=5):
    """Obtiene las últimas N conversaciones de un usuario."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT Pregunta_Usuario, Respuesta_IA
            FROM historial_conversaciones
            WHERE ID_Usuario = %s
            ORDER BY Fecha_Hora DESC
            LIMIT %s
            """,
            (id_usuario, limite),
        )
        rows = cursor.fetchall()
        # Invertir para orden cronológico (más antiguo primero)
        return list(reversed(rows))
    except Exception as e:
        print("ERROR OBTENER HISTORIAL:", e)
        return []
    finally:
        db.close()


def obtener_historial_admin(limite=100):
    """
    Obtiene el historial completo de consultas de TODOS los usuarios.
    Solo para administradores. Incluye nombre de usuario, feedback, y manual.
    """
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                h.ID_Conversacion,
                h.Pregunta_Usuario,
                h.Respuesta_IA,
                h.Fecha_Hora,
                u.Nombre_Completo AS nombre_usuario,
                u.Usuario AS usuario,
                m.Nombre_Archivo AS nombre_manual,
                f.Es_Positivo AS feedback
            FROM historial_conversaciones h
            LEFT JOIN usuarios u ON h.ID_Usuario = u.ID_Usuario
            LEFT JOIN manuales m ON h.ID_Manual = m.ID_Manual
            LEFT JOIN feedback_respuestas f ON h.ID_Conversacion = f.ID_Conversacion
            ORDER BY h.Fecha_Hora DESC
            LIMIT %s
            """,
            (limite,),
        )
        rows = cursor.fetchall()
        # Serializar datetimes a string
        for row in rows:
            if row.get("Fecha_Hora"):
                row["Fecha_Hora"] = row["Fecha_Hora"].strftime("%Y-%m-%d %H:%M:%S")
            # feedback: True/False/None
            if row.get("feedback") is not None:
                row["feedback"] = bool(row["feedback"])
        return rows
    except Exception as e:
        print("ERROR OBTENER HISTORIAL ADMIN:", e)
        return []
    finally:
        db.close()


# =========================================
# FEEDBACK
# =========================================

def guardar_feedback(id_conversacion, es_positivo):
    """Guarda feedback (👍/👎) para una respuesta."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO feedback_respuestas
        (ID_Conversacion, Es_Positivo)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE Es_Positivo = %s
        """
        cursor.execute(sql, (id_conversacion, es_positivo, es_positivo))
        db.commit()
    except Exception as e:
        print("ERROR GUARDAR FEEDBACK:", e)
    finally:
        db.close()


# =========================================
# HISTORIAL DEL USUARIO (propio)
# =========================================

def obtener_historial_usuario(id_usuario, limite=50):
    """Obtiene el historial completo de un usuario específico (para vista propia)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                h.ID_Conversacion,
                h.Pregunta_Usuario,
                h.Respuesta_IA,
                h.Fecha_Hora,
                m.Nombre_Archivo AS nombre_manual,
                f.Es_Positivo AS feedback
            FROM historial_conversaciones h
            LEFT JOIN manuales m ON h.ID_Manual = m.ID_Manual
            LEFT JOIN feedback_respuestas f ON h.ID_Conversacion = f.ID_Conversacion
            WHERE h.ID_Usuario = %s
            ORDER BY h.Fecha_Hora DESC
            LIMIT %s
            """,
            (id_usuario, limite),
        )
        rows = cursor.fetchall()
        for row in rows:
            if row.get("Fecha_Hora"):
                row["Fecha_Hora"] = row["Fecha_Hora"].strftime("%Y-%m-%d %H:%M:%S")
            if row.get("feedback") is not None:
                row["feedback"] = bool(row["feedback"])
        return rows
    except Exception as e:
        print("ERROR OBTENER HISTORIAL USUARIO:", e)
        return []
    finally:
        db.close()


# =========================================
# PREGUNTAS SIN RESPUESTA (pendientes)
# =========================================

def obtener_pendientes(limite=200):
    """Retorna las preguntas que LUXO no pudo responder (para revisión del admin)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                p.ID_Pendiente,
                p.Pregunta_Faltante,
                p.Fecha_Registro,
                p.Estatus,
                u.Nombre_Completo AS nombre_usuario,
                u.Usuario AS usuario,
                u.Tienda AS tienda
            FROM pendientes_actualizacion p
            LEFT JOIN historial_conversaciones h ON p.ID_Conversacion = h.ID_Conversacion
            LEFT JOIN usuarios u ON h.ID_Usuario = u.ID_Usuario
            ORDER BY p.Fecha_Registro DESC
            LIMIT %s
            """,
            (limite,),
        )
        rows = cursor.fetchall()
        for row in rows:
            if row.get("Fecha_Registro"):
                row["Fecha_Registro"] = row["Fecha_Registro"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER PENDIENTES:", e)
        return []
    finally:
        db.close()


# =========================================
# ESTADÍSTICAS DE USO
# =========================================

def obtener_estadisticas():
    """Retorna métricas de uso del sistema para el dashboard de admin."""
    db = conectar_db()
    if not db:
        return {}
    try:
        cursor = db.cursor(dictionary=True)
        stats = {}

        # Totales de consultas
        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN DATE(Fecha_Hora) = CURDATE() THEN 1 ELSE 0 END) AS hoy,
                SUM(CASE WHEN Fecha_Hora >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS semana,
                SUM(CASE WHEN Fecha_Hora >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS mes
            FROM historial_conversaciones
        """)
        totales = cursor.fetchone()
        stats["consultas"] = {
            "total": int(totales["total"] or 0),
            "hoy": int(totales["hoy"] or 0),
            "semana": int(totales["semana"] or 0),
            "mes": int(totales["mes"] or 0),
        }

        # Usuarios únicos activos (últimos 30 días)
        cursor.execute("""
            SELECT COUNT(DISTINCT ID_Usuario) AS activos
            FROM historial_conversaciones
            WHERE Fecha_Hora >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """)
        stats["usuarios_activos"] = int((cursor.fetchone() or {}).get("activos", 0))

        # Feedback positivo/negativo
        cursor.execute("""
            SELECT
                SUM(CASE WHEN Es_Positivo = 1 THEN 1 ELSE 0 END) AS positivos,
                SUM(CASE WHEN Es_Positivo = 0 THEN 1 ELSE 0 END) AS negativos,
                COUNT(*) AS total_feedback
            FROM feedback_respuestas
        """)
        fb = cursor.fetchone()
        stats["feedback"] = {
            "positivos": int(fb["positivos"] or 0),
            "negativos": int(fb["negativos"] or 0),
            "total": int(fb["total_feedback"] or 0),
        }

        # Top 5 manuales más consultados
        cursor.execute("""
            SELECT m.Nombre_Archivo AS nombre, COUNT(*) AS consultas
            FROM historial_conversaciones h
            JOIN manuales m ON h.ID_Manual = m.ID_Manual
            WHERE h.ID_Manual IS NOT NULL
            GROUP BY h.ID_Manual, m.Nombre_Archivo
            ORDER BY consultas DESC
            LIMIT 5
        """)
        stats["top_manuales"] = cursor.fetchall()
        for row in stats["top_manuales"]:
            row["consultas"] = int(row["consultas"])

        # Top 5 usuarios más activos
        cursor.execute("""
            SELECT u.Nombre_Completo AS nombre, u.Tienda AS tienda, COUNT(*) AS consultas
            FROM historial_conversaciones h
            JOIN usuarios u ON h.ID_Usuario = u.ID_Usuario
            GROUP BY h.ID_Usuario, u.Nombre_Completo, u.Tienda
            ORDER BY consultas DESC
            LIMIT 5
        """)
        stats["top_usuarios"] = cursor.fetchall()
        for row in stats["top_usuarios"]:
            row["consultas"] = int(row["consultas"])

        # Preguntas sin respuesta
        cursor.execute("SELECT COUNT(*) AS total FROM pendientes_actualizacion WHERE (Estatus IS NULL OR Estatus != 'Resuelto')")
        stats["pendientes"] = int((cursor.fetchone() or {}).get("total", 0))

        # Consultas por día (últimos 7 días)
        cursor.execute("""
            SELECT DATE(Fecha_Hora) AS dia, COUNT(*) AS consultas
            FROM historial_conversaciones
            WHERE Fecha_Hora >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(Fecha_Hora)
            ORDER BY dia ASC
        """)
        rows_dias = cursor.fetchall()
        stats["consultas_por_dia"] = [
            {"dia": str(r["dia"]), "consultas": int(r["consultas"])}
            for r in rows_dias
        ]

        return stats
    except Exception as e:
        print("ERROR OBTENER ESTADISTICAS:", e)
        return {}
    finally:
        db.close()


# =========================================
# USUARIOS ADMIN (gestión de tiendas)
# =========================================

def obtener_usuarios_admin():
    """Retorna la lista de todos los usuarios con su tienda asignada."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Usuario, Usuario, Nombre_Completo, Rol, Tienda
            FROM usuarios
            ORDER BY Nombre_Completo
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER USUARIOS ADMIN:", e)
        return []
    finally:
        db.close()


def actualizar_tienda_usuario(id_usuario, tienda):
    """Asigna o actualiza la tienda de un usuario. Retorna True si éxito."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE usuarios SET Tienda = %s WHERE ID_Usuario = %s",
            (tienda, id_usuario),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR ACTUALIZAR TIENDA:", e)
        return False
    finally:
        db.close()
