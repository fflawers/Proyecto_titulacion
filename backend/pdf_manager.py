# =========================================
# pdf_manager.py — Gestión de PDFs e Imágenes
# =========================================

import io
import os
from typing import Optional
import fitz  # PyMuPDF
import database
import vector_store
from text_cleaner import limpiar_texto, limpiar_texto_ocr
from config import OCR_DPI, OCR_MIN_CHARS, OCR_LANG, OCR_CONFIG

# OCR opcional — se activa si tesseract está instalado
try:
    import pytesseract
    from PIL import Image, ImageEnhance, ImageFilter
    _OCR_DISPONIBLE = True
    print("✅ OCR disponible (pytesseract)")
except ImportError:
    _OCR_DISPONIBLE = False
    print("⚠️  OCR no disponible (pytesseract no instalado)")


# =========================================
# PREPROCESAMIENTO DE IMAGEN PARA OCR
# =========================================

def _preprocesar_imagen_para_ocr(img: "Image.Image") -> "Image.Image":
    """
    Aplica preprocesamiento para maximizar la calidad del OCR:
    1. Convertir a escala de grises
    2. Aumentar contraste para separar texto del fondo
    3. Umbralización (binarización) — texto negro, fondo blanco
    4. Leve sharpening para bordes más nítidos

    Esto mejora drásticamente resultados en documentos escaneados,
    fotocopiados o con fondo gris/amarillento.
    """
    # 1. Escala de grises
    img = img.convert("L")

    # 2. Aumentar contraste (factor 2.0 = doble de contraste)
    img = ImageEnhance.Contrast(img).enhance(2.0)

    # 3. Sharpening
    img = img.filter(ImageFilter.SHARPEN)

    # 4. Binarización adaptativa con umbral 128
    img = img.point(lambda p: 255 if p > 128 else 0, "1")

    # 5. Convertir de vuelta a RGB para compatibilidad con Tesseract
    img = img.convert("RGB")

    return img


# =========================================
# OCR SOBRE IMAGEN DIRECTA (JPG/PNG)
# =========================================

def _ocr_imagen_bytes(contenido_bytes: bytes, extension: str = "png") -> str:
    """
    Aplica OCR directamente sobre una imagen (JPG/PNG/etc.).
    Incluye preprocesamiento completo.

    Args:
        contenido_bytes: Bytes del archivo de imagen
        extension: Extensión del archivo ('jpg', 'png', etc.)

    Returns:
        Texto extraído como string limpio
    """
    if not _OCR_DISPONIBLE:
        return ""
    try:
        img = Image.open(io.BytesIO(contenido_bytes))

        # Asegurar modo RGB
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        img_procesada = _preprocesar_imagen_para_ocr(img)
        texto = pytesseract.image_to_string(
            img_procesada,
            lang=OCR_LANG,
            config=OCR_CONFIG,
        )
        return limpiar_texto_ocr(texto)
    except Exception as e:
        print("ERROR OCR IMAGEN:", e)
        return ""


# =========================================
# OCR SOBRE PDF (páginas → imágenes)
# =========================================

def _ocr_pdf_bytes(contenido_bytes: bytes) -> str:
    """
    Fallback OCR: convierte cada página del PDF a imagen y extrae texto.
    Se usa cuando PyMuPDF no puede extraer texto (PDFs escaneados/imagen).

    Mejoras vs versión anterior:
    - 300 DPI (era 200) → imágenes mucho más nítidas
    - Preprocesamiento de imagen antes del OCR
    - Configuración avanzada de Tesseract (LSTM neural)
    - Limpieza del texto extraído

    Requiere tesseract instalado en el sistema.
    """
    if not _OCR_DISPONIBLE:
        return ""
    try:
        pdf = fitz.open(stream=contenido_bytes, filetype="pdf")
        partes = []

        for num_pagina, pagina in enumerate(pdf, 1):
            # Renderizar a OCR_DPI (default 300)
            escala = OCR_DPI / 72  # 72 es el DPI base de PDF
            mat = fitz.Matrix(escala, escala)
            pix = pagina.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            img_bytes = pix.tobytes("png")

            img = Image.open(io.BytesIO(img_bytes))
            img_procesada = _preprocesar_imagen_para_ocr(img)

            texto_pagina = pytesseract.image_to_string(
                img_procesada,
                lang=OCR_LANG,
                config=OCR_CONFIG,
            )

            if texto_pagina.strip():
                partes.append(f"--- Página {num_pagina} ---\n{texto_pagina}")

        pdf.close()
        texto_completo = "\n\n".join(partes)
        return limpiar_texto_ocr(texto_completo)

    except Exception as e:
        print("ERROR OCR PDF:", e)
        return ""


# =========================================
# EXTRACCIÓN DE TEXTO DE PDF
# =========================================

def extraer_texto_pdf_bytes(contenido_bytes: bytes) -> str:
    """
    Extrae todo el texto de un PDF a partir de sus bytes.

    Estrategia en cascada:
    1. PyMuPDF — texto nativo (rápido, 100% exacto para PDFs digitales)
    2. Si resultado < OCR_MIN_CHARS (200) → PDF escaneado → OCR completo

    El texto se limpia con text_cleaner antes de retornar.
    """
    try:
        pdf = fitz.open(stream=contenido_bytes, filetype="pdf")
        partes = []

        for num_pagina, pagina in enumerate(pdf, 1):
            texto_pagina = pagina.get_text("text")  # extracción nativa
            if texto_pagina.strip():
                partes.append(f"--- Página {num_pagina} ---\n{texto_pagina}")

        pdf.close()
        texto = "\n\n".join(partes)
        texto = limpiar_texto(texto)

        # Si el texto nativo es insuficiente → PDF escaneado → OCR
        if len(texto.strip()) < OCR_MIN_CHARS:
            print(f"⚠️  Texto insuficiente ({len(texto)} chars) — aplicando OCR 300 DPI...")
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


# =========================================
# NORMALIZAR NOMBRE
# =========================================

def normalizar_nombre_pdf(nombre_archivo: str) -> str:
    """Convierte el nombre del archivo a MAYÚSCULAS para homologar."""
    return nombre_archivo.upper() if nombre_archivo else nombre_archivo


# =========================================
# CARGAR PDF
# =========================================

def cargar_pdf(nombre_archivo: str, contenido_bytes: bytes) -> tuple[bool, str]:
    """
    Carga un nuevo PDF al sistema desde bytes (upload HTTP):
    1. Normaliza el nombre a MAYÚSCULAS
    2. Extrae texto (nativo o OCR según corresponda)
    3. Inserta en MySQL (texto + binario)
    4. Indexa en ChromaDB (chunks + embeddings)

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        nombre_archivo = normalizar_nombre_pdf(nombre_archivo)

        texto = extraer_texto_pdf_bytes(contenido_bytes)
        if not texto.strip():
            return False, (
                f"'{nombre_archivo}' no contiene texto extraíble. "
                "Si es un documento escaneado, asegúrate de que Tesseract OCR esté instalado."
            )

        id_manual = database.insertar_manual(nombre_archivo, contenido_bytes, texto)
        if not id_manual:
            return False, "Error al guardar en la base de datos."

        vector_store.indexar_manual(id_manual, nombre_archivo, texto)

        return True, f"Manual '{nombre_archivo}' cargado correctamente ({len(texto):,} chars extraídos)."

    except Exception as e:
        print("ERROR CARGAR PDF:", e)
        return False, f"Error al cargar PDF: {e}"


# =========================================
# CARGAR IMAGEN (JPG/PNG → OCR → indexar)
# =========================================

def cargar_imagen(nombre_archivo: str, contenido_bytes: bytes) -> tuple[bool, str]:
    """
    Procesa una imagen directa (JPG, PNG) como documento:
    1. Aplica OCR con preprocesamiento
    2. Guarda en MySQL como tipo PDF (la imagen como binario)
    3. Indexa en ChromaDB

    Retorna: (exito: bool, mensaje: str)
    """
    try:
        if not _OCR_DISPONIBLE:
            return False, "OCR no disponible. Instala pytesseract para procesar imágenes."

        nombre_archivo = nombre_archivo.upper()
        ext = nombre_archivo.rsplit(".", 1)[-1].lower()

        texto = _ocr_imagen_bytes(contenido_bytes, ext)
        if not texto.strip():
            return False, (
                f"No se pudo extraer texto de '{nombre_archivo}'. "
                "Asegúrate de que la imagen sea legible y tenga buena resolución."
            )

        # Guardar en MySQL usando el mismo campo que PDF
        id_manual = database.insertar_manual(nombre_archivo, contenido_bytes, texto)
        if not id_manual:
            return False, "Error al guardar en la base de datos."

        vector_store.indexar_manual(id_manual, nombre_archivo, texto)

        return True, f"Imagen '{nombre_archivo}' procesada con OCR: {len(texto):,} chars extraídos."

    except Exception as e:
        print("ERROR CARGAR IMAGEN:", e)
        return False, f"Error al procesar imagen: {e}"


# =========================================
# ACTUALIZAR PDF
# =========================================

def actualizar_pdf(nombre_archivo: str, contenido_bytes: bytes) -> tuple[bool, str]:
    """
    Actualiza un manual existente o carga uno nuevo si no existe.

    Retorna: (exito: bool, mensaje: str)
    """
    try:
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


# =========================================
# BORRAR MANUAL
# =========================================

def borrar_manual(id_manual: int, nombre: str = "") -> tuple[bool, str]:
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


# =========================================
# OBTENER PDF PARA DESCARGA
# =========================================

def obtener_pdf_para_descarga(id_manual: int) -> Optional[dict]:
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
