# SFTWRKEY-458: el chatbot consulta el estado de un pedido al backend Node con su clave interna.
# Nunca va directo a la base de datos.
import httpx
import os


class DemasiadosIntentos(Exception):
    """El backend respondió 429: el cliente ya hizo muchas consultas seguidas."""


class OrderService:

    def __init__(self):
        self.base_url = os.getenv(
            "NODE_API_URL",
            "http://127.0.0.1:3000"
        )

    async def consultar_pedido(
        self,
        numero: int,
        correo: str,
        ip_cliente: str | None = None
    ) -> dict | None:
        """Devuelve {id, status, created_at, updated_at} o None si el número y el correo no coinciden."""
        headers = {"X-Internal-Key": os.getenv("CHATBOT_INTERNAL_KEY", "")}
        # el backend limita las consultas por cliente; todas llegan desde el chatbot,
        # así que se le pasa la ip de quien escribe
        if ip_cliente:
            headers["X-Client-IP"] = ip_cliente

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/internal/orders/lookup",
                json={"order_id": numero, "email": correo},
                headers=headers,
                timeout=10.0,
            )

        if response.status_code == 404:
            return None
        if response.status_code == 429:
            raise DemasiadosIntentos()
        response.raise_for_status()
        return response.json()["order"]
