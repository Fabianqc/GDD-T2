from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime

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
    session_id: Optional[str] = None

class AIChatMessageSchema(BaseModel):
    id: str
    sender: str
    content: str
    created_at: datetime.datetime

class AIChatSessionSchema(BaseModel):
    id: str
    title: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    messages: Optional[List[AIChatMessageSchema]] = []

class AIResponse(BaseModel):
    response: str
    provider: str
    model: str
    session_id: Optional[str] = None

class ImageScanRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"

class ImageScanResponse(BaseModel):
    food_name: str
    portion_size_g: float
    meal_type: str
    provider: str
    calories: Optional[float] = None
    carbs_g: Optional[float] = None
    glycemic_index: Optional[float] = None
    glycemic_load: Optional[float] = None


@router.get("/sessions", response_model=List[AIChatSessionSchema])
def get_ai_chat_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene la lista de conversaciones del paciente ordenadas por la fecha más reciente.
    """
    sessions = db.query(models.AIChatSession).filter(
        models.AIChatSession.patient_id == current_user.id
    ).order_by(models.AIChatSession.updated_at.desc()).all()
    
    return [
        AIChatSessionSchema(
            id=str(s.id),
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            messages=[]
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=AIChatSessionSchema)
def get_ai_chat_session_detail(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene los detalles y el historial completo de mensajes de una sesión de chat.
    """
    session_obj = db.query(models.AIChatSession).filter(
        models.AIChatSession.id == session_id,
        models.AIChatSession.patient_id == current_user.id
    ).first()

    if not session_obj:
        raise HTTPException(status_code=404, detail="Sesión de chat no encontrada.")

    return AIChatSessionSchema(
        id=str(session_obj.id),
        title=session_obj.title,
        created_at=session_obj.created_at,
        updated_at=session_obj.updated_at,
        messages=[
            AIChatMessageSchema(
                id=str(m.id),
                sender=m.sender,
                content=m.content,
                created_at=m.created_at
            ) for m in session_obj.messages
        ]
    )


@router.delete("/sessions/{session_id}")
def delete_ai_chat_session(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Elimina una sesión de chat y todos sus mensajes.
    """
    session_obj = db.query(models.AIChatSession).filter(
        models.AIChatSession.id == session_id,
        models.AIChatSession.patient_id == current_user.id
    ).first()

    if not session_obj:
        raise HTTPException(status_code=404, detail="Sesión de chat no encontrada.")

    db.delete(session_obj)
    db.commit()
    return {"message": "Sesión de chat eliminada exitosamente."}


@router.post("/generate", response_model=AIResponse)
async def generate_ai_response(
    data: AIRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera una respuesta usando la IA activa (NVIDIA, Gemini u Ollama).
    Incorpora el contexto de Diabetes Tipo 2, ficha médica del paciente, reglas del médico
    y guarda la conversación en el historial persistente del paciente.
    """
    clean_prompt = data.prompt.strip()
    if not clean_prompt:
        raise HTTPException(status_code=400, detail="El texto de la consulta no puede estar vacío.")

    # 1. Manejo de la Sesión de Chat Persistente
    session_obj = None
    if data.session_id:
        session_obj = db.query(models.AIChatSession).filter(
            models.AIChatSession.id == data.session_id,
            models.AIChatSession.patient_id == current_user.id
        ).first()

    if not session_obj:
        short_title = clean_prompt[:35] + ("..." if len(clean_prompt) > 35 else "")
        session_obj = models.AIChatSession(
            patient_id=current_user.id,
            title=short_title or "Nueva Consulta IA"
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

    # Guardar mensaje del usuario
    user_msg = models.AIChatMessage(
        session_id=session_obj.id,
        sender="user",
        content=clean_prompt
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Obtener Ficha Médica y Recomendaciones del Doctor
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    doctor_rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == current_user.id).first()

    # 3. Construir Prompt del Sistema con Directrices Clínicas
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

    # 3.1 Historial de Glucemia Capilar
    recent_glucose = db.query(models.GlucoseLog).filter(
        models.GlucoseLog.patient_id == current_user.id
    ).order_by(models.GlucoseLog.recorded_at.desc()).limit(5).all()
    if recent_glucose:
        context_parts.append("\n• ÚLTIMAS MEDICIONES DE GLUCEMIA CAPILAR REGISTRADAS (RF-02):")
        for g in recent_glucose:
            dt_str = g.recorded_at.strftime("%Y-%m-%d %H:%M") if g.recorded_at else ""
            ctx_val = g.context.value if hasattr(g.context, 'value') else str(g.context)
            context_parts.append(f"  - {g.glucose_level} mg/dL ({ctx_val}) el {dt_str}")

    # 3.2 Historial Antropométrico e IMC
    recent_anthro = db.query(models.AnthropometricData).filter(
        models.AnthropometricData.patient_id == current_user.id
    ).order_by(models.AnthropometricData.recorded_at.desc()).limit(3).all()
    if recent_anthro:
        context_parts.append("\n• ÚLTIMOS REGISTROS ANTROPOMÉTRICOS E IMC (RF-02):")
        for a in recent_anthro:
            dt_str = a.recorded_at.strftime("%Y-%m-%d") if a.recorded_at else ""
            context_parts.append(f"  - Peso: {a.weight_kg} kg, Estatura: {a.height_cm} cm, IMC: {a.bmi} kg/m² ({dt_str})")

    # 3.3 Bitácora de Medicamentos Tomados
    recent_meds = db.query(models.MedicationLog).filter(
        models.MedicationLog.patient_id == current_user.id
    ).order_by(models.MedicationLog.taken_at.desc()).limit(5).all()
    if recent_meds:
        context_parts.append("\n• ÚLTIMOS MEDICAMENTOS ADMINISTRADOS (RF-02):")
        for m in recent_meds:
            dt_str = m.taken_at.strftime("%Y-%m-%d %H:%M") if m.taken_at else ""
            context_parts.append(f"  - {m.medication_name} (Dosis: {m.dosage}) el {dt_str}")

    # 3.4 Bitácora de Actividad Física
    recent_activity = db.query(models.PhysicalActivityLog).filter(
        models.PhysicalActivityLog.patient_id == current_user.id
    ).order_by(models.PhysicalActivityLog.recorded_at.desc()).limit(5).all()
    if recent_activity:
        context_parts.append("\n• ÚLTIMAS ACTIVIDADES FÍSICAS REALIZADAS (RF-02):")
        for act in recent_activity:
            dt_str = act.recorded_at.strftime("%Y-%m-%d") if act.recorded_at else ""
            context_parts.append(f"  - {act.activity_type} por {act.duration_minutes} min ({dt_str})")

    # 3.5 Registro de Comidas Recientes
    recent_intakes = db.query(models.IntakeLog).filter(
        models.IntakeLog.patient_id == current_user.id
    ).order_by(models.IntakeLog.consumed_at.desc()).limit(7).all()
    if recent_intakes:
        context_parts.append("\n• ÚLTIMAS COMIDAS / INGESTAS REGISTRADAS:")
        for intake in recent_intakes:
            food_obj = db.query(models.Food).filter(models.Food.id == intake.food_id).first()
            food_name = food_obj.name if food_obj else "Alimento"
            meal_val = intake.meal_type.value if hasattr(intake.meal_type, 'value') else str(intake.meal_type)
            dt_str = intake.consumed_at.strftime("%Y-%m-%d %H:%M") if intake.consumed_at else ""
            assessment = f" [Valoración médica: {intake.doctor_assessment}]" if intake.doctor_assessment else ""
            context_parts.append(f"  - {meal_val}: {food_name} ({intake.portion_size_g}g) el {dt_str}{assessment}")

    context_parts.append("--------------------------------------------------")
    
    # Memoria conversacional de esta sesión
    previous_messages = db.query(models.AIChatMessage).filter(
        models.AIChatMessage.session_id == session_obj.id
    ).order_by(models.AIChatMessage.created_at.asc()).all()

    if len(previous_messages) > 1:
        context_parts.append("--- HISTORIAL DE ESTA CONVERSACIÓN ---")
        for m in previous_messages[:-1]:  # Excluimos el mensaje actual
            prefix = "Paciente: " if m.sender == "user" else "IA Asistente: "
            context_parts.append(f"{prefix}{m.content}")
        context_parts.append("--------------------------------------")

    full_system_prompt = system_prompt + "\n".join(context_parts)

    response_text = await generate_text(clean_prompt, system_prompt=full_system_prompt)
    
    # Guardar respuesta de la IA en la base de datos
    ai_msg = models.AIChatMessage(
        session_id=session_obj.id,
        sender="ai",
        content=response_text
    )
    db.add(ai_msg)
    
    session_obj.updated_at = datetime.datetime.utcnow()
    db.commit()

    # Nombre del modelo activo
    if LLM_PROVIDER in ["nvidia", "llama"]:
        model_name = NVIDIA_MODEL
    elif LLM_PROVIDER == "gemini":
        model_name = "gemini-1.5-flash"
    else:
        model_name = OLLAMA_MODEL
    
    return AIResponse(
        response=response_text,
        provider=LLM_PROVIDER,
        model=model_name,
        session_id=str(session_obj.id)
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
        raise HTTPException(
            status_code=400,
            detail=result.get("error_message") or "No se detectó ningún alimento o plato de comida en la imagen."
        )

    return ImageScanResponse(
        food_name=result["food_name"],
        portion_size_g=result["portion_size_g"],
        meal_type=result["meal_type"],
        provider=LLM_PROVIDER,
        calories=result.get("calories"),
        carbs_g=result.get("carbs_g"),
        glycemic_index=result.get("glycemic_index"),
        glycemic_load=result.get("glycemic_load"),
    )


# ── Generador de Menú Diario Personalizado con IA ──────────────────────────────

class MenuGenerateRequest(BaseModel):
    target_day: str  # "HOY" or "MANANA"

class MenuMealItem(BaseModel):
    meal_type: str
    meal_label: str
    dish_name: str
    ingredients: str
    portion_g: int
    tip: str

class MenuGenerateResponse(BaseModel):
    meals: List[MenuMealItem]
    general_tip: str
    target_day: str
    missing_meals: List[str]
    provider: str

class SaveMenuRequest(BaseModel):
    target_day: str
    meals: List[dict]
    general_tip: str

class SavedMenuResponse(BaseModel):
    id: str
    target_day: str
    meals: List[dict]
    general_tip: str
    created_at: str


@router.post("/generate-menu", response_model=MenuGenerateResponse)
async def generate_daily_menu(
    data: MenuGenerateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import datetime as dt_mod
    import json as json_mod

    all_meal_keys = ["DESAYUNO", "ALMUERZO", "CENA", "MERIENDA"]

    # 1. Comidas ya registradas hoy
    today_intakes = db.query(models.IntakeLog).filter(
        models.IntakeLog.patient_id == current_user.id,
        models.IntakeLog.consumed_at >= dt_mod.datetime.combine(dt_mod.date.today(), dt_mod.time.min),
        models.IntakeLog.consumed_at <= dt_mod.datetime.combine(dt_mod.date.today(), dt_mod.time.max),
    ).all()

    registered_meals_today = set()
    registered_meals_detail = []
    for intake in today_intakes:
        meal_val = intake.meal_type.value if hasattr(intake.meal_type, 'value') else str(intake.meal_type)
        registered_meals_today.add(meal_val)
        food_obj = db.query(models.Food).filter(models.Food.id == intake.food_id).first()
        food_name = food_obj.name if food_obj else "Alimento"
        registered_meals_detail.append(f"{meal_val}: {food_name} ({intake.portion_size_g}g)")

    if data.target_day == "HOY":
        missing_meals = [m for m in all_meal_keys if m not in registered_meals_today]
        if not missing_meals:
            return MenuGenerateResponse(
                meals=[],
                general_tip="🎉 ¡Ya has registrado todas las comidas del día! No hay comidas pendientes.",
                target_day="HOY",
                missing_meals=[],
                provider="none"
            )
    else:
        missing_meals = list(all_meal_keys)

    # 2. Contexto clínico
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    doctor_rec = db.query(models.DoctorRecommendation).filter(models.DoctorRecommendation.patient_id == current_user.id).first()

    ctx = [f"Paciente: {current_user.first_name} {current_user.last_name}", "Diagnóstico: Diabetes Tipo 2"]
    if profile:
        if profile.gender: ctx.append(f"Género: {profile.gender}")
        if profile.weight_kg: ctx.append(f"Peso: {profile.weight_kg} kg")
        if profile.height_cm: ctx.append(f"Estatura: {profile.height_cm} cm")
        if profile.last_hba1c: ctx.append(f"Última HbA1c: {profile.last_hba1c}%")
        if profile.medications: ctx.append(f"Medicamentos: {profile.medications}")
        if profile.allergies: ctx.append(f"Alergias: {profile.allergies}")
        if profile.activity_level: ctx.append(f"Actividad: {profile.activity_level}")
    if doctor_rec:
        if doctor_rec.ai_rules: ctx.append(f"REGLAS MÉDICO: {doctor_rec.ai_rules}")
        if doctor_rec.recommendations: ctx.append(f"RECOMENDACIONES MÉDICO: {doctor_rec.recommendations}")

    recent_glucose = db.query(models.GlucoseLog).filter(
        models.GlucoseLog.patient_id == current_user.id
    ).order_by(models.GlucoseLog.recorded_at.desc()).limit(3).all()
    if recent_glucose:
        ctx.append("Glucemia reciente:")
        for g in recent_glucose:
            gctx = g.context.value if hasattr(g.context, 'value') else str(g.context)
            ctx.append(f"  - {g.glucose_level} mg/dL ({gctx})")

    recent_anthro = db.query(models.AnthropometricData).filter(
        models.AnthropometricData.patient_id == current_user.id
    ).order_by(models.AnthropometricData.recorded_at.desc()).limit(1).all()
    if recent_anthro:
        a = recent_anthro[0]
        ctx.append(f"IMC actual: {a.bmi} (Peso: {a.weight_kg} kg)")

    recent_act = db.query(models.PhysicalActivityLog).filter(
        models.PhysicalActivityLog.patient_id == current_user.id
    ).order_by(models.PhysicalActivityLog.recorded_at.desc()).limit(3).all()
    if recent_act:
        ctx.append("Actividad física reciente:")
        for act in recent_act:
            ctx.append(f"  - {act.activity_type} {act.duration_minutes} min")

    three_days_ago = dt_mod.datetime.now() - dt_mod.timedelta(days=3)
    past_intakes = db.query(models.IntakeLog).filter(
        models.IntakeLog.patient_id == current_user.id,
        models.IntakeLog.consumed_at >= three_days_ago
    ).order_by(models.IntakeLog.consumed_at.desc()).limit(12).all()
    if past_intakes:
        ctx.append("Comidas últimos 3 días:")
        for pi in past_intakes:
            food_obj = db.query(models.Food).filter(models.Food.id == pi.food_id).first()
            fname = food_obj.name if food_obj else "Alimento"
            mval = pi.meal_type.value if hasattr(pi.meal_type, 'value') else str(pi.meal_type)
            ctx.append(f"  - {mval}: {fname} ({pi.portion_size_g}g)")

    # 3. Prompt
    meal_labels = {"DESAYUNO": "Desayuno", "ALMUERZO": "Almuerzo", "CENA": "Cena", "MERIENDA": "Merienda"}
    missing_labels = [meal_labels.get(m, m) for m in missing_meals]

    if data.target_day == "HOY":
        day_label = "hoy"
        intro = f"Ya comió hoy: {', '.join(registered_meals_detail) if registered_meals_detail else 'nada'}.\nPlanificar SOLO: {', '.join(missing_labels)}.\n"
    else:
        day_label = "mañana"
        intro = f"Menú COMPLETO para mañana: {', '.join(missing_labels)}.\n"

    system_prompt = (
        "Eres un nutricionista virtual especializado en DIABETES TIPO 2. "
        "Genera un menú diario personalizado, saludable y realista.\n\n"
        "REGLAS:\n"
        "1. Prioriza bajo índice glucémico y fibra.\n"
        "2. Porciones en gramos.\n"
        "3. No repetir platos de los últimos 3 días.\n"
        "4. Respetar alergias y reglas del médico.\n"
        "5. Alimentos accesibles y fáciles.\n"
        "6. Un tip nutricional breve por comida y un consejo general.\n"
        "7. Español.\n\n"
        "FORMATO DE RESPUESTA: JSON puro sin markdown, sin backticks.\n"
        "Ejemplo:\n"
        '{"meals": [\n'
        '  {"meal_type": "DESAYUNO", "meal_label": "Desayuno", "dish_name": "Avena con Frutas", '
        '"ingredients": "Avena integral, arándanos, nueces, canela", "portion_g": 280, '
        '"tip": "La avena integral aporta fibra soluble."}\n'
        '], "general_tip": "Bebe al menos 8 vasos de agua."}\n\n'
        f"DATOS CLÍNICOS:\n" + "\n".join(ctx) + "\n\n"
        f"{intro}"
        f"Genera SOLO: {', '.join(missing_labels)}. Responde ÚNICAMENTE JSON válido."
    )

    response_text = await generate_text(
        f"Genera menú de {day_label} para Diabetes Tipo 2 en JSON.",
        system_prompt=system_prompt
    )

    # Parse JSON
    import re
    clean = response_text.strip()
    clean = re.sub(r'^```(?:json)?\s*', '', clean)
    clean = re.sub(r'\s*```$', '', clean)
    clean = clean.strip()

    try:
        parsed = json_mod.loads(clean)
        meals_raw = parsed.get("meals", [])
        general_tip = parsed.get("general_tip", "Mantén una alimentación balanceada.")
    except Exception:
        meals_raw = [{"meal_type": "INFO", "meal_label": "Sugerencia", "dish_name": "Menú sugerido",
                      "ingredients": clean[:500], "portion_g": 0, "tip": ""}]
        general_tip = clean[500:] if len(clean) > 500 else "Consulta a tu médico."

    meals = [MenuMealItem(
        meal_type=m.get("meal_type", "OTRO"),
        meal_label=m.get("meal_label", m.get("meal_type", "Comida")),
        dish_name=m.get("dish_name", "Plato sugerido"),
        ingredients=m.get("ingredients", ""),
        portion_g=int(m.get("portion_g", 0)),
        tip=m.get("tip", "")
    ) for m in meals_raw]

    if LLM_PROVIDER in ["nvidia", "llama"]:
        model_name = NVIDIA_MODEL
    elif LLM_PROVIDER == "gemini":
        model_name = "gemini-1.5-flash"
    else:
        model_name = OLLAMA_MODEL

    return MenuGenerateResponse(
        meals=meals,
        general_tip=general_tip,
        target_day=data.target_day,
        missing_meals=missing_meals,
        provider=LLM_PROVIDER
    )


# ── Guardar / Listar / Borrar Menús ────────────────────────────────────────────

@router.post("/save-menu", response_model=SavedMenuResponse)
async def save_menu(
    data: SaveMenuRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import json as json_mod
    menu_data = {"meals": data.meals, "general_tip": data.general_tip}
    saved = models.SavedMenu(
        patient_id=current_user.id,
        target_day=data.target_day,
        menu_json=json_mod.dumps(menu_data, ensure_ascii=False)
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return SavedMenuResponse(
        id=str(saved.id),
        target_day=saved.target_day,
        meals=data.meals,
        general_tip=data.general_tip,
        created_at=saved.created_at.isoformat()
    )


@router.get("/saved-menus", response_model=List[SavedMenuResponse])
async def list_saved_menus(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import json as json_mod
    menus = db.query(models.SavedMenu).filter(
        models.SavedMenu.patient_id == current_user.id
    ).order_by(models.SavedMenu.created_at.desc()).limit(10).all()
    result = []
    for m in menus:
        parsed = json_mod.loads(m.menu_json)
        result.append(SavedMenuResponse(
            id=str(m.id),
            target_day=m.target_day,
            meals=parsed.get("meals", []),
            general_tip=parsed.get("general_tip", ""),
            created_at=m.created_at.isoformat()
        ))
    return result


@router.delete("/saved-menus/{menu_id}")
async def delete_saved_menu(
    menu_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    menu = db.query(models.SavedMenu).filter(
        models.SavedMenu.id == menu_id,
        models.SavedMenu.patient_id == current_user.id
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    db.delete(menu)
    db.commit()
    return {"message": "Menú eliminado"}
