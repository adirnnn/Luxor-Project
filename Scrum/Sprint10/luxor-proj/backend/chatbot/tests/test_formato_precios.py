# Los precios llegan al modelo en quetzales (antes venían sin moneda y respondía "3500,00 €")
# y se le pide no usar tablas, que no caben en el chat del celular.
import pytest

from app.bot.models import ChatRequest
from app.bot.service import REGLA_FORMATO, ChatService, formato_precio, productos_para_prompt
from tests.conftest import PRODUCTOS_FALSOS, FakeChatLogService
from tests.test_product_service import FakeProductService

PRECIOS = {"khamrah": "390.00", "yara": "3500", "hawas": None}


class ProductosConPrecio(FakeProductService):
    async def get_products(self) -> list[dict]:
        return [{**producto, "price": PRECIOS[producto["id"]]} for producto in PRODUCTOS_FALSOS]


@pytest.fixture
def chat_service(fake_provider):
    return ChatService(
        provider=fake_provider,
        product_service=ProductosConPrecio(),
        chat_log_service=FakeChatLogService(),
    )


@pytest.mark.parametrize("valor, esperado", [
    ("390.00", "Q390.00"),
    ("3500", "Q3,500.00"),
    (1170.5, "Q1,170.50"),
    (None, None),
    ("gratis", None),
])
def test_formato_precio_igual_que_el_sitio(valor, esperado):
    assert formato_precio(valor) == esperado


def test_productos_para_prompt_no_cambia_los_originales():
    originales = [{"id": "khamrah", "price": "390.00"}]
    assert productos_para_prompt(originales) == [{"id": "khamrah", "price": "Q390.00"}]
    assert originales[0]["price"] == "390.00"


@pytest.mark.asyncio
async def test_la_busqueda_de_productos_pasa_los_precios_en_quetzales(chat_service, fake_provider):
    await chat_service.generar_respuesta(ChatRequest(message="¿Tienen el Lattafa Khamrah?"))

    sistema = fake_provider.mensajes_recibidos[-1][0].content
    assert "PRODUCTOS ENCONTRADOS" in sistema
    assert '"price": "Q390.00"' in sistema
    assert '"price": "390.00"' not in sistema
    assert REGLA_FORMATO in sistema


@pytest.mark.asyncio
async def test_la_conversacion_general_usa_el_mismo_formato(chat_service, fake_provider):
    catalogo = await ProductosConPrecio().get_products()
    await chat_service.responder_general(ChatRequest(message="¿qué me recomiendas?"), catalogo)

    sistema = fake_provider.mensajes_recibidos[-1][0].content
    assert "Lattafa Yara · Lattafa · Femenino · Q3,500.00" in sistema
    assert REGLA_FORMATO in sistema


def test_la_regla_pide_quetzales_y_prohibe_tablas():
    assert "quetzales" in REGLA_FORMATO
    assert "No uses tablas" in REGLA_FORMATO
