# Build stage
FROM node:22.12.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Serve stage
FROM caddy:2-alpine

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built site from builder
COPY --from=builder /app/dist /srv/dist

# Create non-root user
RUN addgroup -S portfolio && adduser -S portfolio -G portfolio

# Set ownership
RUN chown -R portfolio:portfolio /srv /etc/caddy /data /config

# Switch to non-root user
USER portfolio

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/404.html || exit 1

EXPOSE 80 443
