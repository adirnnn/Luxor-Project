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

# Prueba de recomendaciones
@router.get("/test-recommendations")
async def test_recommendations(name: str):

    productos = await product_service.buscar_productos(
        name
    )

    if not productos:
        return []

    return await product_service.obtener_recomendaciones(
        productos[0]
    )