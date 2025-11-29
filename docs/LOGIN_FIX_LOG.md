# Debugging Log: Login Failure Investigation

**Date:** November 29, 2025
**Author:** Antigravity (AI Assistant)
**Status:** Fix Implemented / Pending Verification

## 1. Initial Problem Identification

**User Report:** The login form at `http://localhost:5174/login` was unresponsive. Submitting valid credentials resulted in an error message ("Ошибка Не удалось выполнить вход") or simply did nothing.

**My Initial Thoughts:**
> "This looks like a standard authentication failure. It could be anything from a network error (CORS), a backend crash (500), or a frontend state issue. Since the port is 5174 (not the default 5173), I immediately suspect a configuration mismatch."

## 2. Investigation & Fixes

### Step 1: Environment & CORS Configuration
**Observation:**
The frontend was running on port `5174`, but the backend configuration (`backend/app/core/config.py`) only allowed `http://localhost:5173`.

**My Thoughts:**
> "Browsers enforce CORS strictly. If the backend doesn't explicitly allow `localhost:5174`, the browser will block the response. This explains the initial 'Network Error' or generic failure message."

**Action:**
I updated `backend/app/core/config.py` to include the new port.

```python
# backend/app/core/config.py
allowed_origins: str | List[str] = 'http://localhost:5173,http://localhost:5174'
```

### Step 2: Proxy Configuration
**Observation:**
Directly hitting the backend from a different port causes preflight (OPTIONS) requests which can be flaky in dev.

**My Thoughts:**
> "To rule out CORS entirely during development, it's better to proxy requests through Vite. This makes the frontend think it's sending requests to its own origin."

**Action:**
I updated `vite.config.ts` and `httpClient.ts`.

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

### Step 3: The "500 Internal Server Error"
**Observation:**
After fixing the network path, the backend started returning `500 Internal Server Error`.

**My Thoughts:**
> "Okay, the request is getting through, but the backend is crashing. The logs are empty, which is frustrating. I need to know *exactly* where it fails. Is it the database connection? The Supabase Auth call?"

**Action:**
I created a standalone script `backend/scripts/debug_login.py` to test the components in isolation.

**Discovery (The "Hidden" Error):**
The script crashed with a `UnicodeEncodeError` when trying to print the user object.
> "Aha! The Windows console is struggling to print Russian characters (likely in the user's name). If the main application tries to log this user object, it might be crashing the request thread silently or generating a 500 error."

I fixed the logging in `auth.py` to be safer and wrapped the login logic in a `try/except` block to catch and log errors explicitly.

### Step 4: The Frontend Session Timeout (The "Hanging" Login)
**Observation:**
With the backend fixed (returning 200 OK), the frontend *still* didn't redirect. It just sat there.

**My Thoughts:**
> "This is the trickiest part. The backend says 'Success', but the frontend ignores it. I looked at `Login.tsx`. It uses `supabase.auth.setSession()`. This function verifies the token with the Supabase server. If there's network lag or a clock skew, it times out."

**The Critical Bug:**
The code had a fallback: if `setSession` times out, it manually saves the session to `localStorage`.
**HOWEVER:** It was saving the wrong user object.
*   **What we were saving:** The `AppUser` (from our Postgres DB).
*   **What Supabase needs:** The `Supabase User` (from the Auth server).

Because the structure didn't match, the Supabase client (on page reload) looked at `localStorage`, saw invalid data, and ignored it. Result: User stays logged out.

**Action:**
1.  **Backend:** I modified `auth.py` to return the raw `supabase_user` in the response.
2.  **Frontend:** I updated `Login.tsx` to use this `supabase_user` when saving to `localStorage`.

```python
# backend/app/api/routes/auth.py
return LoginResponse(
    # ... other fields
    supabase_user=auth_response.get('user'), # Added this
)
```

```typescript
// frontend/src/pages/Login.tsx
// Fallback logic
const sessionObject = {
  // ...
  user: response.supabase_user || response.user, // Use the correct Supabase user object
}
```

## 3. Current Status & Plan for Your Friend

**Current State:**
The code is patched. The backend returns the correct data, and the frontend has a robust fallback mechanism.

**Why it might still be failing (Advice for your friend):**

If the login is *still* not working, here is where to look:

1.  **LocalStorage Key Mismatch:**
    *   Supabase looks for a specific key in `localStorage`: `sb-<project-ref>-auth-token`.
    *   **Check:** Open DevTools -> Application -> Local Storage. Verify the key name matches what `supabaseClient.ts` expects. If the `VITE_SUPABASE_URL` changed, the key name changes.

2.  **Clock Skew:**
    *   If the local computer's time is significantly different from the server time, the JWT tokens might be considered "expired" immediately upon receipt.
    *   **Check:** Verify system time is accurate.

3.  **Supabase Client Singleton:**
    *   Ensure `supabaseClient.ts` is initializing the client correctly and that this *same instance* is being used throughout the app.

4.  **Browser Caching:**
    *   Sometimes Vite caches old bundles aggressively.
    *   **Action:** Delete `node_modules/.vite` and restart `npm run dev`.

**Recommended Next Step:**
Ask your friend to verify the `localStorage` contents immediately after a login attempt. If the `sb-...` key exists and contains valid JSON with a `user` and `access_token`, then the issue is likely in how the `App.tsx` or router checks for authentication (e.g., the `ProtectedRoute` component might be failing to read the session).
