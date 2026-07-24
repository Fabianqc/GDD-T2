from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
try:
    from ..ai_service import generate_text, analyze_food_image, LLM_PROVIDER, OLLAMA_MODEL, NVIDIA_MODEL
    from ..auth import get_current_user
    from ..database import get_db
    from .. import models
except (ImportError, ValueError):
    from ai_service import generate_text, analyze_food_image, LLM_PROVIDER, OLLAMA_MODEL, NVIDIA_MODEL
    from auth import get_current_user
    from database import get_db
    import models

router = APIRouter(prefix="/ai", tags=["Inteligencia Artificial"])

class AIRequest(BaseModel):
    prompt: str

class AIResponse(BaseModel):
    response: str
    provider: str
    model: str

class ImageScanRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"

class ImageScanResponse(BaseModel):
    food_name: str
    portion_size_g: float
    meal_type: str
    provider: str

@router.post("/generate", response_model=AIResponse)
async def generate_ai_response(
    data: AIRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera una respuesta usando la IA activa (NVIDIA, Gemini u Ollama).
    Incorpora automáticamente el contexto de Diabetes Tipo 2, la ficha médica del paciente
    y las reglas/recomendaciones dadas por su médico tratante.
    """
    clean_prompt = data.prompt.strip()
    
    # 1. Obtener Ficha Médica y Recomendaciones del Doctor si existen
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    doctor_rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == current_user.id).first()

    # 2. Construir Prompt del Sistema con Directrices Clínicas y Descargo de Responsabilidad
    system_prompt = (
        "Eres un asistente virtual de salud especializado en el acompañamiento y nutrición para personas con DIABETES TIPO 2.\n\n"
        "DIRECTRICES OBLIGATORIAS DE RESPUESTA:\n"
        "1. RESPUESTA CORTA Y DIRECTA: Responde en un tono empático, claro y conciso (máximo 2 a 3 párrafos breves). Sé directo y evita explicaciones o textos excesivamente largos.\n"
        "2. ENFOQUE EN DIABETES TIPO 2: El paciente padece Diabetes Tipo 2. Ofrece recomendaciones enfocadas en el control del índice y carga glucémica, hábitos saludables y bienestar metabólico.\n"
        "3. FICHA DEL PACIENTE Y REGLAS DEL MÉDICO: Respeta rigurosamente la ficha clínica del paciente y las restricciones específicas dadas por su médico tratante descritas abajo.\n"
        "4. AVISO DE RESPONSABILIDAD MÉDICA (OBLIGATORIO AL FINAL): Concluye tu respuesta con un breve aviso indicando explícitamente que esta información la proporciona una Inteligencia Artificial y que la mejor forma de confirmar o ajustar su tratamiento es consultando directamente a un médico especialista.\n\n"
    )

    context_parts = ["--- DATOS CLÍNICOS DEL PACIENTE ---"]
    context_parts.append(f"• Nombre: {current_user.first_name} {current_user.last_name}")
    context_parts.append("• Diagnóstico: Diabetes Tipo 2")

    if profile:
        if profile.gender: context_parts.append(f"• Género: {profile.gender}")
        if profile.weight_kg: context_parts.append(f"• Peso: {profile.weight_kg} kg")
        if profile.height_cm: context_parts.append(f"• Estatura: {profile.height_cm} cm")
        if profile.diagnosis_year: context_parts.append(f"• Año de diagnóstico: {profile.diagnosis_year}")
        if profile.last_hba1c: context_parts.append(f"• Última HbA1c: {profile.last_hba1c}%")
        if profile.medications: context_parts.append(f"• Medicamentos actuales: {profile.medications}")
        if profile.allergies: context_parts.append(f"• Alergias o restricciones alimentarias: {profile.allergies}")
        if profile.activity_level: context_parts.append(f"• Nivel de actividad física: {profile.activity_level}")
        if profile.medical_history: context_parts.append(f"• Historial clínico relevante: {profile.medical_history}")

    if doctor_rec:
        if doctor_rec.ai_rules:
            context_parts.append(f"• REGLAS Y RESTRICCIONES OBLIGATORIAS DADAS POR SU DOCTOR: {doctor_rec.ai_rules}")
        if doctor_rec.recommendations:
            context_parts.append(f"• RECOMENDACIONES GENERALES DEL MÉDICO TRATANTE: {doctor_rec.recommendations}")

    context_parts.append("--------------------------------------------------")
    full_system_prompt = system_prompt + "\n".join(context_parts)

    response_text = await generate_text(clean_prompt, system_prompt=full_system_prompt)
    
    # Determinamos el nombre del modelo a retornar en los metadatos
    if LLM_PROVIDER in ["nvidia", "llama"]:
        model_name = NVIDIA_MODEL
    elif LLM_PROVIDER == "gemini":
        model_name = "gemini-1.5-flash"
    else:
        model_name = OLLAMA_MODEL
    
    return AIResponse(
        response=response_text,
        provider=LLM_PROVIDER,
        model=model_name
    )

@router.post("/analyze-food", response_model=ImageScanResponse)
async def analyze_food(
    data: ImageScanRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Analiza una foto de un plato de comida enviada en formato Base64.
    Retorna el nombre del alimento estimado, porción en gramos y tipo de comida.
    Si no se detecta comida real, retorna un error 400 aclaratorio.
    """
    clean_image = data.image_base64.strip()
    clean_mime = data.mime_type.strip() if data.mime_type else "image/jpeg"
    result = await analyze_food_image(clean_image, clean_mime)
    
    if not result.get("is_food", True):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=result.get("error_message") or "No se detectó ningún alimento o plato de comida en la imagen."
        )

    return ImageScanResponse(
        food_name=result["food_name"],
        portion_size_g=result["portion_size_g"],
        meal_type=result["meal_type"],
        provider=LLM_PROVIDER
    )

