import os

from app.llm.base import LLMProvider
from app.llm.openai_compat import OpenAICompatProvider
from app.llm.provider import Provider


def get_provider() -> LLMProvider:
    # se elige el proveedor de llm segun la variable LLM_PROVIDER:
    #   - "ollama" (por defecto): modelo local via ollama, para desarrollo.
    #   - "groq" / "openai" / "openai_compat": api externa compatible con openai,
    #     que es lo que se usa en el deploy de render.
    kind = os.getenv("LLM_PROVIDER", "ollama").strip().lower()

    if kind in ("groq", "openai", "openai_compat"):
        return OpenAICompatProvider()

    return Provider()
