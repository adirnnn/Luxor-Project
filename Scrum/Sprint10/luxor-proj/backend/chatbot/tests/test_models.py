import pytest
from pydantic import ValidationError

from app.bot.models import ChatRequest


def test_chat_request_valido():
    request = ChatRequest(message="¿Tienen perfumes árabes?")
    assert request.message == "¿Tienen perfumes árabes?"


def test_chat_request_recorta_espacios_de_los_extremos():
    request = ChatRequest(message="  ¿Tienen Khamrah?  ")
    assert request.message == "¿Tienen Khamrah?"


def test_chat_request_rechaza_mensaje_vacio():
    with pytest.raises(ValidationError):
        ChatRequest(message="")


def test_chat_request_rechaza_mensaje_solo_espacios():
    # Regresión de SFTWRKEY-352: min_length=1 no bloqueaba un mensaje de
    # puros espacios porque su longitud es > 0.
    with pytest.raises(ValidationError):
        ChatRequest(message="   ")
