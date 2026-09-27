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

# Respuesta que devuelve el chatbot
class ChatResponse(BaseModel):
    response: str = Field(
        ...,
        description="Respuesta generada por el chatbot."
    )