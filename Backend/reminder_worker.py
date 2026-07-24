"""
Worker independiente de recordatorios de comida (proceso único).

Uso:
  python reminder_worker.py

Revisa cada minuto los avisos vencidos, reclama el slot con UNIQUE en BD
y envía notificaciones push vía Expo Push API.
"""
from __future__ import annotations

import asyncio
import datetime
import sys
import traceback
from pathlib import Path
from typing import List

import httpx
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError

# Asegura imports relativos al directorio Backend
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

import models  # noqa: E402
from database import SessionLocal  # noqa: E402
from meal_reminder_service import (  # noqa: E402
    ensure_meal_reminder_config,
    iter_due_slots,
    patient_logged_meal_today,
)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
POLL_INTERVAL_SECONDS = 60
RETRY_FAILED_WINDOW_MINUTES = 15


def utc_now() -> datetime.datetime:
    """UTC naive (compatible con columnas DateTime sin timezone)."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _deactivate_invalid_tokens(db, tokens: List[str]) -> None:
    if not tokens:
        return
    devices = (
        db.query(models.PatientPushDevice)
        .filter(models.PatientPushDevice.expo_push_token.in_(tokens))
        .all()
    )
    for device in devices:
        device.is_active = False
        device.last_seen_at = utc_now()


async def _send_expo_messages(messages: List[dict]) -> dict:
    """
    Envía mensajes a Expo Push API.
    Retorna { 'ok_tokens': [...], 'invalid_tokens': [...], 'errors': [...] }
    """
    result = {"ok_tokens": [], "invalid_tokens": [], "errors": []}
    if not messages:
        return result

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(EXPO_PUSH_URL, headers=headers, json=messages)
        response.raise_for_status()
        payload = response.json()

    tickets = payload.get("data") or []
    for idx, ticket in enumerate(tickets):
        token = messages[idx]["to"] if idx < len(messages) else None
        status = ticket.get("status")
        if status == "ok":
            if token:
                result["ok_tokens"].append(token)
            continue

        err_details = ticket.get("details") or {}
        err_code = err_details.get("error") or ticket.get("message") or "unknown"
        result["errors"].append(str(err_code))
        if err_code in ("DeviceNotRegistered", "InvalidCredentials") and token:
            result["invalid_tokens"].append(token)

    return result


def _claim_delivery(db, patient_id, meal_type, reminder_date, scheduled_for):
    """
    Inserta PENDING. Si ya existe (UNIQUE), retorna None.
    Si existe FAILED reciente, permite reintento actualizando el mismo registro.
    """
    existing = (
        db.query(models.MealReminderDelivery)
        .filter(
            models.MealReminderDelivery.patient_id == patient_id,
            models.MealReminderDelivery.meal_type == meal_type,
            models.MealReminderDelivery.reminder_date == reminder_date,
        )
        .first()
    )

    if existing:
        if existing.status in (
            models.ReminderDeliveryStatus.SENT,
            models.ReminderDeliveryStatus.SKIPPED,
            models.ReminderDeliveryStatus.PENDING,
        ):
            return None

        # Reintentar FAILED dentro de la ventana
        if existing.status == models.ReminderDeliveryStatus.FAILED:
            age = utc_now() - (existing.created_at or utc_now())
            if age.total_seconds() > RETRY_FAILED_WINDOW_MINUTES * 60:
                return None
            existing.status = models.ReminderDeliveryStatus.PENDING
            existing.error_message = None
            existing.scheduled_for = scheduled_for
            db.commit()
            db.refresh(existing)
            return existing
        return None

    delivery = models.MealReminderDelivery(
        patient_id=patient_id,
        meal_type=meal_type,
        reminder_date=reminder_date,
        status=models.ReminderDeliveryStatus.PENDING,
        scheduled_for=scheduled_for,
    )
    db.add(delivery)
    try:
        db.commit()
        db.refresh(delivery)
        return delivery
    except IntegrityError:
        db.rollback()
        return None


async def process_due_reminders() -> int:
    db = SessionLocal()
    sent_count = 0
    try:
        configs = (
            db.query(models.MealReminderConfig)
            .filter(models.MealReminderConfig.enabled.is_(True))
            .all()
        )
        # Asegura slots completos
        for config in configs:
            ensure_meal_reminder_config(db, config.patient_id)
        db.commit()

        configs = (
            db.query(models.MealReminderConfig)
            .filter(models.MealReminderConfig.enabled.is_(True))
            .all()
        )
        due_items = iter_due_slots(configs)
        now = utc_now()

        for item in due_items:
            config = item["config"]
            slot = item["slot"]
            local_date = item["local_date"]

            delivery = _claim_delivery(
                db,
                patient_id=config.patient_id,
                meal_type=slot.meal_type,
                reminder_date=local_date,
                scheduled_for=item["notify_at_utc"],
            )
            if delivery is None:
                continue

            # Si ya registró la comida hoy, no notificar
            if patient_logged_meal_today(
                db,
                config.patient_id,
                slot.meal_type,
                local_date,
                config.timezone,
            ):
                delivery.status = models.ReminderDeliveryStatus.SKIPPED
                delivery.error_message = "Comida ya registrada hoy."
                delivery.sent_at = now
                db.commit()
                continue

            devices = (
                db.query(models.PatientPushDevice)
                .filter(
                    models.PatientPushDevice.patient_id == config.patient_id,
                    models.PatientPushDevice.is_active.is_(True),
                )
                .all()
            )
            if not devices:
                delivery.status = models.ReminderDeliveryStatus.SKIPPED
                delivery.error_message = "Sin dispositivos push activos."
                delivery.sent_at = now
                db.commit()
                continue

            meal_label = item["meal_label"]
            meal_time = item["meal_time_str"]
            title = f"Recordatorio de {meal_label}"
            body = (
                f"En {config.advance_minutes} minutos es tu {meal_label} "
                f"({meal_time}). Recuerda registrar tu comida."
            )

            messages = [
                {
                    "to": d.expo_push_token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "data": {
                        "type": "meal_reminder",
                        "meal_type": slot.meal_type.value,
                        "meal_time": meal_time,
                        "patient_id": str(config.patient_id),
                    },
                    "channelId": "meal-reminders",
                    "priority": "high",
                }
                for d in devices
            ]

            try:
                send_result = await _send_expo_messages(messages)
                _deactivate_invalid_tokens(db, send_result["invalid_tokens"])

                if send_result["ok_tokens"]:
                    delivery.status = models.ReminderDeliveryStatus.SENT
                    delivery.sent_at = utc_now()
                    delivery.error_message = None
                    sent_count += 1
                else:
                    delivery.status = models.ReminderDeliveryStatus.FAILED
                    delivery.error_message = "; ".join(send_result["errors"]) or "Sin tickets OK"
                db.commit()
            except Exception as exc:
                delivery.status = models.ReminderDeliveryStatus.FAILED
                delivery.error_message = str(exc)[:500]
                db.commit()
                print(f"[ReminderWorker] Error enviando a {config.patient_id}: {exc}")

        return sent_count
    finally:
        db.close()


async def run_loop() -> None:
    print("[ReminderWorker] Iniciado. Intervalo:", POLL_INTERVAL_SECONDS, "s")
    while True:
        started = utc_now()
        try:
            sent = await process_due_reminders()
            print(f"[ReminderWorker] Tick {started.isoformat()}Z — enviados: {sent}")
        except Exception:
            print("[ReminderWorker] Error en tick:")
            traceback.print_exc()
        elapsed = (utc_now() - started).total_seconds()
        await asyncio.sleep(max(5.0, POLL_INTERVAL_SECONDS - elapsed))


if __name__ == "__main__":
    asyncio.run(run_loop())
