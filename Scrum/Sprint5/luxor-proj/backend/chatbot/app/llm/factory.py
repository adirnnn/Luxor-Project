from app.llm.base import LLMProvider
from app.llm.provider import Provider


def get_provider() -> LLMProvider:
    # Devolver el proveedor que se quiere usar de todos los disponibles.
    return Provider()