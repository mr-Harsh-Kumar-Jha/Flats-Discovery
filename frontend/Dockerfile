# ===========================================================================
# React Frontend — Multi-stage Dockerfile
# ===========================================================================
# Targets:
#   development  — Vite dev server with HMR
#   production   — Static build served by nginx
# ===========================================================================

# ---------------------------------------------------------------------------
# Stage: development
# ---------------------------------------------------------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Copy dependency files first (Docker layer caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source (overridden by volume mount in docker-compose)
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Stage: builder (for production)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage: production
# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: redirect all paths to index.html
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
