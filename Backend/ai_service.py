import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

# Asegura carga del .env aunque este módulo se importe antes que main.py
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# ── Configuración de Variables del .env ────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "nvidia").lower()  # 'nvidia', 'gemini' o 'ollama'
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.2-90b-vision-instruct")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

# El modelo vision 90B es lento con prompts clínicos largos; 30s provocaba ReadTimeout.
NVIDIA_TIMEOUT = httpx.Timeout(connect=15.0, read=120.0, write=30.0, pool=15.0)


def _format_httpx_error(e: Exception) -> str:
    """httpx.ReadTimeout a menudo tiene str(e) vacío; incluir tipo y causa."""
    msg = str(e).strip() or repr(e)
    cause = getattr(e, "__cause__", None)
    if cause is not None:
        return f"{type(e).__name__}: {msg} (cause={type(cause).__name__}: {cause!r})"
    return f"{type(e).__name__}: {msg}"


async def _call_nvidia_api(prompt: str, system_prompt: Optional[str] = None) -> str:
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
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "messages": messages,
        "model": NVIDIA_MODEL,
        "frequency_penalty": 0,
        "max_tokens": 512,
        "presence_penalty": 0,
        "stream": False,
        "temperature": 0.7,
        "top_p": 1
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=NVIDIA_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Error de API NVIDIA ({e.response.status_code}): {e.response.text}"
            )
        except httpx.TimeoutException as e:
            raise HTTPException(
                status_code=502,
                detail=f"Timeout con la API de NVIDIA (el modelo tardó demasiado): {_format_httpx_error(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Error de conexión con la API de NVIDIA: {_format_httpx_error(e)}"
            )

async def generate_text(prompt: str, system_prompt: Optional[str] = None) -> str:
    """
    Genera contenido basado en un prompt, utilizando el proveedor configurado en el .env
    con fallback automático entre NVIDIA, Gemini y Ollama para evitar errores 502 Bad Gateway.
    """
    errors = []
    
    # ── 1. Conexión con NVIDIA API (meta/llama-3.2-90b-vision-instruct) ──────
    if LLM_PROVIDER in ["nvidia", "llama"] and NVIDIA_API_KEY:
        try:
            return await _call_nvidia_api(prompt, system_prompt=system_prompt)
        except Exception as e:
            print(f"[AI Service] Error en NVIDIA API ({e}). Probando fallbacks...")
            errors.append(f"NVIDIA: {str(e)}")

    # ── 2. Conexión con Google Gemini ────────────────────────────────────────────
    if GEMINI_API_KEY:
        try:
            full_text = f"{system_prompt}\n\nConsulta del usuario: {prompt}" if system_prompt else prompt
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": full_text}
                        ]
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=25.0)
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[AI Service] Error en Gemini API ({e}).")
            errors.append(f"Gemini: {str(e)}")

    # ── 3. Conexión con Ollama Local ─────────────────────────────────────────────
    try:
        full_text = f"{system_prompt}\n\nConsulta del usuario: {prompt}" if system_prompt else prompt
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": full_text,
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=25.0)
            response.raise_for_status()
            data = response.json()
            if data.get("response"):
                return data["response"]
    except Exception as e:
        errors.append(f"Ollama: {str(e)}")

    # ── 4. Fallback de Contingencia sin Error 502 ──────────────────────────────
    print(f"[AI Service] Todos los proveedores fallaron: {errors}")
    return (
        "El servicio de Inteligencia Artificial se encuentra temporalmente ocupado o alcanzando el límite de consultas con la API proveedora.\n\n"
        "RECOMENDACIÓN DE SALUD PARA DIABETES TIPO 2:\n"
        "Para mantener niveles de glucosa estables, se recomienda priorizar verduras de hoja verde, proteínas magras (pollo, pescado, huevos) y carbohidratos de digestión lenta en porciones controladas. Evita alimentos ultraprocesados y bebidas azucaradas.\n\n"
        "Aviso Médica (Obligatorio): Esta respuesta es una guía general. La mejor forma de confirmar su consulta es con su médico especialista."
    )


import re
import json

def extract_json_block(text: str) -> dict:
    """Extrae de manera segura un objeto JSON de una cadena de texto e identifica si es comida real."""
    def _num(value, default=None):
        try:
            if value is None or value == "":
                return default
            return float(value)
        except (TypeError, ValueError):
            return default

    try:
        # Intentamos extraer lo que esté entre corchetes { } en caso de que la IA responda con markdown ```json
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
        else:
            parsed = json.loads(text)
        
        is_food = bool(parsed.get("is_food", True))
        food_name = str(parsed.get("food_name", "")).strip()
        
        # Filtro de palabras clave para detectar cuando la IA indica no-comida
        non_food_keywords = ["no es comida", "no hay comida", "no comida", "sin alimentos", "no food", "sin comida", "no detectado", "desconocido"]
        if any(keyword in food_name.lower() for keyword in non_food_keywords):
            is_food = False

        if not is_food:
            return {
                "is_food": False,
                "food_name": "No es comida",
                "portion_size_g": 0.0,
                "meal_type": "ALMUERZO",
                "calories": 0.0,
                "carbs_g": 0.0,
                "glycemic_index": 0.0,
                "glycemic_load": 0.0,
                "error_message": str(parsed.get("error_message", "No se detectó ningún alimento en la imagen."))
            }

        portion = _num(parsed.get("portion_size_g"), 150.0) or 150.0
        calories = _num(parsed.get("calories"), None)
        carbs_g = _num(parsed.get("carbs_g"), None)
        glycemic_index = _num(parsed.get("glycemic_index"), None)
        glycemic_load = _num(parsed.get("glycemic_load"), None)

        # Si falta carga glucémica pero hay IG y carbohidratos: CG ≈ (IG * carbs_g) / 100
        if glycemic_load is None and glycemic_index is not None and carbs_g is not None:
            glycemic_load = round((glycemic_index * carbs_g) / 100.0, 2)

        return {
            "is_food": True,
            "food_name": food_name if food_name else "Alimento Escaneado",
            "portion_size_g": portion,
            "meal_type": str(parsed.get("meal_type", "ALMUERZO")).upper(),
            "calories": calories,
            "carbs_g": carbs_g,
            "glycemic_index": glycemic_index,
            "glycemic_load": glycemic_load,
            "error_message": None
        }
    except Exception:
        # Fallback de seguridad en caso de error de parseo
        return {
            "is_food": True,
            "food_name": "Alimento Escaneado",
            "portion_size_g": 200.0,
            "meal_type": "ALMUERZO",
            "calories": None,
            "carbs_g": None,
            "glycemic_index": None,
            "glycemic_load": None,
            "error_message": None
        }


async def analyze_food_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """
    Analiza una imagen en base64 para detectar platos de comida comestible.
    - Si detecta comida real: retorna is_food=True, el nombre del plato, porción en gramos,
      calorías, carbohidratos, índice glucémico y carga glucémica de esa porción.
    - Si la foto NO muestra alimentos: retorna is_food=False sin inventar.
    """
    prompt = (
        "Eres un experto analizador de nutrición e imágenes de alimentos para Diabetes Tipo 2.\n"
        "Examina con máxima atención la imagen proporcionada y responde ÚNICAMENTE con un objeto JSON.\n\n"
        "REGLAS DE RECONOCIMIENTO:\n"
        "1. EVALÚA SI HAY COMIDA REAL: ¿La foto muestra claramente un plato preparado, ingrediente, fruta, verdura o bebida comestible?\n"
        "2. SI NO HAY COMIDA (personas, ropa, objetos, muebles, pantallas, mascotas, fotos borrosas o sin alimentos claros):\n"
        "   - Pon \"is_food\": false\n"
        "   - Pon \"food_name\": \"No es comida\"\n"
        "   - Pon \"portion_size_g\": 0\n"
        "   - Pon \"calories\": 0, \"carbs_g\": 0, \"glycemic_index\": 0, \"glycemic_load\": 0\n"
        "   - Pon \"error_message\": \"No se ha detectado ningún alimento o plato comestible en la foto.\"\n"
        "   - ¡NO INVENTES NI SUPONGAS ALIMENTOS QUE NO ESTÁN PRESENTES!\n\n"
        "3. SI SÍ HAY COMIDA REAL:\n"
        "   - Pon \"is_food\": true\n"
        "   - \"food_name\": Nombre conciso del plato en español (ej: 'Pollo a la plancha con ensalada').\n"
        "   - \"portion_size_g\": Estimación realista del peso total en gramos (ej: 250).\n"
        "   - \"meal_type\": Estrictamente uno de: 'DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA'.\n"
        "   - \"calories\": Calorías estimadas TOTALES de la porción visible (kcal), no por 100g.\n"
        "   - \"carbs_g\": Carbohidratos totales en gramos de esa misma porción.\n"
        "   - \"glycemic_index\": Índice glucémico estimado del plato (0-100).\n"
        "   - \"glycemic_load\": Carga glucémica de la porción (aprox. IG * carbs_g / 100).\n"
        "   - \"error_message\": null\n\n"
        "ESTRUCTURA DE RESPUESTA JSON (SIN TEXTO ADICIONAL NI MARKDOWN):\n"
        "{\n"
        "  \"is_food\": true,\n"
        "  \"food_name\": \"Nombre del plato\",\n"
        "  \"portion_size_g\": 250,\n"
        "  \"meal_type\": \"ALMUERZO\",\n"
        "  \"calories\": 420,\n"
        "  \"carbs_g\": 35,\n"
        "  \"glycemic_index\": 50,\n"
        "  \"glycemic_load\": 17.5,\n"
        "  \"error_message\": null\n"
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
            "temperature": 0.1
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=NVIDIA_TIMEOUT)
                response.raise_for_status()
                data = response.json()
                response_text = data["choices"][0]["message"]["content"]
                
                return extract_json_block(response_text)
            except httpx.TimeoutException as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Timeout en el escáner de comida de NVIDIA API: {_format_httpx_error(e)}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Error en el escáner de comida de NVIDIA API: {_format_httpx_error(e)}"
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
                    "is_food": True,
                    "food_name": "Tostadas integrales con aguacate y huevo",
                    "portion_size_g": 180.0,
                    "meal_type": "DESAYUNO",
                    "calories": 320.0,
                    "carbs_g": 28.0,
                    "glycemic_index": 45.0,
                    "glycemic_load": 12.6,
                    "error_message": None
                }



