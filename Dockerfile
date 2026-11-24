# --- 1. збірка: перевірка типів і бандл веб-клієнта ---
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- 2. запуск: лише Node, без node_modules (у сервера немає runtime-залежностей) ---
FROM node:26-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/data ./data
COPY --from=build /app/dist ./dist
RUN mkdir -p checkpoints && chown node:node checkpoints
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server/index.ts"]
