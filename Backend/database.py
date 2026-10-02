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

is_production = os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"

# Reintentos de conexión con PostgreSQL
# Código 57P03 = 'the database system is starting up' (común al reiniciar el servidor VPS)
import time
MAX_RETRIES = 15 if is_production else 5
RETRY_DELAY = 2

connected = False
last_error = None

for attempt in range(1, MAX_RETRIES + 1):
    try:
        temp_engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,
        )
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
        connected = True
        break
    except Exception as e:
        last_error = e
        err_msg = str(e)
        is_starting_up = "57P03" in err_msg or "starting up" in err_msg.lower()
        if is_starting_up or attempt < 3:
            print(f"[Database] Esperando a que PostgreSQL termine de iniciar (intento {attempt}/{MAX_RETRIES})...")
        time.sleep(RETRY_DELAY)

if not connected:
    if is_production:
        print(f"\n[FATAL] Error crítico: No se pudo conectar a PostgreSQL en producción tras {MAX_RETRIES} intentos.")
        print(f"Error: {last_error}")
        raise last_error
    else:
        print("\n" + "="*80)
        print("AVISO DE DESARROLLO: No se pudo conectar a PostgreSQL local.")
        print(f"   Error: {last_error}")
        print("Usando SQLite local ('sqlite:///./gdd_t2.db') para no bloquear tu desarrollo.")
        print("="*80 + "\n")
        
        SQLALCHEMY_DATABASE_URL = "sqlite:///./gdd_t2.db"
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, 
            connect_args={"check_same_thread": False}
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
