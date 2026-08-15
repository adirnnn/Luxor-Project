import httpx


class ProductService:

    def __init__(self):
        self.base_url = "http://127.0.0.1:3000"

    async def get_products(self) -> list[dict]:

        async with httpx.AsyncClient() as client:

            response = await client.get(
                f"{self.base_url}/products"
            )

            response.raise_for_status()

            return response.json()