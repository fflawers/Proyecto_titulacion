"""
reindexar_ocr.py — Re-indexa todos los manuales que tienen poco o ningún texto.
Útil para PDFs escaneados que no se pudieron indexar antes de tener OCR.
"""
import database
import pdf_manager
import vector_store

def reindexar_sin_texto():
    db = database.conectar_db()
    if not db:
        print("❌ No se pudo conectar a la BD")
        return

    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT ID_Manual, Nombre_Archivo, Archivo_PDF, Contenido_Texto
        FROM manuales
        WHERE Archivo_PDF IS NOT NULL
          AND (Contenido_Texto IS NULL OR CHAR_LENGTH(TRIM(Contenido_Texto)) < 50)
    """)
    manuales_vacios = cursor.fetchall()
    db.close()

    if not manuales_vacios:
        print("✅ Todos los manuales PDF ya tienen texto indexado.")
        return

    print(f"🔍 Encontrados {len(manuales_vacios)} manual(es) con texto insuficiente:")
    for m in manuales_vacios:
        print(f"  → [{m['ID_Manual']}] {m['Nombre_Archivo']} ({len((m['Contenido_Texto'] or '').strip())} chars)")

    print()
    for m in manuales_vacios:
        nombre = m['Nombre_Archivo']
        id_manual = m['ID_Manual']
        pdf_bytes = m['Archivo_PDF']

        if not pdf_bytes:
            print(f"⚠️  [{id_manual}] {nombre}: sin binario en BD, saltar")
            continue

        print(f"🔄 Procesando [{id_manual}] {nombre}...")
        texto = pdf_manager.extraer_texto_pdf_bytes(bytes(pdf_bytes))

        if not texto.strip():
            print(f"❌ [{id_manual}] {nombre}: OCR tampoco pudo extraer texto")
            continue

        # Actualizar texto en BD
        db2 = database.conectar_db()
        cursor2 = db2.cursor()
        cursor2.execute(
            "UPDATE manuales SET Contenido_Texto = %s WHERE ID_Manual = %s",
            (texto, id_manual)
        )
        db2.commit()
        db2.close()

        # Re-indexar en ChromaDB
        vector_store.indexar_manual(id_manual, nombre, texto)
        print(f"✅ [{id_manual}] {nombre}: {len(texto)} chars indexados")

    print()
    print(f"🏁 Re-indexación completada. Total chunks en ChromaDB: {vector_store.obtener_coleccion().count()}")


if __name__ == "__main__":
    reindexar_sin_texto()
