from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

try:
    from .. import models
    from ..database import get_db
    from ..auth import (
        hash_password,
        verify_password,
        create_access_token,
        create_refresh_token,
        decode_token,
        get_current_user,
    )
except (ImportError, ValueError):
    import models
    from database import get_db
    from auth import (
        hash_password,
        verify_password,
        create_access_token,
        create_refresh_token,
        decode_token,
        get_current_user,
    )

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}  # Pydantic v2


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario con rol PACIENTE.
    El rol puede ser cambiado posteriormente por un administrador.
    """
    # Normalización de datos de entrada
    clean_email = data.email.strip().lower()
    clean_first_name = data.first_name.strip().title()
    clean_last_name = data.last_name.strip().title()

    # Verificar email único
    existing = db.query(models.User).filter(models.User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese correo electrónico",
        )

    # Validar contraseña mínima
    if len(data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La contraseña debe tener al menos 8 caracteres",
        )

    user = models.User(
        email=clean_email,
        password_hash=hash_password(data.password),
        first_name=clean_first_name,
        last_name=clean_last_name,
        role=models.UserRole.PACIENTE,  # Siempre PACIENTE en registro público
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Serializar manualmente para UserResponse
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.value,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica al usuario y retorna access_token (15 min) + refresh_token (7 días).
    """
    clean_email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == clean_email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    user_id = str(user.id)

    # Crear tokens
    access_token = create_access_token(
        data={"sub": user_id, "email": user.email, "role": user.role.value}
    )
    refresh_token, jti = create_refresh_token(user_id)

    # Guardar refresh token en BD (para rotate/blacklist)
    db_refresh = models.RefreshToken(
        jti=jti,
        user_id=user.id,
    )
    db.add(db_refresh)
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    """
    Rotate Token Strategy:
    1. Valida el refresh token recibido
    2. Verifica que el jti NO esté revocado
    3. Revoca el token actual (jti blacklist)
    4. Emite un nuevo par access_token + refresh_token
    """
    # Decodificar y validar
    payload = decode_token(data.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere un refresh token válido",
        )

    jti = payload.get("jti")
    user_id = payload.get("sub")

    # Buscar en BD y verificar que no esté revocado
    db_token = db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).first()
    if not db_token or db_token.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o ya utilizado",
        )

    # Obtener usuario
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    # ── ROTATE: revocar el token actual ──────────────────────────────────────
    db_token.revoked = True
    db_token.revoked_at = datetime.now(timezone.utc)

    # Crear nuevos tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    new_refresh_token, new_jti = create_refresh_token(str(user.id))

    # Guardar nuevo refresh token
    new_db_refresh = models.RefreshToken(
        jti=new_jti,
        user_id=user.id,
    )
    db.add(new_db_refresh)
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    """
    Revoca el refresh token para cerrar sesión de forma segura.
    """
    try:
        payload = decode_token(data.refresh_token)
        jti = payload.get("jti")
        db_token = db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).first()
        if db_token and not db_token.revoked:
            db_token.revoked = True
            db_token.revoked_at = datetime.now(timezone.utc)
            db.commit()
    except Exception:
        pass  # Logout silencioso aunque el token sea inválido


@router.get("/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Retorna los datos del usuario autenticado."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role.value,
        created_at=current_user.created_at,
    )
