import json
from app.bot.models import ChatMessage
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.models import MessageRole
from app.llm.base import LLMProvider
from app.services.productService import ProductService
from difflib import get_close_matches


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
        message: str,
        nombre_producto: list[str]
    ) -> str:

        mensaje_normalizado = message.casefold()

        for nombre in nombre_producto:
            if nombre.casefold() in mensaje_normalizado:
                return nombre

        catalog = "\n".join(nombre_producto)

        mensajes = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Tu única tarea es identificar qué perfume del catálogo "
                    "está mencionando el usuario.\n\n"

                    "CATÁLOGO:\n"
                    f"{catalog}\n\n"

                    "REGLAS:\n"
                    "- Responde exclusivamente con uno de los nombres del catálogo.\n"
                    "- Copia el nombre exactamente como aparece en el catálogo.\n"
                    "- No corrijas, traduzcas ni modifiques el nombre.\n"
                    "- No respondas la pregunta del usuario.\n"
                    "- No agregues explicaciones.\n"
                    "- Si ningún perfume del catálogo es mencionado, responde exactamente NONE."
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

        # Obtener catálogo
        products_catalog = await self.product_service.get_products()

        nombre_productos = [
            product["name"]
            for product in products_catalog
        ]

        # Identificar producto mencionado
        nombre_producto = await self.extraer_nombre_perfume(
            request.message,
            nombre_productos
        )

        print("Nombre extraído:", nombre_producto)

        # Normalizar el texto
        if nombre_producto != "NONE":
            nombre_producto = self.normalizar_texto(
                nombre_producto,
                nombre_productos
            )

        print("Nombre normalizado:", nombre_producto)

        # Buscar en la base de datos
        products = []

        if nombre_producto != "NONE":
            products = await self.product_service.buscar_productos(
                nombre_producto
            )

        print("Productos encontrados:", products)

        # Buscar producto en la base de datos
        products = []

        if nombre_producto != "NONE":
            products = await self.product_service.buscar_productos(
                nombre_producto
            )

        print("Productos encontrados:", products)

        # Producto mencionado pero no encontrado
        if nombre_producto != "NONE" and not products:
            return ChatResponse(
                response=(
                    f"No encontré ningún perfume llamado "
                    f"{nombre_producto} en nuestro catálogo."
                )
            )

        # Convertir resultados a texto para el modelo
        contexto = json.dumps(
            products,
            ensure_ascii=False
        )

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
    
    def normalizar_texto(
        self,
        termino: str,
        opciones: list[str]
    ) -> str:

        termino_normalizado = termino.strip().casefold()

        # Coincidencia exacta
        for opcion in opciones:
            if opcion.strip().casefold() == termino_normalizado:
                return opcion

        # Coincidencia aproximada
        opciones_normalizadas = {
            opcion.casefold(): opcion
            for opcion in opciones
        }

        coincidencias = get_close_matches(
            termino_normalizado,
            opciones_normalizadas.keys(),
            n=1,
            cutoff=0.75
        )

        if coincidencias:
            return opciones_normalizadas[coincidencias[0]]

        return "NONE"