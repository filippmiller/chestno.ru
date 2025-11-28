#!/bin/bash
# Use python3 from PATH (Railway/Nixpacks sets this up)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

