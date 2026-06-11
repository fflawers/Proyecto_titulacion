# =========================================
# pdf_manager.py — Gestión de PDFs (Web)
# =========================================

import io
import os
import fitz  # PyMuPDF
import database
import vector_store

# OCR opcional — se activa si tesseract está instalado
try:
    import pytesseract
    from PIL import Image
    _OCR_DISPONIBLE = True
    print("✅ OCR disponible (pytesseract)")
except ImportError:
    _OCR_DISPONIBLE = False
    print("⚠️  OCR no disponible (pytesseract no instalado)")


def _ocr_pdf_bytes(contenido_bytes):
    """
    Fallback OCR: convierte cada página del PDF a imagen y extrae texto.
    Se usa cuando PyMuPDF no puede extraer texto (PDFs escaneados/imagen).
    Requiere tesseract instalado en el sistema.
    """
    if not _OCR_DISPONIBLE:
        return ""
    try:
        pdf = fitz.open(stream=contenido_bytes, filetype="pdf")
        texto_ocr = ""
        for pagina in pdf:
            # Renderizar la página como imagen (200 DPI para buena calidad)
            mat = fitz.Matrix(200 / 72, 200 / 72)
            pix = pagina.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            # OCR con soporte español e inglés
            texto_pagina = pytesseract.image_to_string(img, lang="spa+eng")
            texto_ocr += texto_pagina + "\n"
        pdf.close()
        return texto_ocr.strip()
    except Exception as e:
        print("ERROR OCR:", e)
        return ""


def extraer_texto_pdf_bytes(contenido_bytes):
    """
    Extrae todo el texto de un PDF a partir de sus bytes.
    1. Intenta PyMuPDF (texto nativo — rápido y exacto).
    2. Si el resultado tiene menos de 50 caracteres, aplica OCR como fallback.
    """
    try:
        pdf = fitz.open(stream=contenido_bytes, filetype="pdf")
        texto = ""
        for pagina in pdf:
            texto += pagina.get_text()
        pdf.close()

        # Si el texto es muy corto, probablemente es un PDF de imagen → OCR
        if len(texto.strip()) < 50:
            print("⚠️  Texto insuficiente en PDF — aplicando OCR...")
            texto_ocr = _ocr_pdf_bytes(contenido_bytes)
            if texto_ocr:
                print(f"✅ OCR exitoso: {len(texto_ocr)} caracteres extraídos")
                return texto_ocr
            else:
                print("❌ OCR tampoco pudo extraer texto")

        return texto
    except Exception as e:
        print("ERROR EXTRAER PDF:", e)
        return ""



def normalizar_nombre_pdf(nombre_archivo):
    """Convierte el nombre del archivo PDF a MAYÚSCULAS para homologar."""
    return nombre_archivo.upper() if nombre_archivo else nombre_archivo


def cargar_pdf(nombre_archivo, contenido_bytes):
    """
    Carga un nuevo PDF al sistema desde bytes (upload HTTP):
    1. Normaliza el nombre a MAYÚSCULAS
    2. Extrae texto con PyMuPDF
    3. Inserta en MySQL (texto + binario)
    4. Indexa en ChromaDB (chunks + embeddings)

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        # Normalizar nombre a mayúsculas
        nombre_archivo = normalizar_nombre_pdf(nombre_archivo)

        texto = extraer_texto_pdf_bytes(contenido_bytes)
        if not texto.strip():
            return False, (
                f"El PDF '{nombre_archivo}' no contiene texto extraíble. "
                "Si es un documento escaneado, asegúrate de que Tesseract OCR esté instalado "
                "en el servidor para procesarlo automáticamente."
            )

        id_manual = database.insertar_manual(nombre_archivo, contenido_bytes, texto)
        if not id_manual:
            return False, "Error al guardar en la base de datos."

        vector_store.indexar_manual(id_manual, nombre_archivo, texto)

        return True, f"Manual '{nombre_archivo}' cargado correctamente."

    except Exception as e:
        print("ERROR CARGAR PDF:", e)
        return False, f"Error al cargar PDF: {e}"


def actualizar_pdf(nombre_archivo, contenido_bytes):
    """
    Actualiza un manual existente o carga uno nuevo si no existe:
    1. Normaliza el nombre a MAYÚSCULAS
    2. Busca si ya existe por nombre de archivo (case-insensitive)
    3. Actualiza MySQL + re-indexa ChromaDB

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        # Normalizar nombre a mayúsculas
        nombre_archivo = normalizar_nombre_pdf(nombre_archivo)

        texto = extraer_texto_pdf_bytes(contenido_bytes)

        existente = database.buscar_manual_por_nombre(nombre_archivo)

        if existente:
            version_actual = existente.get("Version") or "1.0"
            try:
                nueva_version = str(round(float(version_actual) + 0.1, 1))
            except Exception:
                nueva_version = version_actual

            database.actualizar_manual_pdf(
                existente["ID_Manual"], contenido_bytes, texto, nueva_version
            )
            vector_store.indexar_manual(existente["ID_Manual"], nombre_archivo, texto)

            return True, f"Manual '{nombre_archivo}' actualizado a versión {nueva_version}."
        else:
            return cargar_pdf(nombre_archivo, contenido_bytes)

    except Exception as e:
        print("ERROR ACTUALIZAR PDF:", e)
        return False, f"Error al actualizar el manual: {e}"


def borrar_manual(id_manual, nombre=""):
    """
    Borra un manual del sistema:
    1. Elimina chunks de ChromaDB
    2. Borra de MySQL

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        vector_store.eliminar_manual(id_manual)

        if database.borrar_manual(id_manual):
            return True, f"Manual '{nombre}' eliminado correctamente."
        else:
            return False, "Error al borrar de la base de datos."

    except Exception as e:
        print("ERROR BORRAR MANUAL:", e)
        return False, f"Error al borrar: {e}"


def obtener_pdf_para_descarga(id_manual):
    """
    Obtiene el binario y nombre del PDF para enviar como respuesta HTTP.

    Retorna: dict {nombre, contenido_bytes} o None
    """
    try:
        manual = database.obtener_pdf_binario(id_manual)
        if not manual or not manual.get("Archivo_PDF"):
            return None

        return {
            "nombre": manual["Nombre_Archivo"],
            "contenido_bytes": manual["Archivo_PDF"],
        }
    except Exception as e:
        print("ERROR OBTENER PDF:", e)
        return None
