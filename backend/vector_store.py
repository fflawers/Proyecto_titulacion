# =========================================
# vector_store.py — ChromaDB + Embeddings
# =========================================

import chromadb
from chromadb.utils import embedding_functions
from config import CHROMA_DB_PATH, EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP, TOP_K_RESULTS

# =========================================
# INICIALIZACIÓN
# =========================================

_client = None
_collection = None
_embedding_fn = None


def _inicializar():
    """Inicializa ChromaDB y el modelo de embeddings (lazy loading)."""
    global _client, _collection, _embedding_fn

    if _collection is not None:
        return

    print("🔄 Inicializando ChromaDB y modelo de embeddings...")

    _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )

    _client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

    _collection = _client.get_or_create_collection(
        name="manuales_luxo",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"}
    )

    print(f"✅ ChromaDB listo — {_collection.count()} chunks indexados")


def obtener_coleccion():
    """Retorna la colección de ChromaDB, inicializando si es necesario."""
    _inicializar()
    return _collection


# =========================================
# CHUNKING — Dividir texto en fragmentos
# =========================================

def dividir_en_chunks(texto, chunk_size=None, overlap=None):
    """
    Divide un texto largo en chunks con solapamiento.

    Args:
        texto: Texto completo del manual
        chunk_size: Tamaño de cada chunk en caracteres (default: config)
        overlap: Solapamiento entre chunks (default: config)

    Returns:
        Lista de strings (chunks)
    """
    if not texto or not texto.strip():
        return []

    chunk_size = chunk_size or CHUNK_SIZE
    overlap = overlap or CHUNK_OVERLAP

    # Limpiar texto
    texto = texto.strip()

    # Intentar dividir por párrafos primero para respetar estructura
    parrafos = texto.split("\n\n")

    chunks = []
    chunk_actual = ""

    for parrafo in parrafos:
        parrafo = parrafo.strip()
        if not parrafo:
            continue

        # Si el párrafo cabe en el chunk actual, agregarlo
        if len(chunk_actual) + len(parrafo) + 1 <= chunk_size:
            chunk_actual = (chunk_actual + "\n" + parrafo).strip()
        else:
            # Guardar chunk actual si tiene contenido
            if chunk_actual:
                chunks.append(chunk_actual)

            # Si el párrafo es más grande que chunk_size, dividirlo por oraciones
            if len(parrafo) > chunk_size:
                oraciones = parrafo.replace(". ", ".\n").split("\n")
                sub_chunk = ""
                for oracion in oraciones:
                    if len(sub_chunk) + len(oracion) + 1 <= chunk_size:
                        sub_chunk = (sub_chunk + " " + oracion).strip()
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = oracion
                if sub_chunk:
                    chunk_actual = sub_chunk
                else:
                    chunk_actual = ""
            else:
                chunk_actual = parrafo

    # No olvidar el último chunk
    if chunk_actual:
        chunks.append(chunk_actual)

    # Agregar overlap: cada chunk incluye el final del anterior
    if overlap > 0 and len(chunks) > 1:
        chunks_con_overlap = [chunks[0]]
        for i in range(1, len(chunks)):
            prev = chunks[i - 1]
            overlap_text = prev[-overlap:] if len(prev) > overlap else prev
            chunks_con_overlap.append(overlap_text + " " + chunks[i])
        chunks = chunks_con_overlap

    return chunks


# =========================================
# CHUNKING ESPECIALIZADO PARA EXCEL
# =========================================

def dividir_en_chunks_excel(texto: str, chunk_size: int = 2000) -> list[str]:
    """
    Chunking inteligente para texto extraído de Excel.

    Estrategia:
    - Divide por sección de hoja (=== Hoja: ... ===)
    - Dentro de cada hoja, agrupa filas en chunks de chunk_size chars
    - Cada chunk incluye la línea de encabezado de columnas al inicio
      para que el LLM tenga siempre el contexto de "qué columna es qué"
    - Nunca corta a la mitad una fila de datos

    Args:
        texto: Texto extraído por excel_manager
        chunk_size: Máximo de caracteres por chunk (default 1200)

    Returns:
        Lista de chunks con contexto completo
    """
    if not texto or not texto.strip():
        return []

    chunks = []
    # Dividir por hojas
    secciones = []
    seccion_actual = []
    for linea in texto.split("\n"):
        if linea.startswith("=== Hoja:") and seccion_actual:
            secciones.append("\n".join(seccion_actual))
            seccion_actual = [linea]
        else:
            seccion_actual.append(linea)
    if seccion_actual:
        secciones.append("\n".join(seccion_actual))

    for seccion in secciones:
        lineas = seccion.split("\n")
        if not lineas:
            continue

        # Extraer cabecera de hoja y línea de columnas
        cabecera_hoja = ""
        columnas_header = ""
        datos_inicio = 0

        for i, linea in enumerate(lineas):
            if linea.startswith("=== Hoja:"):
                cabecera_hoja = linea
                datos_inicio = i + 1
            elif linea.startswith("Columnas:"):
                columnas_header = linea
                datos_inicio = i + 1
                break

        prefijo = "\n".join(filter(None, [cabecera_hoja, columnas_header]))
        filas_datos = lineas[datos_inicio:]

        # Agrupar filas en chunks respetando el límite de chars
        chunk_filas = []
        chunk_chars = len(prefijo)

        for fila in filas_datos:
            fila = fila.strip()
            if not fila:
                continue

            if chunk_chars + len(fila) + 1 > chunk_size and chunk_filas:
                # Cerrar chunk actual
                chunks.append(prefijo + "\n" + "\n".join(chunk_filas))
                chunk_filas = [fila]
                chunk_chars = len(prefijo) + len(fila)
            else:
                chunk_filas.append(fila)
                chunk_chars += len(fila) + 1

        if chunk_filas:
            chunks.append(prefijo + "\n" + "\n".join(chunk_filas))

    return chunks if chunks else [texto[:2000]]  # fallback


# =========================================
# INDEXAR MANUAL
# =========================================

def indexar_manual(id_manual: int, nombre_archivo: str, texto: str, tipo: str = "pdf"):
    """
    Divide el texto de un manual en chunks, genera embeddings,
    y los almacena en ChromaDB.

    Args:
        id_manual: ID del manual en MySQL
        nombre_archivo: Nombre del archivo
        texto: Texto extraído completo
        tipo: 'pdf' o 'excel' — determina la estrategia de chunking
    """
    collection = obtener_coleccion()

    # Primero eliminar chunks anteriores de este manual (si es actualización)
    eliminar_manual(id_manual)

    # Seleccionar estrategia de chunking según el tipo de archivo
    if tipo == "excel":
        chunks = dividir_en_chunks_excel(texto)
    else:
        chunks = dividir_en_chunks(texto)

    if not chunks:
        print(f"⚠️  No se generaron chunks para el manual {nombre_archivo}")
        return

    # Preparar datos para ChromaDB
    ids = [f"manual_{id_manual}_chunk_{i}" for i in range(len(chunks))]

    metadatas = [
        {
            "id_manual": str(id_manual),
            "nombre_archivo": nombre_archivo,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "tipo": tipo,
        }
        for i in range(len(chunks))
    ]

    # Insertar en ChromaDB (los embeddings se generan automáticamente)
    collection.add(
        documents=chunks,
        ids=ids,
        metadatas=metadatas,
    )

    print(f"✅ Manual '{nombre_archivo}' indexado: {len(chunks)} chunks ({tipo})")



# =========================================
# ELIMINAR MANUAL
# =========================================

def eliminar_manual(id_manual):
    """Elimina todos los chunks de un manual del vector store."""
    collection = obtener_coleccion()

    # Buscar IDs existentes de este manual
    try:
        resultados = collection.get(
            where={"id_manual": str(id_manual)}
        )
        if resultados and resultados["ids"]:
            collection.delete(ids=resultados["ids"])
            print(f"🗑️  Eliminados {len(resultados['ids'])} chunks del manual {id_manual}")
    except Exception as e:
        print(f"⚠️  Error al eliminar chunks: {e}")


# =========================================
# BUSCAR CONTEXTO (core del RAG)
# =========================================

def buscar_contexto(pregunta, top_k=None):
    """
    Busca los chunks más relevantes para una pregunta.

    Args:
        pregunta: Texto de la pregunta del usuario
        top_k: Cantidad de resultados a retornar

    Returns:
        Lista de dicts con {texto, nombre_archivo, id_manual, distancia}
    """
    collection = obtener_coleccion()
    top_k = top_k or TOP_K_RESULTS

    # Si no hay chunks indexados, retornar vacío
    if collection.count() == 0:
        return []

    resultados = collection.query(
        query_texts=[pregunta],
        n_results=min(top_k, collection.count()),
    )

    contextos = []
    if resultados and resultados["documents"] and resultados["documents"][0]:
        for i, doc in enumerate(resultados["documents"][0]):
            metadata = resultados["metadatas"][0][i] if resultados["metadatas"] else {}
            distancia = resultados["distances"][0][i] if resultados["distances"] else 0

            contextos.append({
                "texto": doc,
                "nombre_archivo": metadata.get("nombre_archivo", ""),
                "id_manual": metadata.get("id_manual", ""),
                "distancia": distancia,
            })

    return contextos


def buscar_por_nombre_archivo(nombre_parcial, top_k=None):
    """
    Busca chunks de un manual específico usando el nombre del archivo.
    Útil cuando la pregunta menciona directamente el nombre del documento.

    Args:
        nombre_parcial: Palabras clave del nombre del archivo (case-insensitive)
        top_k: Máximo de chunks a retornar

    Returns:
        Lista de dicts con {texto, nombre_archivo, id_manual, distancia=0.0}
    """
    collection = obtener_coleccion()
    top_k = top_k or TOP_K_RESULTS

    if collection.count() == 0:
        return []

    try:
        # Obtener todos los metadatos y filtrar por nombre
        todos = collection.get(include=["documents", "metadatas"])
        nombre_lower = nombre_parcial.lower()

        coincidencias = []
        for i, meta in enumerate(todos.get("metadatas", [])):
            nombre_archivo = (meta.get("nombre_archivo") or "").lower()
            # Coincidencia si alguna palabra clave del nombre parcial aparece en el archivo
            palabras = [p for p in nombre_lower.split() if len(p) > 2]
            if any(p in nombre_archivo for p in palabras):
                coincidencias.append({
                    "texto": todos["documents"][i],
                    "nombre_archivo": meta.get("nombre_archivo", ""),
                    "id_manual": meta.get("id_manual", ""),
                    "distancia": 0.0,  # Match por nombre = alta confianza
                })

        return coincidencias[:top_k]

    except Exception as e:
        print(f"⚠️  Error en buscar_por_nombre_archivo: {e}")
        return []


# =========================================
# RE-INDEXAR TODOS LOS MANUALES
# =========================================

def reindexar_todos():
    """
    Re-indexa todos los manuales existentes en MySQL.
    Extrae el texto nuevamente del archivo original (binario) para aplicar
    los nuevos algoritmos de limpieza y formateo (ej. formato 'Columna: valor' en Excel),
    actualiza la base de datos con el nuevo texto y re-indexa en ChromaDB.
    """
    import database
    import pdf_manager
    import excel_manager

    manuales = database.obtener_manuales()
    if not manuales:
        print("⚠️  No hay manuales en la BD para indexar.")
        return

    print(f"🔄 Re-indexando {len(manuales)} manuales...")

    for manual in manuales:
        id_manual = manual["ID_Manual"]
        nombre = manual.get("Nombre_Archivo") or manual.get("Titulo") or ""
        tipo_str = manual.get("Tipo_Archivo") or "PDF"
        tipo = tipo_str.lower()
        texto = ""

        try:
            if tipo == "excel":
                datos = database.obtener_excel_binario(id_manual)
                if datos and datos.get("Archivo_Excel"):
                    # Re-extraer usando el nuevo algoritmo inteligente
                    texto = excel_manager.extraer_texto_excel_bytes(datos["Archivo_Excel"])
                    # Actualizar el texto extraído en la base de datos
                    version = manual.get("Version") or "1.0"
                    database.actualizar_manual_excel(id_manual, datos["Archivo_Excel"], texto, version)
                else:
                    texto = manual.get("Contenido_Texto") or ""
            else:
                datos = database.obtener_pdf_binario(id_manual)
                if datos and datos.get("Archivo_PDF"):
                    # Re-extraer usando el nuevo OCR / algoritmo de limpieza
                    texto = pdf_manager.extraer_texto_pdf_bytes(datos["Archivo_PDF"])
                    version = manual.get("Version") or "1.0"
                    database.actualizar_manual_pdf(id_manual, datos["Archivo_PDF"], texto, version)
                else:
                    texto = manual.get("Contenido_Texto") or ""

            if texto.strip():
                indexar_manual(id_manual, nombre, texto, tipo)
            else:
                print(f"⚠️  Manual '{nombre}' no tiene texto útil extraído, saltando...")
        except Exception as e:
            print(f"❌ Error reindexando {nombre}: {e}")

    print(f"✅ Re-indexación completada — {obtener_coleccion().count()} chunks totales")


# Ejecutar re-indexación directamente: python vector_store.py
if __name__ == "__main__":
    reindexar_todos()
