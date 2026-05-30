# =========================================
# ai_engine.py — Motor de IA con RAG
# =========================================

import requests
import re
from config import GROQ_API_KEY, URL_GROQ, GROQ_MODEL, MEMORY_SIZE
import database
import vector_store


# =========================================
# DETECCIÓN DE INTENCIÓN
# =========================================

def detectar_intencion(pregunta):
    """
    Clasifica la intención del usuario.

    Retorna:
        "lista"     — quiere ver los manuales disponibles
        "descargar" — quiere descargar un PDF
        "consulta"  — pregunta sobre contenido de manuales
    """
    pregunta_lower = pregunta.lower().strip()

    # Detectar si pide lista de manuales
    lista_keywords = [
        "qué manuales", "que manuales", "manuales disponibles",
        "lista de pdf", "qué pdf", "que pdf", "mostrar pdf",
        "ver pdf", "documentos disponibles", "listar manuales",
        "cuáles manuales", "cuales manuales", "show manuals",
        "list manuals", "available manuals", "what manuals",
    ]
    if any(phrase in pregunta_lower for phrase in lista_keywords):
        return "lista"

    # Detectar si quiere descargar un PDF
    pdf_keywords = [
        "pdf", "documento", "archivo", "descargar", "descarga",
        "download", "abrir archivo", "open file",
    ]
    if any(k in pregunta_lower for k in pdf_keywords):
        return "descargar"

    return "consulta"


# =========================================
# BUSCAR MANUAL PARA DESCARGA
# =========================================

def buscar_manual_para_descarga(pregunta, manuales):
    """
    Busca el manual más relevante cuando el usuario quiere descargar un PDF.
    Usa scoring por palabras clave en el nombre del archivo.

    Retorna: dict {id, nombre} o None
    """
    pregunta_lower = pregunta.lower()
    palabras_query = re.findall(r"\w+", pregunta_lower)

    stopwords = {
        "de", "la", "el", "los", "las", "un", "una", "pdf",
        "manual", "documento", "archivo", "archivos", "descargar",
        "descarga", "download", "the", "a", "an", "of",
    }
    query_palabras = [w for w in palabras_query if w not in stopwords]

    mejor_manual = None
    mejor_puntaje = 0

    for manual in manuales:
        nombre = (manual.get("Nombre_Archivo") or "").lower()
        texto = (manual.get("Contenido_Texto") or "").lower()
        nombre_palabras = [w for w in re.findall(r"\w+", nombre) if w not in stopwords]

        score = 0
        # Nombre completo en la pregunta
        if nombre and nombre in pregunta_lower:
            score += 100
        # Palabras del nombre que coinciden con la query
        score += sum(10 for p in nombre_palabras if p in query_palabras)
        # Palabras del nombre mencionadas en la pregunta
        score += sum(3 for p in nombre_palabras if p in pregunta_lower)
        # Palabras de la query en el texto del manual
        score += sum(2 for p in query_palabras if p in texto[:3000])

        if score > mejor_puntaje:
            mejor_puntaje = score
            mejor_manual = {
                "id": manual["ID_Manual"],
                "nombre": manual.get("Nombre_Archivo") or "",
            }

    return mejor_manual if mejor_puntaje >= 5 else None


# =========================================
# CONSTRUIR PROMPT DEL SISTEMA
# =========================================

def construir_prompt_sistema(chunks_contexto):
    """
    Construye el system prompt con el contexto RAG relevante.

    Args:
        chunks_contexto: Lista de dicts del vector_store.buscar_contexto()
    """
    if not chunks_contexto:
        contexto_texto = "No se encontró información relevante en los manuales."
    else:
        partes = []
        for i, chunk in enumerate(chunks_contexto, 1):
            nombre = chunk.get("nombre_archivo", "Manual")
            partes.append(f"--- Fragmento {i} (de: {nombre}) ---\n{chunk['texto']}")
        contexto_texto = "\n\n".join(partes)

    return f"""Eres LUXO, asistente operativo inteligente de Sunglass Hut.

INSTRUCCIONES:
- Responde de manera natural, amable y profesional.
- Usa SOLAMENTE la información proporcionada en los fragmentos de manuales a continuación.
- Si la información solicitada NO está en los fragmentos, responde EXACTAMENTE:
  "Por el momento no cuento con esta información."
- Puedes responder en español o inglés según el idioma de la pregunta.
- Si la respuesta abarca varios pasos, usa listas numeradas.
- Cita el nombre del manual de donde obtuviste la información cuando sea posible.

CONTEXTO RELEVANTE DE LOS MANUALES:

{contexto_texto}"""


# =========================================
# GENERAR RESPUESTA (core)
# =========================================

def generar_respuesta(pregunta, id_usuario):
    """
    Pipeline completo de respuesta con RAG:
    1. Detectar intención
    2. Buscar contexto relevante (RAG)
    3. Obtener historial reciente (memoria)
    4. Llamar a Groq con todo el contexto
    5. Guardar en historial

    Args:
        pregunta: Texto de la pregunta del usuario
        id_usuario: ID del usuario que pregunta

    Returns:
        dict {
            respuesta: str,
            intencion: str,
            id_manual: int|None,
            nombre_pdf: str,
            id_conversacion: int|None,
        }
    """
    resultado = {
        "respuesta": "",
        "intencion": "consulta",
        "id_manual": None,
        "nombre_pdf": "",
        "id_conversacion": None,
    }

    try:
        intencion = detectar_intencion(pregunta)
        resultado["intencion"] = intencion

        # --- Lista de manuales ---
        if intencion == "lista":
            manuales = database.obtener_manuales_listado()
            if manuales:
                nombres = [m.get("Nombre_Archivo", "") for m in manuales]
                resultado["respuesta"] = "📚 Manuales disponibles:\n" + "\n".join(
                    f"  • {n}" for n in nombres
                )
            else:
                resultado["respuesta"] = "No hay manuales cargados."
            return resultado

        # --- Descarga de PDF ---
        if intencion == "descargar":
            manuales = database.obtener_manuales()
            manual = buscar_manual_para_descarga(pregunta, manuales)
            if manual:
                resultado["id_manual"] = manual["id"]
                resultado["nombre_pdf"] = manual["nombre"]
                resultado["respuesta"] = f"📄 PDF relacionado: {manual['nombre']}"
            else:
                resultado["respuesta"] = (
                    "No encontré un PDF relacionado con tu pregunta. "
                    "Intenta ser más específico sobre el manual que buscas."
                )
            return resultado

        # --- Consulta con RAG ---

        # 1. Buscar contexto relevante en ChromaDB
        chunks = vector_store.buscar_contexto(pregunta)

        # Identificar el manual más relevante
        if chunks:
            resultado["id_manual"] = chunks[0].get("id_manual")
            resultado["nombre_pdf"] = chunks[0].get("nombre_archivo", "")

        # 2. Obtener historial reciente (memoria conversacional)
        historial = database.obtener_historial_reciente(id_usuario, MEMORY_SIZE)

        # 3. Construir mensajes para la API
        system_prompt = construir_prompt_sistema(chunks)

        messages = [{"role": "system", "content": system_prompt}]

        # Agregar historial como contexto conversacional
        for msg in historial:
            messages.append({"role": "user", "content": msg["Pregunta_Usuario"]})
            messages.append({"role": "assistant", "content": msg["Respuesta_IA"]})

        # Agregar la pregunta actual
        messages.append({"role": "user", "content": pregunta})

        # 4. Llamar a Groq
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
        }

        res = requests.post(URL_GROQ, headers=headers, json=payload)

        if res.status_code == 200:
            data = res.json()
            if "choices" in data and data["choices"]:
                resultado["respuesta"] = data["choices"][0]["message"]["content"]
            else:
                resultado["respuesta"] = "Ocurrió un error consultando la IA."
        else:
            print("AI CONNECTION ERROR:", res.status_code, res.text)
            resultado["respuesta"] = f"Error de conexión con la IA ({res.status_code})."

        # 5. Guardar en historial
        id_conv = database.guardar_historial(
            id_usuario,
            resultado["id_manual"],
            pregunta,
            resultado["respuesta"],
        )
        resultado["id_conversacion"] = id_conv

        # 6. Registrar pendiente si no pudo responder
        if "Por el momento no cuento con esta información" in resultado["respuesta"]:
            if id_conv:
                database.guardar_pendiente(id_conv, pregunta)

    except Exception as e:
        print("ERROR AI ENGINE:", e)
        resultado["respuesta"] = f"Error interno: {e}"

    return resultado
