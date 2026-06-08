# ============================================================================
# RFS Station Manager — container image (Azure Container Apps hosting option)
# ----------------------------------------------------------------------------
# Multi-stage build. The backend (Express + Socket.io) also serves the built
# frontend SPA in production, so a single container runs the whole app.
#
# Runtime layout MUST keep backend/dist and frontend/dist as siblings under the
# working dir: index.ts resolves the SPA at __dirname/../../frontend/dist
# (i.e. /app/backend/dist -> /app/frontend/dist).
# ============================================================================

# ---- Build stage: full deps + compile both packages -----------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Toolchain for native modules (bcrypt) during the build stage only.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching).
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend

# Copy sources and build (tsc for backend + copies rfs-facilities.csv; vite for frontend).
COPY . .
RUN npm run build

# Drop dev dependencies from the backend, keeping the already-compiled native
# modules so the runtime stage needs no compiler.
RUN npm prune --omit=dev --prefix backend

# ---- Runtime stage: slim, production-only ---------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# Run as the built-in non-root node user.
USER node

# Prod backend deps + compiled output, and the built frontend (served by backend).
COPY --chown=node:node --from=build /app/backend/node_modules backend/node_modules
COPY --chown=node:node --from=build /app/backend/dist backend/dist
COPY --chown=node:node --from=build /app/backend/package.json backend/package.json
COPY --chown=node:node --from=build /app/frontend/dist frontend/dist

EXPOSE 8080

# index.ts resolves the SPA via __dirname, so cwd does not matter.
CMD ["node", "backend/dist/index.js"]
