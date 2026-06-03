# =========================================
# ai_engine.py — Motor de IA con RAG + Web
# =========================================

import requests
import re
from config import (
    GROQ_API_KEY, URL_GROQ, GROQ_MODEL,
    MEMORY_SIZE, RAG_RELEVANCE_THRESHOLD,
)
import database
import vector_store


# =========================================
# GUARDRAILS — Filtro de temas y mal uso
# =========================================

# Temas permitidos (relacionados con Sunglass Hut / retail / óptica)
TEMAS_PERMITIDOS = [
    "sunglass", "lentes", "gafas", "sol", "óptica", "optica",
    "tienda", "ventas", "venta", "retail", "cliente", "clientes",
    "inventario", "producto", "productos", "marca", "marcas",
    "ray-ban", "rayban", "oakley", "prada", "gucci", "versace",
    "coach", "michael kors", "tiffany", "burberry", "armani",
    "dolce", "luxottica", "essilorluxottica",
    "kpi", "kpis", "métricas", "metricas", "meta", "metas",
    "robo", "robos", "seguridad", "pérdida", "perdida",
    "devolución", "devolucion", "cambio", "cambios", "garantía", "garantia",
    "horario", "turno", "turnos", "nómina", "nomina", "imss",
    "capacitación", "capacitacion", "inducción", "induccion",
    "manual", "manuales", "procedimiento", "protocolo",
    "corte", "caja", "efectivo", "terminal", "pos",
    "silla", "ergonomía", "ergonomia", "postura",
    "uniforme", "dress code", "presentación", "presentacion",
    "apertura", "cierre", "operación", "operacion",
    "supervisor", "gerente", "asesor", "equipo",
    "rh", "recursos humanos", "alta", "baja", "ingreso",
    "ticket", "factura", "nota", "recibo",
    "luxo", "sgh", "sunglass hut",
    "descuento", "promoción", "promocion", "oferta",
]

# Palabras/temas bloqueados (mal uso)
TEMAS_BLOQUEADOS = [
    "hackear", "hackeo", "exploit", "vulnerabilidad",
    "arma", "armas", "droga", "drogas", "narcotráfico",
    "pornografía", "pornografia", "porno", "xxx",
    "violencia", "matar", "asesinar", "suicidio",
    "bomba", "explosivo", "terrorismo",
    "torrent", "piratería", "pirateria", "crack",
    "apuesta", "apuestas", "casino",
    "desnudo", "desnuda", "sexo", "sexual",
]


def es_tema_bloqueado(pregunta):
    """Detecta si la pregunta contiene temas prohibidos/mal uso."""
    pregunta_lower = pregunta.lower()
    return any(t in pregunta_lower for t in TEMAS_BLOQUEADOS)


def es_tema_relevante(pregunta):
    """
    Verifica si la pregunta es relevante para el contexto de la empresa.
    Retorna True si parece relacionada con Sunglass Hut / retail / operaciones.
    También retorna True para saludos y preguntas generales corteses.
    """
    pregunta_lower = pregunta.lower().strip()

    # Permitir saludos y conversación básica
    saludos = [
        "hola", "buenos días", "buenos dias", "buenas tardes",
        "buenas noches", "hey", "hi", "hello", "qué tal", "que tal",
        "cómo estás", "como estas", "gracias", "ok", "vale",
        "ayuda", "help", "quién eres", "quien eres", "qué puedes",
        "que puedes", "qué haces", "que haces",
    ]
    if any(s in pregunta_lower for s in saludos):
        return True

    # Verificar si contiene algún tema permitido
    if any(t in pregunta_lower for t in TEMAS_PERMITIDOS):
        return True

    # Si la pregunta es muy corta (< 4 palabras), darle el beneficio de la duda
    if len(pregunta_lower.split()) < 4:
        return True

    return False


# =========================================
# DETECCIÓN DE INTENCIÓN
# =========================================

def detectar_intencion(pregunta):
    """
    Clasifica la intención del usuario.

    Retorna:
        "conversacional" — saludo, pregunta sobre el bot, charla general (NO necesita PDF)
        "lista"          — quiere ver los manuales disponibles
        "descargar"      — quiere descargar un PDF explícitamente
        "consulta"       — pregunta sobre contenido de manuales (RAG)
    """
    pregunta_lower = pregunta.lower().strip()

    # --- Detectar intención conversacional (NO requiere PDF) ---
    # Preguntas sobre el bot / meta-preguntas
    meta_keywords = [
        "quién te creó", "quien te creo", "quién te hizo", "quien te hizo",
        "quién eres", "quien eres", "qué eres", "que eres",
        "cómo te llamas", "como te llamas",
        "para qué sirves", "para que sirves",
        "qué puedes hacer", "que puedes hacer",
        "qué haces", "que haces",
        "cómo funcionas", "como funcionas",
        "cuál es tu nombre", "cual es tu nombre",
        "eres un robot", "eres una ia", "eres inteligencia artificial",
        "qué tecnología usas", "que tecnologia usas",
        "te programaron", "te crearon", "te desarrollaron",
    ]
    if any(m in pregunta_lower for m in meta_keywords):
        return "conversacional"

    # Saludos y conversación básica
    frases_conversacionales = [
        "hola", "buenos días", "buenos dias", "buenas tardes",
        "buenas noches", "hey", "hi", "hello",
        "qué tal", "que tal", "cómo estás", "como estas",
        "gracias", "muchas gracias", "te agradezco",
        "ok", "vale", "de acuerdo", "entendido",
        "adiós", "adios", "bye", "hasta luego", "nos vemos",
        "buen día", "buen dia",
    ]
    # Solo si la pregunta ES básicamente un saludo (corta o exacta)
    if len(pregunta_lower.split()) <= 5 and any(
        s in pregunta_lower for s in frases_conversacionales
    ):
        return "conversacional"

    # --- Detectar si pide lista de manuales ---
    lista_keywords = [
        "qué manuales", "que manuales", "manuales disponibles",
        "lista de pdf", "qué pdf", "que pdf", "mostrar pdf",
        "ver pdf", "documentos disponibles", "listar manuales",
        "cuáles manuales", "cuales manuales", "show manuals",
        "list manuals", "available manuals", "what manuals",
    ]
    if any(phrase in pregunta_lower for phrase in lista_keywords):
        return "lista"

    # --- Detectar si EXPLÍCITAMENTE quiere descargar un PDF ---
    verbos_descarga = [
        "descargar", "descarga", "descárgame", "download",
        "bajar", "bájame", "dame el archivo", "dame el pdf",
        "envíame el pdf", "enviame el pdf", "pásame el pdf",
        "pasame el pdf", "abrir archivo", "open file",
    ]
    if any(v in pregunta_lower for v in verbos_descarga):
        return "descargar"

    # Todo lo demás es una consulta de contenido → RAG
    return "consulta"


# =========================================
# BUSCAR MANUAL PARA DESCARGA
# =========================================

def buscar_manual_para_descarga(pregunta, manuales):
    """
    Busca el manual más relevante cuando el usuario quiere descargar un PDF.
    Usa scoring por palabras clave en el nombre del archivo.
    Búsqueda case-insensitive (normaliza todo a minúsculas).

    Retorna: dict {id, nombre} o None
    """
    pregunta_lower = pregunta.lower()
    palabras_query = re.findall(r"\w+", pregunta_lower)

    stopwords = {
        "de", "la", "el", "los", "las", "un", "una", "pdf",
        "manual", "documento", "archivo", "archivos", "descargar",
        "descarga", "download", "the", "a", "an", "of",
        "dame", "quiero", "necesito", "pásame", "pasame",
        "envíame", "enviame", "bájame", "bajame",
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
        # Nombre sin extensión en la pregunta
        nombre_sin_ext = nombre.rsplit(".", 1)[0] if "." in nombre else nombre
        if nombre_sin_ext and nombre_sin_ext in pregunta_lower:
            score += 80
        # Palabras del nombre que coinciden con la query
        score += sum(10 for p in nombre_palabras if p in query_palabras)
        # Palabras de la query que aparecen en el nombre del archivo
        score += sum(15 for p in query_palabras if p in nombre)
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

def construir_prompt_sistema(chunks_contexto, usar_conocimiento_general=False):
    """
    Construye el system prompt con contexto RAG.
    Si no hay buen contexto en los manuales, permite que la IA
    use su conocimiento general (solo para temas de la empresa).

    Args:
        chunks_contexto: Lista de dicts del vector_store.buscar_contexto()
        usar_conocimiento_general: Si True, la IA puede complementar con su conocimiento
    """
    # --- Contexto de manuales ---
    if not chunks_contexto:
        seccion_manuales = "No se encontró información relevante en los manuales internos."
    else:
        partes = []
        for i, chunk in enumerate(chunks_contexto, 1):
            nombre = chunk.get("nombre_archivo", "Manual")
            partes.append(f"--- Fragmento {i} (de: {nombre}) ---\n{chunk['texto']}")
        seccion_manuales = "\n\n".join(partes)

    # --- Instrucción de conocimiento general ---
    if usar_conocimiento_general:
        instruccion_fallback = """- Si la información NO está en los manuales pero tú tienes conocimiento general
  sobre el tema (retail, óptica, Sunglass Hut, atención al cliente, etc.),
  puedes responder con tu conocimiento, pero ACLARA al usuario:
  "Esta información no proviene de los manuales internos, es con base en mi conocimiento general."
- Si no tienes información ni en los manuales ni en tu conocimiento, responde:
  "Por el momento no cuento con esta información."""
    else:
        instruccion_fallback = """- Si la información solicitada NO está en los fragmentos de manuales, responde:
  "Por el momento no cuento con esta información."""

    return f"""Eres LUXO, asistente operativo inteligente de Sunglass Hut.

INSTRUCCIONES PRINCIPALES:
- Responde de manera natural, amable y profesional.
- PRIORIZA siempre la información de los manuales internos sobre cualquier otra fuente.
- Si la información está en los manuales, úsala y cita el nombre del manual.
{instruccion_fallback}
- Puedes responder en español o inglés según el idioma de la pregunta.
- Si la respuesta abarca varios pasos, usa listas numeradas.

RESTRICCIONES DE SEGURIDAD:
- SOLO responde preguntas relacionadas con Sunglass Hut, óptica, retail,
  operaciones de tienda, recursos humanos, y temas empresariales relacionados.
- Si la pregunta NO tiene relación con la empresa o el sector, responde amablemente:
  "Lo siento, solo puedo ayudarte con temas relacionados con Sunglass Hut y
   operaciones de tienda. ¿Tienes alguna duda operativa?"
- NUNCA generes contenido inapropiado, ilegal o que no esté relacionado con la empresa.

CONTEXTO DE LOS MANUALES INTERNOS:

{seccion_manuales}"""


# =========================================
# FILTRAR CHUNKS RELEVANTES
# =========================================

def filtrar_chunks_relevantes(chunks, umbral=None):
    """
    Filtra chunks que tengan una distancia coseno por debajo del umbral.
    Chunks con distancia alta = baja relevancia.

    Retorna: (chunks_buenos, hay_contexto_bueno)
    """
    umbral = umbral or RAG_RELEVANCE_THRESHOLD
    buenos = [c for c in chunks if c.get("distancia", 1.0) <= umbral]
    return buenos, len(buenos) > 0


# =========================================
# GENERAR RESPUESTA (core)
# =========================================

def generar_respuesta(pregunta, id_usuario):
    """
    Pipeline completo de respuesta con RAG + Web fallback:
    1. Verificar guardrails (temas bloqueados / fuera de contexto)
    2. Detectar intención
    3. Buscar contexto relevante (RAG)
    4. Si RAG no tiene buena info → buscar en web
    5. Obtener historial reciente (memoria)
    6. Llamar a Groq con todo el contexto
    7. Guardar en historial

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
        # --- GUARDRAIL: Temas bloqueados ---
        if es_tema_bloqueado(pregunta):
            resultado["respuesta"] = (
                "⚠️ Lo siento, no puedo ayudarte con ese tipo de consulta. "
                "Estoy aquí para asistirte con temas operativos de Sunglass Hut. "
                "¿Tienes alguna duda sobre procedimientos, manuales o políticas de la tienda?"
            )
            return resultado

        intencion = detectar_intencion(pregunta)
        resultado["intencion"] = intencion

        # --- Conversacional: saludo / meta-pregunta (sin PDF) ---
        if intencion == "conversacional":
            # No buscar PDF, responder directamente con la IA
            historial = database.obtener_historial_reciente(id_usuario, MEMORY_SIZE)

            system_prompt = construir_prompt_sistema([], usar_conocimiento_general=True)
            messages = [{"role": "system", "content": system_prompt}]
            for msg in historial:
                messages.append({"role": "user", "content": msg["Pregunta_Usuario"]})
                messages.append({"role": "assistant", "content": msg["Respuesta_IA"]})
            messages.append({"role": "user", "content": pregunta})

            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {"model": GROQ_MODEL, "messages": messages}
            res = requests.post(URL_GROQ, headers=headers, json=payload)

            if res.status_code == 200:
                data = res.json()
                if "choices" in data and data["choices"]:
                    resultado["respuesta"] = data["choices"][0]["message"]["content"]
                else:
                    resultado["respuesta"] = "Ocurrió un error consultando la IA."
            else:
                resultado["respuesta"] = f"Error de conexión con la IA ({res.status_code})."

            # Guardar en historial SIN manual asociado
            id_conv = database.guardar_historial(
                id_usuario, None, pregunta, resultado["respuesta"]
            )
            resultado["id_conversacion"] = id_conv
            # id_manual y nombre_pdf quedan como None/"" → no se muestra PDF
            return resultado

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

        # --- Consulta con RAG + Web fallback ---

        # 1. Buscar contexto relevante en ChromaDB
        chunks = vector_store.buscar_contexto(pregunta)

        # 2. Filtrar solo chunks verdaderamente relevantes
        chunks_buenos, hay_buen_contexto = filtrar_chunks_relevantes(chunks)

        # Identificar el manual más relevante (de los buenos)
        if chunks_buenos:
            resultado["id_manual"] = chunks_buenos[0].get("id_manual")
            resultado["nombre_pdf"] = chunks_buenos[0].get("nombre_archivo", "")

        # 3. Si no hay buen contexto, decidir si usar conocimiento general de la IA
        usar_conocimiento_general = False
        if not hay_buen_contexto:
            if es_tema_relevante(pregunta):
                # Tema relevante → dejar que la IA use su conocimiento
                print(f"🧠 RAG sin contexto bueno — usando conocimiento general de la IA: '{pregunta}'")
                usar_conocimiento_general = True
            else:
                # Tema fuera de contexto → rechazar amablemente
                resultado["respuesta"] = (
                    "Lo siento, solo puedo ayudarte con temas relacionados con "
                    "Sunglass Hut y operaciones de tienda. "
                    "¿Tienes alguna duda operativa que pueda resolver?"
                )
                # Guardar en historial y retornar
                id_conv = database.guardar_historial(
                    id_usuario, None, pregunta, resultado["respuesta"]
                )
                resultado["id_conversacion"] = id_conv
                return resultado

        # 4. Obtener historial reciente (memoria conversacional)
        historial = database.obtener_historial_reciente(id_usuario, MEMORY_SIZE)

        # 5. Construir mensajes para la API
        system_prompt = construir_prompt_sistema(
            chunks_buenos if hay_buen_contexto else chunks,
            usar_conocimiento_general,
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Agregar historial como contexto conversacional
        for msg in historial:
            messages.append({"role": "user", "content": msg["Pregunta_Usuario"]})
            messages.append({"role": "assistant", "content": msg["Respuesta_IA"]})

        # Agregar la pregunta actual
        messages.append({"role": "user", "content": pregunta})

        # 6. Llamar a Groq
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

        # 7. Guardar en historial
        id_conv = database.guardar_historial(
            id_usuario,
            resultado["id_manual"],
            pregunta,
            resultado["respuesta"],
        )
        resultado["id_conversacion"] = id_conv

        # 8. Registrar pendiente si no pudo responder
        if "no cuento con esta información" in resultado["respuesta"].lower():
            if id_conv:
                database.guardar_pendiente(id_conv, pregunta)

    except Exception as e:
        print("ERROR AI ENGINE:", e)
        resultado["respuesta"] = f"Error interno: {e}"

    return resultado
