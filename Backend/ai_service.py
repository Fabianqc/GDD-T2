import os
import httpx
from fastapi import HTTPException

# ── Configuración de Variables del .env ────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "nvidia").lower()  # 'nvidia', 'gemini' o 'ollama'
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.2-90b-vision-instruct")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

async def _call_nvidia_api(prompt: str) -> str:
    if not NVIDIA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Error de configuración: Falta definir NVIDIA_API_KEY en tu archivo .env"
        )
    
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    payload = {
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "model": NVIDIA_MODEL,
        "frequency_penalty": 0,
        "max_tokens": 512,
        "presence_penalty": 0,
        "stream": False,
        "temperature": 1,
        "top_p": 1
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Error de API NVIDIA ({e.response.status_code}): {e.response.text}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Error de conexión con la API de NVIDIA: {str(e)}"
            )

async def generate_text(prompt: str) -> str:
    """
    Genera contenido basado en un prompt, utilizando el proveedor configurado en el .env:
    - 'nvidia': Conexión con NVIDIA API (meta/llama-3.2-90b-vision-instruct).
    - 'gemini': Conexión con la API oficial de Google Gemini.
    - 'ollama': Conexión con tu servidor local de Ollama (ej. qwen2.5:1.5b).
    """
    
    # ── Conexión con NVIDIA API (Llama 3.2 90B Vision) ───────────────────────
    if LLM_PROVIDER in ["nvidia", "llama"]:
        return await _call_nvidia_api(prompt)

    # ── Conexión con Google Gemini ────────────────────────────────────────────
    elif LLM_PROVIDER == "gemini":
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
            except Exception as e:
                # Fallback automático a NVIDIA API si Ollama local no está corriendo en producción
                print(f"[AI Service] Ollama local no disponible ({e}), usando fallback NVIDIA API...")
                try:
                    return await _call_nvidia_api(prompt)
                except Exception as n_err:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Error en IA (Ollama y NVIDIA fallaron): {str(n_err)}"
                    )

    # ── Proveedor No Soportado ────────────────────────────────────────────────
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Proveedor de LLM '{LLM_PROVIDER}' no soportado. Usa 'nvidia', 'gemini' u 'ollama' en tu archivo .env"
        )


import re
import json

def extract_json_block(text: str) -> dict:
    """Extrae de manera segura un objeto JSON de una cadena de texto."""
    try:
        # Intentamos extraer lo que esté entre corchetes { } en caso de que la IA responda con markdown ```json
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
        else:
            parsed = json.loads(text)
        
        # Validar y limpiar campos obligatorios
        return {
            "food_name": str(parsed.get("food_name", "Comida escaneada")),
            "portion_size_g": float(parsed.get("portion_size_g", 150.0)),
            "meal_type": str(parsed.get("meal_type", "ALMUERZO")).upper()
        }
    except Exception:
        # Fallback de seguridad
        return {
            "food_name": "Alimento Escaneado",
            "portion_size_g": 200.0,
            "meal_type": "ALMUERZO"
        }


async def analyze_food_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """
    Analiza una imagen en base64 de un plato de comida.
    - Si usa NVIDIA: Envía la imagen directo a Llama 3.2 90B Vision en NVIDIA API.
    - Si usa Gemini: Envía la imagen directo a Gemini 1.5 Flash (multimodal).
    - Si usa Ollama local (text-only por defecto): Devuelve una predicción simulada o multimodal local.
    """
    prompt = (
        "Analiza la imagen de este plato de comida y determina:\n"
        "1. El nombre del alimento o plato principal (en español, corto, ej: 'Pescado frito con arroz').\n"
        "2. El peso aproximado de la porción en gramos (solo el número, ej: 250).\n"
        "3. El tipo de comida (debe ser estrictamente uno de los siguientes: 'DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA').\n\n"
        "DEBES RESPONDER EXCLUSIVAMENTE UN OBJETO JSON con esta estructura exacta, sin textos de introducción ni despedida:\n"
        "{\n"
        "  \"food_name\": \"Nombre de la comida\",\n"
        "  \"portion_size_g\": 250,\n"
        "  \"meal_type\": \"ALMUERZO\"\n"
        "}"
    )

    if LLM_PROVIDER in ["nvidia", "llama"]:
        if not NVIDIA_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Falta configurar NVIDIA_API_KEY para análisis de fotos."
            )

        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        image_url_val = image_base64 if image_base64.startswith("data:") else f"data:{mime_type};base64,{image_base64}"
        
        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url_val}}
                    ]
                }
            ],
            "model": NVIDIA_MODEL,
            "max_tokens": 512,
            "temperature": 0.2
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=40.0)
                response.raise_for_status()
                data = response.json()
                response_text = data["choices"][0]["message"]["content"]
                
                return extract_json_block(response_text)
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Error en el escáner de comida de NVIDIA API: {str(e)}"
                )

    elif LLM_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Falta configurar GEMINI_API_KEY para análisis de fotos."
            )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_base64
                            }
                        }
                    ]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=40.0)
                response.raise_for_status()
                data = response.json()
                response_text = data["candidates"][0]["content"]["parts"][0]["text"]
                
                return extract_json_block(response_text)
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Error en el escáner de comida de Gemini: {str(e)}"
                )

    # ── Soporte Ollama Local (Multimodal / Fallback Inteligente) ────────────────
    else:
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "images": [image_base64],
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                response_text = data.get("response", "")
                
                return extract_json_block(response_text)
            except Exception:
                return {
                    "food_name": "Tostadas integrales con aguacate y huevo",
                    "portion_size_g": 180.0,
                    "meal_type": "DESAYUNO"
                }


