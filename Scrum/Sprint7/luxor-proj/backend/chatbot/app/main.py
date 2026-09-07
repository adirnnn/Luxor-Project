import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.bot.router import router as chat_router

app = FastAPI(
    title="Luxor Chatbot API",
    description="API del chatbot experto en perfumes para HABIBI PARFUMS",
    version="1.0.0"
)

# origenes permitidos para cors. en local sirven los de siempre; en produccion
# hay que agregar la url del frontend en vercel. se pasan por la variable
# CHATBOT_ALLOWED_ORIGINS separados por coma, por ejemplo:
#   CHATBOT_ALLOWED_ORIGINS=https://mi-frontend.vercel.app
default_origins = "http://localhost:5173,http://localhost:3000"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("CHATBOT_ALLOWED_ORIGINS", default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)

@app.get("/")
async def root():
    return {"message": "El API del chatbot está funcionando correctamente."}