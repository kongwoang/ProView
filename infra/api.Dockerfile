FROM node:24.21.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.34.6
WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate && pnpm --filter @proview/api build

FROM build AS runner
ENV NODE_ENV=production
RUN mkdir -p /app/.data/files && chown -R node:node /app
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
