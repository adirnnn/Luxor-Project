FROM node:20
WORKDIR /app
# SFTWRKEY-380: modo producción (Express no muestra stack traces) y solo dependencias
# de producción, instaladas exactamente como dice package-lock.json.
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
# SFTWRKEY-380: el proceso no corre como root.
USER node

# forma "shell" para que se pueda encadenar el seed antes del server. seed.js
# es idempotente (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING).
# render corre el command con exec, no con shell, asi que el "&&" tiene que
# ir dentro de un "sh -c" explicito (mismo patron que el Dockerfile del chatbot).
CMD ["sh", "-c", "node seed.js && node server.js"]
