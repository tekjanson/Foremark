# ── Foremark container image ────────────────────────────────────────────────
# Minimal Alpine-based Node image running as an unprivileged user.
FROM node:22-alpine

# better-sqlite3 needs a build toolchain to compile its native addon.
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source.
COPY server ./server
COPY public ./public

# Persistent data directory (mounted as a volume in compose).
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
