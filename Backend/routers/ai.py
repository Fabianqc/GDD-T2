from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
try:
    from ..ai_service import generate_text, analyze_food_image, LLM_PROVIDER, OLLAMA_MODEL
    from ..auth import get_current_user
    from .. import models
except (ImportError, ValueError):
    from ai_service import generate_text, analyze_food_image, LLM_PROVIDER, OLLAMA_MODEL
    from auth import get_current_user
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
    current_user: models.User = Depends(get_current_user)
):
    """
    Genera una respuesta usando el proveedor de Inteligencia Artificial activo (Gemini u Ollama local).
    Requiere autenticación de usuario (JWT).
    """
    clean_prompt = data.prompt.strip()
    response_text = await generate_text(clean_prompt)
    
    # Determinamos el nombre del modelo a retornar en los metadatos
    model_name = "gemini-1.5-flash" if LLM_PROVIDER == "gemini" else OLLAMA_MODEL
    
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
    """
    clean_image = data.image_base64.strip()
    clean_mime = data.mime_type.strip() if data.mime_type else "image/jpeg"
    result = await analyze_food_image(clean_image, clean_mime)
    
    return ImageScanResponse(
        food_name=result["food_name"],
        portion_size_g=result["portion_size_g"],
        meal_type=result["meal_type"],
        provider=LLM_PROVIDER
    )

