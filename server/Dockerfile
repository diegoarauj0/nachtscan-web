FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ARG PORT=3000
ARG REDIS_HOST=localhost
ARG REDIS_PORT=6379
ARG REDIS_USERNAME=
ARG REDIS_PASSWORD=
ARG ENABLED_SOURCES=github,gitlab,codeberg,devto,osu,minecraft,mastodon,bluesky
ARG GITHUB_TOKEN=
ARG GITLAB_TOKEN=
ARG CODEBERG_TOKEN=
ARG DEVTO_TOKEN=
ARG OSU_CLIENT_ID=
ARG OSU_CLIENT_SECRET=
ARG MASTODON_CLIENT_KEY=
ARG MASTODON_CLIENT_SECRET=

CMD ["npm", "run", "prod"]