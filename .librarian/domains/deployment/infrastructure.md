# Deployment & Infrastructure

> Last updated: 2026-01-18
> Domain: deployment
> Keywords: railway, deploy, docker, environment, config, production

## Overview

The platform runs on Railway (backend) with Supabase (database/auth/storage).
Frontend can be deployed to Cloudflare Pages or served by backend.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Cloudflare     │     │    Railway      │
│  Pages          │────▶│    Backend      │
│  (Frontend)     │     │    (FastAPI)    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Supabase     │
                        │  - PostgreSQL   │
                        │  - Auth         │
                        │  - Storage      │
                        └─────────────────┘
```

---

## Railway Configuration

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "sh start.sh",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "sh start.sh"
healthcheckPath = "/api/health/"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
```

### start.sh
```bash
#!/bin/bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

---

## Docker Configuration

### Dockerfile (Multi-stage Build)
```dockerfile
# Multi-stage build for frontend + backend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
# IMPORTANT: Use --legacy-peer-deps for React 19 compatibility
RUN npm install --legacy-peer-deps
COPY frontend/ ./
# Build args for Vite environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BACKEND_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
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
ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0"]
CMD ["--port", "8080"]
```

### Frontend NPM Config (.npmrc)
```
# frontend/.npmrc
legacy-peer-deps=true
```
Required because React 19 has peer dependency conflicts with some packages (e.g., react-leaflet).

---

## Environment Variables

### Backend (Required)
```
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://...

# Application
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_URL=https://chestno.ru
ALLOWED_ORIGINS=https://chestno.ru,https://www.chestno.ru

# Session
SESSION_COOKIE_NAME=session_id
SESSION_MAX_AGE=86400

# Security
QR_IP_HASH_SALT=random-string
SOCIAL_LOGIN_SALT=random-string
SOCIAL_STATE_SECRET=random-string
```

### Backend (Optional)
```
# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Yandex OAuth
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...

# GeoIP
GEOIP_DB_PATH=/path/to/GeoLite2-City.mmdb
```

### Frontend
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKEND_URL=https://api.chestno.ru
VITE_VAPID_PUBLIC_KEY=...
```

---

## Local Development

### Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Scripts
- `start-local.ps1` - Start backend locally
- `scripts/apply_migrations.ps1` - Apply DB migrations

---

## Database Migrations

### Location
`supabase/migrations/` - Numbered SQL files

### Apply Migrations
```powershell
# Using Supabase CLI
supabase db push

# Or via script
.\scripts\apply_migrations.ps1
```

### Create Migration
1. Create SQL file: `0024_new_feature.sql`
2. Write SQL statements
3. Test locally
4. Apply to production

---

## Storage Setup

### Create Buckets
```powershell
.\scripts\create-storage-buckets.ps1
```

### Required Buckets
- `org-media` - Organization content
- `review-media` - Review attachments

### Bucket Policies
```sql
-- Public read
CREATE POLICY "Public read" ON storage.objects
FOR SELECT USING (bucket_id = 'org-media');

-- Authenticated write
CREATE POLICY "Auth write" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'org-media' AND
    auth.role() = 'authenticated'
);
```

---

## Health Checks

### Endpoints
- `GET /api/health/` - Full check (DB + Supabase)
- `GET /api/health/db` - Database only
- `GET /api/health/supabase` - Supabase only

### Railway Health Check
Configured in `railway.toml`:
```toml
healthcheckPath = "/api/health/"
healthcheckTimeout = 100
```

---

## Deployment Workflow

### Backend (Railway)
1. Push to `main` branch
2. Railway auto-deploys
3. Runs `start.sh`
4. Health check validates

### Frontend (Cloudflare Pages)
1. Push to `main` branch
2. Cloudflare builds `npm run build`
3. Deploys `frontend/dist/`

### Manual Deploy
```powershell
# Railway CLI
railway up

# Or via git
git push origin main
```

---

## Monitoring

### Railway Dashboard
- Request logs
- Build logs
- Resource usage
- Environment variables

### Supabase Dashboard
- Database metrics
- Auth analytics
- Storage usage
- API logs

---

## Troubleshooting

### Common Issues

**Build fails:**
- Check `requirements.txt` versions
- Verify Python version (3.11+)

**Connection errors:**
- Verify `DATABASE_URL`
- Check Supabase status
- Validate connection pool settings

**Auth issues:**
- Verify `SUPABASE_JWT_SECRET`
- Check cookie settings
- Validate CORS origins

**Storage errors:**
- Verify bucket exists
- Check bucket policies
- Validate file permissions

---

## Documentation

### Existing Docs
- `docs/RAILWAY_DEPLOY_STATUS.md`
- `docs/RAILWAY_BUILD_FIX.md`
- `docs/RAILWAY_DEPLOY_FIX.md`
- `docs/SUPABASE_VERIFICATION_REPORT.md`
- `docs/setup-storage-buckets.md`
