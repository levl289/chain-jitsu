# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies against the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle.
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config (client-side routing + correct CSV mime).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Serve the compiled Angular app.
COPY --from=build /app/dist/web/browser /usr/share/nginx/html

EXPOSE 80

# Lightweight healthcheck for orchestrators (k8s can also use its own probes).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
