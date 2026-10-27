# SFTWRKEY-393: detección de intención por palabras clave, antes del flujo de productos.
# Es determinista y no llama al LLM, así que saludos y despedidas responden al instante.
import random
import re
import unicodedata
from enum import Enum


class Intencion(str, Enum):
    SALUDO = "saludo"
    AGRADECIMIENTO = "agradecimiento"
    DESPEDIDA = "despedida"
    AYUDA = "ayuda"
    INFO_TIENDA = "info_tienda"
    PEDIDO = "pedido"
    PRODUCTO = "producto"


# Frases ya normalizadas (minúsculas, sin tildes ni signos).
SALUDOS = [
    "buenos dias", "buenas tardes", "buenas noches", "buen dia", "que tal",
    "hola", "holi", "buenas", "hey", "saludos", "hello", "hi",
]
AGRADECIMIENTOS = ["muchas gracias", "mil gracias", "te agradezco", "gracias", "thank you", "thanks"]
DESPEDIDAS = ["hasta luego", "hasta pronto", "nos vemos", "adios", "chao", "chau", "bye"]
AYUDA = [
    "que puedes hacer", "que sabes hacer", "en que me ayudas", "en que me puedes ayudar",
    "como funciona", "como te uso", "que haces", "ayuda", "ayudame",
]
INFO_TIENDA = [
    "envio", "envios", "enviar", "envian", "entrega", "entregas", "domicilio", "delivery",
    "pago", "pagos", "pagar", "tarjeta", "efectivo", "transferencia",
    "horario", "horarios", "abren", "cierran", "abierto",
    "ubicacion", "ubicados", "direccion", "donde estan", "donde queda", "tienda fisica",
    "local", "locales", "sucursal", "sucursales",
    "contacto", "telefono", "whatsapp", "instagram",
    "devolucion", "devoluciones", "cambio", "cambios", "garantia",
    "originales", "original", "autenticos", "autentico", "autenticidad",
]

# SFTWRKEY-458: preguntas por el estado de un pedido. "quiero hacer un pedido" no entra: eso es comprar.
PEDIDO = [
    "mi pedido", "mis pedidos", "mi orden", "mis ordenes", "numero de pedido", "numero de orden",
    "estado del pedido", "estado de mi", "rastrear", "rastreo", "seguimiento",
    "donde esta mi", "cuando llega mi", "ya enviaron mi", "ya salio mi",
]
CORREO_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# primero un número que venga después de "pedido", "orden", "#" o "número"; si no, cualquier número
NUMERO_CON_PALABRA_REGEX = re.compile(r"(?:pedido|orden|#|n[uú]mero|no\.)\s*(?:#|n[uú]mero|no\.)?\s*(\d{1,9})\b", re.IGNORECASE)
NUMERO_REGEX = re.compile(r"\b(\d{1,9})\b")

# Los mensajes cortos se tratan como conversación; los largos casi siempre traen una consulta.
MAX_PALABRAS_CORTESIA = 6

PLANTILLAS = {
    Intencion.SALUDO: [
        "¡Hola! Soy el asistente de Perfumería Victoria, ¿en qué te puedo ayudar? "
        "Puedo recomendarte perfumes, contarte de sus notas y precios, o resolver dudas sobre envíos y pagos.",
        "¡Hola! Bienvenido a Perfumería Victoria. ¿Buscas algún perfume en especial o quieres una recomendación?",
    ],
    Intencion.AGRADECIMIENTO: [
        "¡Con gusto! ¿Hay algo más en lo que te pueda ayudar?",
        "¡Para eso estoy! Si quieres, te recomiendo otro perfume o te ayudo con tu compra.",
    ],
    Intencion.DESPEDIDA: [
        "¡Gracias por visitar Perfumería Victoria! Que tengas un excelente día.",
        "¡Hasta pronto! Aquí estaré cuando quieras buscar tu próxima fragancia.",
    ],
    Intencion.AYUDA: [
        "Puedo ayudarte a encontrar perfumes por nombre, marca, categoría o nota aromática, "
        "recomendarte fragancias parecidas y responder dudas sobre envíos, pagos y nuestros locales. "
        "Por ejemplo: \"¿Tienen Khamrah?\", \"Recomiéndame algo dulce\" o \"¿Cómo son los envíos?\"."
    ],
}


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes, sin signos de puntuación y con espacios simples."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto.casefold())
        if unicodedata.category(c) != "Mn"
    )
    solo_palabras = re.sub(r"[^\w\s]", " ", sin_tildes)
    return re.sub(r"\s+", " ", solo_palabras).strip()


def _contiene(texto: str, frases: list[str]) -> bool:
    # Coincidencia por palabra completa: "cambio" no debe coincidir dentro de otra palabra.
    return any(re.search(rf"\b{re.escape(frase)}\b", texto) for frase in frases)


def separar_saludo(mensaje: str) -> tuple[bool, str]:
    """Si el mensaje empieza con un saludo, devuelve (True, resto sin el saludo)."""
    texto = normalizar(mensaje)
    for saludo in SALUDOS:
        if texto == saludo or texto.startswith(saludo + " "):
            return True, texto[len(saludo):].strip()
    return False, texto


def detectar_intencion(mensaje: str) -> Intencion:
    texto = normalizar(mensaje)
    saludo, resto = separar_saludo(mensaje)
    palabras = len(texto.split())

    if saludo and not resto:
        return Intencion.SALUDO
    # antes que las cortesías: "gracias, ¿dónde está mi pedido?" es una consulta de pedido
    if _contiene(texto, PEDIDO) or re.search(r"\b(pedido|orden) \d+\b", texto):
        return Intencion.PEDIDO
    if palabras <= MAX_PALABRAS_CORTESIA:
        if _contiene(texto, AGRADECIMIENTOS):
            return Intencion.AGRADECIMIENTO
        if _contiene(texto, DESPEDIDAS):
            return Intencion.DESPEDIDA
        if _contiene(texto, AYUDA):
            return Intencion.AYUDA
    if _contiene(texto, INFO_TIENDA):
        return Intencion.INFO_TIENDA
    return Intencion.PRODUCTO


def plantilla_para(intencion: Intencion) -> str:
    return random.choice(PLANTILLAS[intencion])


def extraer_datos_pedido(mensaje: str) -> tuple[int | None, str | None]:
    """SFTWRKEY-458: devuelve (número de pedido, correo) si vienen en el mensaje."""
    correo = CORREO_REGEX.search(mensaje)
    # el correo se quita antes de buscar el número (ana15@... no es el pedido 15)
    sin_correo = CORREO_REGEX.sub(" ", mensaje)
    numero = NUMERO_CON_PALABRA_REGEX.search(sin_correo) or NUMERO_REGEX.search(sin_correo)
    return (
        int(numero.group(1)) if numero else None,
        correo.group(0).lower() if correo else None,
    )


def ocultar_correos(texto: str) -> str:
    """Para el registro de consultas: el correo del cliente no se guarda."""
    return CORREO_REGEX.sub("[correo]", texto)
