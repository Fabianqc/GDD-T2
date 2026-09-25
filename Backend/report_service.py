"""
RF-06: Consolidación de reportes clínicos e indicadores.
Mediciones capilares puntuales (no CGM) + balance calórico estimado.
"""
from __future__ import annotations

import csv
import io
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

try:
    from . import models
except (ImportError, ValueError):
    import models

GLUCOSE_LOW = 70.0
GLUCOSE_HIGH = 180.0
MAX_CUSTOM_DAYS = 365

ACTIVITY_FACTORS = {
    "sedentario": 1.2,
    "poco activo": 1.375,
    "moderado": 1.55,
    "muy activo": 1.725,
}


@dataclass
class ReportPeriod:
    period: str
    from_date: date
    to_date: date
    days: int
    label: str


@dataclass
class ClinicalReportBundle:
    patient_id: str
    patient_name: str
    doctor_name: str
    generated_at: datetime
    period: ReportPeriod
    profile: Dict[str, Any]
    glycemic: Dict[str, Any]
    nutrition: Dict[str, Any]
    calorie_balance: Dict[str, Any]
    glucose_series: List[Dict[str, Any]] = field(default_factory=list)
    daily_nutrition: List[Dict[str, Any]] = field(default_factory=list)
    intakes: List[Dict[str, Any]] = field(default_factory=list)
    anthropometric_logs: List[Dict[str, Any]] = field(default_factory=list)
    medication_logs: List[Dict[str, Any]] = field(default_factory=list)
    physical_activity_logs: List[Dict[str, Any]] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


def require_doctor(user: models.User, patient_id: Optional[str] = None) -> None:
    if user.role == models.UserRole.CUIDADOR:
        return
    if patient_id and user.role == models.UserRole.PACIENTE:
        try:
            if user.id == uuid_or_400(patient_id):
                return
        except ValueError:
            pass
    raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores o el propio paciente.")


def get_assigned_patient_profile(db: Session, doctor: models.User, patient_id: str) -> models.PatientProfile:
    try:
        p_uuid = uuid_or_400(patient_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="ID de paciente inválido.") from exc

    # Permite al paciente acceder a su propio perfil clínico
    if doctor.role == models.UserRole.PACIENTE and doctor.id == p_uuid:
        profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == p_uuid).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil de paciente no encontrado.")
        return profile

    profile = (
        db.query(models.PatientProfile)
        .filter(
            models.PatientProfile.user_id == p_uuid,
            models.PatientProfile.caregiver_id == doctor.id,
        )
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o no asignado a este médico.")
    return profile


def uuid_or_400(value: str):
    import uuid as uuid_mod
    return uuid_mod.UUID(value)


def parse_report_period(
    period: str,
    from_date_str: Optional[str] = None,
    to_date_str: Optional[str] = None,
) -> ReportPeriod:
    today = datetime.now().date()
    preset = (period or "30").strip().lower()

    labels = {
        "7": "Últimos 7 días",
        "30": "Últimos 30 días",
        "90": "Últimos 90 días",
        "custom": "Rango personalizado",
    }

    if preset in ("7", "30", "90"):
        days = int(preset)
        to_d = today
        from_d = today - timedelta(days=days - 1)
        return ReportPeriod(period=preset, from_date=from_d, to_date=to_d, days=days, label=labels[preset])

    if preset != "custom":
        raise HTTPException(status_code=400, detail="Período inválido. Use 7, 30, 90 o custom.")

    if not from_date_str or not to_date_str:
        raise HTTPException(status_code=400, detail="Para período custom envíe from_date y to_date (YYYY-MM-DD).")

    try:
        from_d = date.fromisoformat(from_date_str.strip())
        to_d = date.fromisoformat(to_date_str.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fechas inválidas. Use formato YYYY-MM-DD.") from exc

    if from_d > to_d:
        raise HTTPException(status_code=400, detail="from_date no puede ser posterior a to_date.")

    span = (to_d - from_d).days + 1
    if span > MAX_CUSTOM_DAYS:
        raise HTTPException(status_code=400, detail=f"El rango personalizado no puede superar {MAX_CUSTOM_DAYS} días.")

    return ReportPeriod(period="custom", from_date=from_d, to_date=to_d, days=span, label=labels["custom"])


def period_bounds(period: ReportPeriod) -> Tuple[datetime, datetime]:
    start_dt = datetime.combine(period.from_date, time.min)
    end_dt = datetime.combine(period.to_date + timedelta(days=1), time.min)
    return start_dt, end_dt


def compute_glycemic_metrics(levels: List[float]) -> Dict[str, Any]:
    if not levels:
        return {
            "readings_count": 0,
            "mean": None,
            "min": None,
            "max": None,
            "std_dev": None,
            "cv_percent": None,
            "time_in_range_pct": None,
            "hypo_pct": None,
            "hyper_pct": None,
            "target_range": {"min": GLUCOSE_LOW, "max": GLUCOSE_HIGH},
            "source_note": "Mediciones capilares puntuales (no CGM).",
        }

    n = len(levels)
    mean = sum(levels) / n
    if n >= 2:
        std_dev = statistics.pstdev(levels)
    else:
        std_dev = 0.0
    cv = (100.0 * std_dev / mean) if mean else None
    tir = 100.0 * sum(1 for x in levels if GLUCOSE_LOW <= x <= GLUCOSE_HIGH) / n
    hypo = 100.0 * sum(1 for x in levels if x < GLUCOSE_LOW) / n
    hyper = 100.0 * sum(1 for x in levels if x > GLUCOSE_HIGH) / n

    return {
        "readings_count": n,
        "mean": round(mean, 1),
        "min": round(min(levels), 1),
        "max": round(max(levels), 1),
        "std_dev": round(std_dev, 1),
        "cv_percent": round(cv, 1) if cv is not None else None,
        "time_in_range_pct": round(tir, 1),
        "hypo_pct": round(hypo, 1),
        "hyper_pct": round(hyper, 1),
        "target_range": {"min": GLUCOSE_LOW, "max": GLUCOSE_HIGH},
        "source_note": "Mediciones capilares puntuales (no CGM).",
    }


def _activity_factor(level: Optional[str]) -> float:
    if not level:
        return 1.55
    key = level.strip().lower()
    return ACTIVITY_FACTORS.get(key, 1.55)


def estimate_tdee(profile: models.PatientProfile, latest_anthro: Optional[models.AnthropometricData]) -> Dict[str, Any]:
    weight = float(profile.weight_kg) if profile.weight_kg is not None else (
        float(latest_anthro.weight_kg) if latest_anthro else None
    )
    height = float(profile.height_cm) if profile.height_cm is not None else (
        float(latest_anthro.height_cm) if latest_anthro else None
    )
    age = None
    if profile.date_of_birth:
        age = (date.today() - profile.date_of_birth).days // 365

    gender = (profile.gender or "").strip().lower()
    missing = []
    if weight is None:
        missing.append("peso")
    if height is None:
        missing.append("estatura")
    if age is None:
        missing.append("edad")
    if not gender:
        missing.append("género")

    if missing:
        return {
            "available": False,
            "bmr": None,
            "tdee": None,
            "activity_factor": None,
            "confidence": "partial",
            "missing_fields": missing,
            "method": "Mifflin-St Jeor",
        }

    if "femen" in gender or gender in ("f", "mujer"):
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    elif "mascul" in gender or gender in ("m", "hombre"):
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 78

    factor = _activity_factor(profile.activity_level)
    tdee = bmr * factor
    return {
        "available": True,
        "bmr": round(bmr, 0),
        "tdee": round(tdee, 0),
        "activity_factor": factor,
        "confidence": "full",
        "missing_fields": [],
        "method": "Mifflin-St Jeor (estimación)",
    }


def build_clinical_report(
    db: Session,
    profile: models.PatientProfile,
    patient_user: models.User,
    doctor_user: models.User,
    period: ReportPeriod,
) -> ClinicalReportBundle:
    start_dt, end_dt = period_bounds(period)
    p_uuid = profile.user_id

    g_logs = (
        db.query(models.GlucoseLog)
        .filter(
            models.GlucoseLog.patient_id == p_uuid,
            models.GlucoseLog.recorded_at >= start_dt,
            models.GlucoseLog.recorded_at < end_dt,
        )
        .order_by(models.GlucoseLog.recorded_at.asc())
        .all()
    )
    a_logs = (
        db.query(models.AnthropometricData)
        .filter(
            models.AnthropometricData.patient_id == p_uuid,
            models.AnthropometricData.recorded_at >= start_dt,
            models.AnthropometricData.recorded_at < end_dt,
        )
        .order_by(models.AnthropometricData.recorded_at.asc())
        .all()
    )
    # Último antropométrico global para TDEE si no hay en el período
    latest_anthro = (
        db.query(models.AnthropometricData)
        .filter(models.AnthropometricData.patient_id == p_uuid)
        .order_by(models.AnthropometricData.recorded_at.desc())
        .first()
    )
    m_logs = (
        db.query(models.MedicationLog)
        .filter(
            models.MedicationLog.patient_id == p_uuid,
            models.MedicationLog.taken_at >= start_dt,
            models.MedicationLog.taken_at < end_dt,
        )
        .order_by(models.MedicationLog.taken_at.desc())
        .all()
    )
    act_logs = (
        db.query(models.PhysicalActivityLog)
        .filter(
            models.PhysicalActivityLog.patient_id == p_uuid,
            models.PhysicalActivityLog.recorded_at >= start_dt,
            models.PhysicalActivityLog.recorded_at < end_dt,
        )
        .order_by(models.PhysicalActivityLog.recorded_at.desc())
        .all()
    )
    intakes = (
        db.query(models.IntakeLog)
        .filter(
            models.IntakeLog.patient_id == p_uuid,
            models.IntakeLog.consumed_at >= start_dt,
            models.IntakeLog.consumed_at < end_dt,
        )
        .order_by(models.IntakeLog.consumed_at.asc())
        .all()
    )

    levels = [float(g.glucose_level) for g in g_logs]
    glycemic = compute_glycemic_metrics(levels)

    # Series glucemia
    glucose_series = [
        {
            "id": str(g.id),
            "glucose_level": float(g.glucose_level),
            "context": g.context.value if hasattr(g.context, "value") else str(g.context),
            "recorded_at": g.recorded_at.isoformat() if g.recorded_at else None,
            "date": g.recorded_at.date().isoformat() if g.recorded_at else None,
        }
        for g in g_logs
    ]

    # Nutrición diaria
    daily: Dict[date, Dict[str, Any]] = defaultdict(lambda: {
        "calories": 0.0,
        "carbs_g": 0.0,
        "gi_weight": 0.0,
        "carbs_for_gi": 0.0,
        "gl_sum": 0.0,
        "gl_count": 0,
        "intake_count": 0,
    })
    intake_rows = []
    for intake in intakes:
        food = db.query(models.Food).filter(models.Food.id == intake.food_id).first()
        food_name = food.name if food else "Alimento"
        d = intake.consumed_at.date() if intake.consumed_at else period.from_date
        bucket = daily[d]
        bucket["intake_count"] += 1
        if intake.calories is not None:
            bucket["calories"] += float(intake.calories)
        if intake.carbs_g is not None:
            bucket["carbs_g"] += float(intake.carbs_g)
        if intake.glycemic_index is not None and intake.carbs_g is not None and float(intake.carbs_g) > 0:
            bucket["gi_weight"] += float(intake.glycemic_index) * float(intake.carbs_g)
            bucket["carbs_for_gi"] += float(intake.carbs_g)
        if intake.glycemic_load is not None:
            bucket["gl_sum"] += float(intake.glycemic_load)
            bucket["gl_count"] += 1

        intake_rows.append({
            "id": str(intake.id),
            "food_name": food_name,
            "meal_type": intake.meal_type.value if hasattr(intake.meal_type, "value") else str(intake.meal_type),
            "portion_size_g": float(intake.portion_size_g),
            "calories": float(intake.calories) if intake.calories is not None else None,
            "carbs_g": float(intake.carbs_g) if intake.carbs_g is not None else None,
            "glycemic_index": float(intake.glycemic_index) if intake.glycemic_index is not None else None,
            "glycemic_load": float(intake.glycemic_load) if intake.glycemic_load is not None else None,
            "doctor_assessment": intake.doctor_assessment,
            "consumed_at": intake.consumed_at.isoformat() if intake.consumed_at else None,
            "date": d.isoformat(),
        })

    daily_nutrition = []
    cursor = period.from_date
    while cursor <= period.to_date:
        b = daily.get(cursor)
        if b:
            weighted_gi = (b["gi_weight"] / b["carbs_for_gi"]) if b["carbs_for_gi"] > 0 else None
            avg_gl = (b["gl_sum"] / b["gl_count"]) if b["gl_count"] > 0 else None
            daily_nutrition.append({
                "date": cursor.isoformat(),
                "total_calories": round(b["calories"], 1) if b["calories"] else 0.0,
                "total_carbs_g": round(b["carbs_g"], 1) if b["carbs_g"] else 0.0,
                "weighted_gi": round(weighted_gi, 1) if weighted_gi is not None else None,
                "avg_glycemic_load": round(avg_gl, 1) if avg_gl is not None else None,
                "intake_count": b["intake_count"],
            })
        else:
            daily_nutrition.append({
                "date": cursor.isoformat(),
                "total_calories": 0.0,
                "total_carbs_g": 0.0,
                "weighted_gi": None,
                "avg_glycemic_load": None,
                "intake_count": 0,
            })
        cursor += timedelta(days=1)

    days_with_logs = sum(1 for d in daily_nutrition if d["intake_count"] > 0)
    total_cal = sum(d["total_calories"] for d in daily_nutrition)
    total_carbs = sum(d["total_carbs_g"] for d in daily_nutrition)
    avg_daily_intake = (total_cal / days_with_logs) if days_with_logs else None

    # IG ponderado global
    gi_num = sum(float(i["glycemic_index"]) * float(i["carbs_g"]) for i in intake_rows if i["glycemic_index"] is not None and i["carbs_g"])
    gi_den = sum(float(i["carbs_g"]) for i in intake_rows if i["glycemic_index"] is not None and i["carbs_g"])
    weighted_gi_global = (gi_num / gi_den) if gi_den else None
    gl_vals = [float(i["glycemic_load"]) for i in intake_rows if i["glycemic_load"] is not None]
    avg_gl_global = (sum(gl_vals) / len(gl_vals)) if gl_vals else None

    nutrition = {
        "intake_count": len(intakes),
        "days_with_logs": days_with_logs,
        "total_calories": round(total_cal, 1) if intakes else None,
        "total_carbs_g": round(total_carbs, 1) if intakes else None,
        "avg_daily_calories": round(avg_daily_intake, 1) if avg_daily_intake is not None else None,
        "avg_daily_carbs_g": round(total_carbs / days_with_logs, 1) if days_with_logs else None,
        "weighted_glycemic_index": round(weighted_gi_global, 1) if weighted_gi_global is not None else None,
        "avg_glycemic_load": round(avg_gl_global, 1) if avg_gl_global is not None else None,
    }

    tdee_info = estimate_tdee(profile, latest_anthro)
    balance = None
    if tdee_info["available"] and avg_daily_intake is not None:
        balance = round(avg_daily_intake - float(tdee_info["tdee"]), 1)

    calorie_balance = {
        **tdee_info,
        "avg_daily_intake": round(avg_daily_intake, 1) if avg_daily_intake is not None else None,
        "balance_kcal": balance,
        "interpretation": (
            "Déficit estimado" if balance is not None and balance < -100
            else "Superávit estimado" if balance is not None and balance > 100
            else "Cercano al mantenimiento" if balance is not None
            else "Datos insuficientes"
        ),
    }

    notes = [
        "Variabilidad glucémica calculada sobre mediciones capilares puntuales (no CGM).",
        "El balance calórico usa TDEE estimado (Mifflin–St Jeor) y solo días con comidas registradas.",
    ]
    if not tdee_info["available"]:
        notes.append("TDEE incompleto: faltan " + ", ".join(tdee_info["missing_fields"]) + ".")

    doc_display = f"{doctor_user.first_name} {doctor_user.last_name}".strip()
    if doctor_user.role == models.UserRole.PACIENTE and profile.caregiver_id:
        cg = db.query(models.User).filter(models.User.id == profile.caregiver_id).first()
        if cg:
            doc_display = f"{cg.first_name} {cg.last_name}".strip()

    return ClinicalReportBundle(
        patient_id=str(p_uuid),
        patient_name=f"{patient_user.first_name} {patient_user.last_name}".strip(),
        doctor_name=doc_display,
        generated_at=datetime.now(),
        period=period,
        profile={
            "email": patient_user.email,
            "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
            "gender": profile.gender,
            "weight_kg": float(profile.weight_kg) if profile.weight_kg is not None else None,
            "height_cm": float(profile.height_cm) if profile.height_cm is not None else None,
            "diabetes_type": profile.diabetes_type,
            "diagnosis_year": profile.diagnosis_year,
            "last_hba1c": float(profile.last_hba1c) if profile.last_hba1c is not None else None,
            "medications": profile.medications,
            "allergies": profile.allergies,
            "activity_level": profile.activity_level,
            "medical_history": profile.medical_history,
        },
        glycemic=glycemic,
        nutrition=nutrition,
        calorie_balance=calorie_balance,
        glucose_series=glucose_series,
        daily_nutrition=daily_nutrition,
        intakes=intake_rows,
        anthropometric_logs=[
            {
                "id": str(a.id),
                "weight_kg": float(a.weight_kg),
                "height_cm": float(a.height_cm),
                "bmi": float(a.bmi) if a.bmi else round(float(a.weight_kg) / ((float(a.height_cm) / 100) ** 2), 2),
                "recorded_at": a.recorded_at.isoformat() if a.recorded_at else None,
            }
            for a in a_logs
        ],
        medication_logs=[
            {
                "id": str(m.id),
                "medication_name": m.medication_name,
                "dosage": m.dosage,
                "taken_at": m.taken_at.isoformat() if m.taken_at else None,
            }
            for m in m_logs
        ],
        physical_activity_logs=[
            {
                "id": str(a.id),
                "activity_type": a.activity_type,
                "duration_minutes": a.duration_minutes,
                "recorded_at": a.recorded_at.isoformat() if a.recorded_at else None,
            }
            for a in act_logs
        ],
        notes=notes,
    )


def bundle_to_dict(bundle: ClinicalReportBundle) -> Dict[str, Any]:
    return {
        "patient_id": bundle.patient_id,
        "patient_name": bundle.patient_name,
        "doctor_name": bundle.doctor_name,
        "generated_at": bundle.generated_at.isoformat(),
        "period": {
            "period": bundle.period.period,
            "from_date": bundle.period.from_date.isoformat(),
            "to_date": bundle.period.to_date.isoformat(),
            "days": bundle.period.days,
            "label": bundle.period.label,
        },
        "profile": bundle.profile,
        "metrics": {
            "glycemic": bundle.glycemic,
            "nutrition": bundle.nutrition,
            "calorie_balance": bundle.calorie_balance,
        },
        "glucose_series": bundle.glucose_series,
        "daily_nutrition": bundle.daily_nutrition,
        "intakes": bundle.intakes,
        "anthropometric_logs": bundle.anthropometric_logs,
        "medication_logs": bundle.medication_logs,
        "physical_activity_logs": bundle.physical_activity_logs,
        "notes": bundle.notes,
    }


def export_report_csv(bundle: ClinicalReportBundle) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["REPORTE CLINICO GDD-T2"])
    writer.writerow(["Paciente", bundle.patient_name])
    writer.writerow(["Doctor", bundle.doctor_name])
    writer.writerow(["Periodo", bundle.period.label, bundle.period.from_date.isoformat(), bundle.period.to_date.isoformat()])
    writer.writerow(["Generado", bundle.generated_at.isoformat()])
    writer.writerow([])

    writer.writerow(["METRICAS GLUCEMICAS"])
    for k, v in bundle.glycemic.items():
        writer.writerow([k, v])
    writer.writerow([])

    writer.writerow(["METRICAS NUTRICION"])
    for k, v in bundle.nutrition.items():
        writer.writerow([k, v])
    writer.writerow([])

    writer.writerow(["BALANCE CALORICO"])
    for k, v in bundle.calorie_balance.items():
        writer.writerow([k, v])
    writer.writerow([])

    writer.writerow(["GLUCEMIA"])
    writer.writerow(["fecha", "hora", "mg_dL", "contexto"])
    for g in bundle.glucose_series:
        dt = g.get("recorded_at") or ""
        day = dt[:10] if dt else ""
        hour = dt[11:16] if len(dt) >= 16 else ""
        writer.writerow([day, hour, g.get("glucose_level"), g.get("context")])
    writer.writerow([])

    writer.writerow(["NUTRICION DIARIA"])
    writer.writerow(["fecha", "kcal", "carbohidratos_g", "ig_ponderado", "cg_promedio", "comidas"])
    for d in bundle.daily_nutrition:
        writer.writerow([
            d["date"], d["total_calories"], d["total_carbs_g"],
            d["weighted_gi"], d["avg_glycemic_load"], d["intake_count"],
        ])
    writer.writerow([])

    writer.writerow(["COMIDAS"])
    writer.writerow(["fecha", "tipo", "alimento", "porcion_g", "kcal", "carbs_g", "ig", "cg", "valoracion"])
    for i in bundle.intakes:
        writer.writerow([
            i.get("date"), i.get("meal_type"), i.get("food_name"), i.get("portion_size_g"),
            i.get("calories"), i.get("carbs_g"), i.get("glycemic_index"), i.get("glycemic_load"),
            i.get("doctor_assessment"),
        ])
    writer.writerow([])

    writer.writerow(["ANTROPOMETRIA"])
    writer.writerow(["fecha", "peso_kg", "estatura_cm", "imc"])
    for a in bundle.anthropometric_logs:
        writer.writerow([(a.get("recorded_at") or "")[:10], a.get("weight_kg"), a.get("height_cm"), a.get("bmi")])
    writer.writerow([])

    writer.writerow(["MEDICACION"])
    writer.writerow(["fecha", "medicamento", "dosis"])
    for m in bundle.medication_logs:
        writer.writerow([(m.get("taken_at") or "")[:16], m.get("medication_name"), m.get("dosage")])
    writer.writerow([])

    writer.writerow(["ACTIVIDAD FISICA"])
    writer.writerow(["fecha", "actividad", "minutos"])
    for a in bundle.physical_activity_logs:
        writer.writerow([(a.get("recorded_at") or "")[:10], a.get("activity_type"), a.get("duration_minutes")])

    return buf.getvalue().encode("utf-8-sig")


def _pdf_text(value: Any) -> str:
    """Helvetica core fonts: latin-1 seguro (sin emojis / unicode raro)."""
    text = "" if value is None else str(value)
    replacements = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
        "ñ": "n", "Ñ": "N", "ü": "u", "Ü": "U",
        "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def export_report_pdf(bundle: ClinicalReportBundle) -> bytes:
    try:
        from fpdf import FPDF
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Falta instalar fpdf2 en el servidor para exportar PDF.",
        ) from exc

    navy = (11, 28, 44)
    teal = (0, 188, 166)
    teal_dark = (0, 137, 123)
    pale_teal = (230, 248, 245)
    text = (34, 49, 63)
    muted = (102, 117, 128)
    border = (220, 228, 232)
    danger = (220, 76, 70)
    warning = (242, 169, 59)
    logo_path = Path(__file__).resolve().parent / "assets" / "gdd-t2-logo.png"

    class BrandedPDF(FPDF):
        def header(self):
            if self.page_no() == 1:
                return
            self.set_fill_color(*navy)
            self.rect(0, 0, self.w, 20, style="F")
            if logo_path.exists():
                self.image(str(logo_path), x=10, y=3, w=14)
            self.set_xy(29, 5)
            self.set_text_color(255, 255, 255)
            self.set_font("Helvetica", "B", 11)
            self.cell(0, 5, "GDD-T2  |  Reporte clinico")
            self.set_xy(29, 11)
            self.set_font("Helvetica", "", 7)
            self.cell(0, 4, _pdf_text(bundle.patient_name))
            self.set_y(26)

        def footer(self):
            self.set_y(-12)
            self.set_draw_color(*border)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.set_y(-9)
            self.set_text_color(*muted)
            self.set_font("Helvetica", "", 7)
            self.cell(
                0,
                4,
                _pdf_text(f"GDD-T2 | Documento clinico confidencial | Pagina {self.page_no()}"),
                align="C",
            )

    def safe(value: Any, suffix: str = "") -> str:
        return "N/D" if value is None else f"{value}{suffix}"

    def ensure_space(height: float):
        if pdf.get_y() + height > pdf.h - 18:
            pdf.add_page()

    def section_title(title: str, subtitle: Optional[str] = None):
        ensure_space(17 if subtitle else 11)
        pdf.set_fill_color(*teal)
        pdf.rect(pdf.l_margin, pdf.get_y(), 3, 9, style="F")
        pdf.set_x(pdf.l_margin + 7)
        pdf.set_text_color(*navy)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 6, _pdf_text(title), new_x="LMARGIN", new_y="NEXT")
        if subtitle:
            pdf.set_x(pdf.l_margin + 7)
            pdf.set_text_color(*muted)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(0, 4, _pdf_text(subtitle), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    def metric_card(x: float, y: float, width: float, label: str, value: str, accent=teal):
        pdf.set_fill_color(248, 250, 251)
        pdf.set_draw_color(*border)
        pdf.rect(x, y, width, 22, style="DF")
        pdf.set_fill_color(*accent)
        pdf.rect(x, y, 2.5, 22, style="F")
        pdf.set_xy(x + 6, y + 4)
        pdf.set_text_color(*muted)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(width - 8, 4, _pdf_text(label.upper()))
        pdf.set_xy(x + 6, y + 10)
        pdf.set_text_color(*text)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(width - 8, 7, _pdf_text(value))

    def progress_row(label: str, value: Any, color):
        pct = max(0.0, min(100.0, float(value or 0)))
        x = pdf.l_margin
        y = pdf.get_y()
        pdf.set_text_color(*text)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_xy(x, y)
        pdf.cell(36, 5, _pdf_text(label))
        pdf.set_fill_color(235, 239, 241)
        pdf.rect(x + 38, y + 1, 112, 3, style="F")
        pdf.set_fill_color(*color)
        pdf.rect(x + 38, y + 1, 112 * pct / 100, 3, style="F")
        pdf.set_xy(x + 153, y)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(25, 5, f"{pct:.1f}%", align="R")
        pdf.set_y(y + 7)

    def table_header(columns):
        pdf.set_fill_color(*navy)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 7)
        for label, width, align in columns:
            pdf.cell(width, 7, _pdf_text(label), border=0, align=align, fill=True)
        pdf.ln()

    def table_row(values, columns, shaded=False):
        pdf.set_fill_color(*(248, 250, 251) if shaded else (255, 255, 255))
        pdf.set_text_color(*text)
        pdf.set_font("Helvetica", "", 7)
        for value, (_, width, align) in zip(values, columns):
            displayed = _pdf_text(safe(value))
            if len(displayed) > max(6, int(width / 2)):
                displayed = displayed[:max(5, int(width / 2) - 1)] + "..."
            pdf.cell(width, 6, displayed, border="B", align=align, fill=shaded)
        pdf.ln()

    pdf = BrandedPDF()
    pdf.set_margins(14, 14, 14)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_title(_pdf_text(f"Reporte clinico GDD-T2 - {bundle.patient_name}"))
    pdf.set_author("GDD-T2")
    pdf.add_page()

    # Portada compacta con identidad del proyecto.
    pdf.set_fill_color(*navy)
    pdf.rect(0, 0, pdf.w, 49, style="F")
    if logo_path.exists():
        pdf.image(str(logo_path), x=14, y=8, w=33)
    pdf.set_xy(55, 11)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 9, "GDD-T2", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(55)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, "Reporte clinico integral", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(55)
    pdf.set_text_color(185, 227, 222)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, "Seguimiento glucemico, nutricional y metabolico")

    pdf.set_y(57)
    pdf.set_fill_color(*pale_teal)
    pdf.set_draw_color(*border)
    pdf.rect(pdf.l_margin, pdf.get_y(), pdf.epw, 35, style="DF")
    info_y = pdf.get_y() + 6
    pdf.set_xy(pdf.l_margin + 7, info_y)
    pdf.set_text_color(*muted)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(82, 4, "PACIENTE")
    pdf.cell(82, 4, "PROFESIONAL RESPONSABLE")
    pdf.set_xy(pdf.l_margin + 7, info_y + 5)
    pdf.set_text_color(*navy)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(82, 6, _pdf_text(bundle.patient_name))
    pdf.cell(82, 6, _pdf_text(bundle.doctor_name))
    pdf.set_xy(pdf.l_margin + 7, info_y + 15)
    pdf.set_text_color(*muted)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(
        0,
        5,
        _pdf_text(
            f"{bundle.period.label}: {bundle.period.from_date.strftime('%d/%m/%Y')} "
            f"al {bundle.period.to_date.strftime('%d/%m/%Y')}  |  "
            f"Generado: {bundle.generated_at.strftime('%d/%m/%Y %H:%M')}"
        ),
    )
    pdf.set_y(100)

    g = bundle.glycemic
    n = bundle.nutrition
    c = bundle.calorie_balance

    section_title("Resumen glucemico", "Indicadores calculados a partir de mediciones capilares registradas.")
    card_gap = 4
    card_width = (pdf.epw - 3 * card_gap) / 4
    card_y = pdf.get_y()
    metric_card(pdf.l_margin, card_y, card_width, "Promedio", safe(g.get("mean"), " mg/dL"))
    metric_card(pdf.l_margin + card_width + card_gap, card_y, card_width, "Lecturas", safe(g.get("readings_count")))
    metric_card(
        pdf.l_margin + 2 * (card_width + card_gap),
        card_y,
        card_width,
        "En rango",
        safe(g.get("time_in_range_pct"), "%"),
        teal_dark,
    )
    metric_card(
        pdf.l_margin + 3 * (card_width + card_gap),
        card_y,
        card_width,
        "Variabilidad",
        safe(g.get("cv_percent"), "% CV"),
        warning,
    )
    pdf.set_y(card_y + 28)
    progress_row("En rango (70-180)", g.get("time_in_range_pct"), teal_dark)
    progress_row("Hipoglucemia", g.get("hypo_pct"), danger)
    progress_row("Hiperglucemia", g.get("hyper_pct"), warning)
    pdf.set_text_color(*muted)
    pdf.set_font("Helvetica", "I", 7)
    pdf.cell(
        0,
        5,
        _pdf_text(
            f"Minimo: {safe(g.get('min'), ' mg/dL')}  |  Maximo: {safe(g.get('max'), ' mg/dL')}  |  "
            f"Desviacion estandar: {safe(g.get('std_dev'))}"
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    section_title("Nutricion y balance energetico")
    card_y = pdf.get_y()
    metric_card(pdf.l_margin, card_y, card_width, "Comidas", safe(n.get("intake_count")))
    metric_card(
        pdf.l_margin + card_width + card_gap,
        card_y,
        card_width,
        "Media diaria",
        safe(n.get("avg_daily_calories"), " kcal"),
    )
    metric_card(
        pdf.l_margin + 2 * (card_width + card_gap),
        card_y,
        card_width,
        "TDEE estimado",
        safe(c.get("tdee"), " kcal"),
        teal_dark,
    )
    balance = c.get("balance_kcal")
    metric_card(
        pdf.l_margin + 3 * (card_width + card_gap),
        card_y,
        card_width,
        "Balance",
        safe(balance, " kcal"),
        danger if balance is not None and abs(float(balance)) > 100 else teal,
    )
    pdf.set_y(card_y + 28)
    pdf.set_fill_color(248, 250, 251)
    pdf.set_draw_color(*border)
    pdf.rect(pdf.l_margin, pdf.get_y(), pdf.epw, 16, style="DF")
    pdf.set_xy(pdf.l_margin + 6, pdf.get_y() + 3)
    pdf.set_text_color(*text)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(
        0,
        5,
        _pdf_text(
            f"Carbohidratos: {safe(n.get('total_carbs_g'), ' g')}   |   "
            f"IG ponderado: {safe(n.get('weighted_glycemic_index'))}   |   "
            f"Carga glucemica prom.: {safe(n.get('avg_glycemic_load'))}   |   "
            f"Interpretacion: {c.get('interpretation') or 'Datos insuficientes'}"
        ),
    )
    pdf.set_y(pdf.get_y() + 18)

    recent_days = [d for d in bundle.daily_nutrition if d["intake_count"] > 0][-10:]
    section_title("Consumo calorico reciente", "Ultimos 10 dias con comidas registradas.")
    if not recent_days:
        pdf.set_text_color(*muted)
        pdf.set_font("Helvetica", "I", 8)
        pdf.cell(0, 6, "Sin comidas registradas en el periodo.", new_x="LMARGIN", new_y="NEXT")
    else:
        max_kcal = max([float(d["total_calories"] or 0) for d in recent_days] + [float(c.get("tdee") or 0), 1])
        for day in recent_days:
            kcal = float(day["total_calories"] or 0)
            y = pdf.get_y()
            pdf.set_text_color(*text)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(25, 5, day["date"][5:])
            pdf.set_fill_color(235, 239, 241)
            pdf.rect(pdf.l_margin + 26, y + 1, 115, 3, style="F")
            pdf.set_fill_color(*teal)
            pdf.rect(pdf.l_margin + 26, y + 1, 115 * kcal / max_kcal, 3, style="F")
            pdf.cell(120, 5, f"{kcal:.0f} kcal", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    if bundle.glucose_series:
        section_title("Registro de glucemia", "Ultimas 25 lecturas incluidas en el periodo.")
        glucose_columns = [
            ("Fecha", 30, "L"),
            ("Hora", 22, "C"),
            ("Glucemia", 38, "R"),
            ("Contexto", pdf.epw - 90, "L"),
        ]
        table_header(glucose_columns)
        for idx, row in enumerate(bundle.glucose_series[-25:]):
            ensure_space(8)
            if pdf.get_y() < 30:
                table_header(glucose_columns)
            dt = row.get("recorded_at") or ""
            table_row(
                [dt[:10], dt[11:16], safe(row.get("glucose_level"), " mg/dL"), row.get("context")],
                glucose_columns,
                idx % 2 == 1,
            )
        pdf.ln(5)

    if bundle.intakes:
        section_title("Detalle de comidas", "Ultimos 40 registros incluidos en el periodo.")
        meal_columns = [
            ("Fecha", 25, "L"),
            ("Tipo", 25, "L"),
            ("Alimento", 56, "L"),
            ("Porcion", 22, "R"),
            ("Kcal", 20, "R"),
            ("CH", 16, "R"),
            ("IG", 14, "R"),
        ]
        table_header(meal_columns)
        for idx, intake in enumerate(bundle.intakes[-40:]):
            ensure_space(8)
            if pdf.get_y() < 30:
                table_header(meal_columns)
            table_row(
                [
                    intake.get("date"),
                    intake.get("meal_type"),
                    intake.get("food_name"),
                    safe(intake.get("portion_size_g"), " g"),
                    intake.get("calories"),
                    intake.get("carbs_g"),
                    intake.get("glycemic_index"),
                ],
                meal_columns,
                idx % 2 == 1,
            )

    if bundle.notes:
        pdf.ln(5)
        section_title("Notas metodologicas")
        pdf.set_fill_color(248, 250, 251)
        pdf.set_text_color(*muted)
        pdf.set_font("Helvetica", "", 8)
        for note in bundle.notes:
            ensure_space(10)
            pdf.set_x(pdf.l_margin + 3)
            pdf.multi_cell(
                pdf.epw - 6,
                5,
                _pdf_text(f"- {note}"),
                fill=True,
                new_x="LMARGIN",
                new_y="NEXT",
            )

    out = pdf.output()
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    return str(out).encode("latin-1", errors="replace")


def build_metabolic_summary_for_dashboard(
    db: Session,
    profile: models.PatientProfile,
    patient_user: models.User,
) -> Dict[str, Any]:
    """Resumen RF-02 (7 días) reutilizando filtros correctos del report service."""
    period = parse_report_period("7")
    # Doctor dummy name not needed for summary internals — use patient context only
    doctor = models.User(
        first_name="—",
        last_name="",
        email="n/a",
        password_hash="x",
        role=models.UserRole.CUIDADOR,
    )
    # Avoid persisting: pass a lightweight stand-in via real doctor if available
    doctor_user = None
    if profile.caregiver_id:
        doctor_user = db.query(models.User).filter(models.User.id == profile.caregiver_id).first()
    bundle = build_clinical_report(
        db,
        profile,
        patient_user,
        doctor_user or doctor,
        period,
    )

    start_dt, end_dt = period_bounds(period)
    g_all = (
        db.query(models.GlucoseLog)
        .filter(models.GlucoseLog.patient_id == profile.user_id)
        .order_by(models.GlucoseLog.recorded_at.desc())
        .all()
    )
    a_all = (
        db.query(models.AnthropometricData)
        .filter(models.AnthropometricData.patient_id == profile.user_id)
        .order_by(models.AnthropometricData.recorded_at.desc())
        .all()
    )
    m_all = (
        db.query(models.MedicationLog)
        .filter(models.MedicationLog.patient_id == profile.user_id)
        .order_by(models.MedicationLog.taken_at.desc())
        .all()
    )
    act_all = (
        db.query(models.PhysicalActivityLog)
        .filter(models.PhysicalActivityLog.patient_id == profile.user_id)
        .order_by(models.PhysicalActivityLog.recorded_at.desc())
        .all()
    )

    latest_bmi = None
    bmi_category = None
    if a_all:
        latest_bmi = float(a_all[0].bmi) if a_all[0].bmi else round(
            float(a_all[0].weight_kg) / ((float(a_all[0].height_cm) / 100) ** 2), 2
        )
        if latest_bmi < 18.5:
            bmi_category = "Bajo peso"
        elif latest_bmi < 25:
            bmi_category = "Normal"
        elif latest_bmi < 30:
            bmi_category = "Sobrepeso"
        else:
            bmi_category = "Obesidad"

    med_7d = [m for m in m_all if m.taken_at and m.taken_at >= start_dt]
    act_7d = [a for a in act_all if a.recorded_at and a.recorded_at >= start_dt]

    return {
        "patient_id": str(profile.user_id),
        "patient_name": f"{patient_user.first_name} {patient_user.last_name}",
        "profile": {
            "weight_kg": float(profile.weight_kg) if profile.weight_kg is not None else None,
            "height_cm": float(profile.height_cm) if profile.height_cm is not None else None,
            "medications": profile.medications,
            "activity_level": profile.activity_level,
            "gender": profile.gender,
            "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
        },
        "glucose_logs": [
            {
                "id": str(l.id),
                "glucose_level": float(l.glucose_level),
                "context": l.context.value,
                "recorded_at": l.recorded_at,
            }
            for l in g_all
        ],
        "anthropometric_logs": [
            {
                "id": str(l.id),
                "weight_kg": float(l.weight_kg),
                "height_cm": float(l.height_cm),
                "bmi": float(l.bmi) if l.bmi else round(float(l.weight_kg) / ((float(l.height_cm) / 100) ** 2), 2),
                "recorded_at": l.recorded_at,
            }
            for l in a_all
        ],
        "medication_logs": [
            {
                "id": str(l.id),
                "medication_name": l.medication_name,
                "dosage": l.dosage,
                "taken_at": l.taken_at,
            }
            for l in m_all
        ],
        "physical_activity_logs": [
            {
                "id": str(l.id),
                "activity_type": l.activity_type,
                "duration_minutes": l.duration_minutes,
                "recorded_at": l.recorded_at,
            }
            for l in act_all
        ],
        "nutrition": {
            "intake_count": bundle.nutrition.get("intake_count", 0),
            "total_calories": bundle.nutrition.get("total_calories"),
            "total_carbs_g": bundle.nutrition.get("total_carbs_g"),
            "avg_glycemic_index": bundle.nutrition.get("weighted_glycemic_index"),
            "avg_glycemic_load": bundle.nutrition.get("avg_glycemic_load"),
            "last_7_days_calories": bundle.nutrition.get("total_calories"),
            "last_7_days_carbs_g": bundle.nutrition.get("total_carbs_g"),
        },
        "quick_stats": {
            "latest_glucose": float(g_all[0].glucose_level) if g_all else None,
            "latest_glucose_context": g_all[0].context.value if g_all else None,
            "latest_bmi": latest_bmi,
            "bmi_category": bmi_category,
            "activity_minutes_7d": sum(int(a.duration_minutes or 0) for a in act_7d),
            "medication_doses_7d": len(med_7d),
            "glucose_count": len(g_all),
        },
    }
