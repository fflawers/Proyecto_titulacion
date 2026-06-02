# =========================================
# auth.py — Autenticación, JWT y Seguridad
# =========================================

import bcrypt
import database
from datetime import datetime, timedelta
from jose import JWTError, jwt
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS


# =========================================
# HASHING DE CONTRASEÑAS
# =========================================

def hashear_contrasena(contrasena_plana):
    """Genera un hash bcrypt de una contraseña en texto plano."""
    return bcrypt.hashpw(
        contrasena_plana.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def verificar_contrasena(contrasena_plana, hash_almacenado):
    """Compara una contraseña en texto plano contra un hash bcrypt."""
    try:
        return bcrypt.checkpw(
            contrasena_plana.encode("utf-8"),
            hash_almacenado.encode("utf-8")
        )
    except Exception:
        return False


# =========================================
# JWT TOKENS
# =========================================

def crear_token(user_data):
    """
    Crea un JWT con los datos del usuario.

    Args:
        user_data: dict con {id, nombre, rol}

    Returns:
        str: Token JWT
    """
    payload = {
        "sub": str(user_data["id"]),
        "nombre": user_data["nombre"],
        "rol": user_data["rol"],
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verificar_token(token):
    """
    Decodifica y valida un JWT.

    Returns:
        dict con {id, nombre, rol} o None si es inválido
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "id": int(payload["sub"]),
            "nombre": payload["nombre"],
            "rol": payload["rol"],
        }
    except JWTError:
        return None


# =========================================
# LOGIN
# =========================================

def login(usuario, contrasena):
    """
    Verifica credenciales y retorna info del usuario o None.
    Soporta migración transparente de contraseñas en texto plano a bcrypt.

    Retorna: dict {id, nombre, rol} o None
    """
    datos = database.buscar_usuario(usuario)

    if not datos:
        return None

    hash_almacenado = datos.get("Contrasena", "")

    # Verificar con bcrypt
    if hash_almacenado.startswith("$2b$") or hash_almacenado.startswith("$2a$"):
        if verificar_contrasena(contrasena, hash_almacenado):
            return {
                "id": datos["ID_Usuario"],
                "nombre": datos["Nombre_Completo"],
                "rol": datos["Rol"],
            }
        return None

    # Contraseña en texto plano (legacy) — verificar y migrar
    if hash_almacenado == contrasena:
        nuevo_hash = hashear_contrasena(contrasena)
        database.actualizar_contrasena_hash(datos["ID_Usuario"], nuevo_hash)
        print(f"✅ Contraseña de '{usuario}' migrada a bcrypt automáticamente.")

        return {
            "id": datos["ID_Usuario"],
            "nombre": datos["Nombre_Completo"],
            "rol": datos["Rol"],
        }

    return None


# =========================================
# MIGRACIÓN
# =========================================

def migrar_todas_las_contrasenas():
    """
    Script de migración: convierte todas las contraseñas en texto plano a bcrypt.
    Ejecutar una sola vez. Las contraseñas que ya sean bcrypt se saltan.
    """
    from database import conectar_db

    db = conectar_db()
    if not db:
        print("❌ No se pudo conectar a la BD para migrar contraseñas.")
        return

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT ID_Usuario, Usuario, Contrasena FROM usuarios")
        usuarios = cursor.fetchall()

        migrados = 0
        for u in usuarios:
            contrasena = u["Contrasena"]
            if contrasena.startswith("$2b$") or contrasena.startswith("$2a$"):
                continue

            nuevo_hash = hashear_contrasena(contrasena)
            cursor.execute(
                "UPDATE usuarios SET Contrasena = %s WHERE ID_Usuario = %s",
                (nuevo_hash, u["ID_Usuario"]),
            )
            migrados += 1
            print(f"  ✅ '{u['Usuario']}' migrado a bcrypt")

        db.commit()
        print(f"\n🔒 Migración completada: {migrados} contraseñas actualizadas.")

    except Exception as e:
        print(f"❌ Error en migración: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    print("🔒 Migrando contraseñas a bcrypt...")
    migrar_todas_las_contrasenas()
