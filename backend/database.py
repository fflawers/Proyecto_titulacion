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
            SELECT ID_Manual, Nombre_Archivo, Titulo, Version, Abierto
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


def toggle_manual_abierto(id_manual):
    """Alterna el estado Abierto (1/0) de un manual."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE manuales SET Abierto = NOT Abierto WHERE ID_Manual = %s",
            (id_manual,)
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR TOGGLE ABIERTO:", e)
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

def guardar_feedback(id_conversacion, es_positivo, comentario_falla=None):
    """Guarda feedback (👍/👎) y opcionalmente un comentario de falla."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        sql = """
        INSERT INTO feedback_respuestas
        (ID_Conversacion, Es_Positivo, Comentario_Falla)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE Es_Positivo = %s, Comentario_Falla = COALESCE(%s, Comentario_Falla)
        """
        cursor.execute(sql, (id_conversacion, es_positivo, comentario_falla, es_positivo, comentario_falla))
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

        # ── Eficacia de la IA ──
        total_consultas = stats["consultas"]["total"]
        total_feedback  = stats["feedback"]["total"]
        positivos       = stats["feedback"]["positivos"]
        negativos       = stats["feedback"]["negativos"]
        pendientes_val  = stats["pendientes"]
        pct_positivo = round((positivos / total_feedback * 100), 1) if total_feedback > 0 else None
        pct_negativo = round((negativos / total_feedback * 100), 1) if total_feedback > 0 else None
        # Tasa de resolución: consultas que tienen feedback positivo vs total
        tasa_resolucion = round((positivos / total_consultas * 100), 1) if total_consultas > 0 else None
        stats["eficacia"] = {
            "pct_positivo":    pct_positivo,
            "pct_negativo":    pct_negativo,
            "tasa_resolucion": tasa_resolucion,
            "sin_feedback":    total_consultas - total_feedback,
            "pendientes":      pendientes_val,
        }

        # Comentarios de falla recientes (para admin)
        cursor.execute("""
            SELECT f.Comentario_Falla, h.Pregunta_Usuario, u.Nombre_Completo, f.Fecha_Hora
            FROM feedback_respuestas f
            JOIN historial_conversaciones h ON f.ID_Conversacion = h.ID_Conversacion
            JOIN usuarios u ON h.ID_Usuario = u.ID_Usuario
            WHERE f.Es_Positivo = 0 AND f.Comentario_Falla IS NOT NULL AND f.Comentario_Falla != ''
            ORDER BY f.Fecha_Hora DESC
            LIMIT 10
        """)
        fallos = cursor.fetchall()
        for r in fallos:
            if r.get("Fecha_Hora"):
                r["Fecha_Hora"] = r["Fecha_Hora"].strftime("%Y-%m-%d %H:%M")
        stats["fallos_recientes"] = fallos

        # Pendientes por categoría
        cursor.execute("""
            SELECT COALESCE(Categoria, 'Sin clasificar') AS categoria, COUNT(*) AS total
            FROM pendientes_actualizacion
            WHERE (Estatus IS NULL OR Estatus != 'Resuelto')
            GROUP BY Categoria
            ORDER BY total DESC
        """)
        stats["pendientes_por_categoria"] = [
            {"categoria": r["categoria"], "total": int(r["total"])}
            for r in cursor.fetchall()
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


# =========================================
# SESIONES / LOG DE LOGINS
# =========================================

def registrar_sesion(id_usuario, ip=None, ciudad=None, pais=None):
    """Guarda un registro de inicio de sesión."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO sesiones (ID_Usuario, Direccion_IP, Ubicacion_Ciudad, Ubicacion_Pais)
            VALUES (%s, %s, %s, %s)
            """,
            (id_usuario, ip, ciudad, pais),
        )
        db.commit()
    except Exception as e:
        print("ERROR REGISTRAR SESION:", e)
    finally:
        db.close()


def obtener_sesiones_admin(limite=50):
    """Obtiene el historial de inicios de sesión para el admin."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT s.ID_Sesion, s.Fecha_Login, s.Direccion_IP,
                   s.Ubicacion_Ciudad, s.Ubicacion_Pais,
                   u.Nombre_Completo, u.Usuario, u.Tienda, u.Rol
            FROM sesiones s
            JOIN usuarios u ON s.ID_Usuario = u.ID_Usuario
            ORDER BY s.Fecha_Login DESC
            LIMIT %s
            """,
            (limite,),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Login"):
                r["Fecha_Login"] = r["Fecha_Login"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER SESIONES:", e)
        return []
    finally:
        db.close()


# =========================================
# NOTIFICACIONES
# =========================================

def crear_notificacion(id_usuario, titulo, cuerpo, tipo="general"):
    """Crea una notificación para un usuario específico."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO notificaciones (ID_Usuario, Titulo, Cuerpo, Tipo)
            VALUES (%s, %s, %s, %s)
            """,
            (id_usuario, titulo, cuerpo, tipo),
        )
        db.commit()
    except Exception as e:
        print("ERROR CREAR NOTIFICACION:", e)
    finally:
        db.close()


def crear_notificacion_rol(rol, titulo, cuerpo, tipo="general"):
    """Crea una notificación para todos los usuarios con un rol específico."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        cursor.execute("SELECT ID_Usuario FROM usuarios WHERE Rol = %s", (rol,))
        ids = [r[0] for r in cursor.fetchall()]
        for uid in ids:
            cursor.execute(
                """
                INSERT INTO notificaciones (ID_Usuario, Titulo, Cuerpo, Tipo)
                VALUES (%s, %s, %s, %s)
                """,
                (uid, titulo, cuerpo, tipo),
            )
        db.commit()
    except Exception as e:
        print("ERROR CREAR NOTIFICACION ROL:", e)
    finally:
        db.close()


# =========================================
# SUGERENCIAS
# =========================================

def guardar_sugerencia(id_usuario, sugerencia):
    """Guarda una sugerencia del usuario."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO sugerencias_luxo (ID_Usuario, Sugerencia) VALUES (%s, %s)",
            (id_usuario, sugerencia)
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR GUARDAR SUGERENCIA:", e)
        return False
    finally:
        db.close()

def obtener_sugerencias_admin():
    """Obtiene todas las sugerencias con datos del usuario."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT s.ID_Sugerencia, s.Sugerencia, s.Fecha, u.Nombre_Completo, u.Tienda
            FROM sugerencias_luxo s
            JOIN usuarios u ON s.ID_Usuario = u.ID_Usuario
            ORDER BY s.Fecha DESC
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha"):
                r["Fecha"] = r["Fecha"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER SUGERENCIAS:", e)
        return []
    finally:
        db.close()


def obtener_notificaciones(id_usuario, solo_no_leidas=False):
    """Obtiene notificaciones de un usuario."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        sql = """
            SELECT ID_Notificacion, Titulo, Cuerpo, Tipo, Leida, Fecha_Hora
            FROM notificaciones
            WHERE ID_Usuario = %s
        """
        params = [id_usuario]
        if solo_no_leidas:
            sql += " AND Leida = 0"
        sql += " ORDER BY Fecha_Hora DESC LIMIT 50"
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Hora"):
                r["Fecha_Hora"] = r["Fecha_Hora"].strftime("%Y-%m-%d %H:%M:%S")
            r["Leida"] = bool(r["Leida"])
        return rows
    except Exception as e:
        print("ERROR OBTENER NOTIFICACIONES:", e)
        return []
    finally:
        db.close()


def marcar_notificaciones_leidas(id_usuario):
    """Marca todas las notificaciones de un usuario como leídas."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE notificaciones SET Leida = 1 WHERE ID_Usuario = %s AND Leida = 0",
            (id_usuario,),
        )
        db.commit()
    except Exception as e:
        print("ERROR MARCAR NOTIFICACIONES:", e)
    finally:
        db.close()


def contar_no_leidas(id_usuario) -> int:
    """Retorna el número de notificaciones no leídas de un usuario."""
    db = conectar_db()
    if not db:
        return 0
    try:
        cursor = db.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM notificaciones WHERE ID_Usuario = %s AND Leida = 0",
            (id_usuario,),
        )
        return cursor.fetchone()[0] or 0
    except Exception as e:
        print("ERROR CONTAR NO LEIDAS:", e)
        return 0
    finally:
        db.close()


# =========================================
# TICKETS DE SOPORTE
# =========================================

def crear_ticket(id_usuario, detalle):
    """Crea un ticket de soporte. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO tickets_soporte (ID_Usuario, Detalle_Problema) VALUES (%s, %s)",
            (id_usuario, detalle),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR CREAR TICKET:", e)
        return None
    finally:
        db.close()


def obtener_tickets_admin():
    """Obtiene todos los tickets de soporte para el administrador, ordenados por prioridad."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT t.ID_Ticket, t.Detalle_Problema, t.Respuesta_Soporte,
                   t.Estatus, t.Fecha_Creacion, t.Fecha_Resolucion,
                   COALESCE(t.Prioridad, 'Normal') AS Prioridad,
                   u.Nombre_Completo, u.Tienda
            FROM tickets_soporte t
            JOIN usuarios u ON t.ID_Usuario = u.ID_Usuario
            ORDER BY
              FIELD(COALESCE(t.Prioridad,'Normal'), 'Urgente', 'Alta', 'Normal') ASC,
              t.Fecha_Creacion DESC
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            for k in ("Fecha_Creacion", "Fecha_Resolucion"):
                if r.get(k):
                    r[k] = r[k].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER TICKETS:", e)
        return []
    finally:
        db.close()


def marcar_prioridad_ticket(id_ticket, prioridad):
    """Cambia la prioridad de un ticket. Retorna True si éxito."""
    if prioridad not in ('Normal', 'Alta', 'Urgente'):
        return False
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE tickets_soporte SET Prioridad = %s WHERE ID_Ticket = %s",
            (prioridad, id_ticket),
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print("ERROR MARCAR PRIORIDAD:", e)
        return False
    finally:
        db.close()


def crear_ticket_automatico(id_usuario, pregunta):
    """
    Crea un ticket automático cuando la IA no puede resolver una consulta.
    Cooldown: no crea duplicado si el usuario ya tiene un ticket [AUTO] abierto
    sobre el mismo tema en las últimas 2 horas.
    Retorna el ID del ticket creado o None.
    """
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        # Verificar cooldown
        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM tickets_soporte
            WHERE ID_Usuario = %s
              AND Detalle_Problema LIKE %s
              AND Fecha_Creacion >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
              AND Estatus = 'Abierto'
        """, (id_usuario, f"%[AUTO]%{pregunta[:50]}%"))
        row = cursor.fetchone()
        if row and row["cnt"] > 0:
            return None  # ya existe ticket reciente

        detalle = f"[AUTO] La IA no pudo resolver: {pregunta[:500]}"
        cursor2 = db.cursor()
        cursor2.execute(
            "INSERT INTO tickets_soporte (ID_Usuario, Detalle_Problema) VALUES (%s, %s)",
            (id_usuario, detalle),
        )
        db.commit()
        return cursor2.lastrowid
    except Exception as e:
        print("ERROR CREAR TICKET AUTO:", e)
        return None
    finally:
        db.close()


def obtener_tickets_usuario(id_usuario):
    """Obtiene los tickets de soporte de un usuario específico."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Ticket, Detalle_Problema, Respuesta_Soporte,
                   Estatus, Fecha_Creacion, Fecha_Resolucion
            FROM tickets_soporte
            WHERE ID_Usuario = %s
            ORDER BY Fecha_Creacion DESC
            """,
            (id_usuario,),
        )
        rows = cursor.fetchall()
        for r in rows:
            for k in ("Fecha_Creacion", "Fecha_Resolucion"):
                if r.get(k):
                    r[k] = r[k].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER TICKETS USUARIO:", e)
        return []
    finally:
        db.close()


def resolver_ticket(id_ticket, respuesta):
    """Marca un ticket como resuelto con una respuesta."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE tickets_soporte
            SET Estatus = 'Resuelto', Respuesta_Soporte = %s, Fecha_Resolucion = NOW()
            WHERE ID_Ticket = %s
            """,
            (respuesta, id_ticket),
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print("ERROR RESOLVER TICKET:", e)
        return False
    finally:
        db.close()


# =========================================
# CHECKLISTS OPERATIVOS
# =========================================

def obtener_plantillas_checklist(categoria=None):
    """Retorna las tareas/plantillas de checklist, opcionalmente filtradas por categoría."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        if categoria:
            cursor.execute(
                "SELECT ID_Plantilla, Categoria, Descripcion, Prioridad, Notas FROM plantillas_checklist WHERE Categoria = %s AND Activo = 1 ORDER BY ID_Plantilla",
                (categoria,),
            )
        else:
            cursor.execute(
                "SELECT ID_Plantilla, Categoria, Descripcion, Prioridad, Notas FROM plantillas_checklist WHERE Activo = 1 ORDER BY Categoria, ID_Plantilla"
            )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER PLANTILLAS:", e)
        return []
    finally:
        db.close()


def obtener_completadas_hoy(id_usuario):
    """Retorna los ID_Plantilla que el usuario ya completó hoy."""
    db = conectar_db()
    if not db:
        return set()
    try:
        cursor = db.cursor()
        cursor.execute(
            "SELECT ID_Plantilla FROM registro_checklist WHERE ID_Usuario = %s AND Fecha = CURDATE() AND Completado = 1",
            (id_usuario,),
        )
        return {r[0] for r in cursor.fetchall()}
    except Exception as e:
        print("ERROR OBTENER COMPLETADAS:", e)
        return set()
    finally:
        db.close()


def toggle_checklist(id_usuario, id_plantilla, completado):
    """Activa o desactiva una tarea del checklist del día."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        if completado:
            cursor.execute(
                """
                INSERT INTO registro_checklist (ID_Usuario, ID_Plantilla, Completado, Fecha, Fecha_Hora)
                VALUES (%s, %s, 1, CURDATE(), NOW())
                ON DUPLICATE KEY UPDATE Completado = 1, Fecha_Hora = NOW()
                """,
                (id_usuario, id_plantilla),
            )
        else:
            cursor.execute(
                "DELETE FROM registro_checklist WHERE ID_Usuario = %s AND ID_Plantilla = %s AND Fecha = CURDATE()",
                (id_usuario, id_plantilla),
            )
        db.commit()
        return True
    except Exception as e:
        print("ERROR TOGGLE CHECKLIST:", e)
        return False
    finally:
        db.close()


def agregar_tarea_checklist(categoria, descripcion, prioridad="Normal", notas=None):
    """Agrega una nueva tarea a la plantilla de checklist. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO plantillas_checklist (Categoria, Descripcion, Prioridad, Notas) VALUES (%s, %s, %s, %s)",
            (categoria, descripcion, prioridad, notas),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR AGREGAR TAREA:", e)
        return None
    finally:
        db.close()


def eliminar_tarea_checklist(id_plantilla):
    """Elimina una tarea del checklist (soft delete: Activo=0)."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE plantillas_checklist SET Activo = 0 WHERE ID_Plantilla = %s",
            (id_plantilla,),
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print("ERROR ELIMINAR TAREA:", e)
        return False
    finally:
        db.close()


# =========================================
# TAREAS CONSOLIDADAS
# =========================================

def obtener_tareas_activas():
    """Retorna todas las tareas activas (sin binario de plantilla)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Tarea, Titulo, Descripcion, Nombre_Plantilla,
                   Columnas_JSON, Fecha_Limite, Estatus, Fecha_Creacion
            FROM tareas
            ORDER BY Fecha_Creacion DESC
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            for k in ("Fecha_Limite", "Fecha_Creacion"):
                if r.get(k):
                    r[k] = r[k].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER TAREAS:", e)
        return []
    finally:
        db.close()


def crear_tarea(titulo, descripcion, plantilla_bytes, nombre_plantilla, columnas_json, fecha_limite):
    """Crea una nueva tarea. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO tareas (Titulo, Descripcion, Plantilla_Bytes, Nombre_Plantilla, Columnas_JSON, Fecha_Limite)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (titulo, descripcion, plantilla_bytes, nombre_plantilla, columnas_json, fecha_limite),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR CREAR TAREA:", e)
        return None
    finally:
        db.close()


def guardar_respuesta_tarea(id_tarea, id_usuario, tienda, respuestas_json):
    """Guarda o actualiza la respuesta de un usuario a una tarea."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO respuestas_tarea (ID_Tarea, ID_Usuario, Tienda, Respuestas_JSON)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE Tienda = %s, Respuestas_JSON = %s, Fecha_Envio = NOW()
            """,
            (id_tarea, id_usuario, tienda, respuestas_json, tienda, respuestas_json),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR GUARDAR RESPUESTA TAREA:", e)
        return False
    finally:
        db.close()


def obtener_respuestas_tarea(id_tarea):
    """Obtiene todas las respuestas de una tarea para el consolidado."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT r.Tienda, u.Nombre_Completo AS Gerente, r.Fecha_Envio, r.Respuestas_JSON
            FROM respuestas_tarea r
            JOIN usuarios u ON r.ID_Usuario = u.ID_Usuario
            WHERE r.ID_Tarea = %s
            ORDER BY r.Fecha_Envio ASC
            """,
            (id_tarea,),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Envio"):
                r["Fecha_Envio"] = r["Fecha_Envio"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER RESPUESTAS TAREA:", e)
        return []
    finally:
        db.close()


def obtener_plantilla_tarea(id_tarea):
    """Obtiene los bytes de la plantilla Excel de una tarea."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT Plantilla_Bytes, Nombre_Plantilla FROM tareas WHERE ID_Tarea = %s",
            (id_tarea,),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR OBTENER PLANTILLA:", e)
        return None
    finally:
        db.close()


def cerrar_tareas_vencidas():
    """Cierra automáticamente las tareas que superaron su fecha límite."""
    db = conectar_db()
    if not db:
        return 0
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE tareas
            SET Estatus = 'Cerrada'
            WHERE Estatus = 'Activa'
              AND Fecha_Limite IS NOT NULL
              AND Fecha_Limite < NOW()
            """
        )
        db.commit()
        return cursor.rowcount
    except Exception as e:
        print("ERROR CERRAR TAREAS:", e)
        return 0
    finally:
        db.close()


# =========================================
# CAMPAÑAS DE EXHIBICIÓN
# =========================================

def obtener_campana_activa():
    """Retorna la campaña activa actual (sin binarios)."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ID_Campana, Nombre, Descripcion, Guia_PDF_Nombre, Estatus, Fecha_Creacion
            FROM campanas
            WHERE Estatus = 'Activa'
            LIMIT 1
            """
        )
        row = cursor.fetchone()
        if row and row.get("Fecha_Creacion"):
            row["Fecha_Creacion"] = row["Fecha_Creacion"].strftime("%Y-%m-%d %H:%M:%S")
        return row
    except Exception as e:
        print("ERROR OBTENER CAMPANA:", e)
        return None
    finally:
        db.close()


def obtener_todas_campanas():
    """Retorna todas las campañas (para admin)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT ID_Campana, Nombre, Descripcion, Guia_PDF_Nombre, Estatus, Fecha_Creacion FROM campanas ORDER BY Fecha_Creacion DESC"
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Creacion"):
                r["Fecha_Creacion"] = r["Fecha_Creacion"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER CAMPANAS:", e)
        return []
    finally:
        db.close()


def crear_campana(nombre, descripcion, guia_pdf_nombre, guia_pdf_bytes):
    """Crea una campaña y desactiva las anteriores. Retorna ID o None."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        # Cerrar campañas activas anteriores
        cursor.execute("UPDATE campanas SET Estatus = 'Cerrada' WHERE Estatus = 'Activa'")
        cursor.execute(
            """
            INSERT INTO campanas (Nombre, Descripcion, Guia_PDF_Nombre, Guia_PDF_Bytes, Estatus)
            VALUES (%s, %s, %s, %s, 'Activa')
            """,
            (nombre, descripcion, guia_pdf_nombre, guia_pdf_bytes),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR CREAR CAMPANA:", e)
        return None
    finally:
        db.close()


def agregar_foto_guia(id_campana, nombre_foto, instrucciones, imagen_bytes, segmento="Todos"):
    """Agrega una foto guía a una campaña."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO campana_fotos_guia (ID_Campana, Nombre_Foto, Instrucciones, Imagen_Bytes, Segmento)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (id_campana, nombre_foto, instrucciones, imagen_bytes, segmento),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        print("ERROR AGREGAR FOTO GUIA:", e)
        return None
    finally:
        db.close()


def obtener_fotos_guia(id_campana, segmento=None):
    """Retorna las fotos guía de una campaña (con binario)."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        if segmento and segmento != "Todos":
            cursor.execute(
                """
                SELECT ID_Foto_Guia, Nombre_Foto, Instrucciones, Imagen_Bytes, Segmento
                FROM campana_fotos_guia
                WHERE ID_Campana = %s AND (Segmento = 'Todos' OR Segmento = %s)
                ORDER BY ID_Foto_Guia
                """,
                (id_campana, segmento),
            )
        else:
            cursor.execute(
                """
                SELECT ID_Foto_Guia, Nombre_Foto, Instrucciones, Imagen_Bytes, Segmento
                FROM campana_fotos_guia
                WHERE ID_Campana = %s
                ORDER BY ID_Foto_Guia
                """,
                (id_campana,),
            )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER FOTOS GUIA:", e)
        return []
    finally:
        db.close()


def obtener_o_crear_entrega(id_campana, tienda, id_usuario):
    """Obtiene o crea el registro de entrega de una tienda para la campaña."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT ID_Entrega, Estatus FROM campana_entregas_tienda WHERE ID_Campana = %s AND Tienda = %s",
            (id_campana, tienda),
        )
        entrega = cursor.fetchone()
        if not entrega:
            cursor.execute(
                """
                INSERT INTO campana_entregas_tienda (ID_Campana, Tienda, ID_Usuario, Estatus)
                VALUES (%s, %s, %s, 'Pendiente')
                """,
                (id_campana, tienda, id_usuario),
            )
            db.commit()
            entrega = {"ID_Entrega": cursor.lastrowid, "Estatus": "Pendiente"}
        return entrega
    except Exception as e:
        print("ERROR OBTENER/CREAR ENTREGA:", e)
        return None
    finally:
        db.close()


def obtener_fotos_tienda(id_entrega):
    """Retorna las fotos subidas por la tienda para una entrega (sin binario grande)."""
    db = conectar_db()
    if not db:
        return {}
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ft.ID_Foto_Tienda, ft.ID_Foto_Guia, ft.Estatus_Auditoria, ft.Resultado_IA, ft.Fecha_Auditoria
            FROM campana_fotos_tienda ft
            WHERE ft.ID_Entrega = %s
            """,
            (id_entrega,),
        )
        rows = cursor.fetchall()
        result = {}
        for r in rows:
            if r.get("Fecha_Auditoria"):
                r["Fecha_Auditoria"] = r["Fecha_Auditoria"].strftime("%Y-%m-%d %H:%M:%S")
            result[r["ID_Foto_Guia"]] = r
        return result
    except Exception as e:
        print("ERROR OBTENER FOTOS TIENDA:", e)
        return {}
    finally:
        db.close()


def guardar_foto_tienda(id_entrega, id_foto_guia, imagen_bytes):
    """Guarda o actualiza una foto de tienda, inicia estado 'Auditando'."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO campana_fotos_tienda (ID_Entrega, ID_Foto_Guia, Imagen_Bytes, Estatus_Auditoria, Resultado_IA)
            VALUES (%s, %s, %s, 'Auditando', 'Revisando imagen con IA de visión...')
            ON DUPLICATE KEY UPDATE
              Imagen_Bytes = VALUES(Imagen_Bytes),
              Estatus_Auditoria = 'Auditando',
              Resultado_IA = 'Revisando imagen con IA de visión...',
              Fecha_Auditoria = NULL
            """,
            (id_entrega, id_foto_guia, imagen_bytes),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR GUARDAR FOTO TIENDA:", e)
        return False
    finally:
        db.close()


def actualizar_auditoria_foto(id_entrega, id_foto_guia, estatus, resultado_ia):
    """Actualiza el resultado de la auditoría IA de una foto."""
    db = conectar_db()
    if not db:
        return
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE campana_fotos_tienda
            SET Estatus_Auditoria = %s, Resultado_IA = %s, Fecha_Auditoria = NOW()
            WHERE ID_Entrega = %s AND ID_Foto_Guia = %s
            """,
            (estatus, resultado_ia, id_entrega, id_foto_guia),
        )
        # Actualizar estatus global de la entrega si todas aprobadas
        cursor.execute(
            """
            SELECT COUNT(*) as total_guias FROM campana_fotos_guia fg
            WHERE fg.ID_Campana = (
                SELECT ID_Campana FROM campana_entregas_tienda WHERE ID_Entrega = %s
            )
            """,
            (id_entrega,),
        )
        total_guias = (cursor.fetchone() or [0])[0]
        cursor.execute(
            """
            SELECT COUNT(*) as aprobadas FROM campana_fotos_tienda
            WHERE ID_Entrega = %s AND Estatus_Auditoria = 'Aprobado'
            """,
            (id_entrega,),
        )
        aprobadas = (cursor.fetchone() or [0])[0]
        if total_guias > 0 and aprobadas >= total_guias:
            cursor.execute(
                "UPDATE campana_entregas_tienda SET Estatus = 'Aprobado_IA' WHERE ID_Entrega = %s",
                (id_entrega,),
            )
        db.commit()
    except Exception as e:
        print("ERROR ACTUALIZAR AUDITORIA:", e)
    finally:
        db.close()


def obtener_entregas_campana(id_campana):
    """Lista todas las entregas de una campaña para el admin."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT e.ID_Entrega, e.Tienda, e.Estatus, e.Fecha_Envio,
                   u.Nombre_Completo AS Gerente
            FROM campana_entregas_tienda e
            JOIN usuarios u ON e.ID_Usuario = u.ID_Usuario
            WHERE e.ID_Campana = %s
            ORDER BY e.Estatus, e.Tienda
            """,
            (id_campana,),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Envio"):
                r["Fecha_Envio"] = r["Fecha_Envio"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR OBTENER ENTREGAS:", e)
        return []
    finally:
        db.close()


def obtener_detalle_entrega(id_entrega):
    """Obtiene el detalle con todas las fotos (con binarios) de una entrega."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT fg.Nombre_Foto, fg.Instrucciones, fg.Segmento, fg.Imagen_Bytes AS Foto_Guia,
                   ft.Imagen_Bytes AS Foto_Tienda, ft.Estatus_Auditoria, ft.Resultado_IA
            FROM campana_fotos_guia fg
            JOIN campana_fotos_tienda ft ON fg.ID_Foto_Guia = ft.ID_Foto_Guia
            WHERE ft.ID_Entrega = %s
            ORDER BY fg.ID_Foto_Guia
            """,
            (id_entrega,),
        )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER DETALLE ENTREGA:", e)
        return []
    finally:
        db.close()


def dar_visto_bueno(id_entrega):
    """Marca una entrega como 'Visto_Bueno'. Retorna ID_Usuario afectado."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT e.ID_Usuario, c.Nombre AS campana_nombre
            FROM campana_entregas_tienda e
            JOIN campanas c ON e.ID_Campana = c.ID_Campana
            WHERE e.ID_Entrega = %s
            """,
            (id_entrega,),
        )
        row = cursor.fetchone()
        cursor.execute(
            "UPDATE campana_entregas_tienda SET Estatus = 'Visto_Bueno' WHERE ID_Entrega = %s",
            (id_entrega,),
        )
        db.commit()
        return row
    except Exception as e:
        print("ERROR VISTO BUENO:", e)
        return None
    finally:
        db.close()


def depurar_fotos_antiguas():
    """Libera espacio eliminando binarios de fotos con más de 3 meses."""
    db = conectar_db()
    if not db:
        return 0
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE campana_fotos_tienda ft
            JOIN campana_entregas_tienda et ON ft.ID_Entrega = et.ID_Entrega
            SET ft.Imagen_Bytes = NULL
            WHERE et.Fecha_Envio < DATE_SUB(NOW(), INTERVAL 3 MONTH)
              AND ft.Imagen_Bytes IS NOT NULL
            """
        )
        count = cursor.rowcount
        db.commit()
        return count
    except Exception as e:
        print("ERROR DEPURAR FOTOS:", e)
        return 0
    finally:
        db.close()


# =========================================
# PRESUPUESTO
# =========================================

def obtener_presupuesto_mensual(tienda, anio, mes):
    """Retorna el presupuesto mensual de una tienda."""
    db = conectar_db()
    if not db:
        return None
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT Meta_Mensual, Venta_Real FROM presupuesto_mensual WHERE Tienda = %s AND Anio = %s AND Mes = %s",
            (tienda, anio, mes),
        )
        return cursor.fetchone()
    except Exception as e:
        print("ERROR OBTENER PRESUPUESTO:", e)
        return None
    finally:
        db.close()


def upsert_presupuesto_mensual(tienda, anio, mes, meta, venta_real):
    """Crea o actualiza el presupuesto mensual."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO presupuesto_mensual (Tienda, Anio, Mes, Meta_Mensual, Venta_Real)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE Meta_Mensual = %s, Venta_Real = %s
            """,
            (tienda, anio, mes, meta, venta_real, meta, venta_real),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR UPSERT PRESUPUESTO:", e)
        return False
    finally:
        db.close()


def obtener_presupuesto_diario(tienda, fecha_inicio, fecha_fin):
    """Retorna el presupuesto diario de una tienda en un rango de fechas."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT Fecha, Meta_Dia, Venta_Real
            FROM presupuesto_diario
            WHERE Tienda = %s AND Fecha BETWEEN %s AND %s
            ORDER BY Fecha
            """,
            (tienda, fecha_inicio, fecha_fin),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha"):
                r["Fecha"] = str(r["Fecha"])
        return rows
    except Exception as e:
        print("ERROR OBTENER PRESUPUESTO DIARIO:", e)
        return []
    finally:
        db.close()


# =========================================
# PRESUPUESTO DETALLADO (esquema ProyectoMoy)
# =========================================

def obtener_metas_presupuesto(tienda, anio, mes):
    """Retorna las metas mensuales (Meta_Venta, Meta_Piezas) para una tienda."""
    db = conectar_db()
    if not db:
        return {"Meta_Venta": 0.0, "Meta_Piezas": 0}
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT Meta_Venta, Meta_Piezas
            FROM presupuesto_mensual
            WHERE Tienda = %s AND Mes = %s AND Anio = %s
            """,
            (tienda, mes, anio),
        )
        row = cursor.fetchone()
        return row if row else {"Meta_Venta": 0.0, "Meta_Piezas": 0}
    except Exception as e:
        print("ERROR OBTENER METAS PRESUPUESTO:", e)
        return {"Meta_Venta": 0.0, "Meta_Piezas": 0}
    finally:
        db.close()


def upsert_metas_presupuesto(tienda, anio, mes, meta_venta, meta_piezas):
    """Crea o actualiza las metas mensuales de venta y piezas."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO presupuesto_mensual (Tienda, Mes, Anio, Meta_Venta, Meta_Piezas)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE Meta_Venta = %s, Meta_Piezas = %s
            """,
            (tienda, mes, anio, meta_venta, meta_piezas, meta_venta, meta_piezas),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR UPSERT METAS PRESUPUESTO:", e)
        return False
    finally:
        db.close()


def obtener_ventas_diarias(tienda, mes, anio):
    """Retorna todas las ventas diarias de una tienda en un mes/año."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT DAY(Fecha) AS Dia, Venta_Con_IVA, Venta_Sin_IVA, Piezas
            FROM presupuesto_diario
            WHERE Tienda = %s AND MONTH(Fecha) = %s AND YEAR(Fecha) = %s
            ORDER BY Fecha ASC
            """,
            (tienda, mes, anio),
        )
        rows = cursor.fetchall()
        for r in rows:
            r["Dia"] = int(r.get("Dia") or 0)
            r["Venta_Con_IVA"] = float(r.get("Venta_Con_IVA") or 0.0)
            r["Venta_Sin_IVA"] = float(r.get("Venta_Sin_IVA") or 0.0)
            r["Piezas"] = int(r.get("Piezas") or 0)
        return rows
    except Exception as e:
        print("ERROR OBTENER VENTAS DIARIAS:", e)
        return []
    finally:
        db.close()


def upsert_venta_diaria(tienda, fecha_str, venta_con_iva, venta_sin_iva, piezas):
    """Crea o actualiza la venta de un día específico (fecha_str: 'YYYY-MM-DD')."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO presupuesto_diario (Tienda, Fecha, Venta_Con_IVA, Venta_Sin_IVA, Piezas)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                Venta_Con_IVA = %s,
                Venta_Sin_IVA = %s,
                Piezas = %s
            """,
            (tienda, fecha_str, venta_con_iva, venta_sin_iva, piezas,
             venta_con_iva, venta_sin_iva, piezas),
        )
        db.commit()
        return True
    except Exception as e:
        print("ERROR UPSERT VENTA DIARIA:", e)
        return False
    finally:
        db.close()


def obtener_meses_logrados(tienda, anio):
    """Retorna el resumen de los 12 meses para una tienda: meta vs venta lograda."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                m_list.Mes,
                COALESCE(m.Meta_Venta, 0) AS Meta_Venta,
                COALESCE(m.Meta_Piezas, 0) AS Meta_Piezas,
                COALESCE(SUM(d.Venta_Sin_IVA), 0) AS Venta_Lograda,
                COALESCE(SUM(d.Piezas), 0) AS Piezas_Logradas
            FROM (
                SELECT 1 AS Mes UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m_list
            LEFT JOIN presupuesto_mensual m
                ON m.Mes = m_list.Mes AND m.Tienda = %s AND m.Anio = %s
            LEFT JOIN presupuesto_diario d
                ON MONTH(d.Fecha) = m_list.Mes AND YEAR(d.Fecha) = %s AND d.Tienda = %s
            GROUP BY m_list.Mes, m.Meta_Venta, m.Meta_Piezas
            ORDER BY m_list.Mes ASC
            """,
            (tienda, anio, anio, tienda),
        )
        rows = cursor.fetchall()
        for r in rows:
            r["Meta_Venta"] = float(r.get("Meta_Venta") or 0.0)
            r["Meta_Piezas"] = int(r.get("Meta_Piezas") or 0)
            r["Venta_Lograda"] = float(r.get("Venta_Lograda") or 0.0)
            r["Piezas_Logradas"] = int(r.get("Piezas_Logradas") or 0)
        return rows
    except Exception as e:
        print("ERROR OBTENER MESES LOGRADOS:", e)
        return []
    finally:
        db.close()


def obtener_tiendas_con_zona():
    """Retorna lista de tiendas con su zona desde la tabla de usuarios."""
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT DISTINCT Tienda, Zona
            FROM usuarios
            WHERE Tienda IS NOT NULL AND Tienda != ''
            ORDER BY Tienda ASC
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("ERROR OBTENER TIENDAS CON ZONA:", e)
        return []
    finally:
        db.close()


# =========================================
# PENDIENTES — RESOLVER
# =========================================

def resolver_pendiente(id_pendiente):
    """Marca una pregunta pendiente como resuelta."""
    db = conectar_db()
    if not db:
        return False
    try:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE pendientes_actualizacion SET Estatus = 'Resuelto' WHERE ID_Pendiente = %s",
            (id_pendiente,),
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print("ERROR RESOLVER PENDIENTE:", e)
        return False
    finally:
        db.close()


# =========================================
# CAMPAÑAS — RESUMEN POR TIENDA (incluye Sin Entrega)
# =========================================

def obtener_resumen_campana_por_tienda(id_campana):
    """
    Retorna el estado de TODAS las tiendas respecto a una campaña.
    Incluye tiendas que no han enviado nada ('Sin entrega').
    """
    db = conectar_db()
    if not db:
        return []
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                u.Tienda,
                u.Zona,
                COALESCE(e.Estatus, 'Sin entrega') AS Estatus,
                e.Fecha_Envio,
                e.ID_Entrega,
                u2.Nombre_Completo AS Gerente
            FROM (
                SELECT DISTINCT Tienda, Zona
                FROM usuarios
                WHERE Tienda IS NOT NULL AND Tienda != ''
            ) u
            LEFT JOIN campana_entregas_tienda e
                ON e.Tienda = u.Tienda AND e.ID_Campana = %s
            LEFT JOIN usuarios u2 ON e.ID_Usuario = u2.ID_Usuario
            ORDER BY
                FIELD(COALESCE(e.Estatus,'Sin entrega'),
                    'Urgente', 'Rechazado_IA', 'Sin entrega', 'Pendiente',
                    'Auditando', 'Aprobado_IA', 'Visto_Bueno') ASC,
                u.Tienda ASC
        """, (id_campana,))
        rows = cursor.fetchall()
        for r in rows:
            if r.get("Fecha_Envio"):
                r["Fecha_Envio"] = r["Fecha_Envio"].strftime("%Y-%m-%d %H:%M:%S")
        return rows
    except Exception as e:
        print("ERROR RESUMEN CAMPANA POR TIENDA:", e)
        return []
    finally:
        db.close()
