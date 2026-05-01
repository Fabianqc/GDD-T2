from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, database
from .database import engine, get_db

# Crear las tablas en la base de datos (si no existen)
# Nota: En producción es mejor usar Alembic para migraciones
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GDD-T2 API",
    description="Backend para la Gestión Dietética de Pacientes con Diabetes tipo 2",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de GDD-T2"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Aquí se agregarán más rutas (auth, logs, reports, etc.)
