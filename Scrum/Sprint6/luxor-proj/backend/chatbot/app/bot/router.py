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

# Prueba de capacidad de búsqueda por notas
@router.get("/test-notes")
async def test_notes():
    return await product_service.obtener_notas()

@router.get("/test-note")
async def test_note(note: str):
    return await product_service.buscar_por_nota(
        note
    )