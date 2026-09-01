# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl is required by the Prisma engines on Debian.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---- build: install the workspace and compile ----
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @bn/money build \
  && pnpm --filter @bn/shared-types build \
  && pnpm --filter @bn/api exec prisma generate \
  && pnpm --filter @bn/api build

# ---- dev: source is bind-mounted by docker-compose ----
FROM build AS dev
EXPOSE 3001
CMD ["pnpm", "--filter", "@bn/api", "start:dev"]

# ---- prod: compiled artefact + full node_modules (Prisma engine, argon2) ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
