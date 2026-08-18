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

    async def obtener_marcas(self) -> list[str]:
        productos = await self.get_products()
        marcas = {
            producto["brand"]
            for producto in productos
            if producto.get("brand")
        }

        return sorted(marcas)

    async def buscar_por_marca(
        self,
        marca: str
    ) -> list[dict]:

        productos = await self.get_products()

        print("Marca buscada:", repr(marca))

        for producto in productos:
            print(
                producto.get("name"),
                "->",
                repr(producto.get("brand"))
            )

        return [
            producto
            for producto in productos
            if (
                producto.get("brand")
                and producto["brand"].strip().casefold()
                == marca.strip().casefold()
            )
        ]

    async def obtener_notas(self) -> list[str]:

        productos = await self.get_products()

        notas = set()

        for producto in productos:
            notes = producto.get("notes", {})

            for tipo in ["salida", "corazon", "fondo"]:
                contenido = notes.get(tipo)

                if contenido:
                    notas.update(
                        nota.strip()
                        for nota in contenido.split(",")
                        if nota.strip()
                    )

        return sorted(notas)

    async def buscar_por_nota(
        self,
        nota: str
    ) -> list[dict]:

        productos = await self.get_products()

        nota_normalizada = nota.strip().casefold()

        resultados = []

        for producto in productos:

            notes = producto.get("notes", {})

            notas_producto = []

            for tipo in ["salida", "corazon", "fondo"]:
                contenido = notes.get(tipo)

                if contenido:
                    notas_producto.extend(
                        n.strip().casefold()
                        for n in contenido.split(",")
                        if n.strip()
                    )

            if nota_normalizada in notas_producto:
                resultados.append(producto)

        return resultados