# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production dependencies
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

# Stage 3: Runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
