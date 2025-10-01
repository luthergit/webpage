# Multi-stage build for Vite React app using pnpm and Nginx

# ---- Builder ----
FROM node:22-alpine AS builder

# Prefer pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install deps (use lockfile when present)
COPY package.json package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else pnpm install; fi

# Copy source
COPY . .

# Build
RUN pnpm build || npm run build


# ---- Runner ----
FROM nginx:1.27-alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Provide a default nginx config optimized for single-page apps
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  listen [::]:80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
NGINX_CONF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


