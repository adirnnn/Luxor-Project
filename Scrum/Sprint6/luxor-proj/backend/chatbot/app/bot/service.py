import json
from app.bot.models import ChatMessage
from app.bot.models import ChatRequest
from app.bot.models import ChatResponse
from app.bot.models import MessageRole
from app.llm.base import LLMProvider
from app.services.productService import ProductService
from difflib import get_close_matches
from app.services.chatLogService import ChatLogService


class ChatService:

    def __init__(
        self,
        provider: LLMProvider,
        product_service: ProductService,
        chat_log_service: ChatLogService
    ):
        self.provider = provider
        self.product_service = product_service
        self.chat_log_service = chat_log_service


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
        notas = await self.product_service.obtener_notas()

        nombre_productos = [
            product["name"]
            for product in products_catalog
        ]

        # Identificar perfume por nombre
        nombre_producto = await self.extraer_nombre_perfume(
            request.message,
            nombre_productos
        )

        if nombre_producto != "NONE":
            nombre_producto = self.normalizar_texto(
                nombre_producto,
                nombre_productos
            )

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

        # Identificar nota
        nota = await self.extraer_nota(
            request.message,
            notas
        )

        if nota != "NONE":
            nota = self.normalizar_texto(
                nota,
                notas
            )

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

        elif nota != "NONE":
            products = await self.product_service.buscar_por_nota(
                nota
            )

        # Manejo de consultas que no tienen que ver con los productos
        if (
            nombre_producto == "NONE"
            and categoria == "NONE"
            and marca == "NONE"
            and nota == "NONE"
        ):
            respuesta = (
                "No encontré información relacionada con tu consulta "
                "en nuestro catálogo. Puedes preguntarme por un perfume, "
                "una marca, una categoría o una nota aromática."
            )

            return await self._crear_respuesta(
                request.message,
                respuesta
            )

        # Perfume no encontrado
        if nombre_producto != "NONE" and not products:
            respuesta = (
                f"No encontré ningún perfume llamado "
                f"{nombre_producto} en nuestro catálogo."
            )

            return await self._crear_respuesta(
                request.message,
                respuesta
            )

        # Categoría sin resultados
        if categoria != "NONE" and not products:
            respuesta = (
                f"No encontré perfumes de la categoría "
                f"{categoria} en nuestro catálogo."
            )

            return await self._crear_respuesta(
                request.message,
                respuesta
            )

        # Marca sin resultados
        if marca != "NONE" and not products:
            respuesta = (
                f"No encontré perfumes de la marca "
                f"{marca} en nuestro catálogo."
            )

            return await self._crear_respuesta(
                request.message,
                respuesta
            )

        if nota != "NONE" and not products:
            respuesta = (
                f"No encontré perfumes con la nota "
                f"{nota} en nuestro catálogo."
            )

            return await self._crear_respuesta(
                request.message,
                respuesta
            )

        recomendaciones = []

        if nombre_producto != "NONE" and products:
            recomendaciones = await self.product_service.obtener_recomendaciones(
                products[0]
            )

        # Convertir resultados a texto para el modelo
        contexto_productos = json.dumps(
            products,
            ensure_ascii=False
        )

        contexto_recomendaciones = json.dumps(
            recomendaciones,
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
                    f"PRODUCTOS ENCONTRADOS:\n"
                    f"{contexto_productos}\n\n"
                    f"RECOMENDACIONES RELACIONADAS:\n"
                    f"{contexto_recomendaciones}\n\n"
                    "Si existen recomendaciones relacionadas, "
                    "menciona brevemente algunas después de responder "
                    "la pregunta principal del usuario."
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=request.message
            )
        ]

        response = await self.provider.chat(mensajes)

        return await self._crear_respuesta(
            request.message,
            response
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

    async def extraer_nota(
        self,
        message: str,
        notas: list[str]
    ) -> str:

        mensaje_normalizado = message.casefold()

        # Buscar una nota en el mensaje
        for nota in notas:
            if nota.casefold() in mensaje_normalizado:
                return nota

        catalogo = "\n".join(notas)

        mensajes = [
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "Tu única tarea es identificar qué nota aromática "
                    "está mencionando el usuario.\n\n"
                    "NOTAS DISPONIBLES:\n"
                    f"{catalogo}\n\n"
                    "REGLAS:\n"
                    "- Responde exclusivamente con una nota disponible.\n"
                    "- Copia la nota exactamente como aparece en la lista.\n"
                    "- No respondas la pregunta del usuario.\n"
                    "- No agregues explicaciones.\n"
                    "- Si ninguna nota es mencionada, responde exactamente NONE."
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content=message
            )
        ]

        response = await self.provider.chat(mensajes)

        return response.strip()

    # Función para crear respuesta y facilitar que quede registrada
    async def _crear_respuesta(
        self,
        consulta: str,
        respuesta: str
    ) -> ChatResponse:

        await self.chat_log_service.registrar_consulta(
            consulta,
            respuesta
        )

        return ChatResponse(
            response=respuesta
        )