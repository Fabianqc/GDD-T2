from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

# Cargamos el archivo .env ubicado en el mismo directorio (Backend/.env)
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

try:
    from . import models
    from .database import engine, get_db
    from .routers import auth as auth_router
    from .routers import ai as ai_router
    from .routers import dashboard as dashboard_router
except (ImportError, ValueError):
    import models
    from database import engine, get_db
    from routers import auth as auth_router
    from routers import ai as ai_router
    from routers import dashboard as dashboard_router

# Crear las tablas en la base de datos (si no existen)
models.Base.metadata.create_all(bind=engine)

# Auto-migración en caliente: Añadir columnas si no existen
from sqlalchemy import text

_migration_queries = [
    "ALTER TABLE intake_logs ADD COLUMN IF NOT EXISTS image_base64 TEXT;",
    "ALTER TABLE intake_logs ADD COLUMN IF NOT EXISTS doctor_assessment VARCHAR(50);",
    "ALTER TABLE intake_logs ADD COLUMN IF NOT EXISTS doctor_comment TEXT;",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5, 2);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5, 2);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS diabetes_type VARCHAR(100);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS diagnosis_year INTEGER;",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS last_hba1c NUMERIC(4, 2);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS medications TEXT;",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS allergies TEXT;",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS activity_level VARCHAR(100);",
    "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS medical_history TEXT;",
]

for query in _migration_queries:
    try:
        with engine.begin() as conn:
            conn.execute(text(query))
    except Exception as e:
        print(f"[Auto-migration] Warning: Failed to execute '{query}': {e}")


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
app.include_router(dashboard_router.router)

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de GDD-T2"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
