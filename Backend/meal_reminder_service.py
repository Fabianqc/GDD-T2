"""
Helpers para horarios de recordatorio de comidas.
Horarios predeterminados:
  DESAYUNO 08:00, ALMUERZO 12:30, MERIENDA 16:30, CENA 20:00
Anticipación: 30 minutos.
"""
from __future__ import annotations

import datetime
import re
from typing import Iterable, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

try:
    from . import models
except (ImportError, ValueError):
    import models

DEFAULT_TIMEZONE = "America/Caracas"
DEFAULT_ADVANCE_MINUTES = 30
HHMM_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

DEFAULT_MEAL_TIMES = {
    models.MealType.DESAYUNO: datetime.time(8, 0),
    models.MealType.ALMUERZO: datetime.time(12, 30),
    models.MealType.MERIENDA: datetime.time(16, 30),
    models.MealType.CENA: datetime.time(20, 0),
}

MEAL_LABELS = {
    models.MealType.DESAYUNO: "desayuno",
    models.MealType.ALMUERZO: "almuerzo",
    models.MealType.MERIENDA: "merienda",
    models.MealType.CENA: "cena",
}


def parse_hhmm(value: str) -> datetime.time:
    value = (value or "").strip()
    if not HHMM_RE.match(value):
        raise ValueError(f"Hora inválida '{value}'. Usa formato HH:mm (24h).")
    hour, minute = value.split(":")
    return datetime.time(int(hour), int(minute))


def format_hhmm(value: datetime.time) -> str:
    return value.strftime("%H:%M")


def validate_timezone(tz_name: str) -> str:
    name = (tz_name or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Zona horaria inválida: {name}") from exc
    return name


def ensure_meal_reminder_config(
    db: Session,
    patient_id,
    timezone: Optional[str] = None,
    updated_by=None,
) -> models.MealReminderConfig:
    """Crea la configuración y slots por defecto si el paciente no los tiene."""
    config = (
        db.query(models.MealReminderConfig)
        .filter(models.MealReminderConfig.patient_id == patient_id)
        .first()
    )
    if config:
        existing_types = {slot.meal_type for slot in config.slots}
        for meal_type, meal_time in DEFAULT_MEAL_TIMES.items():
            if meal_type not in existing_types:
                db.add(
                    models.MealReminderSlot(
                        patient_id=patient_id,
                        meal_type=meal_type,
                        meal_time=meal_time,
                        enabled=True,
                    )
                )
        if timezone:
            config.timezone = validate_timezone(timezone)
        db.flush()
        return config

    tz = validate_timezone(timezone or DEFAULT_TIMEZONE)
    config = models.MealReminderConfig(
        patient_id=patient_id,
        timezone=tz,
        advance_minutes=DEFAULT_ADVANCE_MINUTES,
        enabled=True,
        updated_by=updated_by,
    )
    db.add(config)
    db.flush()

    for meal_type, meal_time in DEFAULT_MEAL_TIMES.items():
        db.add(
            models.MealReminderSlot(
                patient_id=patient_id,
                meal_type=meal_type,
                meal_time=meal_time,
                enabled=True,
            )
        )
    db.flush()
    return config


def bootstrap_all_patient_schedules(db: Session) -> int:
    """Inicializa horarios para todos los pacientes existentes. Retorna cuántos se crearon/completaron."""
    profiles = db.query(models.PatientProfile).all()
    count = 0
    for profile in profiles:
        before = (
            db.query(models.MealReminderConfig)
            .filter(models.MealReminderConfig.patient_id == profile.user_id)
            .first()
        )
        ensure_meal_reminder_config(db, profile.user_id)
        if before is None:
            count += 1
    db.commit()
    return count


def serialize_schedule(config: models.MealReminderConfig) -> dict:
    slots = sorted(config.slots, key=lambda s: list(DEFAULT_MEAL_TIMES.keys()).index(s.meal_type))
    return {
        "patient_id": str(config.patient_id),
        "timezone": config.timezone,
        "advance_minutes": config.advance_minutes,
        "enabled": bool(config.enabled),
        "updated_at": config.updated_at,
        "slots": [
            {
                "meal_type": slot.meal_type.value,
                "meal_time": format_hhmm(slot.meal_time),
                "enabled": bool(slot.enabled),
            }
            for slot in slots
        ],
    }


def patient_logged_meal_today(
    db: Session,
    patient_id,
    meal_type: models.MealType,
    local_date: datetime.date,
    timezone_name: str,
) -> bool:
    """True si el paciente ya registró esa comida en el día local indicado."""
    tz = ZoneInfo(timezone_name)
    start_local = datetime.datetime.combine(local_date, datetime.time.min, tzinfo=tz)
    end_local = start_local + datetime.timedelta(days=1)
    start_utc = start_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(datetime.timezone.utc).replace(tzinfo=None)

    existing = (
        db.query(models.IntakeLog)
        .filter(
            models.IntakeLog.patient_id == patient_id,
            models.IntakeLog.meal_type == meal_type,
            models.IntakeLog.consumed_at >= start_utc,
            models.IntakeLog.consumed_at < end_utc,
        )
        .first()
    )
    return existing is not None


def iter_due_slots(
    configs: Iterable[models.MealReminderConfig],
    now_utc: Optional[datetime.datetime] = None,
) -> List[dict]:
    """
    Devuelve slots cuyo aviso (hora - anticipación) ya venció en el minuto actual
    (ventana de 0–2 minutos para tolerar ticks del worker).
    """
    now_utc = now_utc or datetime.datetime.now(datetime.timezone.utc)
    due = []

    for config in configs:
        if not config.enabled:
            continue
        try:
            tz = ZoneInfo(config.timezone or DEFAULT_TIMEZONE)
        except ZoneInfoNotFoundError:
            tz = ZoneInfo(DEFAULT_TIMEZONE)

        now_local = now_utc.astimezone(tz)
        local_date = now_local.date()
        advance = max(0, int(config.advance_minutes or DEFAULT_ADVANCE_MINUTES))

        for slot in config.slots:
            if not slot.enabled:
                continue
            meal_dt_local = datetime.datetime.combine(local_date, slot.meal_time, tzinfo=tz)
            notify_at = meal_dt_local - datetime.timedelta(minutes=advance)
            # Ventana: desde notify_at hasta notify_at + 2 min
            delta_seconds = (now_local - notify_at).total_seconds()
            if 0 <= delta_seconds < 120:
                due.append(
                    {
                        "config": config,
                        "slot": slot,
                        "local_date": local_date,
                        "notify_at_utc": notify_at.astimezone(datetime.timezone.utc).replace(tzinfo=None),
                        "meal_label": MEAL_LABELS.get(slot.meal_type, slot.meal_type.value.lower()),
                        "meal_time_str": format_hhmm(slot.meal_time),
                    }
                )
    return due
