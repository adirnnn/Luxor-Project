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

        # Obtener toda la información del catálogo
        products_catalog = await self.product_service.get_products()
        categorias = await self.product_service.obtener_categorias()
        marcas = await self.product_service.obtener_marcas()

        nombre_productos = [
            product["name"]
            for product in products_catalog
        ]

        # Identificar perfume por nombre
        nombre_producto = await self.extraer_nombre_perfume(
            request.message,
            nombre_productos
        )

        print("Nombre extraído:", nombre_producto)
        print("Nombres disponibles:", nombre_productos)

        if nombre_producto != "NONE":
            nombre_producto = self.normalizar_texto(
                nombre_producto,
                nombre_productos
            )

        print("Nombre normalizado:", nombre_producto)

        # Identificar categoría
        categoria = await self.extraer_categoria(
            request.message,
            categorias
        )

        if categoria != "NONE":
            categoria = self.normalizar_texto(
                categoria,
                categorias
            )

        print("Categoría:", categoria)

        # Identificar marca
        marca = await self.extraer_marca(
            request.message,
            marcas
        )

        if marca != "NONE":
            marca = self.normalizar_texto(
                marca,
                marcas
            )

        print("Marca:", marca)

        # Elegir el tipo de búsqueda
        products = []

        if nombre_producto != "NONE":
            products = await self.product_service.buscar_productos(
                nombre_producto
            )

        elif categoria != "NONE":
            products = await self.product_service.buscar_por_categoria(
                categoria
            )

        elif marca != "NONE":
            products = await self.product_service.buscar_por_marca(
                marca
            )

        print("Productos encontrados:", products)

        # Manejar búsquedas sin resultados
        if nombre_producto != "NONE" and not products:
            return ChatResponse(
                response=(
                    f"No encontré ningún perfume llamado "
                    f"{nombre_producto} en nuestro catálogo."
                )
            )

        if categoria != "NONE" and not products:
            return ChatResponse(
                response=(
                    f"No encontré perfumes de la categoría "
                    f"{categoria} en nuestro catálogo."
                )
            )

        if marca != "NONE" and not products:
            return ChatResponse(
                response=(
                    f"No encontré perfumes de la marca "
                    f"{marca} en nuestro catálogo."
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

    async def extraer_categoria(
        self,
        message: str,
        categorias: list[str]
    ) -> str:

        termino_normalizado = message.casefold()

        # Intentar encontrar la categoria
        for categoria in categorias:
            if categoria.casefold() in termino_normalizado:
                return categoria

        catalogo = "\n".join(categorias)

        messages = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Tu única tarea es identificar qué categoría de perfume "
                    "está mencionando el usuario.\n\n"
                    "CATEGORÍAS DISPONIBLES:\n"
                    f"{catalogo}\n\n"
                    "REGLAS:\n"
                    "- Responde exclusivamente con una categoría disponible.\n"
                    "- Copia la categoría exactamente como aparece en la lista.\n"
                    "- No respondas la pregunta del usuario.\n"
                    "- No agregues explicaciones.\n"
                    "- Si ninguna categoría es mencionada, responde exactamente NONE."
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=message
            )
        ]

        response = await self.provider.chat(messages)

        return response.strip()

    async def extraer_marca(
        self,
        message: str,
        marcas: list[str]
    ) -> str:

        mensaje_normalizado = message.casefold()

        # Buscar una marca directamente en el mensaje
        for marca in marcas:
            if marca.casefold() in mensaje_normalizado:
                return marca

        catalogo = "\n".join(marcas)

        messages = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Tu única tarea es identificar qué marca de perfume "
                    "está mencionando el usuario.\n\n"
                    "MARCAS DISPONIBLES:\n"
                    f"{catalogo}\n\n"
                    "REGLAS:\n"
                    "- Responde exclusivamente con una marca disponible.\n"
                    "- Copia la marca exactamente como aparece en la lista.\n"
                    "- No respondas la pregunta del usuario.\n"
                    "- No agregues explicaciones.\n"
                    "- Si ninguna marca es mencionada, responde exactamente NONE."
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=message
            )
        ]

        response = await self.provider.chat(messages)

        return response.strip()