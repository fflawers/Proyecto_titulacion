import database
conn = database.conectar_db()
if conn:
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE plantillas_checklist ADD COLUMN Prioridad VARCHAR(20) DEFAULT 'Normal'")
    except Exception as e:
        print("Prioridad already exists or error:", e)
    try:
        cursor.execute("ALTER TABLE plantillas_checklist ADD COLUMN Notas TEXT DEFAULT NULL")
    except Exception as e:
        print("Notas already exists or error:", e)
    conn.commit()
    conn.close()
    print("DB updated.")
