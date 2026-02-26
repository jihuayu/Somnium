# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache libc6-compat && corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NOTION_INTEGRATION_TOKEN
ARG NOTION_DATA_SOURCE_ID
ARG NOTION_ACTIVE_USER
ARG NOTION_PAGE_ID
ARG NOTION_API_VERSION=2025-09-03
ENV NOTION_INTEGRATION_TOKEN=$NOTION_INTEGRATION_TOKEN
ENV NOTION_DATA_SOURCE_ID=$NOTION_DATA_SOURCE_ID
ENV NOTION_ACTIVE_USER=$NOTION_ACTIVE_USER
ENV NOTION_PAGE_ID=$NOTION_PAGE_ID
ENV NOTION_API_VERSION=$NOTION_API_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app ./
RUN rm -rf node_modules
COPY --from=prod-deps /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
