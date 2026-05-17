from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargamos el archivo .env ubicado en el mismo directorio (Backend/.env)
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# El usuario debera configurar su DATABASE_URL en un archivo .env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gdd_t2")

if SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

try:
    # Intentamos crear el motor con Postgres y validar conexion
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    # Intentar una conexion minima para validar credenciales
    with engine.connect() as conn:
        pass
except Exception as e:
    # Fallback automatico a SQLite si Postgres no esta listo o falla de autenticacion
    print("\n" + "="*80)
    print("AVISO DE DESARROLLO: No se pudo conectar a PostgreSQL local.")
    print(f"   Error: {e}")
    print("Usando SQLite local ('sqlite:///./gdd_t2.db') para no bloquear tu desarrollo.")
    print("="*80 + "\n")
    
    SQLALCHEMY_DATABASE_URL = "sqlite:///./gdd_t2.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
