# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 8000

# Apply migrations, then boot the API.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]
