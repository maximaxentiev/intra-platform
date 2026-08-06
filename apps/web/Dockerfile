# --- Build stage (TanStack Start + Nitro node-server) ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

ARG NITRO_PRESET=node-server
# Same-origin API by default ("" => browser calls /api on the same host).
ARG VITE_API_URL=""
ARG VITE_CARER_PORTAL_ENABLED=false
ENV NITRO_PRESET=${NITRO_PRESET}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CARER_PORTAL_ENABLED=${VITE_CARER_PORTAL_ENABLED}

RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
