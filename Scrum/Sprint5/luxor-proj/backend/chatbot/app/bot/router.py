from fastapi import APIRouter
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.service import ChatService
from app.llm.provider import Provider


router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)

service = ChatService(
    provider=Provider()
)


@router.post(
    "",
    response_model=ChatResponse
)
async def chat(request: ChatRequest):

    return await service.generate_response(request)