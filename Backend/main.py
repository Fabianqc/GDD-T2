from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

# Cargamos el archivo .env ubicado en el mismo directorio (Backend/.env)
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

from . import models
from .database import engine, get_db
from .routers import auth as auth_router
from .routers import ai as ai_router

# Crear las tablas en la base de datos (si no existen)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GDD-T2 API",
    description="Backend para la Gestión Dietética de Pacientes con Diabetes tipo 2",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajustar en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(ai_router.router)

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de GDD-T2"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
