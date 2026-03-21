FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
COPY web/package.json ./web/
RUN bun install --frozen-lockfile 2>/dev/null || bun install
RUN cd web && bun install --frozen-lockfile 2>/dev/null || cd web && bun install

# Build frontend
FROM deps AS build-web
COPY web/ ./web/
RUN cd web && bun run build

# Production image
FROM base AS runner
COPY package.json bun.lockb* ./
RUN bun install --production --frozen-lockfile 2>/dev/null || bun install --production

COPY src/ ./src/
COPY --from=build-web /app/web/dist ./web/dist

# Create data directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8484
ENV DATA_DIR=/app/data

EXPOSE 8484

VOLUME ["/app/data", "/app/custom-integrations"]

CMD ["bun", "run", "src/index.ts"]
