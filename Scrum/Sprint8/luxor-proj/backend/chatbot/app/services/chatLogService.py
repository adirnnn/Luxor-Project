import httpx
import logging
import os

logger = logging.getLogger(__name__)


class ChatLogService:

    def __init__(self):
        self.base_url = os.getenv(
            "NODE_API_URL",
            "http://127.0.0.1:3000"
        )

    async def registrar_consulta(
        self,
        consulta: str,
        respuesta: str
    ) -> None:
        # El registro de la consulta es best-effort: si el backend no responde,
        # no debe impedir que el usuario reciba la respuesta del chatbot.
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chatbot/queries",
                    json={
                        "query": consulta,
                        "response": respuesta
                    },
                    timeout=5.0,
                )
                response.raise_for_status()
        except Exception:
            logger.warning("No se pudo registrar la consulta del chatbot.", exc_info=True)
