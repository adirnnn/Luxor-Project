from fastapi import APIRouter
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.service import ChatService
from app.llm.factory import get_provider
from app.services.productService import ProductService
from app.services.chatLogService import ChatLogService

router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)

product_service = ProductService()
chat_log_service = ChatLogService()

service = ChatService(
    provider = get_provider(),
    product_service = ProductService(),
    chat_log_service= chat_log_service
)


@router.post(
    "",
    response_model=ChatResponse
)
async def chat(request: ChatRequest):

    return await service.generar_respuesta(request)

# Prueba de historial de chat
@router.post("/test-log")
async def test_log():
    await chat_log_service.registrar_consulta(
        "¿Tienen Khamrah?",
        "Sí, tenemos Khamrah."
    )

    return {"success": True}