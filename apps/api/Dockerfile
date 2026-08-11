# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@intra/api --workspace=@intra/shared --include-workspace-root=false --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@intra/api --workspace=@intra/shared --include-workspace-root=false --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/drizzle ./drizzle

EXPOSE 8000

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]
