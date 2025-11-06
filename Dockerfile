# ---- Base
FROM oven/bun:1.1-alpine AS base
WORKDIR /usr/src/app
COPY package.json bun.lockb* ./

# ---- Dev deps (has node_modules incl. devDependencies)
FROM base AS dev_deps
RUN bun install --frozen-lockfile

# ---- Build TS -> dist
FROM base AS build
COPY --from=dev_deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Runtime (prod)
FROM base AS release
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package.json bun.lockb* ./

# install only production deps for a smaller image
RUN bun install --frozen-lockfile --production
COPY --from=build /usr/src/app/dist ./dist

# Copy drizzle config & schema for the migrator
COPY drizzle.config.ts ./drizzle.config.ts
COPY src/db ./src/db

EXPOSE 3000

CMD ["bun", "dist/src/main.js"]
