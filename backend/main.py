# =========================================
# main.py — FastAPI Backend
# =========================================

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from urllib.parse import quote

import auth
import database
import ai_engine
import pdf_manager
import excel_manager
from config import CORS_ORIGINS, ADMIN_HISTORIAL_PASSWORD

# =========================================
# APP
# =========================================

app = FastAPI(
    title="LUXO API",
    description="API del asistente inteligente de Sunglass Hut",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else [],
    allow_origin_regex=".*" if CORS_ORIGINS == ["*"] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================
# SEGURIDAD — JWT
# =========================================

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependencia que extrae y valida el JWT del header Authorization."""
    user = auth.verificar_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return user


def require_admin(user=Depends(get_current_user)):
    """Dependencia que verifica que el usuario es admin."""
    if user["rol"] != "Admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return user


# =========================================
# MODELOS (Request/Response)
# =========================================

class LoginRequest(BaseModel):
    usuario: str
    contrasena: str


class LoginResponse(BaseModel):
    token: str
    nombre: str
    rol: str


class ChatRequest(BaseModel):
    pregunta: str


class ChatResponse(BaseModel):
    respuesta: str
    intencion: str
    id_manual: Optional[int] = None
    nombre_pdf: Optional[str] = None
    id_conversacion: Optional[int] = None


class FeedbackRequest(BaseModel):
    id_conversacion: int
    es_positivo: bool


class ManualResponse(BaseModel):
    id: int
    nombre_archivo: Optional[str] = None
    titulo: Optional[str] = None
    version: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
    success: bool


# =========================================
# ENDPOINTS — AUTENTICACIÓN
# =========================================

@app.post("/api/auth/login", response_model=LoginResponse)
def login_endpoint(req: LoginRequest):
    """Login — verifica credenciales y retorna JWT."""
    user_data = auth.login(req.usuario, req.contrasena)

    if not user_data:
        # Mensaje específico
        if database.usuario_existe(req.usuario):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        else:
            raise HTTPException(status_code=401, detail="Usuario no registrado")

    token = auth.crear_token(user_data)

    return LoginResponse(
        token=token,
        nombre=user_data["nombre"],
        rol=user_data["rol"],
    )


@app.get("/api/auth/me")
def me_endpoint(user=Depends(get_current_user)):
    """Retorna la info del usuario autenticado."""
    return user


# =========================================
# ENDPOINTS — CHAT
# =========================================

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, user=Depends(get_current_user)):
    """Envía una pregunta y recibe respuesta con RAG."""
    if not req.pregunta.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía")

    resultado = ai_engine.generar_respuesta(req.pregunta, user["id"])

    return ChatResponse(
        respuesta=resultado["respuesta"],
        intencion=resultado["intencion"],
        id_manual=resultado.get("id_manual"),
        nombre_pdf=resultado.get("nombre_pdf"),
        id_conversacion=resultado.get("id_conversacion"),
    )


# =========================================
# ENDPOINTS — FEEDBACK
# =========================================

@app.post("/api/feedback", response_model=MessageResponse)
def feedback_endpoint(req: FeedbackRequest, user=Depends(get_current_user)):
    """Guarda feedback (👍/👎) para una respuesta."""
    database.guardar_feedback(req.id_conversacion, req.es_positivo)
    return MessageResponse(
        message="Feedback registrado",
        success=True,
    )


# =========================================
# ENDPOINTS — MANUALES
# =========================================

@app.get("/api/manuales", response_model=list[ManualResponse])
def listar_manuales(user=Depends(get_current_user)):
    """Lista todos los manuales disponibles."""
    manuales = database.obtener_manuales_listado()
    return [
        ManualResponse(
            id=m["ID_Manual"],
            nombre_archivo=m.get("Nombre_Archivo"),
            titulo=m.get("Titulo"),
            version=m.get("Version"),
        )
        for m in manuales
    ]


@app.post("/api/manuales/upload", response_model=MessageResponse)
async def upload_manual(
    archivo: UploadFile = File(...),
    user=Depends(require_admin),
):
    """Sube un nuevo manual PDF o Excel (solo admin)."""
    nombre = archivo.filename.lower()
    es_pdf = nombre.endswith(".pdf")
    es_excel = nombre.endswith(".xlsx") or nombre.endswith(".xls")

    if not es_pdf and not es_excel:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten archivos PDF (.pdf) o Excel (.xlsx, .xls)",
        )

    contenido = await archivo.read()

    if es_pdf:
        exito, mensaje = pdf_manager.cargar_pdf(archivo.filename, contenido)
    else:
        exito, mensaje = excel_manager.cargar_excel(archivo.filename, contenido)

    if not exito:
        raise HTTPException(status_code=400, detail=mensaje)

    return MessageResponse(message=mensaje, success=True)


@app.put("/api/manuales/update", response_model=MessageResponse)
async def update_manual(
    archivo: UploadFile = File(...),
    user=Depends(require_admin),
):
    """Actualiza un manual PDF o Excel existente (solo admin)."""
    nombre = archivo.filename.lower()
    es_pdf = nombre.endswith(".pdf")
    es_excel = nombre.endswith(".xlsx") or nombre.endswith(".xls")

    if not es_pdf and not es_excel:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten archivos PDF (.pdf) o Excel (.xlsx, .xls)",
        )

    contenido = await archivo.read()

    if es_pdf:
        exito, mensaje = pdf_manager.actualizar_pdf(archivo.filename, contenido)
    else:
        exito, mensaje = excel_manager.actualizar_excel(archivo.filename, contenido)

    if not exito:
        raise HTTPException(status_code=400, detail=mensaje)

    return MessageResponse(message=mensaje, success=True)


@app.delete("/api/manuales/{id_manual}", response_model=MessageResponse)
def delete_manual(id_manual: int, user=Depends(require_admin)):
    """Borra un manual (solo admin)."""
    exito, mensaje = pdf_manager.borrar_manual(id_manual)

    if not exito:
        raise HTTPException(status_code=400, detail=mensaje)

    return MessageResponse(message=mensaje, success=True)


@app.get("/api/manuales/{id_manual}/download")
def download_manual(id_manual: int, user=Depends(get_current_user)):
    """Descarga el PDF de un manual."""
    pdf_data = pdf_manager.obtener_pdf_para_descarga(id_manual)

    if not pdf_data:
        raise HTTPException(status_code=404, detail="PDF no encontrado")

    nombre = pdf_data["nombre"]
    nombre_encoded = quote(nombre)
    return Response(
        content=pdf_data["contenido_bytes"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{nombre_encoded}"
        },
    )


@app.get("/api/manuales/{id_manual}/download-excel")
def download_excel(id_manual: int, user=Depends(get_current_user)):
    """Descarga el Excel de un manual."""
    excel_data = excel_manager.obtener_excel_para_descarga(id_manual)

    if not excel_data:
        raise HTTPException(status_code=404, detail="Excel no encontrado")

    nombre = excel_data["nombre"]
    nombre_encoded = quote(nombre)
    return Response(
        content=excel_data["contenido_bytes"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{nombre_encoded}"
        },
    )


# =========================================
# ENDPOINTS — ADMIN: HISTORIAL DE CONSULTAS
# =========================================

class VerifyPasswordRequest(BaseModel):
    password: str


@app.post("/api/admin/verify-historial")
def verify_historial_password(req: VerifyPasswordRequest, user=Depends(require_admin)):
    """Verifica la contraseña de dev para acceder al historial."""
    if req.password != ADMIN_HISTORIAL_PASSWORD:
        raise HTTPException(status_code=403, detail="Contraseña incorrecta")
    return {"success": True}


@app.get("/api/admin/historial")
def admin_historial(
    limite: int = 100,
    user=Depends(require_admin),
    x_historial_password: Optional[str] = None,
):
    """Retorna el historial completo de consultas de todos los usuarios (solo admin + contraseña)."""
    if x_historial_password != ADMIN_HISTORIAL_PASSWORD:
        raise HTTPException(status_code=403, detail="Contraseña de historial requerida")
    historial = database.obtener_historial_admin(limite)
    return historial


# =========================================
# HEALTH CHECK
# =========================================

@app.get("/api/health")
def health():
    """Health check del servidor."""
    return {"status": "ok", "service": "LUXO API"}
