# syntax=docker/dockerfile:1

# Books Manager front-end image (issue #53): two stages, so the final image has only Nginx and the static build.
# Build: docker build -t booksmanager-web .   Run: docker run --rm -p 8080:8080 booksmanager-web
# The image only serves the files. It expects a reverse proxy in front that sends /api/ to the API on the same origin
# (the front-end calls /api/... with relative URLs, and the refresh cookie is SameSite=Strict); see "Produção" in the README.

# --- Build: Node 22 (the version the CI uses) ----------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /workspace

# The dependencies first, in their own layer: they change far less often than the source, so a change in src/ does
# not install them again. The npm cache is also kept in a build cache.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# The checks (lint, typecheck, tests) run in the CI before the image is built, so they are not repeated here. The type
# check of "npm run build" still runs. VITE_API_URL is deliberately NOT set: the bundle then calls /api/... on whatever
# host serves it, so no host is ever baked into the image.
COPY . .
RUN npm run build

# --- Run: Nginx with no privileges (listens on 8080, runs as the "nginx" user) ------------------------
FROM nginxinc/nginx-unprivileged:1.28-alpine

LABEL org.opencontainers.image.title="Books Manager front-end" \
      org.opencontainers.image.source="https://github.com/Riverfount/booksmanager-web"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 8080

# Healthy when Nginx answers its own /healthz (a static answer: the image has no dependency to check).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/healthz || exit 1
