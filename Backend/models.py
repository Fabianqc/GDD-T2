from sqlalchemy import Column, String, ForeignKey, DateTime, DECIMAL, Integer, Boolean, Enum as SQLEnum, Date, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import datetime
try:
    from .database import Base
except (ImportError, ValueError):
    from database import Base
import enum

class UserRole(str, enum.Enum):
    PACIENTE = "PACIENTE"
    CUIDADOR = "CUIDADOR"
    ADMIN = "ADMIN"

class GlycemicContext(str, enum.Enum):
    AYUNAS = "AYUNAS"
    ANTES_COMIDA = "ANTES_COMIDA"
    DESPUES_COMIDA = "DESPUES_COMIDA"
    MADRUGADA = "MADRUGADA"

class MealType(str, enum.Enum):
    DESAYUNO = "DESAYUNO"
    ALMUERZO = "ALMUERZO"
    CENA = "CENA"
    MERIENDA = "MERIENDA"

class AlertType(str, enum.Enum):
    ALTO_RIESGO = "ALTO_RIESGO"
    BAJA_ADHERENCIA = "BAJA_ADHERENCIA"
    RECORDATORIO = "RECORDATORIO"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.PACIENTE)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient_profile = relationship(
        "PatientProfile", 
        back_populates="user", 
        uselist=False,
        foreign_keys="PatientProfile.user_id"
    )

class Food(Base):
    __tablename__ = "foods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    glycemic_index = Column(DECIMAL(5, 2), nullable=False)
    glycemic_load = Column(DECIMAL(5, 2), nullable=False)
    calories_per_100g = Column(DECIMAL(5, 2), nullable=False)
    carbs_per_100g = Column(DECIMAL(5, 2), nullable=False)

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    date_of_birth = Column(Date, nullable=False)
    
    # Nuevos campos médicos detallados clave para el diagnóstico
    gender = Column(String(50), nullable=True)
    weight_kg = Column(DECIMAL(5, 2), nullable=True)
    height_cm = Column(DECIMAL(5, 2), nullable=True)
    diabetes_type = Column(String(100), default="Tipo 2", nullable=True)
    diagnosis_year = Column(Integer, nullable=True)
    last_hba1c = Column(DECIMAL(4, 2), nullable=True)
    medications = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    activity_level = Column(String(100), nullable=True)
    medical_history = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])

class AnthropometricData(Base):
    __tablename__ = "anthropometric_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    weight_kg = Column(DECIMAL(5, 2), nullable=False)
    height_cm = Column(DECIMAL(5, 2), nullable=False)
    bmi = Column(DECIMAL(5, 2))
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

class GlucoseLog(Base):
    __tablename__ = "glucose_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    glucose_level = Column(DECIMAL(5, 2), nullable=False)
    context = Column(SQLEnum(GlycemicContext), nullable=False)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    medication_name = Column(String(150), nullable=False)
    dosage = Column(String(100), nullable=False)
    taken_at = Column(DateTime, default=datetime.datetime.utcnow)

class PhysicalActivityLog(Base):
    __tablename__ = "physical_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    activity_type = Column(String(150), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

class IntakeLog(Base):
    __tablename__ = "intake_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    food_id = Column(UUID(as_uuid=True), ForeignKey("foods.id", ondelete="RESTRICT"))
    meal_type = Column(SQLEnum(MealType), nullable=False)
    portion_size_g = Column(DECIMAL(6, 2), nullable=False)
    image_base64 = Column(Text, nullable=True)
    doctor_assessment = Column(String(50), nullable=True)  # "CORRECTA" o "INCORRECTA"
    doctor_comment = Column(Text, nullable=True)  # Comentarios/observaciones específicas del doctor
    consumed_at = Column(DateTime, default=datetime.datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"))
    type = Column(SQLEnum(AlertType), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RefreshToken(Base):
    """
    Registro de refresh tokens para la estrategia rotate + blacklist.
    Cuando se usa un refresh token, se revoca (revoked=True) y se emite uno nuevo.
    """
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = Column(String(36), unique=True, nullable=False, index=True)  # JWT ID único
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="refresh_tokens")


class DoctorRecommendation(Base):
    """
    Recomendaciones médicas y reglas de IA específicas dadas por un doctor (cuidador) para un paciente.
    """
    __tablename__ = "doctor_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    ai_rules = Column(Text, nullable=True)  # Reglas/restricciones específicas para la IA
    recommendations = Column(Text, nullable=True)  # Consejos médicos generales
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", backref="doctor_recommendation")


class MalaiseIncident(Base):
    """
    Registros de dolor, incidencias, malestares y consultas directas al doctor por parte del paciente.
    """
    __tablename__ = "malaise_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    description = Column(String(500), nullable=False)  # ej: "Fuerte dolor de cabeza y visión borrosa"
    pain_level = Column(Integer, nullable=True)  # Escala 1 al 10
    
    doctor_question = Column(String(500), nullable=True)  # Consulta o petición de consejo directo
    doctor_response = Column(String(500), nullable=True)  # Respuesta / consejo del doctor
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    patient = relationship("PatientProfile", backref="malaise_incidents")

