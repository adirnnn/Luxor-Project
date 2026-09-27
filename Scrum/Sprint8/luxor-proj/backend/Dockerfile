FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000

# forma "shell" para que se pueda encadenar el seed antes del server. seed.js
# es idempotente (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING).
# render corre el command con exec, no con shell, asi que el "&&" tiene que
# ir dentro de un "sh -c" explicito (mismo patron que el Dockerfile del chatbot).
CMD ["sh", "-c", "node seed.js && node server.js"]