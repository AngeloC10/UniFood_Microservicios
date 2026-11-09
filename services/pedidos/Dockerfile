FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci --omit=dev
COPY . .
EXPOSE 3004
ENV NODE_ENV=production
CMD ["node", "index.js"]
