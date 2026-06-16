# =========================================
# text_cleaner.py — Limpieza universal de texto
# Compartido por pdf_manager, excel_manager y ocr
# =========================================

import re


def limpiar_texto(texto: str) -> str:
    """
    Aplica limpieza universal a texto extraído de cualquier fuente
    (PDF nativo, OCR, Excel).

    Pasos:
    1. Normalizar saltos de línea (\\r\\n → \\n)
    2. Eliminar líneas compuestas solo de símbolos decorativos
    3. Colapsar espacios múltiples en uno solo
    4. Colapsar más de 2 saltos de línea seguidos en máximo 2
    5. Eliminar caracteres de control invisibles (excepto \\n y \\t)
    6. Strip final
    """
    if not texto:
        return ""

    # 1. Normalizar saltos de línea
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")

    # 2. Eliminar líneas decorativas (solo guiones, iguales, puntos, asteriscos, underscores)
    texto = re.sub(r"^[\-=_\*\.~#]{3,}\s*$", "", texto, flags=re.MULTILINE)

    # 3. Colapsar espacios múltiples (sin tocar los saltos de línea)
    texto = re.sub(r"[ \t]+", " ", texto)

    # 4. Colapsar más de 2 saltos de línea consecutivos
    texto = re.sub(r"\n{3,}", "\n\n", texto)

    # 5. Eliminar caracteres de control invisibles excepto \n y \t
    texto = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", texto)

    # 6. Eliminar líneas que sean solo espacios
    lineas = [l.rstrip() for l in texto.split("\n")]
    texto = "\n".join(lineas)

    return texto.strip()


def limpiar_texto_ocr(texto: str) -> str:
    """
    Limpieza adicional específica para texto extraído por OCR.
    Aplica limpiar_texto() + correcciones típicas de Tesseract.
    """
    if not texto:
        return ""

    # Corregir artefactos comunes de OCR
    # Tesseract confunde | con l o 1 en medio de palabras — no tocar
    # Pero sí eliminar líneas que son solo símbolos del OCR
    texto = re.sub(r"^[\|\!\@\#\$\%\^\&\*\(\)\[\]\{\}]{2,}\s*$", "", texto, flags=re.MULTILINE)

    # Corregir múltiples puntos seguidos (tabla de contenido artefacts)
    texto = re.sub(r"\.{4,}", "...", texto)

    # Aplicar limpieza general
    texto = limpiar_texto(texto)

    return texto


def limpiar_texto_excel(texto: str) -> str:
    """
    Limpieza específica para texto extraído de Excel.
    """
    if not texto:
        return ""

    # Eliminar celdas que son solo números de fila/columna (artefactos de coordenadas)
    # Formato: [A1]: valor → mantener; [A1]:  → eliminar
    texto = re.sub(r"\[([A-Z]+\d+)\]:\s*\|", "", texto)

    # Aplicar limpieza general
    texto = limpiar_texto(texto)

    return texto
