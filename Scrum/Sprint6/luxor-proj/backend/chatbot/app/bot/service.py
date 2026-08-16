import json
from app.bot.models import ChatMessage
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.models import MessageRole
from app.llm.base import LLMProvider
from app.services.productService import ProductService


class ChatService:

    def __init__(
        self,
        provider: LLMProvider,
        product_service: ProductService
    ):
        self.provider = provider
        self.product_service = product_service


    async def extraer_nombre_perfume(
        self,
        message: str
    ) -> str:

        mensajes = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Tu única tarea es identificar el nombre del perfume "
                    "mencionado por el usuario.\n"
                    "Devuelve EXCLUSIVAMENTE el nombre del perfume.\n"
                    "No respondas la pregunta.\n"
                    "No expliques nada.\n"
                    "No corrijas ni traduzcas el nombre.\n"
                    "Conserva exactamente la escritura usada por el usuario.\n"
                    "Si no se menciona un nombre de perfume, responde exactamente: NONE\n\n"
                    "Ejemplos:\n"
                    "Usuario: ¿Tienen Khamrah?\n"
                    "Respuesta: Khamrah\n"
                    "Usuario: Quiero información sobre Asad\n"
                    "Respuesta: Asad\n"
                    "Usuario: ¿Qué perfumes tienen?\n"
                    "Respuesta: NONE"
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=message
            )
        ]

        response = await self.provider.chat(mensajes)

        return response.strip()


    async def generar_respuesta(
        self,
        request: ChatRequest
    ) -> ChatResponse:

        # Extraer el nombre del perfume
        nombre_producto = await self.extraer_nombre_perfume(
            request.message
        )

        print("Nombre extraído:", nombre_producto)

        # Buscar en la base de datos
        products = []

        if nombre_producto != "NONE":
            products = await self.product_service.buscar_productos(
                nombre_producto
            )

        print("Productos encontrados:", products)

        # Respuesta si el perfume no fue encontrado
        if nombre_producto != "NONE" and not products:
            return ChatResponse(
                response=(
                    f"No encontré ningún perfume llamado "
                    f"{nombre_producto} en nuestro catálogo."
                )
            )

        # Convertir los resultados en el contexto de la respuesta
        contexto = json.dumps(
            products,
            ensure_ascii=False
        )

        # Generar respuesta
        mensajes = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Eres el asistente virtual de Luxor. "
                    "Responde utilizando únicamente la información "
                    "del catálogo proporcionado. "
                    "No inventes productos ni disponibilidad.\n\n"
                    f"CATÁLOGO ENCONTRADO:\n{contexto}"
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=request.message
            )
        ]

        response = await self.provider.chat(mensajes)

        return ChatResponse(
            response=response
        )