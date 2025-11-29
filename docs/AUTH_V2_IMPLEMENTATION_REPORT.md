# Auth V2 Implementation Report

## Summary
Implemented a new cookie-based authentication system (Auth V2) to replace token-based auth. The system uses httpOnly cookies for session management, implements role-based access control, and supports OAuth (Google/Yandex).

**Status:** Implementation complete, but login still not working. Needs debugging.

---

## What Was Implemented

### Backend Changes

#### 1. New API Routes (`backend/app/api/routes/auth_v2.py`)
- **POST `/api/auth/v2/login`** - Email/password login with cookie-based session
- **POST `/api/auth/v2/logout`** - Logout and clear session cookie
- **GET `/api/auth/v2/me`** - Get current user session data
- **GET `/api/auth/v2/session`** - Get current session info
- **POST `/api/auth/v2/oauth-callback`** - Handle OAuth callback (Google/Yandex)

#### 2. Session Management (`backend/app/services/sessions.py`)
- Creates and manages sessions in PostgreSQL `sessions` table
- 24-hour session expiry
- Refresh token hashing (SHA-256)
- Session cleanup on expiry

#### 3. Session Dependencies (`backend/app/core/session_deps.py`)
- `get_current_user_from_session()` - Extract user from session cookie
- `get_current_user_id_from_session()` - Get user ID from session

#### 4. Session Data Service (`backend/app/services/session_data.py`)
- `get_session_data_v2()` - Fetches user data from `app_profiles` table
- Returns user, organizations, memberships, platform_roles

#### 5. App Profiles Service (`backend/app/services/app_profiles.py`)
- `ensure_app_profile()` - Creates/updates user profile in `app_profiles` table
- Maps Supabase auth.users to app_profiles

#### 6. Auth Events Service (`backend/app/services/auth_events.py`)
- Login attempt logging
- Rate limiting (per IP/email)
- Auth event tracking

#### 7. Social Login V2 (`backend/app/api/routes/social_v2.py`)
- **GET `/api/auth/v2/yandex/start`** - Start Yandex OAuth flow
- **GET `/api/auth/v2/yandex/callback`** - Handle Yandex callback with cookie session

#### 8. Database Migration (`supabase/migrations/0020_auth_rebuild.sql`)
- Creates `app_profiles` table
- Creates `sessions` table
- Sets up RLS policies

#### 9. Main App Registration (`backend/app/main.py`)
- Added: `from app.api.routes.auth_v2 import router as auth_v2_router`
- Registered: `app.include_router(auth_v2_router)`
- Added: `from app.api.routes.social_v2 import router as social_v2_router`
- Registered: `app.include_router(social_v2_router)`

### Frontend Changes

#### 1. New Auth Provider (`frontend/src/auth/AuthProviderV2.tsx`)
- Replaces old `AuthProvider`
- Uses cookie-based sessions (no localStorage tokens)
- Methods:
  - `loginWithEmail(email, password)`
  - `signupWithEmail(email, password, fullName?)`
  - `loginWithGoogle()`
  - `loginWithYandex()`
  - `logout()`
  - `resetPassword(email)`
  - `refreshAuth()`

#### 2. Role-Based Protected Route (`frontend/src/auth/RoleProtectedRoute.tsx`)
- Protects routes based on user role (`admin`, `business_owner`, `user`)
- Redirects to appropriate dashboard based on role

#### 3. Updated App.tsx (`frontend/src/App.tsx`)
- Changed from `AuthProvider` to `AuthProviderV2`
- Changed from `useAuth()` to `useAuthV2()`
- Updated role checking logic

#### 4. Updated AuthPage (`frontend/src/auth/AuthPage.tsx`)
- Changed from `useAuth()` to `useAuthV2()`
- Uses new login methods

#### 5. Updated ProtectedRoute (`frontend/src/auth/ProtectedRoute.tsx`)
- Changed from `useAuth()` to `useAuthV2()`

#### 6. Updated AuthCallbackPage (`frontend/src/auth/AuthCallbackPage.tsx`)
- Handles OAuth callbacks
- Creates backend session via `/api/auth/v2/oauth-callback`

#### 7. Updated HTTP Client (`frontend/src/api/httpClient.ts`)
- Added `withCredentials: true` to axios config
- Ensures cookies are sent with requests

#### 8. Updated LandingHeader (`frontend/src/components/landing/LandingHeader.tsx`)
- Uses `isAuthenticated` prop from `AuthProviderV2`
- Updated login/register links to use React Router `Link`

#### 9. Updated Routes (`frontend/src/routes/index.tsx`)
- Added `RoleProtectedRoute` for admin routes
- Updated admin routes to use role-based protection

---

## Configuration Changes

### Backend `.env` Requirements
- `SUPABASE_JWT_SECRET` - **REQUIRED** (was missing, placeholder added)
- `SUPABASE_URL` - Already set
- `SUPABASE_SERVICE_ROLE_KEY` - Already set
- `SUPABASE_ANON_KEY` - Already set
- `DATABASE_URL` - Already set
- `SESSION_COOKIE_NAME` - Defaults to `session_id`
- `SESSION_MAX_AGE` - Defaults to 86400 (24 hours)

### Frontend `.env` Requirements
- `VITE_SUPABASE_URL` - Already set
- `VITE_SUPABASE_ANON_KEY` - Already set

---

## Database Schema

### `app_profiles` Table
```sql
CREATE TABLE app_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'business_owner', 'user')),
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `sessions` Table
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Current Issues / Debugging Needed

### 1. Login Not Working - **FIXED** ✅
**Root Cause Found:**
- **Frontend was still using old `AuthProvider` instead of `AuthProviderV2`**
- File `frontend/src/App.tsx` was not updated to use the new auth system
- This meant all new Auth V2 code was implemented but not being used

**Fix Applied:**
- Updated `frontend/src/App.tsx` to use `AuthProviderV2` and `useAuthV2()`
- Updated role checking logic
- Added `isAuthenticated` prop to `LandingHeader`
- Changes committed and pushed

**Remaining Possible Issues:**
1. **Missing SUPABASE_JWT_SECRET** - Check if properly set in `.env`
2. **Database migration not applied** - `app_profiles` or `sessions` tables might not exist
3. **CORS issues** - Cookies might not be sent/received properly
4. **Session cookie not being set** - Check backend response headers
5. **Supabase auth issue** - `supabase_admin.password_sign_in()` might be failing

### 2. Testing Checklist
- [ ] Verify `.env` has `SUPABASE_JWT_SECRET` set correctly
- [ ] Check if database migration `0020_auth_rebuild.sql` was applied
- [ ] Test backend endpoint directly: `POST /api/auth/v2/login`
- [ ] Check browser Network tab for cookie in response headers
- [ ] Verify frontend is using `AuthProviderV2` (not old `AuthProvider`)
- [ ] Check browser console for errors
- [ ] Verify `withCredentials: true` in axios requests
- [ ] Check backend logs for errors

### 3. Files to Check
- `backend/.env` - Must have `SUPABASE_JWT_SECRET`
- `backend/app/main.py` - Must import and register `auth_v2_router`
- `frontend/src/App.tsx` - Must use `AuthProviderV2`
- `frontend/src/api/httpClient.ts` - Must have `withCredentials: true`
- Database - Check if `app_profiles` and `sessions` tables exist

---

## API Endpoints Reference

### Login
```http
POST /api/auth/v2/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": { ... },
  "role": "user",
  "redirect_url": "/dashboard"
}

Cookie: session_id=<uuid>
```

### Get Current User
```http
GET /api/auth/v2/me
Cookie: session_id=<uuid>

Response:
{
  "user": { ... },
  "organizations": [ ... ],
  "memberships": [ ... ],
  "platform_roles": [ ... ]
}
```

### Logout
```http
POST /api/auth/v2/logout
Cookie: session_id=<uuid>

Response:
{
  "success": true,
  "message": "Logged out"
}
```

---

## Git Status

**Branch:** `feature/auth-v2-cookie-sessions` (pushed)
**Main branch:** Latest commit includes trigger comment for redeploy

**Files Changed:**
- 14 new files created
- 1 file modified (`frontend/src/pages/Login.tsx`)
- All changes committed and pushed

---

## Next Steps for Debugging

1. **Check Backend Logs**
   - Start backend: `python -m uvicorn app.main:app --reload`
   - Try login and check console output

2. **Test Backend Directly**
   ```bash
   curl -X POST http://localhost:8000/api/auth/v2/login \
     -H "Content-Type: application/json" \
     -d '{"email":"filippmiller@gmail.com","password":"Airbus380+"}' \
     -v
   ```
   Check for `Set-Cookie` header in response

3. **Check Database**
   - Verify `app_profiles` table exists
   - Verify `sessions` table exists
   - Check if user exists in `app_profiles`

4. **Check Frontend**
   - Open browser DevTools → Network tab
   - Try login
   - Check request/response headers
   - Verify cookie is being sent in subsequent requests

5. **Check Environment Variables**
   - Verify all Supabase credentials are correct
   - Verify `SUPABASE_JWT_SECRET` is set (not placeholder)

---

## Contact Points

- Backend API: `backend/app/api/routes/auth_v2.py`
- Frontend Auth: `frontend/src/auth/AuthProviderV2.tsx`
- Session Management: `backend/app/services/sessions.py`
- Database Schema: `supabase/migrations/0020_auth_rebuild.sql`

