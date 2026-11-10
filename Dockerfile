FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node /data
WORKDIR /app

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN npm exec --yes --package bun@1.3.4 -- bun install --frozen-lockfile
COPY . .
RUN npm run db:generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=file:/data/shipos.db
COPY --chown=node:node --from=build /app/.next/standalone/ ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
