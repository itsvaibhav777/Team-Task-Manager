# ── Stage 1: Build the frontend ──────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy all package files
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies
RUN npm install

# Copy source code
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend
RUN cd frontend && npx vite build

# ── Stage 2: Production image ───────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy backend package files
COPY backend/package.json ./backend/

# Install only backend production dependencies
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 5000

CMD ["node", "server.js"]
