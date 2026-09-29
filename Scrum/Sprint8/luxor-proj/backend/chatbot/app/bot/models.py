from enum import Enum

from pydantic import BaseModel, Field, field_validator

# Roles válidos
class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

# Mensaje de una conversación
class ChatMessage(BaseModel):
    role: MessageRole = Field(
        ...,
        description="Rol del mensaje en la conversación."
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Contenido del mensaje."
    )

# Petición de chat enviada por el usuario
class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        # SFTWRKEY-379: límite para evitar abuso del LLM (costo) y prompts de inyección largos.
        max_length=500,
        description="Mensaje enviado por el usuario."
    )

    # SFTWRKEY-352: min_length=1 solo bloquea strings vacíos (""), pero un mensaje
    # de puros espacios (" ") tiene longitud > 0 y pasaba la validación sin problema.
    # Aquí quitamos los espacios de los extremos y rechazamos si queda vacío.
    @field_validator("message")
    @classmethod
    def message_no_puede_ser_solo_espacios(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El mensaje no puede estar vacío ni contener solo espacios.")
        return cleaned

    # SFTWRKEY-393: últimos mensajes de la conversación, para entender seguimientos
    # como "¿y cuánto cuesta?". Es opcional: las peticiones sin historial siguen igual.
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=10,
        description="Mensajes anteriores de la conversación (solo user y assistant)."
    )

    @field_validator("history")
    @classmethod
    def history_solo_user_y_assistant(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        for mensaje in value:
            # El cliente nunca puede mandar instrucciones de sistema (prompt injection).
            if mensaje.role == MessageRole.SYSTEM:
                raise ValueError("El historial solo puede tener mensajes de user o assistant.")
            if len(mensaje.content) > 1000:
                raise ValueError("Cada mensaje del historial puede tener hasta 1000 caracteres.")
        return value

# Respuesta que devuelve el chatbot
class ChatResponse(BaseModel):
    response: str = Field(
        ...,
        description="Respuesta generada por el chatbot."
    )