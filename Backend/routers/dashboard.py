from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

from .. import models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard por Roles"])

# ── Schemas ──────────────────────────────────────────────────────────────────

class IntakeCreateRequest(BaseModel):
    food_name: str
    portion_size_g: float
    meal_type: models.MealType
    image_base64: Optional[str] = None

class IntakeResponse(BaseModel):
    id: str
    food_name: str
    portion_size_g: float
    meal_type: str
    consumed_at: datetime
    image_base64: Optional[str] = None
    doctor_assessment: Optional[str] = None
    doctor_comment: Optional[str] = None

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
    if not food:
        food = models.Food(
            name=clean_food_name,
            glycemic_index=55.0,  # Valores estándar por defecto
            glycemic_load=10.0,
            calories_per_100g=120.0,
            carbs_per_100g=15.0
        )
        db.add(food)
        db.commit()
        db.refresh(food)

    # 3. Registrar la ingesta
    log = models.IntakeLog(
        patient_id=profile.user_id,
        food_id=food.id,
        meal_type=data.meal_type,
        portion_size_g=round(data.portion_size_g, 2),
        image_base64=data.image_base64
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
        image_base64=log.image_base64
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
            IntakeResponse(
                id=str(log.id),
                food_name=food.name if food else "Alimento Desconocido",
                portion_size_g=float(log.portion_size_g),
                meal_type=log.meal_type.value,
                consumed_at=log.consumed_at,
                image_base64=log.image_base64,
                doctor_assessment=log.doctor_assessment,
                doctor_comment=log.doctor_comment
            )
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

    # Actualizar campos si se proporcionan en el request
    if data.date_of_birth:
        try:
            profile.date_of_birth = datetime.strptime(data.date_of_birth.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Debe ser YYYY-MM-DD")

    if data.gender is not None:
        profile.gender = data.gender.strip()
    if data.weight_kg is not None:
        profile.weight_kg = round(data.weight_kg, 2)
    if data.height_cm is not None:
        profile.height_cm = round(data.height_cm, 2)
    if data.diabetes_type is not None:
        profile.diabetes_type = data.diabetes_type.strip()
    if data.diagnosis_year is not None:
        profile.diagnosis_year = data.diagnosis_year
    if data.last_hba1c is not None:
        profile.last_hba1c = round(data.last_hba1c, 2)
    if data.medications is not None:
        profile.medications = data.medications.strip()
    if data.allergies is not None:
        profile.allergies = data.allergies.strip()
    if data.activity_level is not None:
        profile.activity_level = data.activity_level.strip()
    if data.medical_history is not None:
        profile.medical_history = data.medical_history.strip()

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
            IntakeResponse(
                id=str(log.id),
                food_name=food.name if food else "Alimento Desconocido",
                portion_size_g=float(log.portion_size_g),
                meal_type=log.meal_type.value,
                consumed_at=log.consumed_at,
                image_base64=log.image_base64,
                doctor_assessment=log.doctor_assessment,
                doctor_comment=log.doctor_comment
            )
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
