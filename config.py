# =========================================
# config.py — Configuración centralizada
# =========================================

import os
from dotenv import load_dotenv

# Paths
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
ASSETS_PATH = os.path.join(BASE_PATH, "assets")
CHROMA_DB_PATH = os.path.join(BASE_PATH, "chroma_db")

# Cargar variables de entorno
load_dotenv(os.path.join(BASE_PATH, ".env"))

# =========================================
# GROQ / IA
# =========================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("⚠️  ADVERTENCIA: GROQ_API_KEY no encontrada en .env")

URL_GROQ = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# =========================================
# BASE DE DATOS
# =========================================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "sgh_portal"),
}

# =========================================
# RAG
# =========================================

# Modelo de embeddings multilingüe (español + inglés)
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

# Tamaño de cada chunk de texto (en caracteres)
CHUNK_SIZE = 500

# Solapamiento entre chunks para no perder contexto
CHUNK_OVERLAP = 50

# Cantidad de chunks relevantes a recuperar por pregunta
TOP_K_RESULTS = 5

# =========================================
# MEMORIA CONVERSACIONAL
# =========================================

# Cantidad de mensajes recientes a incluir como contexto
MEMORY_SIZE = 5
