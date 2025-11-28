# Multi-stage build for frontend + backend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
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

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

