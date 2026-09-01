# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS dev
COPY . .
RUN pnpm --filter @bn/shared-types build
EXPOSE 3000
CMD ["pnpm", "--filter", "@bn/web", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter @bn/shared-types build && pnpm --filter @bn/web build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@bn/web", "start"]
