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
    provider = get_provider()
)

product_service = ProductService()


@router.post(
    "",
    response_model=ChatResponse
)
async def chat(request: ChatRequest):

    return await service.generate_response(request)

# Prueba de conexión de chatbot con backend para obtener productos
@router.get("/test-products")
async def test_products():
    return await product_service.get_products()