# syntax=docker/dockerfile:1

# Этап сборки: устанавливаем инструменты и компилируем TypeScript.
FROM node:20-alpine AS builder

WORKDIR /app

# Отдельное копирование манифестов сохраняет кэш npm при изменении исходников.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Финальный runtime-образ содержит только production-зависимости и dist.
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && rm -rf /root/.npm

COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node
CMD ["node", "dist/src/server.js"]
