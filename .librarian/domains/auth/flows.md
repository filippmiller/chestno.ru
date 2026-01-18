# Authentication Flows

> Last updated: 2026-01-18
> Domain: auth
> Keywords: auth, authentication, login, signup, session, cookie, oauth, google, yandex, token, jwt

## Overview

Cookie-based authentication using Supabase Auth + custom backend sessions.
Sessions stored in httpOnly cookies for security.

---

## Email/Password Login Flow

```
1. User enters email/password on /auth page
2. Frontend calls POST /api/auth/v2/login
3. Backend validates via Supabase Auth
4. Backend creates session record in DB
5. Backend sets httpOnly session cookie
6. Returns: { user, role, organizations, memberships, platform_roles, redirect_url }
7. Frontend stores in AuthProviderV2 state
8. Redirects based on role:
   - platform_admin → /admin/dashboard
   - business user → /dashboard
```

**Files:**
- Frontend: `frontend/src/auth/AuthProviderV2.tsx`
- Backend: `backend/app/api/routes/auth_v2.py`
- Service: `backend/app/services/sessions.py`

---

## Email/Password Signup Flow

```
1. User fills signup form on /auth page
2. Frontend calls POST /api/auth/v2/signup
3. Backend creates user via Supabase Auth
4. Backend creates app_users record
5. Supabase sends email confirmation
6. User clicks email link
7. Redirected to /auth/callback
8. User can now login
```

**Email confirmation required before login.**

---

## Google OAuth Flow

```
1. User clicks "Login with Google"
2. Frontend redirects to GET /api/auth/v2/google/start
3. Backend redirects to Google OAuth consent
4. User authorizes
5. Google redirects to callback with code
6. Backend exchanges code for tokens via Supabase
7. Backend creates/links user
8. Backend creates session, sets cookie
9. Redirects to /dashboard with session active
```

**Files:**
- Backend: `backend/app/api/routes/auth_v2.py`
- Frontend redirect: `frontend/src/auth/AuthProviderV2.tsx` → `loginWithGoogle()`

---

## Yandex OAuth Flow

```
1. User clicks "Login with Yandex"
2. Frontend calls startYandexLogin() → backend redirect
3. Backend redirects to Yandex OAuth
4. User authorizes on Yandex
5. Yandex redirects to backend callback
6. Backend exchanges code for Yandex tokens
7. Backend creates/links user via Supabase
8. Backend creates session, sets cookie
9. Redirects to /dashboard
```

**Configuration:**
- `YANDEX_CLIENT_ID` - Yandex OAuth app ID
- `YANDEX_CLIENT_SECRET` - Yandex OAuth secret

---

## Session Persistence

**Method:** httpOnly cookies (server-set)
- Cookie name: `session_id` (configurable)
- Max age: 24 hours (86400 seconds)
- Secure: true in production
- SameSite: Lax

**On page refresh:**
1. Browser sends cookie automatically
2. Frontend calls `fetchAppUserData()`
3. Backend validates session from cookie
4. Returns user data or 401
5. Frontend updates state accordingly

**Files:**
- Config: `backend/app/core/config.py` → `session_cookie_name`, `session_max_age`
- Session service: `backend/app/services/sessions.py`
- Session data: `backend/app/services/session_data.py`

---

## Logout Flow

```
1. User clicks logout
2. Frontend calls POST /api/auth/v2/logout
3. Backend deletes session from DB
4. Backend clears session cookie
5. Frontend clears state
6. Redirects to /
```

---

## Rate Limiting

**Login attempts limited per email + IP:**
- Tracked in `login_throttle` table
- Exponential backoff on failures
- Lock period after multiple failures

**Service:** `backend/app/services/auth_events.py`
- `check_rate_limit(email, ip)` → (allowed, wait_seconds)
- `record_failed_attempt(email, ip)`
- `clear_failed_attempts(email, ip)`

---

## Role-Based Access

### Organization Roles (per membership)
```
owner    → Full access, can transfer ownership
admin    → Full access except ownership
manager  → Content management, moderation, invites
editor   → Create/edit content
analyst  → View analytics
viewer   → View only
```

### Platform Roles (global)
```
platform_admin → Full platform access
moderator      → Organization verification
support        → Limited support access
```

**Files:**
- Types: `frontend/src/types/auth.ts`
- Backend check: `backend/app/services/*` → `_require_role()`

---

## Session Data Structure

```typescript
interface SessionResponse {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    locale: string;
  };
  organizations: Organization[];
  memberships: OrganizationMembership[];
  platform_roles: string[];
}
```

---

## Frontend Auth Components

### AuthProviderV2.tsx
**Purpose:** React Context provider for auth state
**Exports:** `useAuthV2()` hook

**State:**
- `status`: 'loading' | 'authenticated' | 'unauthenticated'
- `user`: AppUser | null
- `role`: string | null
- `organizations`: Organization[]
- `memberships`: OrganizationMembership[]
- `platformRoles`: string[]

**Methods:**
- `loginWithEmail(email, password)`
- `signupWithEmail(email, password, fullName)`
- `loginWithGoogle()`
- `loginWithYandex()`
- `logout()`
- `resetPassword(email)`
- `fetchAppUserData()`

### ProtectedRoute.tsx
**Purpose:** Route guard for authenticated pages
**Behavior:** Redirects to /auth if not authenticated

### RoleProtectedRoute.tsx
**Purpose:** Route guard with role requirement
**Props:** `allowedRoles: string[]`

---

## Security Considerations

1. **httpOnly cookies** - Not accessible via JavaScript
2. **Secure flag** - HTTPS only in production
3. **SameSite: Lax** - CSRF protection
4. **Rate limiting** - Prevents brute force
5. **IP hashing** - Privacy for analytics
6. **Password never stored** - Supabase handles auth
