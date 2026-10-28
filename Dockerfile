# Builder
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma7.config.ts ./

RUN npm ci
RUN npx prisma generate

COPY src ./src

RUN npm prune --omit=dev

# Runner
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./
COPY --from=builder /app/src ./src

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
