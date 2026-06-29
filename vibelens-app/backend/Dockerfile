# ============================================================
# VibeLens AI Backend — production container image
# Build:  docker build -t vibelens-backend .
# Run:    docker run -p 8080:8080 --env-file .env vibelens-backend
# ============================================================
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY firestore.rules ./firestore.rules

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/server.js"]
