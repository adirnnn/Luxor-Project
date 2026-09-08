import pytest

from app.bot.models import ChatMessage
from app.llm.base import LLMProvider


# Catálogo de productos que usan las pruebas. Coincide con la forma en la
# que /products del backend Node devuelve los datos (incluyendo "notes").
PRODUCTOS_FALSOS = [
    {
        "id": "khamrah",
        "name": "Lattafa Khamrah",
        "brand": "Lattafa",
        "category_name": "Dulce",
        "notes": {"salida": "Canela, dátiles", "corazon": "Praliné, vainilla", "fondo": "Madera, ámbar"},
    },
    {
        "id": "yara",
        "name": "Lattafa Yara",
        "brand": "Lattafa",
        "category_name": "Femenino",
        "notes": {"salida": "Frutas tropicales", "corazon": "Rosa, jazmín", "fondo": "Vainilla, almizcle"},
    },
    {
        "id": "hawas",
        "name": "Rasasi Hawas",
        "brand": "Rasasi",
        "category_name": "Fresco",
        "notes": {"salida": "Bergamota", "corazon": "Canela", "fondo": "Almizcle"},
    },
]

# "Oriental" existe como categoría pero ningún producto la usa: sirve para
# probar la rama de "categoría sin resultados".
CATEGORIAS_FALSAS = ["Dulce", "Femenino", "Fresco", "Oriental"]


class FakeLLMProvider(LLMProvider):
    """
    Reemplaza al proveedor real (Ollama/Groq) en las pruebas.

    Siempre devuelve el mismo texto fijo, sin importar el mensaje. Como
    ChatService valida todo lo que devuelve el LLM contra las listas del
    catálogo (ver ChatService.normalizar_texto), un texto que no está en
    ninguna lista termina resolviéndose como "NONE" — así el resultado es
    predecible sin necesitar un LLM real corriendo.
    """

    def __init__(self, respuesta_fija: str = "Respuesta simulada del LLM"):
        self.respuesta_fija = respuesta_fija
        self.mensajes_recibidos: list[list[ChatMessage]] = []

    async def chat(self, messages: list[ChatMessage]) -> str:
        self.mensajes_recibidos.append(messages)
        return self.respuesta_fija


class FakeChatLogService:
    """Reemplaza al ChatLogService real para no hacer peticiones HTTP en las pruebas."""

    def __init__(self):
        self.consultas_registradas: list[tuple[str, str]] = []

    async def registrar_consulta(self, consulta: str, respuesta: str) -> None:
        self.consultas_registradas.append((consulta, respuesta))


@pytest.fixture
def fake_provider():
    return FakeLLMProvider()


@pytest.fixture
def fake_chat_log_service():
    return FakeChatLogService()
