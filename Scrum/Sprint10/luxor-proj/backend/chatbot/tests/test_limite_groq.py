# con el plan gratis de groq un 429 (limite de tokens por minuto) no debe dejar al cliente sin respuesta
import asyncio

import httpx
import pytest

from app.bot.models import ChatMessage, MessageRole
from app.llm.openai_compat import OpenAICompatProvider

OK = {"choices": [{"message": {"content": "Te recomiendo Lattafa Yara."}}]}


def proveedor(respuestas, monkeypatch, fallback=""):
    monkeypatch.setenv("LLM_FALLBACK_MODEL", fallback)
    monkeypatch.setenv("LLM_RETRY_MAX_WAIT", "0.01")
    p = OpenAICompatProvider()
    pedidos = []

    def manejar(request):
        import json
        pedidos.append(json.loads(request.content)["model"])
        return respuestas.pop(0)

    p.transport = httpx.MockTransport(manejar)
    return p, pedidos


def mensajes():
    return [ChatMessage(role=MessageRole.USER, content="hola")]


def test_con_un_429_espera_y_reintenta_el_mismo_modelo(monkeypatch):
    p, pedidos = proveedor([httpx.Response(429, headers={"retry-after": "3"}), httpx.Response(200, json=OK)], monkeypatch)
    assert asyncio.run(p.chat(mensajes())) == "Te recomiendo Lattafa Yara."
    assert pedidos == [p.model, p.model]


def test_con_modelo_de_respaldo_pasa_a_ese_sin_esperar(monkeypatch):
    p, pedidos = proveedor([httpx.Response(429), httpx.Response(200, json=OK)], monkeypatch, fallback="llama-3.3-70b-versatile")
    assert asyncio.run(p.chat(mensajes())) == "Te recomiendo Lattafa Yara."
    assert pedidos == [p.model, "llama-3.3-70b-versatile"]


def test_si_sigue_en_429_se_avisa_el_error(monkeypatch):
    p, _ = proveedor([httpx.Response(429), httpx.Response(429)], monkeypatch)
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(p.chat(mensajes()))


def test_la_espera_nunca_pasa_del_maximo(monkeypatch):
    monkeypatch.setenv("LLM_RETRY_MAX_WAIT", "8")
    p = OpenAICompatProvider()
    assert p._espera(httpx.Response(429, headers={"retry-after": "60"})) == 8
    assert p._espera(httpx.Response(429)) == 2
