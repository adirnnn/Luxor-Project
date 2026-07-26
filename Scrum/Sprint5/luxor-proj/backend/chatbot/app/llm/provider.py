from app.bot.models import ChatMessage
from app.llm.base import LLMProvider

# Prueba de funcionamiento de proveedor de LLM
class Provider(LLMProvider):


    async def chat(self, messages: list[ChatMessage]) -> str:
        return (
            "Hola. Soy LuxorBot (modo de prueba). "
            "Funciona bien"
        )