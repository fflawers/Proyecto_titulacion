# =========================================
# pdf_manager.py — Gestión de PDFs
# =========================================

import os
import sys
import subprocess
import tempfile
import fitz  # PyMuPDF
import database
import vector_store


def extraer_texto_pdf(ruta_pdf):
    """Extrae todo el texto de un archivo PDF."""
    try:
        pdf = fitz.open(ruta_pdf)
        texto = ""
        for pagina in pdf:
            texto += pagina.get_text()
        pdf.close()
        return texto
    except Exception as e:
        print("ERROR EXTRAER PDF:", e)
        return ""


def cargar_pdf(ruta_pdf):
    """
    Carga un nuevo PDF al sistema:
    1. Extrae texto con PyMuPDF
    2. Inserta en MySQL (texto + binario)
    3. Indexa en ChromaDB (chunks + embeddings)

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        nombre_archivo = os.path.basename(ruta_pdf)

        # Leer binario
        with open(ruta_pdf, "rb") as f:
            pdf_binario = f.read()

        # Extraer texto
        texto = extraer_texto_pdf(ruta_pdf)
        if not texto.strip():
            return False, f"El PDF '{nombre_archivo}' no contiene texto extraíble."

        # Insertar en MySQL
        id_manual = database.insertar_manual(nombre_archivo, pdf_binario, texto)
        if not id_manual:
            return False, "Error al guardar en la base de datos."

        # Indexar en ChromaDB
        vector_store.indexar_manual(id_manual, nombre_archivo, texto)

        return True, f"✅ Manual '{nombre_archivo}' cargado correctamente."

    except Exception as e:
        print("ERROR CARGAR PDF:", e)
        return False, f"Error al cargar PDF: {e}"


def actualizar_pdf(ruta_pdf):
    """
    Actualiza un manual existente o carga uno nuevo si no existe:
    1. Busca si ya existe por nombre de archivo
    2. Actualiza MySQL + re-indexa ChromaDB

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        nombre_archivo = os.path.basename(ruta_pdf)

        # Leer binario
        with open(ruta_pdf, "rb") as f:
            pdf_binario = f.read()

        # Extraer texto
        texto = extraer_texto_pdf(ruta_pdf)

        # Buscar si existe
        existente = database.buscar_manual_por_nombre(nombre_archivo)

        if existente:
            # Calcular nueva versión
            version_actual = existente.get("Version") or "1.0"
            try:
                nueva_version = str(round(float(version_actual) + 0.1, 1))
            except Exception:
                nueva_version = version_actual

            # Actualizar MySQL
            database.actualizar_manual_pdf(
                existente["ID_Manual"], pdf_binario, texto, nueva_version
            )

            # Re-indexar en ChromaDB
            vector_store.indexar_manual(existente["ID_Manual"], nombre_archivo, texto)

            return True, f"✅ Manual '{nombre_archivo}' actualizado a versión {nueva_version}."
        else:
            # No existe — cargar como nuevo
            return cargar_pdf(ruta_pdf)

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
        # Eliminar de ChromaDB
        vector_store.eliminar_manual(id_manual)

        # Eliminar de MySQL
        if database.borrar_manual(id_manual):
            return True, f"✅ Manual '{nombre}' eliminado correctamente."
        else:
            return False, "Error al borrar de la base de datos."

    except Exception as e:
        print("ERROR BORRAR MANUAL:", e)
        return False, f"Error al borrar: {e}"


def descargar_pdf(id_manual):
    """Descarga un PDF del manual y lo abre en el visor del sistema."""
    try:
        manual = database.obtener_pdf_binario(id_manual)

        if not manual or not manual.get("Archivo_PDF"):
            print("PDF no encontrado o sin contenido binario.")
            return

        ruta_guardado = os.path.join(
            tempfile.gettempdir(),
            manual["Nombre_Archivo"],
        )

        with open(ruta_guardado, "wb") as archivo:
            archivo.write(manual["Archivo_PDF"])

        # Abrir PDF multiplataforma
        if sys.platform == "win32":
            os.startfile(ruta_guardado)
        elif sys.platform == "darwin":
            subprocess.call(["open", ruta_guardado])
        else:
            subprocess.call(["xdg-open", ruta_guardado])

    except Exception as e:
        print("ERROR DESCARGA:", e)


def pedir_ruta_pdf(titulo="Seleccionar PDF"):
    """
    Abre el selector nativo de macOS usando AppleScript.
    Sin Tkinter, sin conflictos con Flet.
    """
    try:
        applescript = (
            f'POSIX path of (choose file with prompt "{titulo}:" '
            'of type {"pdf", "PDF"})'
        )
        result = subprocess.run(
            ["osascript", "-e", applescript],
            capture_output=True,
            text=True,
            timeout=120,
        )
        ruta = result.stdout.strip()
        return ruta if ruta else None
    except subprocess.TimeoutExpired:
        return None
    except Exception as e:
        print("ERROR SELECTOR:", e)
        return None
