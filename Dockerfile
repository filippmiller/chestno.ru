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
COPY start.sh ./start.sh

# Make start.sh executable
RUN chmod +x start.sh

EXPOSE 8080

CMD ["/bin/bash", "/app/start.sh"]

