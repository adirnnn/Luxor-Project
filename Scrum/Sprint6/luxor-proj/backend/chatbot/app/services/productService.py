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

    async def buscar_productos(
        self,
        query: str
    ) -> list[dict]:

        async with httpx.AsyncClient() as client:

            response = await client.get(
                f"{self.base_url}/products/search",
                params={
                    "busqueda": query
                }
            )

            response.raise_for_status()

            data = response.json()

            return data["products"]

    async def obtener_categorias(self) -> list[str]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/categories"
            )

            response.raise_for_status()

            data = response.json()

            return [
                categoria["nombre"]
                for categoria in data["categories"]
            ]

    async def buscar_por_categoria(
        self,
        categoria: str
    ) -> list[dict]:

        productos = await self.get_products()

        return [
            producto
            for producto in productos
            if (
                producto.get("category_name")
                and producto["category_name"].strip().casefold()
                == categoria.strip().casefold()
            )
        ]