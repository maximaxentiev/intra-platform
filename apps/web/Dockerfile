# --- Build stage (TanStack Start + Nitro node-server) ---
# Use glibc (Debian) — Vite/Rolldown/Tailwind native bindings target linux-gnu, not Alpine musl.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Monorepo install from the committed lockfile (reproducible; no accidental platform-only direct deps).
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@intra/web --workspace=@intra/shared --include-workspace-root=false --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /app/apps/web

ARG NITRO_PRESET=node-server
# Same-origin API by default ("" => browser calls /api on the same host).
ARG VITE_API_URL=""
ARG VITE_CARER_PORTAL_ENABLED=false
ENV NITRO_PRESET=${NITRO_PRESET}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CARER_PORTAL_ENABLED=${VITE_CARER_PORTAL_ENABLED}

RUN npm run build

# --- Runtime stage (bundled Nitro output — no Rolldown at runtime) ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
