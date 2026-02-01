# Multi-stage build for frontend + backend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies with fix for Rollup platform-specific modules
# See: https://github.com/npm/cli/issues/4828
RUN rm -f package-lock.json && npm install --legacy-peer-deps

# Copy source files
COPY frontend/ ./

# Build args for Vite environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BACKEND_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Build frontend
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

EXPOSE 8080

WORKDIR /app/backend

# Railway sets PORT env var automatically
# Using exec form to avoid shell issues
ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0"]
CMD ["--port", "8080"]

# Force rebuild: 2026-02-01T12:40:00Z
