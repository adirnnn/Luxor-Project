# SFTWRKEY-458: consulta del estado de un pedido con el número y el correo de la compra.
import httpx
import pytest
from fastapi.testclient import TestClient

import app.bot.router as chat_router
import app.services.order_service as order_module
from app.bot import service as servicio_chat
from app.bot.intents import Intencion, detectar_intencion, extraer_datos_pedido, ocultar_correos
from app.bot.models import ChatMessage, ChatRequest, MessageRole
from app.bot.service import ChatService
from app.main import app
from app.services.order_service import DemasiadosIntentos, OrderService
from tests.conftest import FakeChatLogService, FakeLLMProvider
from tests.test_product_service import FakeProductService

client = TestClient(app)
CLIENTE_HTTP_REAL = httpx.AsyncClient

PEDIDO_ENVIADO = {
    "id": 15,
    "status": "enviado",
    "created_at": "2026-10-20T15:00:00.000Z",
    # 22/10 a las 3:00 en UTC todavía es 21/10 en Guatemala
    "updated_at": "2026-10-22T03:00:00.000Z",
}


class FakeOrderService:
    """Simula al backend: solo existe el pedido 15 de ana@luxor.com."""

    def __init__(self, error: Exception | None = None):
        self.consultas: list[tuple] = []
        self.error = error

    async def consultar_pedido(self, numero, correo, ip_cliente=None):
        self.consultas.append((numero, correo, ip_cliente))
        if self.error:
            raise self.error
        if numero == 15 and correo == "ana@luxor.com":
            return PEDIDO_ENVIADO
        return None


def crear_servicio(pedidos=None):
    proveedor = FakeLLMProvider()
    registro = FakeChatLogService()
    pedidos = pedidos or FakeOrderService()
    servicio = ChatService(
        provider=proveedor,
        product_service=FakeProductService(),
        chat_log_service=registro,
        order_service=pedidos,
    )
    return servicio, proveedor, registro, pedidos


def conversacion(*mensajes: tuple[str, str]) -> list[ChatMessage]:
    roles = {"user": MessageRole.USER, "bot": MessageRole.ASSISTANT}
    return [ChatMessage(role=roles[rol], content=texto) for rol, texto in mensajes]


# ── Detección y extracción ──────────────────────────────────────────────────

@pytest.mark.parametrize("mensaje", [
    "¿Dónde está mi pedido?",
    "Quiero saber el estado de mi compra",
    "¿Cuándo llega mi pedido?",
    "gracias, ¿dónde está mi pedido?",
    "hola, quiero rastrear mi orden",
    "pedido 15",
    "¿Ya enviaron mi pedido?",
])
def test_reconoce_la_intencion_de_consultar_un_pedido(mensaje):
    assert detectar_intencion(mensaje) == Intencion.PEDIDO


@pytest.mark.parametrize("mensaje, esperada", [
    ("Quiero hacer un pedido", Intencion.PRODUCTO),
    ("¿Cómo son los envíos?", Intencion.INFO_TIENDA),
    ("¿Tienen Khamrah?", Intencion.PRODUCTO),
    ("gracias", Intencion.AGRADECIMIENTO),
])
def test_no_confunde_otras_preguntas_con_una_consulta_de_pedido(mensaje, esperada):
    assert detectar_intencion(mensaje) == esperada


@pytest.mark.parametrize("mensaje, esperado", [
    ("pedido 15, ana@luxor.com", (15, "ana@luxor.com")),
    ("15 Ana@Luxor.com", (15, "ana@luxor.com")),
    ("mi correo es ana15@gmail.com y el pedido #23", (23, "ana15@gmail.com")),
    ("número 7", (7, None)),
    ("ana@luxor.com", (None, "ana@luxor.com")),
    ("no sé", (None, None)),
])
def test_extrae_numero_y_correo(mensaje, esperado):
    assert extraer_datos_pedido(mensaje) == esperado


def test_oculta_los_correos_para_el_registro():
    assert ocultar_correos("pedido 15, ana@luxor.com") == "pedido 15, [correo]"


# ── Criterios de aceptación ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_con_numero_y_correo_correctos_responde_el_estado_del_pedido():
    servicio, proveedor, _, pedidos = crear_servicio()

    respuesta = await servicio.generar_respuesta(
        ChatRequest(message="¿Dónde está mi pedido 15? Mi correo es Ana@Luxor.com"),
        ip_cliente="203.0.113.5",
    )

    assert respuesta.response == (
        "Tu pedido #15 ya fue enviado y va en camino. Última actualización: 21/10/2026."
    )
    assert pedidos.consultas == [(15, "ana@luxor.com", "203.0.113.5")]
    # el estado no pasa por el LLM
    assert proveedor.mensajes_recibidos == []


@pytest.mark.asyncio
@pytest.mark.parametrize("mensaje", [
    "pedido 15, otra@luxor.com",   # correo de otra persona
    "pedido 16, ana@luxor.com",    # número que no es suyo
    "pedido 999, x@y.com",         # pedido que no existe
])
async def test_con_datos_que_no_coinciden_responde_que_no_lo_encontro_sin_detalles(mensaje):
    servicio, proveedor, _, _ = crear_servicio()

    respuesta = (await servicio.generar_respuesta(ChatRequest(message=mensaje))).response

    assert respuesta == servicio_chat.PEDIDO_NO_ENCONTRADO
    for detalle in ("enviado", "camino", "pagado", "preparación", "entregado", "cancelado", "#15", "Ana"):
        assert detalle not in respuesta
    assert proveedor.mensajes_recibidos == []


# ── Conversación ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_si_solo_pregunta_por_su_pedido_le_pide_los_datos():
    servicio, proveedor, _, pedidos = crear_servicio()

    respuesta = await servicio.generar_respuesta(ChatRequest(message="¿Dónde está mi pedido?"))

    assert respuesta.response == servicio_chat.PEDIR_DATOS
    assert pedidos.consultas == []
    assert proveedor.mensajes_recibidos == []


@pytest.mark.asyncio
async def test_los_datos_pueden_llegar_en_mensajes_separados():
    servicio, _, _, pedidos = crear_servicio()

    # 1. solo el número: le falta el correo
    falta = await servicio.generar_respuesta(ChatRequest(
        message="15",
        history=conversacion(("user", "¿Dónde está mi pedido?"), ("bot", servicio_chat.PEDIR_DATOS)),
    ))
    assert falta.response == servicio_chat.FALTA_CORREO

    # 2. después el correo: junta los dos datos
    final = await servicio.generar_respuesta(ChatRequest(
        message="ana@luxor.com",
        history=conversacion(
            ("user", "¿Dónde está mi pedido?"), ("bot", servicio_chat.PEDIR_DATOS),
            ("user", "15"), ("bot", servicio_chat.FALTA_CORREO),
        ),
    ))
    assert final.response.startswith("Tu pedido #15 ya fue enviado")
    assert pedidos.consultas == [(15, "ana@luxor.com", None)]


@pytest.mark.asyncio
async def test_si_falta_el_numero_lo_pide():
    servicio, _, _, pedidos = crear_servicio()

    respuesta = await servicio.generar_respuesta(ChatRequest(
        message="ana@luxor.com",
        history=conversacion(("user", "mi pedido"), ("bot", servicio_chat.PEDIR_DATOS)),
    ))

    assert respuesta.response == servicio_chat.FALTA_NUMERO
    assert pedidos.consultas == []


@pytest.mark.asyncio
async def test_un_numero_suelto_fuera_de_la_consulta_no_se_toma_como_pedido():
    servicio, _, _, pedidos = crear_servicio()

    # el bot no pidió datos de pedido: "300" es parte de una pregunta normal
    await servicio.generar_respuesta(ChatRequest(
        message="¿Tienen perfumes de menos de 300?",
        history=conversacion(("user", "hola"), ("bot", "¡Hola! ¿En qué te puedo ayudar?")),
    ))

    assert pedidos.consultas == []


@pytest.mark.asyncio
async def test_datos_de_una_conversacion_vieja_no_se_mezclan():
    servicio, _, _, pedidos = crear_servicio()

    # el cliente dio un número antes, pero después la conversación siguió con otra cosa
    respuesta = await servicio.generar_respuesta(ChatRequest(
        message="¿dónde está mi pedido? ana@luxor.com",
        history=conversacion(
            ("user", "mi pedido"), ("bot", servicio_chat.PEDIR_DATOS), ("user", "15"),
            ("bot", servicio_chat.FALTA_CORREO), ("user", "mejor recomiéndame un perfume"),
            ("bot", "Te recomiendo Lattafa Khamrah."),
        ),
    ))

    assert respuesta.response == servicio_chat.FALTA_NUMERO
    assert pedidos.consultas == []


@pytest.mark.asyncio
async def test_cuando_el_backend_limita_los_intentos_lo_explica():
    servicio, _, _, _ = crear_servicio(FakeOrderService(error=DemasiadosIntentos()))

    respuesta = await servicio.generar_respuesta(ChatRequest(message="pedido 15, ana@luxor.com"))

    assert respuesta.response == servicio_chat.DEMASIADOS_INTENTOS


@pytest.mark.asyncio
async def test_si_el_backend_falla_responde_un_mensaje_amable():
    servicio, _, _, _ = crear_servicio(FakeOrderService(error=httpx.ConnectError("sin conexion")))

    respuesta = await servicio.generar_respuesta(ChatRequest(message="pedido 15, ana@luxor.com"))

    assert respuesta.response == servicio_chat.PEDIDO_SIN_SERVICIO
    assert "ConnectError" not in respuesta.response


@pytest.mark.asyncio
async def test_el_correo_del_cliente_no_queda_en_el_registro_de_consultas():
    servicio, _, registro, _ = crear_servicio()

    await servicio.generar_respuesta(ChatRequest(message="pedido 15, ana@luxor.com"))

    [(consulta, respuesta)] = registro.consultas_registradas
    assert consulta == "pedido 15, [correo]"
    assert "ana@luxor.com" not in respuesta


@pytest.mark.asyncio
@pytest.mark.parametrize("estado, texto", [
    ("pagado", "está pagado"), ("en_preparacion", "está en preparación"),
    ("entregado", "ya fue entregado"), ("cancelado", "fue cancelado"), ("otro", "está en revisión"),
])
async def test_cada_estado_tiene_su_mensaje(estado, texto):
    class Pedidos(FakeOrderService):
        async def consultar_pedido(self, numero, correo, ip_cliente=None):
            return {**PEDIDO_ENVIADO, "status": estado}

    servicio, _, _, _ = crear_servicio(Pedidos())

    respuesta = await servicio.generar_respuesta(ChatRequest(message="pedido 15, ana@luxor.com"))

    assert respuesta.response.startswith(f"Tu pedido #15 {texto}")


# ── Endpoint /chat ──────────────────────────────────────────────────────────

def test_el_endpoint_manda_la_ip_real_del_cliente(monkeypatch):
    servicio, _, _, pedidos = crear_servicio()
    monkeypatch.setattr(chat_router, "service", servicio)

    # en Render el proxy agrega la ip real al final; la primera la puede inventar cualquiera
    response = client.post(
        "/chat",
        json={"message": "pedido 15, ana@luxor.com"},
        headers={"X-Forwarded-For": "1.2.3.4, 203.0.113.9"},
    )

    assert response.status_code == 200
    assert response.json()["response"].startswith("Tu pedido #15")
    assert pedidos.consultas == [(15, "ana@luxor.com", "203.0.113.9")]


# ── OrderService (llamada al backend) ───────────────────────────────────────

def usar_backend(monkeypatch, responder):
    peticiones: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        return responder(request)

    monkeypatch.setattr(
        order_module.httpx, "AsyncClient",
        lambda **kwargs: CLIENTE_HTTP_REAL(transport=httpx.MockTransport(handler), **kwargs),
    )
    monkeypatch.setenv("NODE_API_URL", "http://backend.test")
    monkeypatch.setenv("CHATBOT_INTERNAL_KEY", "clave-interna-de-prueba")
    return peticiones


@pytest.mark.asyncio
async def test_order_service_consulta_al_backend_con_la_clave_interna(monkeypatch):
    peticiones = usar_backend(monkeypatch, lambda r: httpx.Response(200, json={"found": True, "order": PEDIDO_ENVIADO}))

    pedido = await OrderService().consultar_pedido(15, "ana@luxor.com", "203.0.113.5")

    assert pedido == PEDIDO_ENVIADO
    [peticion] = peticiones
    assert str(peticion.url) == "http://backend.test/internal/orders/lookup"
    assert peticion.headers["X-Internal-Key"] == "clave-interna-de-prueba"
    assert peticion.headers["X-Client-IP"] == "203.0.113.5"
    assert peticion.read() == b'{"order_id":15,"email":"ana@luxor.com"}'


@pytest.mark.asyncio
async def test_order_service_404_es_pedido_no_encontrado_y_429_son_demasiados_intentos(monkeypatch):
    usar_backend(monkeypatch, lambda r: httpx.Response(404, json={"found": False}))
    assert await OrderService().consultar_pedido(15, "otra@luxor.com") is None

    usar_backend(monkeypatch, lambda r: httpx.Response(429, json={"found": False}))
    with pytest.raises(DemasiadosIntentos):
        await OrderService().consultar_pedido(15, "ana@luxor.com")

    usar_backend(monkeypatch, lambda r: httpx.Response(500, json={"found": False}))
    with pytest.raises(httpx.HTTPStatusError):
        await OrderService().consultar_pedido(15, "ana@luxor.com")
