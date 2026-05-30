# =========================================
# auth.py — Autenticación y Seguridad
# =========================================

import bcrypt
import database


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
        # Si el hash almacenado no es válido (texto plano antiguo),
        # comparar directamente y migrar
        return False


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
        # Ya es un hash bcrypt
        if verificar_contrasena(contrasena, hash_almacenado):
            return {
                "id": datos["ID_Usuario"],
                "nombre": datos["Nombre_Completo"],
                "rol": datos["Rol"],
            }
        return None

    # Contraseña en texto plano (legacy) — verificar y migrar
    if hash_almacenado == contrasena:
        # Migrar a bcrypt de forma transparente
        nuevo_hash = hashear_contrasena(contrasena)
        database.actualizar_contrasena_hash(datos["ID_Usuario"], nuevo_hash)
        print(f"✅ Contraseña de '{usuario}' migrada a bcrypt automáticamente.")

        return {
            "id": datos["ID_Usuario"],
            "nombre": datos["Nombre_Completo"],
            "rol": datos["Rol"],
        }

    return None


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
            # Saltar si ya es bcrypt
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


# Ejecutar migración directamente: python auth.py
if __name__ == "__main__":
    print("🔒 Migrando contraseñas a bcrypt...")
    migrar_todas_las_contrasenas()
