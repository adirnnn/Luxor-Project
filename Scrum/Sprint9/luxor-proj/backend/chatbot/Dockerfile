FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# se usa el puerto que da la plataforma (render setea $PORT), y si no existe
# se cae a 8000, que es el que usamos en local y en docker-compose.
# hace falta la forma "shell" del CMD para que se expanda la variable.
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]