# =========================================
# excel_manager.py — Gestión de Excels (Web)
# =========================================

import io
import openpyxl
import database
import vector_store


def extraer_texto_excel_bytes(contenido_bytes):
    """
    Extrae todo el texto de un archivo Excel a partir de sus bytes.
    Itera por todas las hojas y celdas, generando un texto estructurado
    que permite al RAG entender el contexto (hoja, fila, columna).
    """
    try:
        wb = openpyxl.load_workbook(
            io.BytesIO(contenido_bytes), read_only=True, data_only=True
        )
        partes = []

        for nombre_hoja in wb.sheetnames:
            ws = wb[nombre_hoja]
            partes.append(f"\n=== Hoja: {nombre_hoja} ===\n")

            filas_con_datos = []
            for fila in ws.iter_rows():
                celdas = []
                for celda in fila:
                    valor = celda.value
                    if valor is not None and str(valor).strip() != "":
                        celdas.append(f"[{celda.coordinate}]: {str(valor).strip()}")
                if celdas:
                    filas_con_datos.append(" | ".join(celdas))

            if filas_con_datos:
                partes.append("\n".join(filas_con_datos))
            else:
                partes.append("(Hoja vacía)")

        wb.close()
        return "\n".join(partes)
    except Exception as e:
        print("ERROR EXTRAER EXCEL:", e)
        return ""


def normalizar_nombre_excel(nombre_archivo):
    """Convierte el nombre del archivo Excel a MAYÚSCULAS para homologar."""
    return nombre_archivo.upper() if nombre_archivo else nombre_archivo


def cargar_excel(nombre_archivo, contenido_bytes):
    """
    Carga un nuevo Excel al sistema desde bytes (upload HTTP):
    1. Normaliza el nombre a MAYÚSCULAS
    2. Extrae texto con openpyxl
    3. Inserta en MySQL (texto + binario)
    4. Indexa en ChromaDB (chunks + embeddings)

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        nombre_archivo = normalizar_nombre_excel(nombre_archivo)

        texto = extraer_texto_excel_bytes(contenido_bytes)
        if not texto.strip():
            return False, f"El Excel '{nombre_archivo}' no contiene texto extraíble."

        id_manual = database.insertar_manual_excel(nombre_archivo, contenido_bytes, texto)
        if not id_manual:
            return False, "Error al guardar en la base de datos."

        vector_store.indexar_manual(id_manual, nombre_archivo, texto)

        return True, f"Excel '{nombre_archivo}' cargado correctamente."

    except Exception as e:
        print("ERROR CARGAR EXCEL:", e)
        return False, f"Error al cargar Excel: {e}"


def actualizar_excel(nombre_archivo, contenido_bytes):
    """
    Actualiza un manual Excel existente o carga uno nuevo si no existe:
    1. Normaliza el nombre a MAYÚSCULAS
    2. Busca si ya existe por nombre de archivo (case-insensitive)
    3. Actualiza MySQL + re-indexa ChromaDB

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        nombre_archivo = normalizar_nombre_excel(nombre_archivo)

        texto = extraer_texto_excel_bytes(contenido_bytes)

        existente = database.buscar_manual_por_nombre(nombre_archivo)

        if existente:
            version_actual = existente.get("Version") or "1.0"
            try:
                nueva_version = str(round(float(version_actual) + 0.1, 1))
            except Exception:
                nueva_version = version_actual

            database.actualizar_manual_excel(
                existente["ID_Manual"], contenido_bytes, texto, nueva_version
            )
            vector_store.indexar_manual(existente["ID_Manual"], nombre_archivo, texto)

            return True, f"Excel '{nombre_archivo}' actualizado a versión {nueva_version}."
        else:
            return cargar_excel(nombre_archivo, contenido_bytes)

    except Exception as e:
        print("ERROR ACTUALIZAR EXCEL:", e)
        return False, f"Error al actualizar el Excel: {e}"


def obtener_excel_para_descarga(id_manual):
    """
    Obtiene el binario y nombre del Excel para enviar como respuesta HTTP.

    Retorna: dict {nombre, contenido_bytes} o None
    """
    try:
        manual = database.obtener_excel_binario(id_manual)
        if not manual or not manual.get("Archivo_Excel"):
            return None

        return {
            "nombre": manual["Nombre_Archivo"],
            "contenido_bytes": manual["Archivo_Excel"],
        }
    except Exception as e:
        print("ERROR OBTENER EXCEL:", e)
        return None
