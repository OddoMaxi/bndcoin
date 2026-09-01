# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl: the workspace install runs the API's `prisma generate` postinstall.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---- build ----
FROM base AS build
# NEXT_PUBLIC_* are inlined by Next at build time, so they must be present here.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_MOCK_ENABLED=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MOCK_ENABLED=$NEXT_PUBLIC_MOCK_ENABLED
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @bn/shared-types build && pnpm --filter @bn/web build

# ---- dev: source is bind-mounted by docker-compose ----
FROM build AS dev
EXPOSE 3000
CMD ["pnpm", "--filter", "@bn/web", "dev"]

# ---- prod ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@bn/web", "start"]
