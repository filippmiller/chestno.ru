# New Authentication Flow - Design Document

**Date:** November 29, 2025  
**Status:** DESIGN (ready for implementation)  
**Version:** 1.0

---

## 1. Design Principles

### Primary Rule
**Supabase Auth is the ONLY source of truth for authentication.**

This means:
- ✅ Frontend uses Supabase client directly for all auth operations
- ✅ Backend **validates** Supabase JWTs, never issues them
- ✅ No custom password verification on backend
- ✅ No manual localStorage manipulation
- ✅ Trust Supabase's built-in session persistence

### Secondary Principles
- Keep it simple: fewer moving parts = fewer bugs
- Follow Supabase best practices
- All UI text in Russian
- Clear error messages for users
- Consistent behavior across all auth methods

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────┐
│         React App (Frontend)            │
│  ┌───────────────────────────────────┐  │
│  │  Supabase Client (@supabase-js)   │  │
│  │  - signInWithPassword()           │  │
│  │  - signUp()                       │  │
│  │  - signInWithOAuth()              │  │
│  │  - resetPasswordForEmail()        │  │
│  │  - onAuthStateChange()            │  │
│  └───────────┬───────────────────────┘  │
│              │                           │
│              │ Session stored in         │
│              │ localStorage (automatic)  │
│              │                           │
│  ┌───────────▼───────────────────────┐  │
│  │      AuthContext Provider         │  │
│  │  - Listen to auth state           │  │
│  │  - Fetch AppUser from backend     │  │
│  │  - Provide user + session         │  │
│  └───────────┬───────────────────────┘  │
│              │                           │
└──────────────┼───────────────────────────┘
               │
               │ GET /api/auth/me
               │ Authorization: Bearer {access_token}
               │
               ▼
┌─────────────────────────────────────────┐
│         Backend (FastAPI)               │
│  ┌───────────────────────────────────┐  │
│  │  JWT Validation Middleware        │  │
│  │  - Verify Supabase JWT signature  │  │
│  │  - Extract user_id                │  │
│  └───────────┬───────────────────────┘  │
│              │                           │
│  ┌───────────▼───────────────────────┐  │
│  │  GET /api/auth/me                 │  │
│  │  - Query Postgres for AppUser     │  │
│  │  - Return user + orgs + roles     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Supabase (Auth + Postgres)           │
│  - User accounts (auth.users)           │
│  - Application data (app_users table)   │
└─────────────────────────────────────────┘
```

---

## 3. User Flows

### 3.1. Email + Password Registration

**UI:** `/auth` page (Регистрация tab)

```
User                    Frontend                 Supabase              Backend
  │                         │                        │                    │
  │ Enter email+password    │                        │                    │
  ├────────────────────────►│                        │                    │
  │                         │ signUp({               │                    │
  │                         │   email, password,     │                    │
  │                         │   options: {           │                    │
  │                         │     data: {            │                    │
  │                         │       full_name        │                    │
  │                         │     }                  │                    │
  │                         │   }                    │                    │
  │                         │ })                     │                    │
  │                         ├───────────────────────►│                    │
  │                         │                        │                    │
  │                         │                        │ Creates user       │
  │                         │                        │ in auth.users      │
  │                         │                        │                    │
  │                         │◄───────────────────────┤                    │
  │                         │ { user, session }      │                    │
  │                         │                        │                    │
  │ Session stored          │ (automatic via         │                    │
  │ in localStorage         │  Supabase client)      │                    │
  │                         │                        │                    │
  │                         │ onAuthStateChange      │                    │
  │                         │ fires SIGNED_IN        │                    │
  │                         │                        │                    │
  │                         │ GET /api/auth/me       │                    │
  │                         │ Authorization: Bearer  │                    │
  │                         ├────────────────────────┼───────────────────►│
  │                         │                        │                    │
  │                         │                        │   Query app_users  │
  │                         │                        │   (create if new)  │
  │                         │                        │                    │
  │                         │◄───────────────────────┼────────────────────┤
  │                         │ { user, orgs, roles }  │                    │
  │                         │                        │                    │
  │ Redirect to /dashboard  │                        │                    │
  │◄────────────────────────┤                        │                    │
```

**Notes:**
- Supabase may send confirmation email (depending on config)
- If email confirmation required, user sees "Check your email" message
- On confirmation, user can log in

### 3.2. Email + Password Login

**UI:** `/auth` page (Вход tab)

```
User                    Frontend                 Supabase              Backend
  │                         │                        │                    │
  │ Enter email+password    │                        │                    │
  ├────────────────────────►│                        │                    │
  │                         │ signInWithPassword({   │                    │
  │                         │   email, password      │                    │
  │                         │ })                     │                    │
  │                         ├───────────────────────►│                    │
  │                         │                        │                    │
  │                         │                        │ Verify credentials │
  │                         │                        │                    │
  │                         │◄───────────────────────┤                    │
  │                         │ { user, session }      │                    │
  │                         │ (or error if wrong)    │                    │
  │                         │                        │                    │
  │ If error:               │                        │                    │
  │ Show "Неверный e-mail   │                        │                    │
  │ или пароль"             │                        │                    │
  │                         │                        │                    │
  │ If success:             │                        │                    │
  │ Session stored          │                        │                    │
  │                         │                        │                    │
  │                         │ GET /api/auth/me       │                    │
  │                         ├────────────────────────┼───────────────────►│
  │                         │                        │                    │
  │                         │◄───────────────────────┼────────────────────┤
  │                         │ { user, orgs, roles }  │                    │
  │                         │                        │                    │
  │ Redirect to /dashboard  │                        │                    │
  │◄────────────────────────┤                        │                    │
```

**Error Handling:**
- Wrong password → Supabase returns 400 error
- Frontend catches error, shows: "Неверный e-mail или пароль"
- Network error → "Не удалось выполнить вход. Попробуйте позже."

### 3.3. Google OAuth Login

**UI:** `/auth` page ("Войти через Google" button)

```
User                    Frontend                 Supabase              Backend
  │                         │                        │                    │
  │ Click "Войти через      │                        │                    │
  │ Google"                 │                        │                    │
  ├────────────────────────►│                        │                    │
  │                         │ signInWithOAuth({      │                    │
  │                         │   provider: 'google',  │                    │
  │                         │   options: {           │                    │
  │                         │     redirectTo:        │                    │
  │                         │     'http://...:5174/  │                    │
  │                         │      auth/callback'    │                    │
  │                         │   }                    │                    │
  │                         │ })                     │                    │
  │                         ├───────────────────────►│                    │
  │                         │                        │                    │
  │                         │◄───────────────────────┤                    │
  │                         │ Redirect to Google     │                    │
  │                         │                        │                    │
  │ Redirected to Google    │                        │                    │
  │ OAuth consent screen    │                        │                    │
  │                         │                        │                    │
  │ User approves           │                        │                    │
  │                         │                        │                    │
  │ Google redirects back   │                        │                    │
  │ to /auth/callback       │                        │                    │
  │ with auth code          │                        │                    │
  ├────────────────────────►│                        │                    │
  │                         │                        │                    │
  │                         │ Supabase client        │                    │
  │                         │ exchanges code for     │                    │
  │                         │ session (automatic)    │                    │
  │                         │                        │                    │
  │                         │ onAuthStateChange      │                    │
  │                         │ fires SIGNED_IN        │                    │
  │                         │                        │                    │
  │                         │ GET /api/auth/me       │                    │
  │                         ├────────────────────────┼───────────────────►│
  │                         │                        │                    │
  │                         │◄───────────────────────┼────────────────────┤
  │                         │                        │                    │
  │ Redirect to /dashboard  │                        │                    │
  │◄────────────────────────┤                        │                    │
```

**Configuration:**
- Supabase Dashboard → Authentication → Providers → Google
- Set OAuth Client ID and Secret
- Redirect URL: `https://{project}.supabase.co/auth/v1/callback`

**Frontend redirectTo:**
- Development: `http://localhost:5174/auth/callback`
- Production: `https://yourdomain.com/auth/callback`

### 3.4. Yandex OAuth Login

**Same as Google, but:**
```typescript
signInWithOAuth({
  provider: 'yandex',
  options: { redirectTo: '...' }
})
```

**Configuration:**
- Enable Yandex provider in Supabase Dashboard
- Set Yandex OAuth credentials

### 3.5. Password Reset (Forgot Password)

**UI:** `/auth` page → "Забыли пароль?" link → Modal or separate page

**Step 1: Request Reset**
```
User                    Frontend                 Supabase
  │                         │                        │
  │ Enter email             │                        │
  ├────────────────────────►│                        │
  │                         │ resetPasswordForEmail({│
  │                         │   email,               │
  │                         │   options: {           │
  │                         │     redirectTo:        │
  │                         │     'http://...:5174/  │
  │                         │      auth/reset'       │
  │                         │   }                    │
  │                         │ })                     │
  │                         ├───────────────────────►│
  │                         │                        │
  │                         │                        │ Sends email with
  │                         │                        │ magic link
  │                         │                        │
  │                         │◄───────────────────────┤
  │                         │ { }                    │
  │                         │                        │
  │ Show: "Мы отправили     │                        │
  │ письмо со ссылкой"      │                        │
  │◄────────────────────────┤                        │
```

**Step 2: User clicks link in email**
```
User                    Frontend                 Supabase
  │                         │                        │
  │ Click link in email     │                        │
  │ → redirected to         │                        │
  │ /auth/reset?token=...   │                        │
  ├────────────────────────►│                        │
  │                         │                        │
  │                         │ Supabase client        │
  │                         │ automatically picks up │
  │                         │ token from URL hash    │
  │                         │                        │
  │ Show "Set New Password" │                        │
  │ form                    │                        │
  │◄────────────────────────┤                        │
  │                         │                        │
  │ Enter new password      │                        │
  ├────────────────────────►│                        │
  │                         │ updateUser({           │
  │                         │   password: newPassword│
  │                         │ })                     │
  │                         ├───────────────────────►│
  │                         │                        │
  │                         │◄───────────────────────┤
  │                         │ { user }               │
  │                         │                        │
  │ Show: "Пароль успешно   │                        │
  │ изменён"                │                        │
  │ Redirect to /dashboard  │                        │
  │◄────────────────────────┤                        │
```

### 3.6. Logout

```
User                    Frontend                 Supabase
  │                         │                        │
  │ Click "Выйти"           │                        │
  ├────────────────────────►│                        │
  │                         │ signOut()              │
  │                         ├───────────────────────►│
  │                         │                        │
  │                         │                        │ Invalidates session
  │                         │                        │
  │                         │◄───────────────────────┤
  │                         │                        │
  │                         │ onAuthStateChange      │
  │                         │ fires SIGNED_OUT       │
  │                         │                        │
  │                         │ Clear AuthContext      │
  │                         │                        │
  │ Redirect to /           │                        │
  │◄────────────────────────┤                        │
```

### 3.7. Session Persistence (Page Reload)

```
User                    Frontend                 Supabase              Backend
  │                         │                        │                    │
  │ Refresh page or         │                        │                    │
  │ open app in new tab     │                        │                    │
  ├────────────────────────►│                        │                    │
  │                         │                        │                    │
  │                         │ App.tsx mounts         │                    │
  │                         │ AuthProvider renders   │                    │
  │                         │                        │                    │
  │                         │ useEffect(() => {      │                    │
  │                         │   supabase.auth.       │                    │
  │                         │   getSession()         │                    │
  │                         │ })                     │                    │
  │                         ├───────────────────────►│                    │
  │                         │                        │                    │
  │                         │                        │ Checks localStorage│
  │                         │                        │ for session        │
  │                         │                        │                    │
  │                         │◄───────────────────────┤                    │
  │                         │ { data: { session } }  │                    │
  │                         │                        │                    │
  │ If session exists:      │                        │                    │
  │                         │ GET /api/auth/me       │                    │
  │                         ├────────────────────────┼───────────────────►│
  │                         │                        │                    │
  │                         │◄───────────────────────┼────────────────────┤
  │                         │ { user, orgs, roles }  │                    │
  │                         │                        │                    │
  │                         │ Set AuthContext        │                    │
  │                         │ status='authenticated' │                    │
  │                         │                        │                    │
  │ User stays logged in    │                        │                    │
  │◄────────────────────────┤                        │                    │
```

**If session expired or invalid:**
- Supabase returns null session
- AuthContext status='unauthenticated'
- ProtectedRoute redirects to `/auth`

---

## 4. Backend API Design

### 4.1. Minimal Endpoints

We only need **ONE** endpoint:

**GET `/api/auth/me`**

**Purpose:** Get current user's application data (AppUser + organizations + roles)

**Authentication:** Requires valid Supabase JWT in `Authorization: Bearer {token}` header

**Request:**
```http
GET /api/auth/me HTTP/1.1
Authorization: Bearer eyJhbGc...
```

**Response (Success):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Иван Иванов",
    "locale": "ru"
  },
  "organizations": [
    {
      "id": "uuid",
      "name": "ООО Пример",
      "slug": "primer",
      ...
    }
  ],
  "memberships": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "user_id": "uuid",
      "role": "owner"
    }
  ],
  "platform_roles": ["platform_admin"]
}
```

**Response (Error):**
```json
{
  "detail": "Invalid or expired token"
}
```

**Implementation Notes:**
- JWT validation done via FastAPI dependency
- Extract `user_id` from JWT claims
- Query `app_users` table
- If user doesn't exist in `app_users`, create from Supabase user metadata
- Return full session payload

### 4.2. JWT Validation (Dependency)

```python
# backend/app/core/auth_deps.py

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from jose import jwt, JWTError
from .config import get_settings
from .supabase import supabase_admin

security = HTTPBearer()

async def get_current_user_id(
    credentials: HTTPAuthCredentials = Depends(security)
) -> str:
    """
    Validate Supabase JWT and extract user_id.
    """
    token = credentials.credentials
    settings = get_settings()
    
    try:
        # Decode JWT using Supabase's JWT secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,  # from env
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
```

**Usage:**
```python
@router.get('/me')
async def get_me(user_id: str = Depends(get_current_user_id)):
    session = await get_session_data(user_id)
    return session
```

### 4.3. Deprecated/Deleted Endpoints

The following endpoints will be **REMOVED**:
- ❌ `POST /api/auth/login` (replaced by direct Supabase client)
- ❌ `POST /api/auth/after-signup` (replaced by direct Supabase client)
- ❌ `GET /api/auth/yandex/start` (replaced by Supabase OAuth)

We **KEEP**:
- ✅ `GET /api/auth/me` (renamed from `/api/auth/session`)
- ✅ `GET /api/auth/linked-accounts` (useful utility)

---

## 5. Frontend Implementation Plan

### 5.1. File Structure

```
src/
├── auth/
│   ├── AuthPage.tsx              # Combined login/register page
│   ├── ResetPasswordPage.tsx     # Password reset UI
│   ├── AuthCallbackPage.tsx      # OAuth callback handler
│   ├── AuthProvider.tsx          # Context provider
│   ├── ProtectedRoute.tsx        # Route wrapper
│   └── components/
│       ├── EmailPasswordForm.tsx # Email+password inputs
│       ├── SocialLoginButtons.tsx# Google + Yandex buttons
│       └── PasswordInput.tsx     # Input with show/hide toggle
├── lib/
│   └── supabaseClient.ts         # Supabase client init (existing)
└── types/
    └── auth.ts                   # Type definitions (existing)
```

### 5.2. AuthProvider (Context)

**Responsibilities:**
- Subscribe to `supabase.auth.onAuthStateChange()`
- Maintain auth state: `{ status, user, session }`
- Fetch AppUser from backend when signed in
- Provide `login()`, `signup()`, `logout()` helpers

**State:**
```typescript
type AuthState = {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  user: AppUser | null
  session: Session | null  // Supabase session
  organizations: Organization[]
  memberships: OrganizationMembership[]
  platformRoles: PlatformRole[]
}
```

**Methods:**
```typescript
type AuthContextType = {
  ...AuthState
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string, fullName?: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithYandex: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}
```

### 5.3. AuthPage Component

**Layout:**
```
┌──────────────────────────────────────────┐
│          Работаем Честно!                │
│                                          │
│  ┌────────────┬────────────┐            │
│  │   Вход     │ Регистрация│  ← Tabs    │
│  └────────────┴────────────┘            │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Войти через Google                │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Войти через Яндекс                │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ─────────── или ───────────            │
│                                          │
│  E-mail                                  │
│  ┌────────────────────────────────────┐ │
│  │ you@example.com                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Пароль                                  │
│  ┌────────────────────────────────────┐ │
│  │ ••••••••     [👁 Показать пароль] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [If Регистрация tab active:]           │
│  Полное имя                              │
│  ┌────────────────────────────────────┐ │
│  │ Иван Иванов                        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │         Войти / Зарегистрироваться │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Забыли пароль?                          │
│                                          │
└──────────────────────────────────────────┘
```

**Behavior:**
- Two tabs: "Вход" and "Регистрация"
- Social login buttons always visible
- Email+password form adapts to selected tab
- "Забыли пароль?" link opens modal or navigates to `/auth/reset`

### 5.4. PasswordInput Component

```tsx
const PasswordInput = ({ value, onChange, placeholder }) => {
  const [showPassword, setShowPassword] = useState(false)
  
  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={showPassword}
      >
        {showPassword ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  )
}
```

### 5.5. ProtectedRoute Component

```tsx
const ProtectedRoute = ({ children }) => {
  const { status } = useAuth()
  const location = useLocation()
  
  if (status === 'loading') {
    return <div>Загрузка...</div>
  }
  
  if (status === 'unauthenticated') {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }
  
  return children
}
```

**Usage:**
```tsx
<Route
  path="/dashboard/*"
  element={
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  }
/>
```

---

## 6. Error Handling

### Frontend Error Messages (Russian)

| Scenario | Message |
|----------|---------|
| Wrong email/password | Неверный e-mail или пароль |
| Network error | Не удалось выполнить вход. Проверьте подключение к интернету. |
| Server error (500) | Ошибка сервера. Попробуйте позже. |
| Email already exists | Этот e-mail уже зарегистрирован |
| Weak password | Пароль слишком короткий (минимум 8 символов) |
| Invalid email format | Неверный формат e-mail |
| Password reset sent | Мы отправили письмо со ссылкой для восстановления пароля |
| Password reset success | Пароль успешно изменён |

### Backend Error Responses

**Standard format:**
```json
{
  "detail": "Error message in English (for logging)",
  "message_ru": "Сообщение для пользователя"  // Optional
}
```

---

## 7. Supabase Configuration

### Required Settings

**Authentication → Providers:**
- ✅ Email (enabled)
- ✅ Google OAuth (credentials configured)
- ✅ Yandex OAuth (credentials configured)

**Authentication → URL Configuration:**
- Site URL: `http://localhost:5174` (dev) / `https://yourdomain.com` (prod)
- Redirect URLs:
  - `http://localhost:5174/auth/callback`
  - `https://yourdomain.com/auth/callback`

**Authentication → Email Templates:**
- Confirmation email (if enabled)
- Password reset email
  - Redirect to: `{{ .SiteURL }}/auth/reset`

---

## 8. Testing Checklist

### Manual Tests (to be detailed in AUTH_MANUAL_TESTS.md)

1. **Registration**
   - [ ] Valid email+password → success
   - [ ] Weak password → error
   - [ ] Email already registered → error
   - [ ] Invalid email format → error

2. **Login**
   - [ ] Correct credentials → success
   - [ ] Wrong password → error message
   - [ ] Unregistered email → error message
   - [ ] Network failure → appropriate error

3. **OAuth**
   - [ ] Google login → success
   - [ ] Yandex login → success
   - [ ] OAuth cancel → return to login page

4. **Password Reset**
   - [ ] Request reset email → success message
   - [ ] Click link in email → reset page
   - [ ] Set new password → success
   - [ ] Login with new password → success

5. **Session Persistence**
   - [ ] Page reload → user stays logged in
   - [ ] Close tab, reopen → user stays logged in
   - [ ] Wait 1 hour, reload → session refreshed automatically

6. **Logout**
   - [ ] Logout → session cleared
   - [ ] Protected pages redirect to /auth

7. **UI**
   - [ ] Password show/hide toggle works
   - [ ] Tab navigation (Login ↔ Registration)
   - [ ] All text in Russian
   - [ ] Responsive design

---

## 9. Migration Notes

### Database
- ✅ No changes to `app_users` table required
- ✅ Keep existing Supabase configuration
- ✅ `auth.users` table managed by Supabase (no changes)

### Environment Variables

**Backend (.env):**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-jwt-secret  # NEW: for JWT validation
DATABASE_URL=postgresql://...
```

**Frontend (.env.local):**
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 10. Implementation Roadmap

1. ✅ Phase 1: Audit legacy code (DONE)
2. ✅ Phase 2: Design new flow (THIS DOCUMENT)
3. ⏳ Phase 3: Backend (implement `/api/auth/me`, delete old endpoints)
4. ⏳ Phase 4: Frontend AuthProvider
5. ⏳ Phase 5: Frontend AuthPage (login/register)
6. ⏳ Phase 6: ProtectedRoute wrapper
7. ⏳ Phase 7: Password reset flow
8. ⏳ Phase 8: Testing & documentation
9. ⏳ Phase 9: Delete legacy code
10. ⏳ Phase 10: Deploy & verify

---

**Design Complete. Ready for Implementation.**
