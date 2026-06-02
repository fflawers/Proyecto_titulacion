# =========================================
# setup.py — Script de configuración inicial
# =========================================
#
# Ejecutar una sola vez después de instalar:
#   python setup.py
#
# Lo que hace:
#   1. Crea la tabla feedback_respuestas si no existe
#   2. Migra contraseñas de texto plano a bcrypt
#   3. Re-indexa todos los manuales existentes en ChromaDB
#

import database
import auth
import vector_store


def main():
    print("=" * 50)
    print("  LUXO — Configuración Inicial")
    print("=" * 50)
    print()

    # 1. Verificar conexión a BD
    print("1️⃣  Verificando conexión a MySQL...")
    db = database.conectar_db()
    if not db:
        print("❌ No se pudo conectar a MySQL.")
        print("   Asegúrate de que MySQL está corriendo y las credenciales en .env son correctas.")
        return

    # 2. Crear tabla feedback
    print("2️⃣  Creando tabla feedback_respuestas...")
    try:
        cursor = db.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback_respuestas (
                ID_Feedback INT AUTO_INCREMENT PRIMARY KEY,
                ID_Conversacion INT UNIQUE,
                Es_Positivo TINYINT(1) NOT NULL,
                Fecha_Feedback DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ID_Conversacion)
                    REFERENCES historial_conversaciones(ID_Conversacion)
            )
        """)
        db.commit()
        print("   ✅ Tabla feedback_respuestas lista")
    except Exception as e:
        print(f"   ⚠️  {e}")

    db.close()

    # 3. Migrar contraseñas
    print("3️⃣  Migrando contraseñas a bcrypt...")
    auth.migrar_todas_las_contrasenas()

    # 4. Re-indexar manuales
    print()
    print("4️⃣  Indexando manuales en ChromaDB (RAG)...")
    vector_store.reindexar_todos()

    print()
    print("=" * 50)
    print("  ✅ Configuración completada")
    print("  Ejecuta: python main.py")
    print("=" * 50)


if __name__ == "__main__":
    main()
