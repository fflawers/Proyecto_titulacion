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
            SELECT ID_Usuario, Nombre_Completo, Rol, Contrasena
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
                   Contenido_Texto, Categoria
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
