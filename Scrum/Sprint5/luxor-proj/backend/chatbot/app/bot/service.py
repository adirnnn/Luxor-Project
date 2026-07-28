from app.bot.models import ChatMessage
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.models import MessageRole
from app.llm.base import LLMProvider


class ChatService:

    def __init__(self, provider: LLMProvider):
        # Inicializar con un proveedor genérico
        self.provider = provider

    async def generate_response(
        self,
        request: ChatRequest
    ) -> ChatResponse:

        messages = [
            ChatMessage(
                role=MessageRole.USER,
                content=request.message
            )
        ]

        response = await self.provider.chat(messages)

        return ChatResponse(
            response=response
        )