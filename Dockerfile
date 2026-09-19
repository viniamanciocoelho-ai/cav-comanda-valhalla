FROM oven/bun:1.3.14 AS dependencies

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages/web/package.json packages/web/package.json
COPY packages/desktop/package.json packages/desktop/package.json
COPY packages/mobile/package.json packages/mobile/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build

COPY . .
RUN bun run build:web

FROM oven/bun:1.3.14 AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json bun.lock turbo.json ./
COPY packages/web/package.json packages/web/package.json
COPY packages/desktop/package.json packages/desktop/package.json
COPY packages/mobile/package.json packages/mobile/package.json
RUN bun install --frozen-lockfile --production

COPY --from=build --chown=bun:bun /app/packages/web/dist packages/web/dist
COPY --chown=bun:bun packages/web/src/api packages/web/src/api
COPY --chown=bun:bun packages/web/src/web/lib packages/web/src/web/lib
COPY --chown=bun:bun packages/web/src/server.ts packages/web/src/server.ts
COPY --chown=bun:bun packages/web/src/__server.ts packages/web/src/__server.ts
COPY --chown=bun:bun packages/web/drizzle packages/web/drizzle
COPY --chown=bun:bun packages/web/scripts packages/web/scripts
COPY --chown=bun:bun deploy/docker-entrypoint.sh deploy/docker-entrypoint.sh

RUN chmod +x deploy/docker-entrypoint.sh \
  && mkdir -p /app/.data /app/backups \
  && chown -R bun:bun /app/.data /app/backups

USER bun

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const response = await fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health/ready'); if (!response.ok) process.exit(1)"

CMD ["sh", "deploy/docker-entrypoint.sh"]
