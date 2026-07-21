# ---------- STAGE 1: Builder ---------------
FROM node:20-alpine3.23 AS builder

RUN apk upgrade --no-cache

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (minimal change: replace npm ci)
RUN npm install --production \
    && npm cache clean --force

# Copy app code
COPY . .

# ---------- STAGE 2: Production ---------
FROM node:20-alpine3.23

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=builder /app ./

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]