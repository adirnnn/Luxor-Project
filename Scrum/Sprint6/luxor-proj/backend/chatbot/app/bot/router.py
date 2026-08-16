from fastapi import APIRouter
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.service import ChatService
from app.llm.factory import get_provider
from app.services.productService import ProductService

router = APIRouter(
    prefix="/chat",
    tags=["Chatbot"]
)

service = ChatService(
    provider = get_provider(),
    product_service = ProductService()
)

product_service = ProductService()


@router.post(
    "",
    response_model=ChatResponse
)
async def chat(request: ChatRequest):

    return await service.generar_respuesta(request)

# Prueba de capacidad de consultas por nombre
@router.get("/test-search")
async def test_search(q: str):
    return await product_service.buscar_productos(q)