# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps: install the whole workspace once ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/money/package.json packages/money/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

# ---- dev: source is bind-mounted by docker-compose ----
FROM deps AS dev
COPY . .
RUN pnpm --filter @bn/money build && pnpm --filter @bn/shared-types build
RUN pnpm --filter @bn/api prisma generate
EXPOSE 3001
CMD ["pnpm", "--filter", "@bn/api", "start:dev"]

# ---- build: compiled artefact for production ----
FROM deps AS build
COPY . .
RUN pnpm --filter @bn/money build \
  && pnpm --filter @bn/shared-types build \
  && pnpm --filter @bn/api prisma generate \
  && pnpm --filter @bn/api build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
