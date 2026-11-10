# Con más de 500 perfumes el bot le mandaba a Groq categorías enteras ("Masculino": casi 200
# perfumes, unos 34,000 tokens) y la lista de todos los nombres en cada mensaje: Groq lo rechazaba
# y el cliente veía "en este momento no puedo responder".
import logging
import random

import httpx
import pytest
from fastapi.testclient import TestClient

from app.bot import router
from app.bot.models import ChatRequest
from app.bot.service import MAX_MENSAJES_HISTORIAL, ChatService, buscar_nombre_en_mensaje
from app.main import app
from app.services import product_service as modulo_productos
from app.services.product_service import (
    MAX_PERFUMES_PARA_LLM, ProductService, hay_stock, ordenar_para_llm, resumen_para_llm,
)
from tests.conftest import FakeChatLogService, FakeLLMProvider


def perfume(i: int, **extra) -> dict:
    return {
        "id": f"masc-{i}", "name": f"Marca{i} Perfume{i}", "brand": f"Marca{i}",
        "category_name": "Masculino", "price": "500.00", "stock": 3,
        "image": f"https://res.cloudinary.com/x/{i}.webp", "created_at": "2026-11-01",
        "description": "Amaderado y especiado. " * 30,
        "notes": {"salida": "Bergamota", "corazon": "Lavanda", "fondo": "Cedro"},
        **extra,
    }


CATALOGO_GRANDE = [perfume(i) for i in range(200)] + [
    perfume(900, name="Lattafa Khamrah", brand="Lattafa", category_name="Dulce", stock=0),
    perfume(901, name="Lattafa Yara", brand="Lattafa", category_name="Femenino"),
    perfume(902, name="Lattafa Yara Moi", brand="Lattafa", category_name="Femenino"),
    perfume(903, name="Armaf Sexy", brand="Armaf", category_name="Masculino"),
]


class CatalogoGrande(ProductService):
    async def get_products(self) -> list[dict]:
        return CATALOGO_GRANDE

    async def obtener_categorias(self) -> list[str]:
        return ["Masculino", "Femenino", "Dulce"]


def servicio(proveedor):
    return ChatService(provider=proveedor, product_service=CatalogoGrande(), chat_log_service=FakeChatLogService())


# ── Lo que llega al modelo ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_una_categoria_grande_manda_solo_unos_pocos_perfumes_y_cabe_en_el_limite():
    proveedor = FakeLLMProvider("NONE")
    await servicio(proveedor).generar_respuesta(ChatRequest(message="recomiéndame algo masculino"))

    sistema = proveedor.mensajes_recibidos[-1][0].content
    assert "PRODUCTOS ENCONTRADOS" in sistema
    assert sistema.count('"name"') <= MAX_PERFUMES_PARA_LLM
    # sin foto, fechas ni ids, y la descripción recortada
    assert "cloudinary" not in sistema and "created_at" not in sistema and '"id"' not in sistema
    # antes eran más de 100,000 caracteres; ahora unos pocos miles
    assert len(sistema) < 6000
    for mensajes in proveedor.mensajes_recibidos:
        assert sum(len(m.content) for m in mensajes) < 8000


@pytest.mark.asyncio
async def test_el_nombre_del_perfume_se_busca_sin_mandarle_el_catalogo_al_modelo():
    proveedor = FakeLLMProvider("NONE")
    await servicio(proveedor).generar_respuesta(ChatRequest(message="¿tienen el yara moi?"))

    for mensajes in proveedor.mensajes_recibidos:
        assert "Marca150 Perfume150" not in mensajes[0].content
    assert "Lattafa Yara Moi" in proveedor.mensajes_recibidos[-1][0].content


# ── Agotados ────────────────────────────────────────────────────────────────

def test_ordenar_quita_los_agotados_y_pone_primero_los_mejor_calificados():
    productos = [
        {"name": "A", "stock": 0, "rating_avg": "5.0"},
        {"name": "B", "stock": 2, "rating_avg": None},
        {"name": "C", "stock": 1, "rating_avg": "4.5", "rating_count": 3},
    ]
    assert [p["name"] for p in ordenar_para_llm(productos, azar=random.Random(1))] == ["C", "B"]


def test_ordenar_varia_entre_los_que_empatan():
    productos = [{"name": str(i), "stock": 1} for i in range(50)]
    primeros = {tuple(p["name"] for p in ordenar_para_llm(productos, azar=random.Random(s))) for s in range(5)}
    assert len(primeros) > 1
    assert all(len(lista) == MAX_PERFUMES_PARA_LLM for lista in primeros)


@pytest.mark.asyncio
async def test_un_perfume_agotado_se_menciona_si_lo_piden_por_nombre():
    proveedor = FakeLLMProvider("NONE")
    await servicio(proveedor).generar_respuesta(ChatRequest(message="¿tienen khamrah?"))

    sistema = proveedor.mensajes_recibidos[-1][0].content
    assert "Lattafa Khamrah" in sistema
    assert '"disponible": "agotado"' in sistema
    assert "aclara que está agotado" in sistema


@pytest.mark.asyncio
async def test_las_recomendaciones_no_incluyen_agotados():
    yara = CATALOGO_GRANDE[-3]
    recomendaciones = await CatalogoGrande().obtener_recomendaciones(yara, limite=5)
    assert recomendaciones
    assert all(hay_stock(p) for p in recomendaciones)


def test_resumen_solo_trae_lo_necesario():
    resumen = resumen_para_llm(perfume(1))
    assert set(resumen) == {"name", "brand", "category", "price", "notes", "description", "disponible"}
    assert len(resumen["description"]) <= 201
    assert resumen["notes"] == "salida: Bergamota; corazón: Lavanda; fondo: Cedro"


def test_resumen_sin_notas_ni_descripcion():
    resumen = resumen_para_llm({"name": "X", "brand": "Y", "price": "10", "stock": 1,
                                "description": None, "notes": {"salida": None}})
    assert "notes" not in resumen and "description" not in resumen


# ── Buscar el nombre en el mensaje ──────────────────────────────────────────

NOMBRES = [p["name"] for p in CATALOGO_GRANDE]
MARCAS = {p["name"]: p["brand"] for p in CATALOGO_GRANDE}


@pytest.mark.parametrize("mensaje, esperado", [
    ("¿Tienen el Lattafa Khamrah?", "Lattafa Khamrah"),
    ("tienen khamrah?", "Lattafa Khamrah"),          # sin la marca
    ("tienen khamra", "Lattafa Khamrah"),            # error de escritura
    ("quiero el yara moi", "Lattafa Yara Moi"),      # gana el nombre más largo
    ("y el yara?", "Lattafa Yara"),
    ("algo sexy para hombre", "NONE"),               # palabra común sin la marca
    ("el armaf sexy", "Armaf Sexy"),                 # con la marca sí cuenta
    ("recomiéndame algo masculino", "NONE"),
])
def test_buscar_nombre_en_mensaje(mensaje, esperado):
    assert buscar_nombre_en_mensaje(mensaje, NOMBRES, MARCAS) == esperado


# ── Historial ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_solo_se_mandan_los_ultimos_mensajes_de_la_conversacion():
    historial = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"mensaje {i}"} for i in range(10)]
    proveedor = FakeLLMProvider("NONE")
    await servicio(proveedor).generar_respuesta(ChatRequest(message="¿y cuál me recomiendas?", history=historial))

    mensajes = proveedor.mensajes_recibidos[-1]
    assert len(mensajes) == 1 + MAX_MENSAJES_HISTORIAL + 1
    assert mensajes[1].content == "mensaje 2"
    assert mensajes[-1].content == "¿y cuál me recomiendas?"


# ── Catálogo guardado un minuto ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_el_catalogo_se_descarga_una_vez_por_minuto(monkeypatch):
    descargas = []

    class ClienteFalso:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            descargas.append(url)
            return httpx.Response(200, json=CATALOGO_GRANDE, request=httpx.Request("GET", url))

    reloj = [1000.0]
    monkeypatch.setattr(modulo_productos.httpx, "AsyncClient", ClienteFalso)
    monkeypatch.setattr(modulo_productos.time, "monotonic", lambda: reloj[0])
    servicio_real = ProductService()

    await servicio_real.buscar_por_categoria("Masculino")
    await servicio_real.obtener_marcas()
    await servicio_real.obtener_notas()
    assert len(descargas) == 1

    reloj[0] += 61
    await servicio_real.get_products()
    assert len(descargas) == 2


# ── Registro del error de Groq ──────────────────────────────────────────────

def test_el_registro_dice_el_codigo_del_error_de_groq(monkeypatch, caplog):
    async def groq_rechaza(*args, **kwargs):
        respuesta = httpx.Response(413, request=httpx.Request("POST", "https://api.groq.com"))
        raise httpx.HTTPStatusError("demasiado grande", request=respuesta.request, response=respuesta)

    monkeypatch.setattr(router.service, "generar_respuesta", groq_rechaza)
    with caplog.at_level(logging.ERROR):
        respuesta = TestClient(app).post("/chat", json={"message": "algo masculino"})

    assert respuesta.json()["response"] == router.MENSAJE_SIN_SERVICIO
    assert "HTTPStatusError (código 413)" in caplog.text
    assert "algo masculino" not in caplog.text
