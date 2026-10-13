import asyncio
import logging
import os

from fastapi import APIRouter
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.service import ChatService
from app.llm.factory import get_provider
from app.services.product_service import ProductService
from app.services.chat_log_service import ChatLogService

logger = logging.getLogger(__name__)

# segundos maximos para responder un mensaje (todas las llamadas al LLM juntas)
CHAT_TIMEOUT = float(os.getenv("CHAT_TIMEOUT_SECONDS", "45"))
MENSAJE_SIN_SERVICIO = (
    "Lo siento, en este momento no puedo responder. "
    "Intenta de nuevo en unos minutos o escríbenos por WhatsApp."
)

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
    # SFTWRKEY-411 (SEC-44): si el proveedor del LLM se cae o tarda demasiado,
    # se responde un mensaje amable en vez de un 500 o una espera sin fin.
    try:
        return await asyncio.wait_for(service.generar_respuesta(request), timeout=CHAT_TIMEOUT)
    except Exception as err:
        logger.error("El chatbot no pudo responder: %s", type(err).__name__)
        return ChatResponse(response=MENSAJE_SIN_SERVICIO)
