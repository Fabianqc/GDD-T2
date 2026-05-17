from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..ai_service import generate_text, LLM_PROVIDER, OLLAMA_MODEL
from ..auth import get_current_user
from .. import models

router = APIRouter(prefix="/ai", tags=["Inteligencia Artificial"])

class AIRequest(BaseModel):
    prompt: str

class AIResponse(BaseModel):
    response: str
    provider: str
    model: str

@router.post("/generate", response_model=AIResponse)
async def generate_ai_response(
    data: AIRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Genera una respuesta usando el proveedor de Inteligencia Artificial activo (Gemini u Ollama local).
    Requiere autenticación de usuario (JWT).
    """
    response_text = await generate_text(data.prompt)
    
    # Determinamos el nombre del modelo a retornar en los metadatos
    model_name = "gemini-1.5-flash" if LLM_PROVIDER == "gemini" else OLLAMA_MODEL
    
    return AIResponse(
        response=response_text,
        provider=LLM_PROVIDER,
        model=model_name
    )
