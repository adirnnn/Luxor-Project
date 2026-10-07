import pytest

from app.services.product_service import ProductService
from tests.conftest import CATEGORIAS_FALSAS, PRODUCTOS_FALSOS


class FakeProductService(ProductService):
    """
    ProductService de prueba: sobreescribe únicamente los dos métodos que
    hacen peticiones HTTP (get_products y obtener_categorias) para que
    devuelvan datos fijos en memoria. El resto de métodos (buscar_por_*,
    obtener_marcas, obtener_notas, obtener_recomendaciones) son heredados
    tal cual del ProductService real, así que las pruebas siguen validando
    la lógica de negocio real.
    """

    async def get_products(self) -> list[dict]:
        return PRODUCTOS_FALSOS

    async def obtener_categorias(self) -> list[str]:
        return CATEGORIAS_FALSAS


@pytest.fixture
def product_service():
    return FakeProductService()


@pytest.mark.asyncio
async def test_buscar_productos_por_nombre(product_service):
    resultado = await product_service.buscar_productos("khamrah")
    assert len(resultado) == 1
    assert resultado[0]["id"] == "khamrah"


@pytest.mark.asyncio
async def test_buscar_productos_sin_coincidencias(product_service):
    resultado = await product_service.buscar_productos("perfume-que-no-existe")
    assert resultado == []


@pytest.mark.asyncio
async def test_buscar_por_categoria(product_service):
    resultado = await product_service.buscar_por_categoria("Fresco")
    assert [p["id"] for p in resultado] == ["hawas"]


@pytest.mark.asyncio
async def test_buscar_por_categoria_sin_productos(product_service):
    # "Oriental" existe en la lista de categorías pero ningún producto la usa.
    resultado = await product_service.buscar_por_categoria("Oriental")
    assert resultado == []


@pytest.mark.asyncio
async def test_obtener_marcas(product_service):
    marcas = await product_service.obtener_marcas()
    assert marcas == ["Lattafa", "Rasasi"]


@pytest.mark.asyncio
async def test_buscar_por_marca(product_service):
    resultado = await product_service.buscar_por_marca("lattafa")  # case-insensitive
    assert {p["id"] for p in resultado} == {"khamrah", "yara"}


@pytest.mark.asyncio
async def test_obtener_notas(product_service):
    notas = await product_service.obtener_notas()
    assert "canela" in notas
    assert "vainilla" in notas
    assert "almizcle" in notas


@pytest.mark.asyncio
async def test_buscar_por_nota(product_service):
    # "canela" aparece en Khamrah (salida) y en Hawas (corazón)
    resultado = await product_service.buscar_por_nota("canela")
    assert {p["id"] for p in resultado} == {"khamrah", "hawas"}


@pytest.mark.asyncio
async def test_obtener_recomendaciones_prioriza_marca_y_categoria(product_service):
    khamrah = PRODUCTOS_FALSOS[0]  # Lattafa, Dulce
    recomendaciones = await product_service.obtener_recomendaciones(khamrah, limite=3)

    # No debe recomendarse a sí mismo
    assert all(r["id"] != "khamrah" for r in recomendaciones)
    # Yara comparte marca (Lattafa) con Khamrah, así que debe aparecer
    assert any(r["id"] == "yara" for r in recomendaciones)
