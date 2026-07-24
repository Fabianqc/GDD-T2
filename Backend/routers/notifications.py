"""
API de recordatorios de comidas y registro de dispositivos Expo Push.
"""
from __future__ import annotations

import datetime
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

try:
    from ..auth import get_current_user
    from ..database import get_db
    from .. import models
    from ..meal_reminder_service import (
        DEFAULT_ADVANCE_MINUTES,
        ensure_meal_reminder_config,
        parse_hhmm,
        serialize_schedule,
        validate_timezone,
    )
except (ImportError, ValueError):
    from auth import get_current_user
    from database import get_db
    import models
    from meal_reminder_service import (
        DEFAULT_ADVANCE_MINUTES,
        ensure_meal_reminder_config,
        parse_hhmm,
        serialize_schedule,
        validate_timezone,
    )

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])

EXPO_TOKEN_RE = re.compile(r"^ExponentPushToken\[[A-Za-z0-9_-]+\]$")


# ── Schemas ───────────────────────────────────────────────────────────────────

class MealSlotSchema(BaseModel):
    meal_type: models.MealType
    meal_time: str = Field(..., examples=["08:00", "12:30"])
    enabled: bool = True


class MealScheduleResponse(BaseModel):
    patient_id: str
    timezone: str
    advance_minutes: int
    enabled: bool
    updated_at: Optional[datetime.datetime] = None
    slots: List[dict]


class MealScheduleUpdateRequest(BaseModel):
    timezone: Optional[str] = None
    advance_minutes: Optional[int] = Field(default=None, ge=0, le=180)
    enabled: Optional[bool] = None
    slots: List[MealSlotSchema]


class PushDeviceRegisterRequest(BaseModel):
    expo_push_token: str
    platform: Optional[str] = Field(default=None, examples=["android", "ios"])
    device_name: Optional[str] = None
    timezone: Optional[str] = None


class PushDeviceResponse(BaseModel):
    id: str
    expo_push_token: str
    platform: Optional[str] = None
    device_name: Optional[str] = None
    timezone: Optional[str] = None
    is_active: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_patient(user: models.User) -> None:
    if user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")


def _require_doctor(user: models.User) -> None:
    if user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")


def _get_assigned_patient_profile(db: Session, doctor: models.User, patient_id: str) -> models.PatientProfile:
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="ID de paciente inválido.") from exc

    profile = (
        db.query(models.PatientProfile)
        .filter(
            models.PatientProfile.user_id == patient_uuid,
            models.PatientProfile.caregiver_id == doctor.id,
        )
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o no asignado a su cargo.")
    return profile


def _apply_schedule_update(
    db: Session,
    config: models.MealReminderConfig,
    data: MealScheduleUpdateRequest,
    updated_by,
) -> models.MealReminderConfig:
    if data.timezone is not None:
        try:
            config.timezone = validate_timezone(data.timezone)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if data.advance_minutes is not None:
        config.advance_minutes = data.advance_minutes

    if data.enabled is not None:
        config.enabled = data.enabled

    if not data.slots:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un horario de comida.")

    seen = set()
    for slot_data in data.slots:
        if slot_data.meal_type in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de comida duplicado: {slot_data.meal_type.value}",
            )
        seen.add(slot_data.meal_type)

        try:
            meal_time = parse_hhmm(slot_data.meal_time)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        slot = next((s for s in config.slots if s.meal_type == slot_data.meal_type), None)
        if slot is None:
            slot = models.MealReminderSlot(
                patient_id=config.patient_id,
                meal_type=slot_data.meal_type,
                meal_time=meal_time,
                enabled=slot_data.enabled,
            )
            db.add(slot)
        else:
            slot.meal_time = meal_time
            slot.enabled = slot_data.enabled

    config.updated_by = updated_by
    config.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(config)
    return config


# ── Paciente: dispositivos ─────────────────────────────────────────────────────

@router.post("/patient/device", response_model=PushDeviceResponse)
def register_push_device(
    data: PushDeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Registra o actualiza el token Expo Push del dispositivo del paciente."""
    _require_patient(current_user)

    profile = (
        db.query(models.PatientProfile)
        .filter(models.PatientProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        # Perfil mínimo para poder asociar horarios y dispositivos push
        profile = models.PatientProfile(
            user_id=current_user.id,
            date_of_birth=datetime.date(1990, 1, 1),
        )
        db.add(profile)
        db.flush()

    token = (data.expo_push_token or "").strip()
    if not EXPO_TOKEN_RE.match(token):
        raise HTTPException(
            status_code=400,
            detail="Token Expo inválido. Debe tener formato ExponentPushToken[...].",
        )

    tz = None
    if data.timezone:
        try:
            tz = validate_timezone(data.timezone)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    ensure_meal_reminder_config(db, current_user.id, timezone=tz, updated_by=current_user.id)

    device = (
        db.query(models.PatientPushDevice)
        .filter(models.PatientPushDevice.expo_push_token == token)
        .first()
    )
    now = datetime.datetime.utcnow()
    if device:
        device.patient_id = current_user.id
        device.platform = data.platform
        device.device_name = data.device_name
        device.timezone = tz or device.timezone
        device.is_active = True
        device.last_seen_at = now
    else:
        device = models.PatientPushDevice(
            patient_id=current_user.id,
            expo_push_token=token,
            platform=data.platform,
            device_name=data.device_name,
            timezone=tz,
            is_active=True,
            last_seen_at=now,
        )
        db.add(device)

    if tz:
        config = (
            db.query(models.MealReminderConfig)
            .filter(models.MealReminderConfig.patient_id == current_user.id)
            .first()
        )
        if config:
            config.timezone = tz

    db.commit()
    db.refresh(device)
    return PushDeviceResponse(
        id=str(device.id),
        expo_push_token=device.expo_push_token,
        platform=device.platform,
        device_name=device.device_name,
        timezone=device.timezone,
        is_active=device.is_active,
    )


@router.delete("/patient/device")
def unregister_push_device(
    data: PushDeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Desactiva el token Expo Push del dispositivo (p. ej. al cerrar sesión)."""
    _require_patient(current_user)

    token = (data.expo_push_token or "").strip()
    device = (
        db.query(models.PatientPushDevice)
        .filter(
            models.PatientPushDevice.expo_push_token == token,
            models.PatientPushDevice.patient_id == current_user.id,
        )
        .first()
    )
    if device:
        device.is_active = False
        device.last_seen_at = datetime.datetime.utcnow()
        db.commit()

    return {"message": "Dispositivo desregistrado."}


@router.get("/patient/schedule", response_model=MealScheduleResponse)
def get_own_meal_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Consulta la configuración de recordatorios del paciente autenticado."""
    _require_patient(current_user)
    config = ensure_meal_reminder_config(db, current_user.id)
    db.commit()
    return serialize_schedule(config)


# ── Doctor: horarios de pacientes asignados ───────────────────────────────────

@router.get("/doctor/patient/{patient_id}/schedule", response_model=MealScheduleResponse)
def get_patient_meal_schedule(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Doctor consulta los horarios de comida de un paciente a su cargo."""
    _require_doctor(current_user)
    profile = _get_assigned_patient_profile(db, current_user, patient_id)
    config = ensure_meal_reminder_config(db, profile.user_id)
    db.commit()
    return serialize_schedule(config)


@router.put("/doctor/patient/{patient_id}/schedule", response_model=MealScheduleResponse)
def update_patient_meal_schedule(
    patient_id: str,
    data: MealScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Doctor actualiza horarios / anticipación de un paciente asignado."""
    _require_doctor(current_user)
    profile = _get_assigned_patient_profile(db, current_user, patient_id)
    config = ensure_meal_reminder_config(db, profile.user_id, updated_by=current_user.id)
    config = _apply_schedule_update(db, config, data, updated_by=current_user.id)
    return serialize_schedule(config)
