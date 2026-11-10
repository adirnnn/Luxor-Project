import asyncio
import os

import httpx

from app.bot.models import ChatMessage
from app.llm.base import LLMProvider


# proveedor para cualquier api que hable el formato de openai
# (/chat/completions con bearer token). se usa para groq en el deploy de
# render, porque render no puede correr ollama (no tiene gpu). la misma clase
# sirve para openai, together, etc. con solo cambiar las variables de entorno.
class OpenAICompatProvider(LLMProvider):

    def __init__(self):
        # url base de la api, sin la barra final.
        # groq -> https://api.groq.com/openai/v1
        self.base_url = os.getenv(
            "LLM_API_BASE_URL",
            "https://api.groq.com/openai/v1",
        ).rstrip("/")

        # el token secreto del proveedor. en render se carga como env var
        # "secreta" (no queda en el repo).
        self.api_key = os.getenv("LLM_API_KEY", "")

        # nombre del modelo. en groq por ejemplo "llama-3.1-8b-instant".
        # conviene verificar el id exacto en la consola del proveedor porque
        # a veces lo cambian.
        self.model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")

        # el plan gratis de groq limita los tokens por minuto de cada modelo. con un 429 se prueba
        # el modelo de respaldo (si hay, tiene su propio limite) o se espera lo que pide groq y se
        # reintenta, en vez de contestarle al cliente "no puedo responder".
        self.fallback_model = os.getenv("LLM_FALLBACK_MODEL", "").strip()
        self.max_wait = float(os.getenv("LLM_RETRY_MAX_WAIT", "8"))
        # para las pruebas (httpx.MockTransport)
        self.transport = None

    def _espera(self, response: httpx.Response) -> float:
        # groq manda "retry-after" en segundos; sin eso se espera 2 s
        try:
            segundos = float(response.headers.get("retry-after", "2"))
        except ValueError:
            segundos = 2.0
        return max(0.0, min(segundos, self.max_wait))

    async def chat(self, messages: list[ChatMessage]) -> str:
        # se respeta el role de cada mensaje (system / user / assistant) para
        # que los prompts de sistema del chatbot funcionen igual que con ollama.
        payload = {
            "model": self.model,
            "messages": [
                {"role": message.role.value, "content": message.content}
                for message in messages
            ],
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        # intentos: el modelo principal, y con un 429 el de respaldo o el mismo despues de esperar
        modelos = [self.model, self.fallback_model or self.model]

        async with httpx.AsyncClient(timeout=30.0, transport=self.transport) as client:
            for intento, modelo in enumerate(modelos):
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={**payload, "model": modelo},
                    headers=headers,
                )
                if response.status_code == 429 and intento < len(modelos) - 1:
                    if not self.fallback_model:
                        await asyncio.sleep(self._espera(response))
                    continue
                response.raise_for_status()
                break
            data = response.json()

        # formato estandar de openai: choices[0].message.content
        return data["choices"][0]["message"]["content"]
