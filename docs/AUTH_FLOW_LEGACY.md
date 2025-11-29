# Legacy Authentication Flow - Audit Report

**Date:** November 29, 2025  
**Purpose:** Document the existing (broken) auth implementation before complete rewrite  
**Status:** TO BE REPLACED

---

## Executive Summary

The current authentication system is a patchwork of hacks, custom workarounds, and incomplete integrations. It attempts to use Supabase Auth but includes numerous manual session management hacks that make it unreliable and difficult to maintain.

**Critical Problems:**
1. Manual localStorage manipulation pretending to be Supabase tokens
2. Multiple sources of truth for authentication state
3. No proper route protection
4. Fragile error handling
5. Timeout-based session setting with unreliable fallbacks

---

## Frontend Auth Architecture

### Core Files

1. **`src/pages/Login.tsx`** (360 lines)
   - Main login form component
   - Contains the infamous "3-second timeout + manual localStorage fallback" hack
   
2. **`src/pages/Register.tsx`** (~16KB)
   - Registration form
   - Similar structure to Login.tsx
   
3. **`src/pages/AuthCallback.tsx`**
   - Handles OAuth callbacks (Google, Yandex)
   
4. **`src/api/authService.ts`** (416 lines)
   - Contains `login()`, `afterSignup()`, `fetchSession()` functions
   - Makes REST API calls to backend `/api/auth/*` endpoints
   
5. **`src/lib/supabaseClient.ts`** (21 lines)
   - Initializes Supabase client with environment variables
   
6. **`src/store/userStore.ts`** (55 lines)
   - Zustand store for user state
   - Stores: `user`, `memberships`, `organizations`, `platformRoles`
   
7. **`src/types/auth.ts`** (505 lines)
   - TypeScript type definitions for all auth-related data structures

### Current Login Flow (Email + Password)

**User Journey:**
1. User visits `/login`
2. Enters email and password
3. Clicks "Войти" (Login) button

**Technical Flow:**

```
┌──────────────┐
│ Login.tsx    │
│ onSubmit()   │
└───────┬──────┘
        │
        │ 1. Calls authService.login(email, password)
        ↓
┌──────────────────────────────────┐
│ authService.ts                    │
│ POST /api/auth/login             │
│ (via httpClient with proxy)      │
└───────────┬──────────────────────┘
            │
            │ 2. Request proxied to backend
            ↓
┌──────────────────────────────────┐
│ Backend: app/api/routes/auth.py  │
│ @router.post('/login')           │
└───────────┬──────────────────────┘
            │
            │ 3. Backend calls Supabase Admin API
            │    supabase_admin.password_sign_in()
            ↓
┌──────────────────────────────────┐
│ Supabase Auth API                │
│ /auth/v1/token?grant_type=pwd    │
└───────────┬──────────────────────┘
            │
            │ 4. Returns: access_token, refresh_token, user
            ↓
┌──────────────────────────────────┐
│ Backend queries Postgres         │
│ get_session_data(user_id)        │
│ Returns AppUser + orgs + roles   │
└───────────┬──────────────────────┘
            │
            │ 5. Backend returns LoginResponse
            │    {access_token, refresh_token, user, orgs, ...}
            ↓
┌──────────────────────────────────┐
│ Login.tsx receives response      │
└───────────┬──────────────────────┘
            │
            │ THE HACK BEGINS HERE
            ↓
┌─────────────────────────────────────────────────┐
│ Login.tsx attempts:                              │
│ supabase.auth.setSession({                       │
│   access_token, refresh_token                    │
│ })                                               │
│                                                  │
│ WITH A 3-SECOND TIMEOUT                          │
└───────────┬─────────────────────────────────────┘
            │
            ├─ SUCCESS → Session set, redirect /dashboard
            │
            └─ TIMEOUT/FAILURE
                │
                │ FALLBACK HACK:
                │ Manually write to localStorage:
                │ key: "sb-{projectRef}-auth-token"
                │ value: {
                │   access_token,
                │   refresh_token,
                │   expires_at,
                │   user: response.supabase_user || response.user
                │ }
                │
                ↓
            Sometimes works, often doesn't.
            User redirects to /dashboard but might not
            actually be authenticated.
```

**Problems with this flow:**
- ❌ Backend duplicates Supabase Auth (password verification)
- ❌ Two different user objects: `AppUser` (from Postgres) and `SupabaseUser` (from Auth)
- ❌ Manual localStorage writes bypass Supabase's internal session management
- ❌ Race conditions: timeout happens before valid response
- ❌ No validation that the session was actually accepted by Supabase client

### Current Registration Flow

Similar to login but calls:
- Frontend: `authService.afterSignup()`
- Backend: `POST /api/auth/after-signup`

Creates both Supabase user and AppUser record.

### OAuth (Google, Yandex)

**Current Implementation:**
1. Login.tsx has buttons for Google and Yandex
2. **Google:** 
   ```typescript
   supabase.auth.signInWithOAuth({
     provider: 'google',
     options: { redirectTo }
   })
   ```
3. **Yandex:**
   ```typescript
   const url = await startYandexLogin(redirectTo)
   window.location.href = url
   ```
   - Calls backend `/api/auth/yandex/start`
   - Backend constructs OAuth URL manually

**Callback Handling:**
- Route: `/auth/callback`
- Component: `AuthCallback.tsx`
- Attempts to call backend `/api/auth/session` after OAuth

**Problems:**
- Inconsistent: Google uses Supabase client, Yandex uses custom backend flow
- Callback handling is fragile

### Session Management in App.tsx

```typescript
useEffect(() => {
  const loadSession = async () => {
    // 1. Get Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    
    // 2. If session exists, call backend /api/auth/session
    if (session && !user) {
      const sessionPayload = await fetchSession()
      setSessionData(sessionPayload)
    }
  }
  loadSession()
  
  // 3. Listen to auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      fetchSession().then(setSessionData)
    } else if (event === 'SIGNED_OUT') {
      reset()
    }
  })
}, [])
```

**Problems:**
- Assumes Supabase session is always valid
- Fetches additional data from backend every time
- No error boundary if backend `/auth/session` fails
- Fallback logic creates incomplete user state

### Route Protection

**Current Status:** NONE

- All routes in `src/routes/index.tsx` are public
- No `ProtectedRoute` or `RequireAuth` wrapper
- The `Dashboard` component checks `user` state manually
- Individual pages decide whether to redirect

**Problems:**
- Inconsistent: each page implements own auth check
- Easy to accidentally expose protected pages
- No loading state during auth check

---

## Backend Auth Architecture

### Core Files

1. **`backend/app/api/routes/auth.py`**
   - Endpoints: `/login`, `/after-signup`, `/session`, `/linked-accounts`
   
2. **`backend/app/core/supabase.py`**
   - `SupabaseAdminClient` class
   - Methods: `password_sign_in()`, `get_user()`, `create_user()`
   
3. **`backend/app/services/accounts.py`**
   - `get_session_data(user_id)` - queries Postgres for AppUser
   - `handle_after_signup()` - creates AppUser and Organization
   
4. **`backend/app/services/login_throttle.py`**
   - Rate limiting for failed login attempts
   
5. **`backend/app/schemas/auth.py`**
   - Pydantic models: `LoginRequest`, `LoginResponse`, `SessionResponse`

### Endpoints

| Method | Path | Purpose | Issues |
|--------|------|---------|--------|
| POST | `/api/auth/login` | Email+password login | Duplicates Supabase Auth logic |
| POST | `/api/auth/after-signup` | Complete registration | Server-side registration unnecessary |
| GET | `/api/auth/session` | Get current user data | Depends on valid Supabase token |
| GET | `/api/auth/linked-accounts` | List OAuth providers | Works fine |
| GET | `/api/auth/yandex/start` | Initiate Yandex OAuth | Should use Supabase provider |

### Backend Login Logic (auth.py)

```python
@router.post('/login')
async def login(payload: LoginRequest):
    # 1. Check rate limiting
    state = login_throttle.get_state(payload.email)
    
    # 2. Call Supabase Admin API
    auth_response = supabase_admin.password_sign_in(email, password)
    
    # 3. Extract user_id from Supabase response
    user_id = auth_response['user']['id']
    
    # 4. Query our Postgres DB for AppUser + organizations
    session = await get_session_data(user_id)
    
    # 5. Return combined response
    return LoginResponse(
        access_token=auth_response['access_token'],
        refresh_token=auth_response['refresh_token'],
        user=session.user,
        organizations=session.organizations,
        ...
        supabase_user=auth_response['user']  # Added during debugging
    )
```

**Problems:**
- Backend acts as a proxy to Supabase Auth (unnecessary)
- Frontend could call Supabase directly
- Backend should only validate tokens, not issue them

---

## Data Models

### Supabase User (from Auth API)
```typescript
{
  id: string               // UUID
  email: string
  user_metadata: {
    full_name?: string
    ...
  }
  // + many other Supabase-specific fields
}
```

### AppUser (from Postgres `app_users` table)
```typescript
{
  id: string               // Same UUID as Supabase
  email: string
  full_name?: string
  locale?: string
}
```

**Mapping:**
- Backend creates `AppUser` with same `id` as Supabase user
- `get_session_data()` queries `app_users` by `id`

### Session State (Frontend)
```typescript
// userStore.ts
{
  user: AppUser | null
  memberships: OrganizationMembership[]
  organizations: Organization[]
  platformRoles: PlatformRole[]
  selectedOrganizationId: string | null
  loading: boolean
}
```

---

## Identified Problems & Code Smells

### 1. **Dual Authentication Sources**
- Supabase Auth handles tokens
- Backend re-implements password verification
- Result: Confusion about "who is the authority"

### 2. **Manual localStorage Hacks**
```typescript
// Login.tsx line 158
localStorage.setItem(storageKey, JSON.stringify(sessionObject))
```
- Bypasses Supabase's internal session management
- Uses hardcoded key format `sb-{projectRef}-auth-token`
- Fragile: breaks if Supabase changes format

### 3. **Timeout-Based Logic**
```typescript
// Login.tsx line 120
setTimeout(() => reject(new Error('setSession timeout after 3 seconds')), 3000)
```
- Arbitrary timeout
- Falls back even if setSession would succeed at 3.1 seconds
- No retry logic

### 4. **Inconsistent User Objects**
- Backend returns both `user` (AppUser) and `supabase_user` in LoginResponse
- Frontend sometimes uses one, sometimes the other
- Confusion about which is "correct"

### 5. **No Route Protection**
- `/dashboard` routes are publicly accessible
- Each component implements own redirect logic
- Inconsistent user experience

### 6. **Error Handling**
- Generic Russian error message: "Не удалось выполнить вход"
- No distinction between:
  - Wrong password
  - Network error  
  - Server error
  - Rate limiting

### 7. **OAuth Inconsistency**
- Google: Uses Supabase client (correct)
- Yandex: Custom backend implementation (wrong)
- Should both use Supabase providers

### 8. **No Password Reset**
- Feature completely missing
- Users cannot recover accounts

### 9. **Encoding Bugs**
- Backend crashes when logging Russian characters
- `UnicodeEncodeError` in some environments

### 10. **Zustand Store Complexity**
- Stores full user state (user, orgs, memberships, roles)
- Reloads everything on every auth change
- Could be simpler: just user ID + email

---

## localStorage Keys Observed

During debugging, I found these keys:

1. **`sb-{projectRef}-auth-token`**
   - Set by Supabase client (when working correctly)
   - Set manually by fallback hack (when timeout occurs)
   
2. **`pendingInviteCode`** (mentioned in Login.tsx)
   - Used to redirect to invite page after login

---

## Recommendation

**DO NOT ATTEMPT TO FIX THIS CODE.**

The current implementation is too convoluted with too many hacks layered on top of each other. A clean rewrite following Supabase best practices will be:
- Simpler
- More maintainable
- More reliable
- Easier to test

---

## Files to Delete in Rewrite

### Frontend
- ❌ `src/pages/Login.tsx` (360 lines of hacks)
- ❌ `src/pages/Register.tsx` (separate registration flow)
- ❌ `src/pages/AuthCallback.tsx` (unless we can simplify it drastically)
- ❌ `src/api/authService.ts` → All backend-proxying login functions
- ⚠️  `src/lib/supabaseClient.ts` → Keep, but ensure correct config
- ⚠️  `src/store/userStore.ts` → Simplify drastically
- ⚠️  `src/types/auth.ts` → Keep types, remove obsolete ones

### Backend
- ❌ `backend/app/api/routes/auth.py` → Delete `/login` and `/after-signup`
- ⚠️  Keep `/auth/session` (renamed to `/auth/me`)
- ❌ `backend/app/core/supabase.py` → Remove `password_sign_in()` method
- ⚠️  `backend/app/services/accounts.py` → Keep `get_session_data()`, simplify

---

## Next Steps

1. ✅ **Audit complete** (this document)
2. 📋 Design new auth flow (`AUTH_FLOW_NEW.md`)
3. 🗑️  Delete legacy code
4. ✨ Implement new auth from scratch
5. 📝 Create manual test checklist
6. 🧪 Test thoroughly

---

**End of Legacy Audit**
