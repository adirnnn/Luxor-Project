import asyncio
import logging
import os

from fastapi import APIRouter, Request
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.service import ChatService
from app.llm.factory import get_provider
from app.services.product_service import ProductService
from app.services.chat_log_service import ChatLogService
from app.services.order_service import OrderService

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
    chat_log_service= chat_log_service,
    order_service = OrderService()
)


def ip_del_cliente(http: Request) -> str | None:
    # SFTWRKEY-458: en Render las peticiones pasan por Cloudflare. X-Forwarded-For llega como
    # "<ip del cliente>, <ip de Cloudflare>": la última cambia en cada petición y la primera la
    # puede inventar el cliente. Cloudflare siempre pone la ip real en CF-Connecting-IP (y
    # reemplaza la que mande el cliente); True-Client-IP queda de respaldo. En local no vienen y
    # se usa la conexión.
    for cabecera in ("cf-connecting-ip", "true-client-ip"):
        ip = http.headers.get(cabecera, "").strip()
        if ip:
            return ip
    return http.client.host if http.client else None


@router.post(
    "",
    response_model=ChatResponse
)
async def chat(request: ChatRequest, http: Request):
    # SFTWRKEY-411 (SEC-44): si el proveedor del LLM se cae o tarda demasiado,
    # se responde un mensaje amable en vez de un 500 o una espera sin fin.
    try:
        return await asyncio.wait_for(
            service.generar_respuesta(request, ip_del_cliente(http)),
            timeout=CHAT_TIMEOUT
        )
    except Exception as err:
        logger.error("El chatbot no pudo responder: %s", type(err).__name__)
        return ChatResponse(response=MENSAJE_SIN_SERVICIO)
