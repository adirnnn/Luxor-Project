import pytest

from app.bot.models import ChatRequest
from app.bot.service import ChatService
from tests.conftest import FakeChatLogService, FakeLLMProvider
from tests.test_product_service import FakeProductService


@pytest.fixture
def chat_service(fake_provider):
    return ChatService(
        provider=fake_provider,
        product_service=FakeProductService(),
        chat_log_service=FakeChatLogService(),
    )


@pytest.mark.asyncio
async def test_normalizar_texto_coincidencia_exacta(chat_service):
    resultado = chat_service.normalizar_texto("fresco", ["Dulce", "Femenino", "Fresco"])
    assert resultado == "Fresco"


@pytest.mark.asyncio
async def test_normalizar_texto_coincidencia_aproximada(chat_service):
    # "Frezco" (con z) debe emparejar con "Fresco" por similitud
    resultado = chat_service.normalizar_texto("Frezco", ["Dulce", "Femenino", "Fresco"])
    assert resultado == "Fresco"


@pytest.mark.asyncio
async def test_normalizar_texto_sin_coincidencia(chat_service):
    resultado = chat_service.normalizar_texto("algo-totalmente-distinto", ["Dulce", "Femenino", "Fresco"])
    assert resultado == "NONE"


@pytest.mark.asyncio
async def test_pregunta_por_nombre_de_perfume_encontrado(chat_service, fake_provider):
    request = ChatRequest(message="Cuéntame sobre el Lattafa Khamrah")
    respuesta = await chat_service.generar_respuesta(request)

    # La respuesta final es la que devuelve el LLM (fake) al armar el contexto
    assert respuesta.response == fake_provider.respuesta_fija
    # Se registró la consulta en el historial
    assert chat_service.chat_log_service.consultas_registradas[-1][0] == request.message


@pytest.mark.asyncio
async def test_pregunta_por_categoria_encontrada(chat_service, fake_provider):
    request = ChatRequest(message="Muéstrame perfumes de la categoría Fresco")
    respuesta = await chat_service.generar_respuesta(request)

    assert respuesta.response == fake_provider.respuesta_fija


@pytest.mark.asyncio
async def test_pregunta_por_categoria_sin_resultados(chat_service):
    # "Oriental" es una categoría válida pero ningún producto la tiene
    request = ChatRequest(message="Busco algo de la categoría Oriental")
    respuesta = await chat_service.generar_respuesta(request)

    assert "Oriental" in respuesta.response
    assert "No encontré perfumes" in respuesta.response


@pytest.mark.asyncio
async def test_consulta_no_relacionada_con_el_catalogo(chat_service):
    request = ChatRequest(message="¿Cuál es el clima en Guatemala hoy?")
    respuesta = await chat_service.generar_respuesta(request)

    assert respuesta.response == (
        "No encontré información relacionada con tu consulta "
        "en nuestro catálogo. Puedes preguntarme por un perfume, "
        "una marca, una categoría o una nota aromática."
    )


@pytest.mark.asyncio
async def test_toda_consulta_queda_registrada_en_el_historial(chat_service):
    request = ChatRequest(message="¿Cuál es el clima en Guatemala hoy?")
    await chat_service.generar_respuesta(request)

    assert len(chat_service.chat_log_service.consultas_registradas) == 1
    consulta, respuesta_guardada = chat_service.chat_log_service.consultas_registradas[0]
    assert consulta == request.message
