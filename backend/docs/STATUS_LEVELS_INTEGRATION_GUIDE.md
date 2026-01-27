# Status Levels API - Integration Guide

## Quick Start

This guide shows how to integrate the Status Levels API routes into your FastAPI application.

## Step 1: Import Routes

Add these imports to your main application file (typically `backend/app/main.py` or `backend/app/__init__.py`):

```python
from app.api.routes.status_levels import (
    router as status_router,
    public_router as status_public_router,
    admin_router as status_admin_router
)
```

## Step 2: Register Routes

Register the three routers with your FastAPI app:

```python
# In your FastAPI app initialization
from fastapi import FastAPI

app = FastAPI()

# Register Status Levels routers
app.include_router(status_public_router)  # Public routes (no auth)
app.include_router(status_router)         # Authenticated routes
app.include_router(status_admin_router)   # Admin routes
```

## Step 3: Verify Installation

### Check Routes
Start your development server and verify routes are registered:

```bash
# Start server
uvicorn app.main:app --reload

# In another terminal, check routes
curl http://localhost:8000/api/status-levels/info
```

Expected response: JSON with status levels information.

### Check OpenAPI Docs
Visit: `http://localhost:8000/docs`

You should see all Status Levels endpoints organized under these tags:
- `status-levels` - Public and authenticated endpoints
- `admin-status-levels` - Admin-only endpoints

## Step 4: Run Tests

```bash
# Run all status levels tests
pytest backend/tests/test_status_levels_api.py -v

# Run specific test
pytest backend/tests/test_status_levels_api.py::test_get_status_levels_info_public -v

# Run with coverage
pytest backend/tests/test_status_levels_api.py --cov=app.api.routes.status_levels --cov-report=html
```

## Router Structure

The `status_levels.py` module exports three routers:

### 1. `public_router`
- **Prefix:** `/api/status-levels`
- **Authentication:** None required
- **Endpoints:**
  - `GET /info` - Get public info about levels

### 2. `router`
- **Prefix:** `/api/organizations`
- **Authentication:** Optional (session cookie)
- **Endpoints:**
  - `GET /{org_id}/status` - Get organization status
  - `POST /{org_id}/status-upgrade-request` - Request upgrade (requires auth)
  - `GET /{org_id}/status-history` - Get history (requires auth)

### 3. `admin_router`
- **Prefix:** `/api/admin/organizations`
- **Authentication:** Required (platform admin only)
- **Endpoints:**
  - `POST /{org_id}/status-levels` - Grant level
  - `DELETE /{org_id}/status-levels/{level}` - Revoke level

## Complete Integration Example

Here's a complete example of integrating into your app:

```python
# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import existing routers
from app.api.routes import (
    auth,
    organizations,
    reviews,
    # ... other routes
)

# Import new Status Levels routers
from app.api.routes.status_levels import (
    router as status_router,
    public_router as status_public_router,
    admin_router as status_admin_router
)

# Create FastAPI app
app = FastAPI(
    title="Chestno.ru API",
    version="1.0.0",
    description="Platform for transparent business practices"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register existing routers
app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(reviews.router)
# ... other existing routes

# Register Status Levels routers
app.include_router(status_public_router, tags=["status-levels"])
app.include_router(status_router, tags=["status-levels"])
app.include_router(status_admin_router, tags=["admin-status-levels"])

@app.get("/")
async def root():
    return {"message": "Chestno.ru API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

## Middleware Configuration

The Status Levels routes use these dependencies:

### 1. Session Authentication
From `app.core.session_deps`:
```python
from app.core.session_deps import get_current_user_id_from_session
```

Ensure your session middleware is configured:
- Cookie name: `session_id` (or as configured in `settings.session_cookie_name`)
- Secure: `True` in production
- HttpOnly: `True`
- SameSite: `Lax`

### 2. Admin Guard
From `app.services.admin_guard`:
```python
from app.services.admin_guard import assert_platform_admin
```

Ensure admin users have:
- `role='admin'` in `app_profiles` table, OR
- Record in `platform_roles` table with `role='platform_admin'`

## Environment Variables

No new environment variables needed! The Status Levels API uses existing configuration:

```env
# Existing database configuration
DATABASE_URL=postgresql://...

# Existing session configuration
SESSION_COOKIE_NAME=session_id
SESSION_SECRET_KEY=...

# Existing Supabase configuration (for auth)
SUPABASE_URL=...
SUPABASE_KEY=...
```

## Database Requirements

Ensure these database objects exist (should already be deployed):

### Tables
- `organization_status_levels`
- `organization_status_history`
- `status_upgrade_requests`
- `organization_members`
- `app_profiles`

### Functions
- `get_current_status_level(uuid)`
- `check_level_c_criteria(uuid)`
- `grant_status_level(...)`
- `revoke_status_level(...)`

To verify:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%status%';
```

## Testing the Integration

### 1. Test Public Endpoint
```bash
curl http://localhost:8000/api/status-levels/info | jq
```

Expected: JSON with level information.

### 2. Test Authenticated Endpoint
```bash
# First, get a session cookie by logging in
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# Then use the session
curl http://localhost:8000/api/organizations/{org_id}/status \
  -b cookies.txt
```

### 3. Test Admin Endpoint
```bash
# Login as admin
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  -c admin_cookies.txt

# Grant status level
curl -X POST http://localhost:8000/api/admin/organizations/{org_id}/status-levels \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{
    "level": "B",
    "notes": "Test grant"
  }'
```

## Troubleshooting

### Issue: 404 Not Found on all routes
**Cause:** Routers not registered or incorrect prefix

**Solution:** Check that all three routers are included:
```python
app.include_router(status_public_router)
app.include_router(status_router)
app.include_router(status_admin_router)
```

### Issue: 401 Unauthorized on authenticated routes
**Cause:** Session cookie not being sent or invalid

**Solution:**
1. Check cookie is present: `curl ... -b cookies.txt -v`
2. Verify session is valid in database
3. Check `SESSION_COOKIE_NAME` matches

### Issue: 403 Forbidden on admin routes
**Cause:** User doesn't have admin role

**Solution:** Grant admin role to user:
```sql
-- Option 1: Set role in app_profiles (Auth V2)
UPDATE app_profiles
SET role = 'admin'
WHERE email = 'admin@example.com';

-- Option 2: Add to platform_roles (legacy)
INSERT INTO platform_roles (user_id, role)
VALUES ('user-uuid', 'platform_admin');
```

### Issue: Import errors
**Cause:** Missing dependencies or incorrect paths

**Solution:**
1. Verify service layer exists: `backend/app/services/status_levels.py`
2. Check schemas exist: `backend/app/schemas/status_levels.py`
3. Reinstall dependencies: `pip install -r requirements.txt`

## Next Steps

After successful integration:

1. **Deploy to staging** - Test in staging environment
2. **Monitor logs** - Watch for `[status_levels]` log entries
3. **Set up monitoring** - Track API performance metrics
4. **Update frontend** - Integrate with UI components
5. **Document for users** - Create user-facing documentation
6. **Load testing** - Verify performance under load

## Support

For issues or questions:
- Check logs: Look for `[status_levels]` prefix
- Review tests: `backend/tests/test_status_levels_api.py`
- Read spec: `C:\Dev\_OpsVault\Chestno.ru\Docs\specs\SPEC_Status_Levels_v1.md`
- API docs: `backend/docs/status_levels_api.yaml`
