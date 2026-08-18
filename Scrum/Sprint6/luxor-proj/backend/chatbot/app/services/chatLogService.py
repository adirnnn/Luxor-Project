import httpx
import os


class ChatLogService:

    def __init__(self):
        self.base_url = "http://127.0.0.1:3000"

    async def registrar_consulta(
        self,
        consulta: str,
        respuesta: str
    ) -> None:

        async with httpx.AsyncClient() as client:

            response = await client.post(
                f"{self.base_url}/chatbot/queries",
                json={
                    "query": consulta,
                    "response": respuesta
                }
            )

            response.raise_for_status()