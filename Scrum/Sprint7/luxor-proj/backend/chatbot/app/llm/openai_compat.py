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

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        # formato estandar de openai: choices[0].message.content
        return data["choices"][0]["message"]["content"]
