import os
import httpx
from fastapi import HTTPException

# ── Configuración de Variables del .env ────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()  # 'gemini' o 'ollama'
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

async def generate_text(prompt: str) -> str:
    """
    Genera contenido basado en un prompt, utilizando el proveedor configurado en el .env:
    - 'gemini': Conexión con la API oficial de Google Gemini.
    - 'ollama': Conexión con tu servidor local de Ollama (ej. qwen2.5:1.5b).
    """
    
    # ── Conexión con Google Gemini ────────────────────────────────────────────
    if LLM_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Error de configuración: Falta definir GEMINI_API_KEY en tu archivo .env"
            )
        
        # Usamos el modelo ultra rápido y eficiente gemini-1.5-flash
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                
                # Extraemos el texto generado por Gemini
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Error de API Gemini ({e.response.status_code}): {e.response.text}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Error de conexión con la API de Gemini: {str(e)}"
                )

    # ── Conexión con Ollama Local ─────────────────────────────────────────────
    elif LLM_PROVIDER == "ollama":
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                
                # Extraemos el texto generado por Ollama
                return data.get("response", "")
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Ollama devolvió un error ({e.response.status_code}): {e.response.text}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"No se pudo conectar a Ollama local en {OLLAMA_BASE_URL}. ¿Está Ollama abierto y ejecutándose? Detalles: {str(e)}"
                )

    # ── Proveedor No Soportado ────────────────────────────────────────────────
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Proveedor de LLM '{LLM_PROVIDER}' no soportado. Usa 'gemini' o 'ollama' en tu archivo .env"
        )
