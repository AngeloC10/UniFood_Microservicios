
FROM node:24-alpine

WORKDIR /app

# Instalar herramientas para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar código fuente
COPY src ./src

ENV NODE_ENV=production

CMD ["node", "src/index.js"]

