from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.bot.router import router as chat_router

app = FastAPI(
    title="Luxor Chatbot API",
    description="API del chatbot experto en perfumes para HABIBI PARFUMS",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", # Vite
        "http://localhost:3000" # React
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)

@app.get("/")
async def root():
    return {"message": "El API del chatbot está funcionando correctamente."}