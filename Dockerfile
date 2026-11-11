# syntax=docker/dockerfile:1

# ---- Build -----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public values are baked into the static HTML at build time.
ARG SITE_URL=https://cherrycreek.app
ARG PUBLIC_SERVER_ADDRESS=play.cherrycreek.app
ARG PUBLIC_MAP_URL=https://map.cherrycreek.app
ARG PUBLIC_DISCORD_URL=https://discord.gg/dRxSt8Bt9t
ENV SITE_URL=$SITE_URL \
    PUBLIC_SERVER_ADDRESS=$PUBLIC_SERVER_ADDRESS \
    PUBLIC_MAP_URL=$PUBLIC_MAP_URL \
    PUBLIC_DISCORD_URL=$PUBLIC_DISCORD_URL \
    ASTRO_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Runtime ---------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    ASTRO_TELEMETRY_DISABLED=1

# The build bundles its server dependencies, so dist/ is all that is needed.
COPY --from=build /app/dist ./dist

# The image's built-in unprivileged user.
USER node
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/entry.mjs"]
