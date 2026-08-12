# ═══════════════════════════════════
# eSANGGUNI — Production Dockerfile (PostgreSQL)
# ═══════════════════════════════════

# Stage 1: Builder — install deps + build Next.js
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Public URLs baked at build time (override with --build-arg)
ARG NEXT_PUBLIC_ELLA_URL=/ella
ARG NEXT_PUBLIC_OBRA_URL=/obra
ARG NEXT_PUBLIC_YALA_URL=/yala
ARG NEXT_PUBLIC_ESANGGUNI_URL=/
ENV NEXT_PUBLIC_ELLA_URL=$NEXT_PUBLIC_ELLA_URL
ENV NEXT_PUBLIC_OBRA_URL=$NEXT_PUBLIC_OBRA_URL
ENV NEXT_PUBLIC_YALA_URL=$NEXT_PUBLIC_YALA_URL
ENV NEXT_PUBLIC_ESANGGUNI_URL=$NEXT_PUBLIC_ESANGGUNI_URL

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production runner
# ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y curl openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

# Generated Prisma client
COPY --from=builder --chown=nextjs:nodejs /app/src/generated  ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma         ./prisma

# Prisma adapter + pg driver (not always in standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/adapter-pg   ./node_modules/@prisma/adapter-pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg                   ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string

USER nextjs

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", "server.js"]
