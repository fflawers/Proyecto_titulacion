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
# JWT
# =========================================

JWT_SECRET = os.getenv("JWT_SECRET", "luxo-secret-key-change-in-production-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

# =========================================
# RAG
# =========================================

EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K_RESULTS = 5
RAG_RELEVANCE_THRESHOLD = 0.65  # Distancia coseno máxima para considerar un chunk relevante

# =========================================
# MEMORIA CONVERSACIONAL
# =========================================

MEMORY_SIZE = 5

# =========================================
# CONTRASEÑA DEV PARA HISTORIAL
# =========================================

ADMIN_HISTORIAL_PASSWORD = os.getenv("ADMIN_HISTORIAL_PASSWORD", "luxo2024dev")

# =========================================
# CORS — Frontend origins permitidos
# =========================================

CORS_ORIGINS = ["*"]  # Permite cualquier origen (ngrok, localhost:517X, etc.)
