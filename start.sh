#!/bin/bash
cd backend
if [ -f "/app/.venv/bin/python" ]; then
  /app/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
else
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
fi
