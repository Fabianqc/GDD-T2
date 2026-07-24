from sqlalchemy import Column, String, ForeignKey, DateTime, DECIMAL, Integer, Boolean, Enum as SQLEnum, Date, Text, UniqueConstraint, Time
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
    portion_size_g = Column(DECIMAL(10, 2), nullable=False)
    # Valores nutricionales de la porción consumida (estimados por IA o capturados manualmente)
    calories = Column(DECIMAL(8, 2), nullable=True)
    carbs_g = Column(DECIMAL(8, 2), nullable=True)
    glycemic_index = Column(DECIMAL(5, 2), nullable=True)
    glycemic_load = Column(DECIMAL(5, 2), nullable=True)
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


class AIChatSession(Base):
    """
    Sesión de conversación entre un paciente y la IA.
    """
    __tablename__ = "ai_chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", backref="ai_chat_sessions")
    messages = relationship("AIChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="AIChatMessage.created_at.asc()")


class AIChatMessage(Base):
    """
    Mensaje individual perteneciente a una sesión de chat con la IA.
    """
    __tablename__ = "ai_chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(20), nullable=False)  # "user" o "ai"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("AIChatSession", back_populates="messages")


class SavedMenu(Base):
    """
    Menú diario personalizado generado por IA y guardado por el paciente.
    """
    __tablename__ = "saved_menus"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), nullable=False)
    target_day = Column(String(10), nullable=False)  # "HOY" or "MANANA"
    menu_json = Column(Text, nullable=False)  # JSON string with structured meals
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", backref="saved_menus")


class ReminderDeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class MealReminderConfig(Base):
    """
    Configuración global de recordatorios de comida por paciente.
    Horarios predeterminados; el doctor puede ajustarlos después.
    """
    __tablename__ = "meal_reminder_configs"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), primary_key=True)
    timezone = Column(String(64), nullable=False, default="America/Caracas")
    advance_minutes = Column(Integer, nullable=False, default=30)
    enabled = Column(Boolean, nullable=False, default=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", backref="meal_reminder_config", uselist=False)
    slots = relationship(
        "MealReminderSlot",
        back_populates="config",
        cascade="all, delete-orphan",
        order_by="MealReminderSlot.meal_type",
    )


class MealReminderSlot(Base):
    """Horario individual por tipo de comida (desayuno, almuerzo, merienda, cena)."""
    __tablename__ = "meal_reminder_slots"
    __table_args__ = (
        UniqueConstraint("patient_id", "meal_type", name="uq_meal_reminder_slot_patient_meal"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("meal_reminder_configs.patient_id", ondelete="CASCADE"), nullable=False)
    meal_type = Column(SQLEnum(MealType), nullable=False)
    meal_time = Column(Time, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)

    config = relationship("MealReminderConfig", back_populates="slots")


class PatientPushDevice(Base):
    """Token Expo Push asociado a un dispositivo del paciente."""
    __tablename__ = "patient_push_devices"
    __table_args__ = (
        UniqueConstraint("expo_push_token", name="uq_patient_push_expo_token"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    expo_push_token = Column(String(255), nullable=False)
    platform = Column(String(20), nullable=True)  # ios | android
    device_name = Column(String(150), nullable=True)
    timezone = Column(String(64), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", backref="push_devices")


class MealReminderDelivery(Base):
    """
    Historial de entregas de recordatorios.
    UNIQUE (patient_id, meal_type, reminder_date) evita notificaciones duplicadas.
    """
    __tablename__ = "meal_reminder_deliveries"
    __table_args__ = (
        UniqueConstraint("patient_id", "meal_type", "reminder_date", name="uq_meal_reminder_delivery_day"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.user_id", ondelete="CASCADE"), nullable=False, index=True)
    meal_type = Column(SQLEnum(MealType), nullable=False)
    reminder_date = Column(Date, nullable=False)
    status = Column(SQLEnum(ReminderDeliveryStatus), nullable=False, default=ReminderDeliveryStatus.PENDING)
    scheduled_for = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

