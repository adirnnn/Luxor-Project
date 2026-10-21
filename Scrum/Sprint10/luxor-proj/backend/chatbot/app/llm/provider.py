from app.bot.models import ChatMessage
from app.llm.base import LLMProvider
from ollama import AsyncClient
import os

# Prueba de funcionamiento de proveedor de LLM
class Provider(LLMProvider):
    def __init__(self):
        self.client = AsyncClient(
            host=os.getenv(
                "OLLAMA_URL",
                "http://127.0.0.1:11434"
            ),
            # SFTWRKEY-411 (SEC-44): sin timeout, si ollama se cuelga la peticion espera para siempre
            timeout=30.0,
        )
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:4b")

    async def chat(self, messages: list[ChatMessage]) -> str:
        response = await self.client.chat(
            model=self.model,
            messages=[{"role": "user", "content": message.content} for message in messages]
        )
        return response['message']['content']