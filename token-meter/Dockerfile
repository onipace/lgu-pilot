# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --production

# ── Stage 2: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
RUN addgroup --system --gid 1001 tokenmeter && \
    adduser --system --uid 1001 tokenmeter && \
    mkdir -p /data && chown tokenmeter:tokenmeter /data
USER tokenmeter
EXPOSE 3084
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3084/health || exit 1
CMD ["node", "src/server.js"]
