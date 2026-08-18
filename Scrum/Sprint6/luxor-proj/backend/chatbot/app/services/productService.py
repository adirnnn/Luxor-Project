import httpx
import os

class ProductService:

    def __init__(self):
        self.base_url = os.getenv(
            "NODE_API_URL",
            "http://127.0.0.1:3000"
        )

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
            notas.update(self._obtener_notas_producto(producto))

        return sorted(notas)

    async def buscar_por_nota(
        self,
        nota: str
    ) -> list[dict]:

        productos = await self.get_products()

        nota_normalizada = nota.strip().casefold()

        return [
            producto
            for producto in productos
            if nota_normalizada
            in self._obtener_notas_producto(producto)
        ]

    async def obtener_recomendaciones(
        self,
        producto: dict,
        limite: int = 3
    ) -> list[dict]:

        productos = await self.get_products()

        recomendaciones = []

        notas_producto = self._obtener_notas_producto(
            producto
        )

        for candidato in productos:

            # No recomendar el mismo perfume
            if candidato["id"] == producto["id"]:
                continue

            puntaje = 0

            # Misma marca
            if (
                producto.get("brand")
                and candidato.get("brand")
                and producto["brand"].casefold()
                == candidato["brand"].casefold()
            ):
                puntaje += 2

            # Misma categoría
            if (
                producto.get("category_name")
                and candidato.get("category_name")
                and producto["category_name"].casefold()
                == candidato["category_name"].casefold()
            ):
                puntaje += 2

            # Notas compartidas
            notas_producto = self._obtener_notas_producto(producto)
            notas_candidato = self._obtener_notas_producto(candidato)

            notas_compartidas = (
                notas_producto & notas_candidato
            )

            puntaje += len(notas_compartidas)

            if puntaje > 0:
                recomendaciones.append(
                    (puntaje, candidato)
                )

        recomendaciones.sort(
            key=lambda item: item[0],
            reverse=True
        )

        return [
            producto
            for _, producto in recomendaciones[:limite]
        ]

    # Funcion para obtener las notas
    def _obtener_notas_producto(
        self,
        producto: dict
    ) -> set[str]:

        notas = set()
        notes = producto.get("notes", {})

        for tipo in ["salida", "corazon", "fondo"]:
            contenido = notes.get(tipo)

            if contenido:
                notas.update(
                    nota.strip().casefold()
                    for nota in contenido.split(",")
                    if nota.strip()
                )

        return notas