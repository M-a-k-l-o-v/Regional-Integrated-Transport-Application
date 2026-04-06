# Backend — Node.js + Express + Prisma
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled source
COPY Src ./Src
COPY tsconfig.json ./

# Build TypeScript
RUN npx tsc -p tsconfig.json

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
