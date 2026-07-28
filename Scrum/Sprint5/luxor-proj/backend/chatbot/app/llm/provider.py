from app.bot.models import ChatMessage
from app.llm.base import LLMProvider
from ollama import AsyncClient

# Prueba de funcionamiento de proveedor de LLM
class Provider(LLMProvider):
    def __init__(self):
        self.client = AsyncClient()

    async def chat(self, messages: list[ChatMessage]) -> str:
        response = await self.client.chat(
            model="qwen3:4b",
            messages=[{"role": "user", "content": message.content} for message in messages]
        )
        return response['message']['content']