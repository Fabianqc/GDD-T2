from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timedelta
import uuid
import io

try:
    from .. import models
    from ..database import get_db
    from ..auth import get_current_user
    from ..report_service import (
        require_doctor,
        get_assigned_patient_profile,
        parse_report_period,
        build_clinical_report,
        bundle_to_dict,
        export_report_csv,
        export_report_pdf,
        build_metabolic_summary_for_dashboard,
    )
except (ImportError, ValueError):
    import models
    from database import get_db
    from auth import get_current_user
    from report_service import (
        require_doctor,
        get_assigned_patient_profile,
        parse_report_period,
        build_clinical_report,
        bundle_to_dict,
        export_report_csv,
        export_report_pdf,
        build_metabolic_summary_for_dashboard,
    )

router = APIRouter(prefix="/dashboard", tags=["Dashboard por Roles"])


def _intake_to_response(log: models.IntakeLog, food_name: str) -> "IntakeResponse":
    return IntakeResponse(
        id=str(log.id),
        food_name=food_name,
        portion_size_g=float(log.portion_size_g),
        meal_type=log.meal_type.value,
        consumed_at=log.consumed_at,
        image_base64=log.image_base64,
        doctor_assessment=log.doctor_assessment,
        doctor_comment=log.doctor_comment,
        calories=float(log.calories) if log.calories is not None else None,
        carbs_g=float(log.carbs_g) if log.carbs_g is not None else None,
        glycemic_index=float(log.glycemic_index) if log.glycemic_index is not None else None,
        glycemic_load=float(log.glycemic_load) if log.glycemic_load is not None else None,
    )


# ── Schemas ──────────────────────────────────────────────────────────────────

class IntakeCreateRequest(BaseModel):
    food_name: str
    portion_size_g: float = Field(..., ge=0.1, le=99999.0, description="Porción en gramos")
    meal_type: models.MealType
    image_base64: Optional[str] = None
    consumed_at: Optional[str] = None  # Format: YYYY-MM-DD or ISO string
    calories: Optional[float] = Field(default=None, ge=0, le=10000, description="Calorías de la porción")
    carbs_g: Optional[float] = Field(default=None, ge=0, le=2000, description="Carbohidratos (g) de la porción")
    glycemic_index: Optional[float] = Field(default=None, ge=0, le=100, description="Índice glucémico")
    glycemic_load: Optional[float] = Field(default=None, ge=0, le=500, description="Carga glucémica de la porción")

class IntakeResponse(BaseModel):
    id: str
    food_name: str
    portion_size_g: float
    meal_type: str
    consumed_at: datetime
    image_base64: Optional[str] = None
    doctor_assessment: Optional[str] = None
    doctor_comment: Optional[str] = None
    calories: Optional[float] = None
    carbs_g: Optional[float] = None
    glycemic_index: Optional[float] = None
    glycemic_load: Optional[float] = None

    model_config = {"from_attributes": True}

class RecommendationResponse(BaseModel):
    ai_rules: Optional[str]
    recommendations: Optional[str]
    updated_at: Optional[datetime]
    doctor_name: Optional[str] = None

class RecommendationUpdateRequest(BaseModel):
    patient_id: str
    ai_rules: str
    recommendations: str

class PatientListItem(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    diabetes_type: Optional[str] = None
    diagnosis_year: Optional[int] = None
    last_hba1c: Optional[float] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    activity_level: Optional[str] = None
    medical_history: Optional[str] = None
    ai_rules: Optional[str] = None
    recommendations: Optional[str] = None

class PatientProfileResponse(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    diabetes_type: Optional[str] = None
    diagnosis_year: Optional[int] = None
    last_hba1c: Optional[float] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    activity_level: Optional[str] = None
    medical_history: Optional[str] = None
    doctor_name: Optional[str] = None

    model_config = {"from_attributes": True}

class PatientProfileUpdateRequest(BaseModel):
    date_of_birth: Optional[str] = None  # Format: YYYY-MM-DD
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    diabetes_type: Optional[str] = None
    diagnosis_year: Optional[int] = None
    last_hba1c: Optional[float] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    activity_level: Optional[str] = None
    medical_history: Optional[str] = None

class UserListItem(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    caregiver_name: Optional[str] = None

class AssignPatientRequest(BaseModel):
    patient_id: str
    doctor_id: str

class ChangeRoleRequest(BaseModel):
    user_id: str
    new_role: models.UserRole

# ── Schemas RF-02 ────────────────────────────────────────────────────────────

class GlucoseLogCreate(BaseModel):
    glucose_level: float = Field(..., ge=20.0, le=600.0, description="Nivel de glucosa en mg/dL")
    context: models.GlycemicContext
    recorded_at: Optional[str] = None

class GlucoseLogResponse(BaseModel):
    id: str
    glucose_level: float
    context: str
    recorded_at: datetime

    model_config = {"from_attributes": True}

class AnthropometricCreate(BaseModel):
    weight_kg: float = Field(..., ge=20.0, le=350.0, description="Peso en kg")
    height_cm: float = Field(..., ge=50.0, le=260.0, description="Estatura en cm")
    recorded_at: Optional[str] = None

class AnthropometricResponse(BaseModel):
    id: str
    weight_kg: float
    height_cm: float
    bmi: float
    recorded_at: datetime

    model_config = {"from_attributes": True}

class MedicationLogCreate(BaseModel):
    medication_name: str
    dosage: str
    taken_at: Optional[str] = None

class MedicationLogResponse(BaseModel):
    id: str
    medication_name: str
    dosage: str
    taken_at: datetime

    model_config = {"from_attributes": True}

class PhysicalActivityCreate(BaseModel):
    activity_type: str
    duration_minutes: int = Field(..., ge=1, le=1440, description="Duración en minutos")
    recorded_at: Optional[str] = None

class PhysicalActivityResponse(BaseModel):
    id: str
    activity_type: str
    duration_minutes: int
    recorded_at: datetime

    model_config = {"from_attributes": True}

class NutritionSummary(BaseModel):
    intake_count: int = 0
    total_calories: Optional[float] = None
    total_carbs_g: Optional[float] = None
    avg_glycemic_index: Optional[float] = None
    avg_glycemic_load: Optional[float] = None
    last_7_days_calories: Optional[float] = None
    last_7_days_carbs_g: Optional[float] = None


class MetabolicQuickStats(BaseModel):
    latest_glucose: Optional[float] = None
    latest_glucose_context: Optional[str] = None
    latest_bmi: Optional[float] = None
    bmi_category: Optional[str] = None
    activity_minutes_7d: int = 0
    medication_doses_7d: int = 0
    glucose_count: int = 0


class DoctorPatientMetabolicSummary(BaseModel):
    patient_id: str
    patient_name: str
    profile: Optional[dict] = None
    glucose_logs: List[GlucoseLogResponse]
    anthropometric_logs: List[AnthropometricResponse]
    medication_logs: List[MedicationLogResponse]
    physical_activity_logs: List[PhysicalActivityResponse]
    nutrition: Optional[NutritionSummary] = None
    quick_stats: Optional[MetabolicQuickStats] = None


# ── 1. Endpoints de PACIENTE ──────────────────────────────────────────────────

@router.post("/patient/intake", response_model=IntakeResponse)
def create_intake(
    data: IntakeCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al paciente registrar una ingesta de comida."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    # 1. Asegurar que existe el perfil de paciente
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if not profile:
        # Si por alguna razón no tiene perfil, lo auto-creamos con una fecha por defecto
        profile = models.PatientProfile(user_id=current_user.id, date_of_birth=datetime.strptime("1990-01-01", "%Y-%m-%d").date())
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # 2. Buscar o auto-crear el alimento en el catálogo
    clean_food_name = data.food_name.strip().title()
    food = db.query(models.Food).filter(models.Food.name.ilike(clean_food_name)).first()

    # Estimar valores por 100g a partir de la porción, si vienen datos nutricionales
    safe_portion = min(max(round(data.portion_size_g, 2), 0.1), 99999.0)
    cal = round(float(data.calories), 2) if data.calories is not None else None
    carbs = round(float(data.carbs_g), 2) if data.carbs_g is not None else None
    gi = round(float(data.glycemic_index), 2) if data.glycemic_index is not None else None
    gl = round(float(data.glycemic_load), 2) if data.glycemic_load is not None else None

    cal_per_100 = round((cal / safe_portion) * 100, 2) if cal is not None else 120.0
    carbs_per_100 = round((carbs / safe_portion) * 100, 2) if carbs is not None else 15.0
    catalog_gi = gi if gi is not None else 55.0
    catalog_gl = gl if gl is not None else 10.0

    if not food:
        food = models.Food(
            name=clean_food_name,
            glycemic_index=catalog_gi,
            glycemic_load=catalog_gl,
            calories_per_100g=cal_per_100,
            carbs_per_100g=carbs_per_100,
        )
        db.add(food)
        db.commit()
        db.refresh(food)
    elif cal is not None or carbs is not None or gi is not None or gl is not None:
        # Actualiza el catálogo con la estimación más reciente de la porción
        if gi is not None:
            food.glycemic_index = catalog_gi
        if gl is not None:
            food.glycemic_load = catalog_gl
        if cal is not None:
            food.calories_per_100g = cal_per_100
        if carbs is not None:
            food.carbs_per_100g = carbs_per_100
        db.commit()
        db.refresh(food)

    consumed_datetime = datetime.now()
    if data.consumed_at:
        try:
            clean_str = data.consumed_at.strip()
            if "T" in clean_str:
                consumed_datetime = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            elif " " in clean_str and ":" in clean_str:
                consumed_datetime = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            elif len(clean_str) == 10:
                now_time = datetime.now().time()
                c_date = datetime.strptime(clean_str, "%Y-%m-%d").date()
                consumed_datetime = datetime.combine(c_date, now_time)
        except Exception:
            consumed_datetime = datetime.now()

    # 3. Registrar la ingesta con nutrición de la porción consumida
    log = models.IntakeLog(
        patient_id=profile.user_id,
        food_id=food.id,
        meal_type=data.meal_type,
        portion_size_g=safe_portion,
        calories=cal,
        carbs_g=carbs,
        glycemic_index=gi,
        glycemic_load=gl,
        image_base64=data.image_base64,
        consumed_at=consumed_datetime
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return IntakeResponse(
        id=str(log.id),
        food_name=food.name,
        portion_size_g=float(log.portion_size_g),
        meal_type=log.meal_type.value,
        consumed_at=log.consumed_at,
        image_base64=log.image_base64,
        calories=float(log.calories) if log.calories is not None else None,
        carbs_g=float(log.carbs_g) if log.carbs_g is not None else None,
        glycemic_index=float(log.glycemic_index) if log.glycemic_index is not None else None,
        glycemic_load=float(log.glycemic_load) if log.glycemic_load is not None else None,
    )

@router.get("/patient/intakes", response_model=List[IntakeResponse])
def get_intakes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna la lista de comidas registradas por el paciente logueado."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    logs = db.query(models.IntakeLog).filter(models.IntakeLog.patient_id == current_user.id).order_by(models.IntakeLog.consumed_at.desc()).all()
    
    result = []
    for log in logs:
        food = db.query(models.Food).filter(models.Food.id == log.food_id).first()
        result.append(
            _intake_to_response(log, food.name if food else "Alimento Desconocido")
        )
    return result

@router.get("/patient/profile", response_model=PatientProfileResponse)
def get_patient_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna los datos clínicos del paciente logueado."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.PatientProfile(
            user_id=current_user.id,
            date_of_birth=datetime.strptime("1990-01-01", "%Y-%m-%d").date()
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    doctor_name = None
    if profile.caregiver_id:
        doctor = db.query(models.User).filter(models.User.id == profile.caregiver_id).first()
        if doctor:
            doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"

    return PatientProfileResponse(
        user_id=str(current_user.id),
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        date_of_birth=str(profile.date_of_birth) if profile.date_of_birth else None,
        gender=profile.gender,
        weight_kg=float(profile.weight_kg) if profile.weight_kg else None,
        height_cm=float(profile.height_cm) if profile.height_cm else None,
        diabetes_type=profile.diabetes_type,
        diagnosis_year=profile.diagnosis_year,
        last_hba1c=float(profile.last_hba1c) if profile.last_hba1c else None,
        medications=profile.medications,
        allergies=profile.allergies,
        activity_level=profile.activity_level,
        medical_history=profile.medical_history,
        doctor_name=doctor_name
    )

@router.post("/patient/profile")
def update_patient_profile(
    data: PatientProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al paciente rellenar o actualizar sus datos clínicos clave para el doctor."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.PatientProfile(
            user_id=current_user.id,
            date_of_birth=datetime.strptime("1990-01-01", "%Y-%m-%d").date()
        )
        db.add(profile)

    # 1. Autoformatear y Validar Fecha de Nacimiento
    if data.date_of_birth:
        raw_date = data.date_of_birth.strip().replace(" ", "-").replace("/", "-").replace(".", "-")
        try:
            parsed_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
            if parsed_date > datetime.utcnow().date():
                raise HTTPException(status_code=400, detail="La fecha de nacimiento no puede ser una fecha futura.")
            profile.date_of_birth = parsed_date
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Formato aceptado: AAAA-MM-DD (ej: 1990-01-01).")

    # 2. Normalizar Género (Masculino, Femenino, Otro)
    if data.gender is not None:
        clean_gender = data.gender.strip().capitalize()
        if clean_gender in ["Masculino", "Femenino", "Otro", "Prefiero no decir"]:
            profile.gender = clean_gender
        else:
            profile.gender = data.gender.strip().title()

    # 3. Validar Rangos Numéricos de Peso y Estatura
    if data.weight_kg is not None:
        if data.weight_kg < 20.0 or data.weight_kg > 350.0:
            raise HTTPException(status_code=400, detail="El peso debe estar en un rango realista (entre 20 kg y 350 kg).")
        profile.weight_kg = round(data.weight_kg, 2)

    if data.height_cm is not None:
        if data.height_cm < 50.0 or data.height_cm > 260.0:
            raise HTTPException(status_code=400, detail="La estatura debe estar en un rango realista (entre 50 cm y 260 cm).")
        profile.height_cm = round(data.height_cm, 2)

    if data.diabetes_type is not None:
        profile.diabetes_type = data.diabetes_type.strip() or "Tipo 2"

    # 4. Validar Año del Diagnóstico
    current_year = datetime.utcnow().year
    if data.diagnosis_year is not None:
        if data.diagnosis_year < 1920 or data.diagnosis_year > current_year:
            raise HTTPException(status_code=400, detail=f"El año de diagnóstico debe estar entre 1920 y el año actual ({current_year}).")
        profile.diagnosis_year = data.diagnosis_year

    # 5. Validar HbA1c
    if data.last_hba1c is not None:
        if data.last_hba1c < 3.0 or data.last_hba1c > 20.0:
            raise HTTPException(status_code=400, detail="La hemoglobina glicosilada (HbA1c) debe estar entre 3.0% y 20.0%.")
        profile.last_hba1c = round(data.last_hba1c, 2)

    # 6. Saneamiento de Textos
    def sanitize_text(text: Optional[str]) -> Optional[str]:
        if not text: return None
        cleaned = text.strip()
        return None if cleaned in [".", ",", "-", "", "ninguna", "ninguno"] else cleaned

    if data.medications is not None:
        profile.medications = sanitize_text(data.medications)
    if data.allergies is not None:
        profile.allergies = sanitize_text(data.allergies)
    if data.activity_level is not None:
        profile.activity_level = sanitize_text(data.activity_level) or "Moderado"
    if data.medical_history is not None:
        profile.medical_history = sanitize_text(data.medical_history)

    profile.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Perfil clínico actualizado exitosamente"}

@router.get("/patient/recommendation", response_model=RecommendationResponse)
def get_patient_recommendation(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna las recomendaciones de su doctor y reglas de IA activas para el paciente."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    doctor_name = None
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if profile and profile.caregiver_id:
        doctor = db.query(models.User).filter(models.User.id == profile.caregiver_id).first()
        if doctor:
            doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"

    rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == current_user.id).first()
    if not rec:
        return RecommendationResponse(ai_rules="", recommendations="", updated_at=None, doctor_name=doctor_name)
    
    return RecommendationResponse(
        ai_rules=rec.ai_rules,
        recommendations=rec.recommendations,
        updated_at=rec.updated_at,
        doctor_name=doctor_name
    )


# ── 2. Endpoints de DOCTOR (CUIDADOR) ─────────────────────────────────────────

@router.get("/doctor/patients", response_model=List[PatientListItem])
def get_doctor_patients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna la lista de pacientes asignados a este doctor/cuidador con su historial clínico completo."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")

    profiles = db.query(models.PatientProfile).filter(models.PatientProfile.caregiver_id == current_user.id).all()
    
    result = []
    for prof in profiles:
        user = db.query(models.User).filter(models.User.id == prof.user_id).first()
        if user:
            rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == user.id).first()
            result.append(
                PatientListItem(
                    id=str(user.id),
                    email=user.email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    date_of_birth=str(prof.date_of_birth) if prof.date_of_birth else None,
                    gender=prof.gender,
                    weight_kg=float(prof.weight_kg) if prof.weight_kg else None,
                    height_cm=float(prof.height_cm) if prof.height_cm else None,
                    diabetes_type=prof.diabetes_type,
                    diagnosis_year=prof.diagnosis_year,
                    last_hba1c=float(prof.last_hba1c) if prof.last_hba1c else None,
                    medications=prof.medications,
                    allergies=prof.allergies,
                    activity_level=prof.activity_level,
                    medical_history=prof.medical_history,
                    ai_rules=rec.ai_rules if rec else "",
                    recommendations=rec.recommendations if rec else ""
                )
            )
    return result

@router.get("/doctor/patient/{patient_id}/intakes", response_model=List[IntakeResponse])
def get_doctor_patient_intakes(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna la lista de comidas registradas por un paciente específico a cargo de este doctor."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")

    # Verificar que el paciente exista y esté a cargo de este doctor
    profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == uuid.UUID(patient_id),
        models.PatientProfile.caregiver_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o no asignado a su cargo.")

    logs = db.query(models.IntakeLog).filter(
        models.IntakeLog.patient_id == uuid.UUID(patient_id)
    ).order_by(models.IntakeLog.consumed_at.desc()).all()
    
    result = []
    for log in logs:
        food = db.query(models.Food).filter(models.Food.id == log.food_id).first()
        result.append(
            _intake_to_response(log, food.name if food else "Alimento Desconocido")
        )
    return result

@router.post("/doctor/recommendation")
def update_recommendation(
    data: RecommendationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al doctor actualizar recomendaciones y reglas de IA para su paciente."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Cuidadores.")

    patient_id_uuid = uuid.UUID(data.patient_id)

    # Validar que el paciente está asignado a este doctor
    profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == patient_id_uuid,
        models.PatientProfile.caregiver_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="El paciente no existe o no está asignado a ti.")

    clean_ai_rules = data.ai_rules.strip()
    clean_recommendations = data.recommendations.strip()

    rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == patient_id_uuid).first()
    if not rec:
        rec = models.DoctorRecommendation(
            patient_id=patient_id_uuid,
            ai_rules=clean_ai_rules,
            recommendations=clean_recommendations
        )
        db.add(rec)
    else:
        rec.ai_rules = clean_ai_rules
        rec.recommendations = clean_recommendations
    
    db.commit()
    return {"message": "Recomendaciones e instrucciones de IA actualizadas correctamente"}


# ── 3. Endpoints de ADMINISTRADOR ─────────────────────────────────────────────

@router.get("/admin/users", response_model=List[UserListItem])
def get_admin_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna la lista de todos los pacientes y doctores en el sistema."""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Administradores.")

    users = db.query(models.User).all()
    
    result = []
    for u in users:
        caregiver_name = None
        if u.role == models.UserRole.PACIENTE:
            prof = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == u.id).first()
            if prof and prof.caregiver_id:
                cg = db.query(models.User).filter(models.User.id == prof.caregiver_id).first()
                if cg:
                    caregiver_name = f"Dr. {cg.first_name} {cg.last_name}"
        
        result.append(
            UserListItem(
                id=str(u.id),
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                role=u.role.value,
                caregiver_name=caregiver_name
            )
        )
    return result

@router.post("/admin/assign")
def assign_patient_to_doctor(
    data: AssignPatientRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Asigna un paciente a un doctor específico."""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Administradores.")

    p_uuid = uuid.UUID(data.patient_id)
    d_uuid = uuid.UUID(data.doctor_id)

    # Validar doctor
    doctor = db.query(models.User).filter(models.User.id == d_uuid, models.User.role == models.UserRole.CUIDADOR).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="El Doctor/Cuidador especificado no existe.")

    # Validar o crear perfil de paciente
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == p_uuid).first()
    if not profile:
        profile = models.PatientProfile(user_id=p_uuid, date_of_birth=datetime.strptime("1990-01-01", "%Y-%m-%d").date())
        db.add(profile)

    profile.caregiver_id = doctor.id
    db.commit()

    return {"message": f"Paciente asignado con éxito al Dr. {doctor.first_name} {doctor.last_name}"}

@router.post("/admin/change-role")
def change_user_role(
    data: ChangeRoleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Cambia el rol de un usuario del sistema (ej: PACIENTE a CUIDADOR)."""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Administradores.")

    u_uuid = uuid.UUID(data.user_id)
    user = db.query(models.User).filter(models.User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="El usuario especificado no existe.")

    user.role = data.new_role
    db.commit()

    return {"message": f"Rol del usuario {user.email} cambiado exitosamente a {data.new_role.value}"}


# ── Nuevos Schemas para Incidencias y Evaluaciones ──────────────────────────

class MalaiseIncidentCreateRequest(BaseModel):
    description: str
    pain_level: Optional[int] = Field(None, ge=1, le=10)
    doctor_question: Optional[str] = None

class MalaiseIncidentResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    description: str
    pain_level: Optional[int]
    doctor_question: Optional[str]
    doctor_response: Optional[str]
    created_at: datetime
    responded_at: Optional[datetime]

    model_config = {"from_attributes": True}

class MalaiseResponseUpdateRequest(BaseModel):
    doctor_response: str

class IntakeAssessmentRequest(BaseModel):
    doctor_assessment: str  # "CORRECTA" o "INCORRECTA"
    doctor_comment: str


# ── Nuevos Endpoints: Registrar Incidencia y Consultar al Doctor ────────────

@router.post("/patient/incident", response_model=MalaiseIncidentResponse)
def create_incident(
    data: MalaiseIncidentCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al paciente registrar una incidencia de dolor o malestar y pedir consejo directo."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    incident = models.MalaiseIncident(
        patient_id=current_user.id,
        description=data.description.strip(),
        pain_level=data.pain_level,
        doctor_question=data.doctor_question.strip() if data.doctor_question else None
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    return MalaiseIncidentResponse(
        id=str(incident.id),
        patient_id=str(incident.patient_id),
        patient_name=f"{current_user.first_name} {current_user.last_name}",
        description=incident.description,
        pain_level=incident.pain_level,
        doctor_question=incident.doctor_question,
        doctor_response=incident.doctor_response,
        created_at=incident.created_at,
        responded_at=incident.responded_at
    )

@router.get("/patient/incidents", response_model=List[MalaiseIncidentResponse])
def get_patient_incidents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Obtiene el historial de incidencias y dolores del paciente logueado."""
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    incidents = db.query(models.MalaiseIncident).filter(
        models.MalaiseIncident.patient_id == current_user.id
    ).order_by(models.MalaiseIncident.created_at.desc()).all()

    return [
        MalaiseIncidentResponse(
            id=str(inc.id),
            patient_id=str(inc.patient_id),
            patient_name=f"{current_user.first_name} {current_user.last_name}",
            description=inc.description,
            pain_level=inc.pain_level,
            doctor_question=inc.doctor_question,
            doctor_response=inc.doctor_response,
            created_at=inc.created_at,
            responded_at=inc.responded_at
        )
        for inc in incidents
    ]

# ── Endpoints del Doctor: Ver incidencias, responderlas y evaluar comidas ───

@router.get("/doctor/incidents", response_model=List[MalaiseIncidentResponse])
def get_doctor_incidents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Obtiene la lista de incidencias registradas por los pacientes a cargo del doctor logueado."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")

    # Buscar perfiles asignados a este doctor
    patient_ids = [
        p.user_id for p in db.query(models.PatientProfile).filter(
            models.PatientProfile.caregiver_id == current_user.id
        ).all()
    ]

    incidents = db.query(models.MalaiseIncident).filter(
        models.MalaiseIncident.patient_id.in_(patient_ids)
    ).order_by(models.MalaiseIncident.created_at.desc()).all()

    result = []
    for inc in incidents:
        patient = db.query(models.User).filter(models.User.id == inc.patient_id).first()
        p_name = f"{patient.first_name} {patient.last_name}" if patient else "Paciente Anónimo"
        result.append(
            MalaiseIncidentResponse(
                id=str(inc.id),
                patient_id=str(inc.patient_id),
                patient_name=p_name,
                description=inc.description,
                pain_level=inc.pain_level,
                doctor_question=inc.doctor_question,
                doctor_response=inc.doctor_response,
                created_at=inc.created_at,
                responded_at=inc.responded_at
            )
        )
    return result

@router.post("/doctor/incident/{incident_id}/respond")
def respond_to_incident(
    incident_id: str,
    data: MalaiseResponseUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al doctor responder a la incidencia o malestar con consejos médicos directos."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")

    inc_uuid = uuid.UUID(incident_id)
    incident = db.query(models.MalaiseIncident).filter(models.MalaiseIncident.id == inc_uuid).first()
    if not incident:
        raise HTTPException(status_code=404, detail="La incidencia médica especificada no existe.")

    # Validar que el paciente de esta incidencia está bajo este doctor
    profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == incident.patient_id,
        models.PatientProfile.caregiver_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=403, detail="No autorizado: Este paciente no está a su cargo.")

    incident.doctor_response = data.doctor_response.strip()
    incident.responded_at = datetime.utcnow()
    db.commit()

    return {"message": "Respuesta y consejo directo guardado exitosamente."}

@router.post("/doctor/intake/{intake_id}/assess")
def assess_patient_intake(
    intake_id: str,
    data: IntakeAssessmentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al doctor marcar una comida específica como CORRECTA/INCORRECTA e introducir recomendaciones específicas."""
    if current_user.role != models.UserRole.CUIDADOR:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Doctores/Cuidadores.")

    intake_uuid = uuid.UUID(intake_id)
    log = db.query(models.IntakeLog).filter(models.IntakeLog.id == intake_uuid).first()
    if not log:
        raise HTTPException(status_code=404, detail="El registro de comida especificado no existe.")

    # Validar que el paciente dueño del log está a cargo de este doctor
    profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == log.patient_id,
        models.PatientProfile.caregiver_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=403, detail="No autorizado: Este paciente no está a su cargo.")

    if data.doctor_assessment not in ["CORRECTA", "INCORRECTA"]:
        raise HTTPException(status_code=400, detail="Evaluación inválida. Debe ser 'CORRECTA' o 'INCORRECTA'.")

    log.doctor_assessment = data.doctor_assessment
    log.doctor_comment = data.doctor_comment.strip()
    db.commit()

    return {"message": "Evaluación y comentarios del médico guardados correctamente para esta comida."}


# ── RF-02 Endpoints: Módulo de Registro Integral de Variables Metabólicas ───

# 1. Glucemia Capilar (glucose_logs)
@router.post("/patient/glucose", response_model=GlucoseLogResponse)
def create_glucose_log(
    data: GlucoseLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    rec_datetime = datetime.now()
    if data.recorded_at:
        try:
            clean_str = data.recorded_at.strip()
            if "T" in clean_str:
                rec_datetime = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            elif " " in clean_str and ":" in clean_str:
                rec_datetime = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            elif len(clean_str) == 10:
                rec_datetime = datetime.combine(datetime.strptime(clean_str, "%Y-%m-%d").date(), datetime.now().time())
        except Exception:
            rec_datetime = datetime.now()

    log = models.GlucoseLog(
        patient_id=current_user.id,
        glucose_level=round(data.glucose_level, 2),
        context=data.context,
        recorded_at=rec_datetime
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return GlucoseLogResponse(
        id=str(log.id),
        glucose_level=float(log.glucose_level),
        context=log.context.value,
        recorded_at=log.recorded_at
    )

@router.get("/patient/glucose", response_model=List[GlucoseLogResponse])
def get_glucose_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    logs = db.query(models.GlucoseLog).filter(
        models.GlucoseLog.patient_id == current_user.id
    ).order_by(models.GlucoseLog.recorded_at.desc()).all()

    return [
        GlucoseLogResponse(
            id=str(l.id),
            glucose_level=float(l.glucose_level),
            context=l.context.value,
            recorded_at=l.recorded_at
        ) for l in logs
    ]

# 2. Seguimiento Antropométrico con IMC Automático (anthropometric_data)
@router.post("/patient/anthropometric", response_model=AnthropometricResponse)
def create_anthropometric_log(
    data: AnthropometricCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    height_m = data.height_cm / 100.0
    computed_bmi = round(data.weight_kg / (height_m ** 2), 2)

    rec_datetime = datetime.now()
    if data.recorded_at:
        try:
            clean_str = data.recorded_at.strip()
            if "T" in clean_str:
                rec_datetime = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            elif " " in clean_str and ":" in clean_str:
                rec_datetime = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            elif len(clean_str) == 10:
                rec_datetime = datetime.combine(datetime.strptime(clean_str, "%Y-%m-%d").date(), datetime.now().time())
        except Exception:
            rec_datetime = datetime.now()

    log = models.AnthropometricData(
        patient_id=current_user.id,
        weight_kg=round(data.weight_kg, 2),
        height_cm=round(data.height_cm, 2),
        bmi=computed_bmi,
        recorded_at=rec_datetime
    )
    db.add(log)

    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if profile:
        profile.weight_kg = round(data.weight_kg, 2)
        profile.height_cm = round(data.height_cm, 2)

    db.commit()
    db.refresh(log)

    return AnthropometricResponse(
        id=str(log.id),
        weight_kg=float(log.weight_kg),
        height_cm=float(log.height_cm),
        bmi=float(log.bmi),
        recorded_at=log.recorded_at
    )

@router.get("/patient/anthropometric", response_model=List[AnthropometricResponse])
def get_anthropometric_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    logs = db.query(models.AnthropometricData).filter(
        models.AnthropometricData.patient_id == current_user.id
    ).order_by(models.AnthropometricData.recorded_at.desc()).all()

    return [
        AnthropometricResponse(
            id=str(l.id),
            weight_kg=float(l.weight_kg),
            height_cm=float(l.height_cm),
            bmi=float(l.bmi) if l.bmi else round(float(l.weight_kg)/((float(l.height_cm)/100)**2), 2),
            recorded_at=l.recorded_at
        ) for l in logs
    ]

# 3. Diario de Medicación (medication_logs)
@router.post("/patient/medication", response_model=MedicationLogResponse)
def create_medication_log(
    data: MedicationLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    if not data.medication_name.strip():
        raise HTTPException(status_code=400, detail="El nombre del medicamento no puede estar vacío.")

    rec_datetime = datetime.now()
    if data.taken_at:
        try:
            clean_str = data.taken_at.strip()
            if "T" in clean_str:
                rec_datetime = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            elif " " in clean_str and ":" in clean_str:
                rec_datetime = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            elif len(clean_str) == 10:
                rec_datetime = datetime.combine(datetime.strptime(clean_str, "%Y-%m-%d").date(), datetime.now().time())
        except Exception:
            rec_datetime = datetime.now()

    log = models.MedicationLog(
        patient_id=current_user.id,
        medication_name=data.medication_name.strip(),
        dosage=data.dosage.strip(),
        taken_at=rec_datetime
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return MedicationLogResponse(
        id=str(log.id),
        medication_name=log.medication_name,
        dosage=log.dosage,
        taken_at=log.taken_at
    )

@router.get("/patient/medication", response_model=List[MedicationLogResponse])
def get_medication_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    logs = db.query(models.MedicationLog).filter(
        models.MedicationLog.patient_id == current_user.id
    ).order_by(models.MedicationLog.taken_at.desc()).all()

    return [
        MedicationLogResponse(
            id=str(l.id),
            medication_name=l.medication_name,
            dosage=l.dosage,
            taken_at=l.taken_at
        ) for l in logs
    ]

# 4. Bitácora de Actividad Física (physical_activity_logs)
@router.post("/patient/physical-activity", response_model=PhysicalActivityResponse)
def create_physical_activity_log(
    data: PhysicalActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    if not data.activity_type.strip():
        raise HTTPException(status_code=400, detail="El tipo de actividad física no puede estar vacío.")

    rec_datetime = datetime.now()
    if data.recorded_at:
        try:
            clean_str = data.recorded_at.strip()
            if "T" in clean_str:
                rec_datetime = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            elif " " in clean_str and ":" in clean_str:
                rec_datetime = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            elif len(clean_str) == 10:
                rec_datetime = datetime.combine(datetime.strptime(clean_str, "%Y-%m-%d").date(), datetime.now().time())
        except Exception:
            rec_datetime = datetime.now()

    log = models.PhysicalActivityLog(
        patient_id=current_user.id,
        activity_type=data.activity_type.strip(),
        duration_minutes=data.duration_minutes,
        recorded_at=rec_datetime
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return PhysicalActivityResponse(
        id=str(log.id),
        activity_type=log.activity_type,
        duration_minutes=log.duration_minutes,
        recorded_at=log.recorded_at
    )

@router.get("/patient/physical-activity", response_model=List[PhysicalActivityResponse])
def get_physical_activity_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.PACIENTE:
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo para Pacientes.")

    logs = db.query(models.PhysicalActivityLog).filter(
        models.PhysicalActivityLog.patient_id == current_user.id
    ).order_by(models.PhysicalActivityLog.recorded_at.desc()).all()

    return [
        PhysicalActivityResponse(
            id=str(l.id),
            activity_type=l.activity_type,
            duration_minutes=l.duration_minutes,
            recorded_at=l.recorded_at
        ) for l in logs
    ]

# 5. Consulta del Médico para la Ficha e Historial Metabólico (RF-02) de un Paciente Asignado
@router.get("/doctor/patient/{patient_id}/metabolic-summary", response_model=DoctorPatientMetabolicSummary)
def get_doctor_patient_metabolic_summary(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permite al médico revisar el registro integral de variables metabólicas (RF-02) de un paciente asignado."""
    require_doctor(current_user)
    profile = get_assigned_patient_profile(db, current_user, patient_id)
    patient_user = db.query(models.User).filter(models.User.id == profile.user_id).first()
    if not patient_user:
        raise HTTPException(status_code=404, detail="Usuario paciente no encontrado.")

    data = build_metabolic_summary_for_dashboard(db, profile, patient_user)
    return DoctorPatientMetabolicSummary(
        patient_id=data["patient_id"],
        patient_name=data["patient_name"],
        profile=data["profile"],
        glucose_logs=[GlucoseLogResponse(**g) for g in data["glucose_logs"]],
        anthropometric_logs=[AnthropometricResponse(**a) for a in data["anthropometric_logs"]],
        medication_logs=[MedicationLogResponse(**m) for m in data["medication_logs"]],
        physical_activity_logs=[PhysicalActivityResponse(**a) for a in data["physical_activity_logs"]],
        nutrition=NutritionSummary(**data["nutrition"]),
        quick_stats=MetabolicQuickStats(**data["quick_stats"]),
    )


# ── RF-06: Reportes clínicos e indicadores ────────────────────────────────────

class ClinicalReportResponse(BaseModel):
    patient_id: str
    patient_name: str
    doctor_name: str
    generated_at: str
    period: Dict[str, Any]
    profile: Dict[str, Any]
    metrics: Dict[str, Any]
    glucose_series: List[Dict[str, Any]]
    daily_nutrition: List[Dict[str, Any]]
    intakes: List[Dict[str, Any]]
    anthropometric_logs: List[Dict[str, Any]]
    medication_logs: List[Dict[str, Any]]
    physical_activity_logs: List[Dict[str, Any]]
    notes: List[str] = []


@router.get("/doctor/patient/{patient_id}/clinical-report", response_model=ClinicalReportResponse)
def get_doctor_clinical_report(
    patient_id: str,
    period: str = Query(default="30", description="7 | 30 | 90 | custom"),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """RF-06: Indicadores de variabilidad glucémica y balance calórico para consulta médica."""
    require_doctor(current_user)
    profile = get_assigned_patient_profile(db, current_user, patient_id)
    patient_user = db.query(models.User).filter(models.User.id == profile.user_id).first()
    if not patient_user:
        raise HTTPException(status_code=404, detail="Usuario paciente no encontrado.")

    report_period = parse_report_period(period, from_date, to_date)
    bundle = build_clinical_report(db, profile, patient_user, current_user, report_period)
    return bundle_to_dict(bundle)


@router.get("/doctor/patient/{patient_id}/clinical-report/export")
def export_doctor_clinical_report(
    patient_id: str,
    format: str = Query(default="pdf", description="pdf | csv"),
    period: str = Query(default="30"),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """RF-06: Exporta reporte clínico en PDF o CSV."""
    require_doctor(current_user)
    profile = get_assigned_patient_profile(db, current_user, patient_id)
    patient_user = db.query(models.User).filter(models.User.id == profile.user_id).first()
    if not patient_user:
        raise HTTPException(status_code=404, detail="Usuario paciente no encontrado.")

    report_period = parse_report_period(period, from_date, to_date)
    bundle = build_clinical_report(db, profile, patient_user, current_user, report_period)

    fmt = (format or "pdf").strip().lower()
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in patient_user.first_name.lower())
    stamp = report_period.to_date.isoformat()

    if fmt == "csv":
        content = export_report_csv(bundle)
        filename = f"reporte_clinico_{safe_name}_{stamp}.csv"
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    if fmt == "pdf":
        content = export_report_pdf(bundle)
        filename = f"reporte_clinico_{safe_name}_{stamp}.pdf"
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    raise HTTPException(status_code=400, detail="Formato inválido. Use pdf o csv.")
