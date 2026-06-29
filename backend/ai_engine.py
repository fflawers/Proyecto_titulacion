# =========================================
# ai_engine.py — Motor de IA con RAG + Web
# =========================================

import requests
import re
import time
import math
import os
import threading
from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()

from config import (
    GROQ_API_KEY, URL_GROQ, GROQ_MODEL,
    MEMORY_SIZE, RAG_RELEVANCE_THRESHOLD,
)
import database
import vector_store

# =========================================
# CONFIGURACIÓN GROQ Y GEMINI
# =========================================

groq_client = Groq(api_key=GROQ_API_KEY)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# =========================================
# LLAMADA A GROQ CON REINTENTOS
# =========================================

def llamar_groq(messages, max_reintentos=3):
    """
    Llama a la API de Groq con reintentos automáticos para errores 429.
    Espera progresiva: 2s, 4s, 8s entre reintentos.

    Args:
        messages: Lista de mensajes para la API
        max_reintentos: Número máximo de reintentos (default: 3)

    Returns:
        dict {ok: bool, respuesta: str}
    """
    for intento in range(max_reintentos + 1):
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=messages,
                model=GROQ_MODEL,
            )
            return {"ok": True, "respuesta": chat_completion.choices[0].message.content}
        except Exception as e:
            if "429" in str(e) and intento < max_reintentos:
                espera = 2 ** (intento + 1)
                time.sleep(espera)
                continue
            return {"ok": False, "respuesta": "Error de conexión con el servicio de IA."}

# =========================================
# LLAMAR A GEMINI (Para Fotos/Videos)
# =========================================

def llamar_gemini(system_prompt, messages, archivo_bytes, archivo_tipo):
    """
    Llama a Gemini 1.5 Flash usando el historial y el archivo multimedia.
    """
    try:
        model = genai.GenerativeModel(
            model_name='gemini-1.5-flash',
            system_instruction=system_prompt
        )
        
        parts = []
        if archivo_bytes:
            parts.append({"mime_type": archivo_tipo, "data": archivo_bytes})
            
        # Convertir historial a texto
        prompt_texto = "HISTORIAL CONVERSACIONAL (y pregunta actual al final):\n"
        for msg in messages:
            if msg["role"] != "system":
                prompt_texto += f"{msg['role'].upper()}: {msg['content']}\n"
                
        parts.append(prompt_texto)
        
        response = model.generate_content(parts)
        return {"respuesta": response.text}
    except Exception as e:
        print(f"Error en Gemini: {e}")
        return {"respuesta": "Lo siento, tuve un problema analizando el archivo multimedia (verifica la clave de API y formato)."}

def clasificar_pregunta_faltante_async(pregunta_texto, id_pend):
    def run_classification():
        try:
            # Reimplementación simplificada para el hilo async
            system_msg = {
                "role": "system",
                "content": "Clasifica la siguiente pregunta de un usuario en UNA de las siguientes categorías exactas: 'Impresoras', 'Políticas de Venta', 'Sistemas/Terminales', 'Manuales', 'Otros'. Responde ÚNICAMENTE con la palabra de la categoría (una sola palabra, sin comillas ni punto)."
            }
            user_msg = {"role": "user", "content": pregunta_texto}
            messages = [system_msg, user_msg]
            
            res = llamar_groq(messages)
            if res["ok"]:
                categoria = res["respuesta"].strip().replace("'", "").replace('"', '').replace(".", "")
                valid_categories = ['Impresoras', 'Políticas de Venta', 'Sistemas/Terminales', 'Manuales', 'Otros']
                matched_cat = "Otros"
                for cat in valid_categories:
                    if cat.lower() in categoria.lower() or categoria.lower() in cat.lower():
                        matched_cat = cat
                        break
                db_conn = database.conectar_db()
                if db_conn:
                    cursor_up = db_conn.cursor()
                    cursor_up.execute(
                        "UPDATE pendientes_actualizacion SET Categoria = %s WHERE ID_Pendiente = %s",
                        (matched_cat, id_pend)
                    )
                    db_conn.commit()
                    db_conn.close()
        except Exception as ex:
            print("ERROR EN CLASIFICACION ASYNC:", ex)
    threading.Thread(target=run_classification, daemon=True).start()


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


# =========================================
# PALABRAS CLAVE — ROUTING A SOPORTE
# =========================================

# Palabras que indican un problema técnico que requiere soporte humano
KEYWORDS_SOPORTE = [
    # Impresoras / recibos
    "impresora", "imprime", "imprimir", "no imprime", "papel", "cartucho",
    "recibo", "ticket impreso", "impresion", "impresión",
    # Terminales / cobro
    "terminal", "pos", "no cobra", "no lee", "tarjeta no lee",
    "datafóno", "datafono", "lector", "chip", "banda magnética",
    # Sistema / cómputo
    "sistema caíd", "sistema caío", "no abre", "no funciona el sistema",
    "pantalla negra", "error sistema", "reinició", "reinicio solo",
    "colgado", "colgada", "lento", "internet caído", "sin internet",
    "wifi", "red", "conexion", "conexión",
    # Caja / efectivo
    "caja no abre", "cajón", "cajero", "billete falso",
    # Alarmas / seguridad física
    "alarma", "sensor", "antirrobo", "chicharra", "el sensor no",
    # Fallas eléctricas
    "luz", "apagó", "corte de luz", "no hay luz", "no enciende",
    # Soporte explícito
    "soporte", "técnico", "tecnico", "mantenimiento", "reparar", "reparación",
    "ayuda urgente", "urgente", "problema con",
]


def detectar_necesita_soporte(pregunta):
    """
    Detecta si la pregunta contiene palabras clave que indican
    un problema técnico-operativo que requiere soporte humano.
    Retorna True si se recomienda crear un ticket.
    """
    pregunta_lower = pregunta.lower()
    return any(kw in pregunta_lower for kw in KEYWORDS_SOPORTE)


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

def construir_prompt_sistema(chunks_contexto, usar_conocimiento_general=False, idioma="es"):
    """
    Construye el system prompt con contexto RAG.
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
        instruccion_fallback = (
            "- Puedes responder con tu conocimiento general sobre retail, óptica y Sunglass Hut\n"
            "  ÚNICAMENTE para información básica de contexto (definiciones, conceptos generales).\n"
            "- ACLARA siempre: Esta información no proviene de los manuales internos.\n"
            "- JAMÁS inventes procedimientos, políticas, listas de pasos o contenido específico que no esté en los fragmentos.\n"
            "- Si el usuario pide el contenido de un documento específico que no está en los fragmentos, responde:\n"
            "  No encontré ese documento en el sistema. ¿Está cargado en los manuales?"
        )
    else:
        instruccion_fallback = (
            "- Si la información solicitada NO está EXPLÍCITAMENTE en los fragmentos de manuales, responde:\n"
            "  No encontré información sobre eso en los manuales disponibles.\n"
            "- NUNCA inventes procedimientos, políticas, listas de pasos o datos que no estén en los fragmentos.\n"
            "- Si el usuario pregunta por un documento específico que no aparece en los fragmentos, responde:\n"
            "  Ese documento no está disponible en el sistema actualmente."
        )


    return f"""Eres LUXO, asistente operativo inteligente de Sunglass Hut.

INSTRUCCIONES PRINCIPALES:
- Responde de manera natural, amable y profesional.
- PRIORIZA siempre la información de los manuales internos sobre cualquier otra fuente.
- Si la información está en los manuales, úsala y cita el nombre del manual.
{instruccion_fallback}
- RESPONDE ESTRICTAMENTE EN EL SIGUIENTE IDIOMA (Ignora en qué idioma esté tu contexto o los manuales): {idioma.upper()}.
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
    """
    umbral = umbral or RAG_RELEVANCE_THRESHOLD
    buenos = [c for c in chunks if c.get("distancia", 1.0) <= umbral]
    return buenos, len(buenos) > 0


# =========================================
# GENERAR RESPUESTA (core)
# =========================================

def generar_respuesta(pregunta, id_usuario, idioma="es", archivo_bytes=None, archivo_tipo=None):
    resultado = {
        "respuesta": "",
        "intencion": "consulta",
        "id_manual": None,
        "nombre_pdf": "",
        "id_conversacion": None,
        "es_abierto": True,
        "sugiere_ticket": False,  # ← nuevo: True si la pregunta indica problema técnico
    }

    try:
        if es_tema_bloqueado(pregunta):
            resultado["respuesta"] = (
                "⚠️ Lo siento, no puedo ayudarte con ese tipo de consulta. "
                "Estoy aquí para asistirte con temas operativos de Sunglass Hut. "
                "¿Tienes alguna duda sobre procedimientos, manuales o políticas de la tienda?"
            )
            return resultado

        # Detectar si la pregunta sugiere un problema técnico que requiere soporte
        if detectar_necesita_soporte(pregunta):
            resultado["sugiere_ticket"] = True

        intencion = detectar_intencion(pregunta)
        resultado["intencion"] = intencion

        if intencion == "conversacional":
            historial = database.obtener_historial_reciente(id_usuario, MEMORY_SIZE)
            system_prompt = construir_prompt_sistema([], usar_conocimiento_general=True, idioma=idioma)
            messages = [{"role": "system", "content": system_prompt}]
            for msg in historial:
                messages.append({"role": "user", "content": msg["Pregunta_Usuario"]})
                messages.append({"role": "assistant", "content": msg["Respuesta_IA"]})
            messages.append({"role": "user", "content": pregunta})

            if archivo_bytes and GEMINI_API_KEY:
                resultado_ia = llamar_gemini(system_prompt, messages, archivo_bytes, archivo_tipo)
            else:
                resultado_ia = llamar_groq(messages)

            resultado["respuesta"] = resultado_ia["respuesta"]

            id_conv = database.guardar_historial(
                id_usuario, None, pregunta, resultado["respuesta"]
            )
            resultado["id_conversacion"] = id_conv

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

        # 1a. Intentar búsqueda por nombre de archivo si la pregunta menciona uno
        #     (útil para PDFs con texto OCR de baja calidad semántica)
        manuales_disponibles = database.obtener_manuales_listado()
        chunks_por_nombre = []
        for manual in manuales_disponibles:
            nombre = (manual.get("Nombre_Archivo") or "").lower()
            nombre_sin_ext = nombre.rsplit(".", 1)[0]
            # Palabras significativas del nombre (>3 letras)
            palabras_nombre = [p for p in nombre_sin_ext.split() if len(p) > 3]
            pregunta_lower = pregunta.lower()
            # Si al menos 2 palabras del nombre aparecen en la pregunta → buscar sus chunks
            coincidencias = sum(1 for p in palabras_nombre if p in pregunta_lower)
            if coincidencias >= 2 or (len(palabras_nombre) == 1 and palabras_nombre[0] in pregunta_lower):
                nombre_query = " ".join(palabras_nombre)
                found = vector_store.buscar_por_nombre_archivo(nombre_query)
                if found:
                    print(f"📁 Match por nombre de archivo: '{nombre}' ({len(found)} chunks)")
                    chunks_por_nombre.extend(found)

        # 1b. Búsqueda semántica estándar
        chunks = vector_store.buscar_contexto(pregunta)

        # Combinar: primero los de nombre exacto, luego los semánticos (sin duplicados)
        ids_ya_incluidos = {c["texto"][:50] for c in chunks_por_nombre}
        for c in chunks:
            if c["texto"][:50] not in ids_ya_incluidos:
                chunks_por_nombre.append(c)
        chunks = chunks_por_nombre

        # 2. Filtrar solo chunks verdaderamente relevantes
        chunks_buenos, hay_buen_contexto = filtrar_chunks_relevantes(chunks)

        # Identificar el manual más relevante (de los buenos)
        if chunks_buenos:
            id_m = chunks_buenos[0].get("id_manual")
            resultado["id_manual"] = id_m
            resultado["nombre_pdf"] = chunks_buenos[0].get("nombre_archivo", "")
            if id_m:
                for m in manuales_disponibles:
                    if str(m["ID_Manual"]) == str(id_m):
                        resultado["es_abierto"] = bool(m.get("Abierto", 1))
                        break

        # 3. Si no hay buen contexto, ser honesto — NO alunar con conocimiento general
        usar_conocimiento_general = False
        if not hay_buen_contexto:
            if es_tema_relevante(pregunta):
                # Hay topic relevante pero sin documento cargado → responder honestamente
                print(f"⚠️  RAG sin contexto bueno para: '{pregunta}' — respondiendo sin PDF")
                usar_conocimiento_general = True
                # Limpiar referencia a PDF para no mostrar botón incorrecto
                resultado["id_manual"] = None
                resultado["nombre_pdf"] = ""
            else:
                # Tema fuera de contexto → rechazar amablemente
                resultado["respuesta"] = (
                    "Lo siento, solo puedo ayudarte con temas relacionados con "
                    "Sunglass Hut y operaciones de tienda. "
                    "¿Tienes alguna duda operativa que pueda resolver?"
                )
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
            idioma=idioma
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Agregar historial como contexto conversacional
        for msg in historial:
            messages.append({"role": "user", "content": msg["Pregunta_Usuario"]})
            messages.append({"role": "assistant", "content": msg["Respuesta_IA"]})

        # Agregar la pregunta actual
        messages.append({"role": "user", "content": pregunta})

        # 6. Llamar a Groq o Gemini (si hay multimedia)
        if archivo_bytes and GEMINI_API_KEY:
            resultado_ia = llamar_gemini(system_prompt, messages, archivo_bytes, archivo_tipo)
        else:
            resultado_ia = llamar_groq(messages)
            
        resultado["respuesta"] = resultado_ia["respuesta"]

        # 7. Guardar en historial
        id_conv = database.guardar_historial(
            id_usuario,
            resultado["id_manual"],
            pregunta,
            resultado["respuesta"],
        )
        resultado["id_conversacion"] = id_conv

        # 8. Si la respuesta indica que no encontró info, limpiar referencia al PDF
        #    para no mostrar el botón de vista previa de un documento incorrecto
        frases_sin_info = [
            "no encontré información",
            "no encontré ese documento",
            "no está disponible en el sistema",
            "no cuento con esta información",
            "por el momento no cuento",
        ]
        respuesta_lower = resultado["respuesta"].lower()
        if any(f in respuesta_lower for f in frases_sin_info):
            resultado["id_manual"] = None
            resultado["nombre_pdf"] = ""

        # 9. Registrar pendiente si no pudo responder + auto-ticket
        if "no cuento con esta información" in resultado["respuesta"].lower() or \
           "no encontré" in resultado["respuesta"].lower():
            if id_conv:
                database.guardar_pendiente(id_conv, pregunta)
                # Crear auto-ticket para que el admin lo revise
                database.crear_ticket_automatico(id_usuario, pregunta)
                # Recuperar el ID insertado para pasarlo al hilo de clasificacion
                db_c = database.conectar_db()
                if db_c:
                    cur = db_c.cursor()
                    cur.execute("SELECT ID_Pendiente FROM pendientes_actualizacion WHERE ID_Conversacion = %s ORDER BY ID_Pendiente DESC LIMIT 1", (id_conv,))
                    row = cur.fetchone()
                    db_c.close()
                    if row:
                        clasificar_pregunta_faltante_async(pregunta, row[0])

    except Exception as e:
        print("ERROR AI ENGINE:", e)
        resultado["respuesta"] = f"Error interno: {e}"

    return resultado
