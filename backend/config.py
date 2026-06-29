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
# GOOGLE GEMINI (Vision AI para campañas)
# =========================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    print("ℹ️   GEMINI_API_KEY no configurada — auditoría visual de campañas desactivada")

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
CHUNK_SIZE = 1500      # Reducido para respetar el límite de 6000 TPM de Groq
CHUNK_OVERLAP = 200    # Solapamiento adecuado
TOP_K_RESULTS = 3      # Reducido a 3 para no exceder los tokens permitidos
RAG_RELEVANCE_THRESHOLD = 0.55  # Ligeramente más permisivo para textos OCR
                                 # (OCR genera embeddings menos perfectos que texto digital)


# =========================================
# OCR
# =========================================

OCR_DPI = 300                  # Resolución de renderizado (200 → 300 DPI = mucho mejor)
OCR_MIN_CHARS = 200            # Si el PDF tiene menos chars → aplicar OCR
OCR_LANG = "spa+eng"           # Idiomas soportados por Tesseract
OCR_CONFIG = "--psm 3 --oem 3" # psm 3=auto, oem 3=LSTM neural (el más preciso)


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
