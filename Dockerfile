# ── Stage 1: Build the frontend ──────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install ALL dependencies (workspaces)
RUN npm ci

# Copy source code
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend
RUN npm run build --workspace=frontend

# ── Stage 2: Production image ───────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy backend package files and root workspace config
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install only backend production dependencies
RUN npm ci --workspace=backend --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 5000

CMD ["node", "server.js"]
