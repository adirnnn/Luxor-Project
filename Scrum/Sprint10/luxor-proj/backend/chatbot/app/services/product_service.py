import httpx
import os
import random
import time

# Con más de 500 perfumes, una categoría como "Masculino" (casi 200) no cabe en lo que Groq acepta
# por minuto y respondía con error. El bot sigue buscando en todo el catálogo, pero al modelo solo
# le pasa los mejores resultados y solo con los datos que necesita para redactar la respuesta.
MAX_PERFUMES_PARA_LLM = 8
LARGO_DESCRIPCION = 200
# el catálogo se guarda un minuto: antes se descargaba 6 veces en cada mensaje
CACHE_SEGUNDOS = 60


def hay_stock(producto: dict) -> bool:
    stock = producto.get("stock")
    if stock is None:
        return True
    try:
        return int(stock) > 0
    except (TypeError, ValueError):
        return False


def ordenar_para_llm(
    productos: list[dict],
    limite: int = MAX_PERFUMES_PARA_LLM,
    incluir_agotados: bool = False,
    azar: random.Random | None = None,
) -> list[dict]:
    """Los perfumes que se le pasan al modelo: sin agotados (salvo que pregunten por uno por su
    nombre), primero los de mejores reseñas y, entre los que empatan, en orden al azar para que
    "otras opciones" no traiga siempre los mismos."""
    candidatos = [p for p in productos if incluir_agotados or hay_stock(p)]
    (azar or random).shuffle(candidatos)

    def puntaje(producto: dict):
        try:
            promedio = float(producto.get("rating_avg") or 0)
        except (TypeError, ValueError):
            promedio = 0.0
        return (hay_stock(producto), promedio, producto.get("rating_count") or 0)

    # sort es estable: lo que empata se queda en el orden al azar
    candidatos.sort(key=puntaje, reverse=True)
    return candidatos[:limite]


def recortar(texto: str, largo: int = LARGO_DESCRIPCION) -> str:
    texto = " ".join(str(texto).split())
    if len(texto) <= largo:
        return texto
    return texto[:largo].rsplit(" ", 1)[0] + "…"


def resumen_para_llm(producto: dict) -> dict:
    """Solo lo que el modelo necesita para recomendar (sin foto, ids, fechas ni datos internos)."""
    notas = producto.get("notes") or {}
    texto_notas = "; ".join(
        f"{etiqueta}: {notas[clave]}"
        for clave, etiqueta in (("salida", "salida"), ("corazon", "corazón"), ("fondo", "fondo"))
        if notas.get(clave)
    )
    resumen = {
        "name": producto.get("name"),
        "brand": producto.get("brand"),
        "category": producto.get("category_name"),
        "price": producto.get("price"),
        "notes": texto_notas or None,
        "description": recortar(producto["description"]) if producto.get("description") else None,
        "disponible": "sí" if hay_stock(producto) else "agotado",
    }
    return {clave: valor for clave, valor in resumen.items() if valor is not None}


class ProductService:

    def __init__(self):
        self.base_url = os.getenv(
            "NODE_API_URL",
            "http://127.0.0.1:3000"
        )
        self._catalogo: list[dict] | None = None
        self._catalogo_hora = 0.0

    async def get_products(self) -> list[dict]:
        ahora = time.monotonic()
        if self._catalogo is not None and ahora - self._catalogo_hora < CACHE_SEGUNDOS:
            return self._catalogo

        async with httpx.AsyncClient() as client:

            response = await client.get(
                f"{self.base_url}/products"
            )

            response.raise_for_status()

            self._catalogo = response.json()
            self._catalogo_hora = ahora
            return self._catalogo

    async def buscar_productos(
        self,
        query: str
    ) -> list[dict]:
        # Búsqueda por nombre: se filtra solo por p.name (no por descripción/notas)
        # para que una consulta por el nombre de un perfume no traiga perfumes
        # no relacionados que solo comparten palabras en la descripción.
        productos = await self.get_products()
        query_normalizado = query.strip().casefold()

        return [
            producto
            for producto in productos
            if query_normalizado in (producto.get("name") or "").casefold()
        ]

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

            # No recomendar el mismo perfume ni uno agotado
            if candidato["id"] == producto["id"] or not hay_stock(candidato):
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