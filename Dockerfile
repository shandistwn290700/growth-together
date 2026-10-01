# ---------- 1. Build tampilan React ----------
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- 2. Server produksi ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist

USER node
EXPOSE 3000
# Jalankan migrasi database dulu (aman diulang), lalu nyalakan server.
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node bin/www.js"]
