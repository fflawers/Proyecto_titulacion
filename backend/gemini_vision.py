# =========================================
# gemini_vision.py — Auditoría Visual con Gemini 1.5 Flash
# =========================================

import base64
import json
import os

import requests

from config import GEMINI_API_KEY


def _imagen_a_base64(imagen_bytes: bytes) -> str:
    """Convierte bytes de imagen a string base64."""
    return base64.b64encode(imagen_bytes).decode("utf-8")


def auditar_foto(
    guia_bytes: bytes,
    tienda_bytes: bytes,
    instrucciones: str = "",
    nombre_foto: str = "",
) -> tuple[str, str]:
    """
    Compara la foto guía de la campaña contra la foto real de la tienda
    usando Gemini 1.5 Flash Vision.

    Args:
        guia_bytes:     Bytes de la imagen guía oficial de la campaña
        tienda_bytes:   Bytes de la foto subida por el gerente de tienda
        instrucciones:  Texto con las instrucciones de montaje de esta sección
        nombre_foto:    Nombre de la sección (ej: "Cabecera principal")

    Returns:
        tuple (estatus, resultado_texto)
        estatus: "Aprobado" | "Corregir"
        resultado_texto: Análisis detallado de la IA
    """
    if not GEMINI_API_KEY:
        return "Corregir", "⚠️ No hay API Key de Gemini configurada. Configura GEMINI_API_KEY en el archivo .env del backend."

    try:
        guia_b64   = _imagen_a_base64(guia_bytes)
        tienda_b64 = _imagen_a_base64(tienda_bytes)

        prompt = f"""Eres un auditor visual experto en exhibiciones de Sunglass Hut.

Recibes DOS imágenes:
1. FOTO GUÍA: La imagen oficial de cómo debe verse la exhibición.
2. FOTO TIENDA: La foto tomada por el gerente de su tienda real.

Sección auditada: {nombre_foto or "Exhibición"}
Instrucciones de montaje: {instrucciones or "Seguir el estilo visual de la guía."}

Tu tarea:
1. Compara ambas imágenes en detalle: alineación de productos, orden, cantidad visible, iluminación, limpieza y fidelidad a la guía.
2. Determina si la tienda cumple con la guía.
3. Responde OBLIGATORIAMENTE comenzando con UNA de estas dos palabras en MAYÚSCULAS:
   - APROBADO: si la exhibición cumple de forma aceptable con la guía.
   - CORREGIR: si hay diferencias importantes que deben corregirse.

Luego, en 2-4 oraciones, explica tu veredicto de forma constructiva y específica.
Ejemplo de formato:
"APROBADO. La exhibición coincide con la guía en posición de productos, iluminación y orden. Los productos de la cabecera están correctamente alineados."
o
"CORREGIR. Faltan productos en el estante central que se ven en la guía. La iluminación está apagada y los exhibidores no están limpios."
"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": guia_b64,
                            }
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": tienda_b64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 512,
                "temperature": 0.2,
            },
        }

        resp = requests.post(url, json=payload, timeout=60)

        if resp.status_code == 200:
            data = resp.json()
            texto = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
                .strip()
            )

            if not texto:
                return "Corregir", "La IA no retornó texto. Intenta de nuevo."

            texto_upper = texto.upper()
            if texto_upper.startswith("APROBADO"):
                estatus = "Aprobado"
            else:
                estatus = "Corregir"

            return estatus, texto

        else:
            error_msg = f"Error Gemini API ({resp.status_code}): {resp.text[:300]}"
            print(error_msg)
            return "Corregir", f"Error al conectar con la IA de visión. Código {resp.status_code}."

    except requests.exceptions.Timeout:
        return "Corregir", "Tiempo de espera agotado al contactar la IA de visión. Intenta de nuevo."
    except Exception as e:
        print(f"ERROR GEMINI VISION: {e}")
        return "Corregir", f"Error inesperado en la auditoría: {str(e)}"


def verificar_api_key() -> bool:
    """Verifica que la API key de Gemini esté configurada y sea válida."""
    return bool(GEMINI_API_KEY and len(GEMINI_API_KEY) > 10)
