from abc import ABC, abstractmethod

from app.bot.models import ChatMessage

# Interfaz para proveedores de LLM
class LLMProvider(ABC):

    # Recibir la conversación y devolver la respuesta generada por el LLM
    @abstractmethod
    async def chat(self, messages: list[ChatMessage]) -> str:
        pass