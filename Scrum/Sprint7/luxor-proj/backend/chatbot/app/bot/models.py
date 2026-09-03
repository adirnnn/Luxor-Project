from enum import Enum

from pydantic import BaseModel, Field

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

# Respuesta que devuelve el chatbot
class ChatResponse(BaseModel):
    response: str = Field(
        ...,
        description="Respuesta generada por el chatbot."
    )