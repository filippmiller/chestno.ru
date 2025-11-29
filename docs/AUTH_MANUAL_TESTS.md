# Authentication Manual Testing Checklist

**Last Updated:** November 29, 2025  
**Version:** 1.0

---

## Prerequisites

Before testing:
- ✅ Backend server running on port 8000
- ✅ Frontend server running on port 5174
- ✅ Supabase project configured with:
  - Email provider enabled
  - Google OAuth configured
  - Yandex OAuth configured (if available)
- ✅ Test email account accessible for verification emails

---

## 1. Email + Password Registration

### Test 1.1: Successful Registration
**Steps:**
1. Navigate to `http://localhost:5174/auth`
2. Click "Регистрация" tab
3. Enter:
   - Full Name: `Тестовый Пользователь`
   - Email: `test+<unique>@example.com` (use unique suffix)
   - Password: `TestPass123`
4. Click "Зарегистрироваться"

**Expected Result:**
- ✅ Form submits without errors
- ✅ Either:
  - Immediately redirected to `/dashboard` (if email confirmation disabled)
  - OR success message: "Регистрация успешна! Проверьте почту..." (if confirmation enabled)
- ✅ User can login after confirming email

### Test 1.2: Duplicate Email
**Steps:**
1. Try registering with an email that already exists

**Expected Result:**
- ✅ Error message: "Этот e-mail уже зарегистрирован"
- ✅ Form remains functional

### Test 1.3: Weak Password
**Steps:**
1. Enter password: `123`

**Expected Result:**
- ✅ Error message: "Пароль слишком короткий (минимум 6 символов)"

### Test 1.4: Invalid Email Format
**Steps:**
1. Enter email: `not-an-email`

**Expected Result:**
- ✅ Browser validation prevents submission OR
- ✅ Error message: "Неверный формат e-mail"

---

## 2. Email + Password Login

### Test 2.1: Successful Login
**Steps:**
1. Navigate to `http://localhost:5174/auth`
2. Ensure "Вход" tab is active
3. Enter valid credentials
4. Click "Войти"

**Expected Result:**
- ✅ Redirected to `/dashboard`
- ✅ User data loaded (name, email visible in header)
- ✅ No console errors

### Test 2.2: Wrong Password
**Steps:**
1. Enter correct email, wrong password
2. Click "Войти"

**Expected Result:**
- ✅ Error message: "Неверный e-mail или пароль"
- ✅ No redirect
- ✅ Password field cleared or stays filled

### Test 2.3: Unregistered Email
**Steps:**
1. Enter email that doesn't exist: `nonexistent@example.com`
2. Enter any password

**Expected Result:**
- ✅ Error message: "Неверный e-mail или пароль"
- ✅ Same behavior as wrong password (for security)

### Test 2.4: Network Failure Simulation
**Steps:**
1. Stop backend server
2. Try to login

**Expected Result:**
- ✅ Error message: "Не удалось подключиться. Проверьте интернет." OR similar
- ✅ Form remains usable

---

## 3. Password Show/Hide Toggle

### Test 3.1: Toggle Functionality
**Steps:**
1. Enter password in password field
2. Click the eye icon
3. Click again

**Expected Result:**
- ✅ First click: password becomes visible (text shown)
- ✅ Second click: password hidden again (••••)
- ✅ Icon changes between Eye and EyeOff
- ✅ Accessible via keyboard (Tab to button, Enter to toggle)

---

## 4. Google OAuth Login

### Test 4.1: Successful Google Login
**Steps:**
1. Click "Войti через Google"
2. Authenticate with Google account
3. Grant permissions

**Expected Result:**
- ✅ Redirected to Google OAuth consent screen
- ✅ After approval, redirected to `/auth/callback`
- ✅ Then redirected to `/dashboard`
- ✅ User logged in with Google email

### Test 4.2: OAuth Cancel
**Steps:**
1. Click "Войти через Google"
2. Close OAuth popup or click "Cancel"

**Expected Result:**
- ✅ User returns to `/auth` page
- ✅ Not logged in
- ✅ Can try again

---

## 5. Yandex OAuth Login

### Test 5.1: Successful Yandex Login
**Steps:**
1. Click "Войти через Яндекс"
2. Authenticate with Yandex account

**Expected Result:**
- ✅ Same flow as Google
- ✅ Successfully logged in

**Note:** This depends on Supabase Yandex provider being configured.

---

## 6. Password Reset Flow

### Test 6.1: Request Reset Email
**Steps:**
1. On auth page, click "Забыли пароль?"
2. Enter registered email
3. Click "Отправить ссылку для восстановления"

**Expected Result:**
- ✅ Success message: "Мы отправили письмо..."
- ✅ Email received (check inbox)
- ✅ Email contains clickable link

### Test 6.2: Click Reset Link
**Steps:**
1. Open email
2. Click password reset link

**Expected Result:**
- ✅ Redirected to `/auth/reset`
- ✅ Form shows "Установите новый пароль"
- ✅ Two password fields visible

### Test 6.3: Set New Password - Success
**Steps:**
1. Enter new password in both fields (matching)
2. Click "Изменить пароль"

**Expected Result:**
- ✅ Success message: "Пароль успешно изменён!"
- ✅ Auto-redirect to `/dashboard`
- ✅ User is logged in

### Test 6.4: Set New Password - Mismatch
**Steps:**
1. Enter different passwords in the two fields
2. Click "Изменить пароль"

**Expected Result:**
- ✅ Error: "Пароли не совпадают"
- ✅ No submission

### Test 6.5: Expired Reset Link
**Steps:**
1. Use a reset link that's older than 1 hour (or expired)

**Expected Result:**
- ✅ Error message: "Ссылка недействительна или истекла..."
- ✅ Option to request new link

---

## 7. Session Persistence

### Test 7.1: Page Reload
**Steps:**
1. Login successfully
2. Reload page (F5 or Ctrl+R)

**Expected Result:**
- ✅ User remains logged in
- ✅ Dashboard still shows user data
- ✅ No re-login required

### Test 7.2: Open in New Tab
**Steps:**
1. Login in one tab
2. Open `http://localhost:5174/dashboard` in new tab

**Expected Result:**
- ✅ User is logged in in new tab
- ✅ Same session data visible

### Test 7.3: Session Refresh (Long-running)
**Steps:**
1. Login
2. Wait 1 hour (or adjust Supabase token expiry)
3. Perform an action

**Expected Result:**
- ✅ Session automatically refreshes (if refresh token valid)
- ✅ OR user redirected to login if refresh failed

---

## 8. Logout

### Test 8.1: Logout Button
**Steps:**
1. Login
2. Click "Выйти" button (in header or settings)

**Expected Result:**
- ✅ Session cleared
- ✅ Redirected to `/` or `/auth`
- ✅ localStorage cleared

### Test 8.2: Protected Pages After Logout
**Steps:**
1. Logout
2. Manually navigate to `/dashboard`

**Expected Result:**
- ✅ Redirected to `/auth`
- ✅ "Loading..." state briefly shown

---

## 9. Route Protection

### Test 9.1: Access Protected Route While Unauthenticated
**Steps:**
1. Ensure logged out
2. Navigate to `/dashboard` directly

**Expected Result:**
- ✅ Redirected to `/auth`
- ✅ After login, redirected back to `/dashboard`

### Test 9.2: Public Routes Always Accessible
**Steps:**
1. Without logging in, visit:
   - `/`
   - `/products`
   - `/about`
   - `/pricing`

**Expected Result:**
- ✅ All pages load without requiring login

---

## 10. UI & UX

### Test 10.1: Tab Navigation (Login ↔ Registration)
**Steps:**
1. Click between "Вход" and "Регистрация" tabs

**Expected Result:**
- ✅ Tabs switch smoothly
- ✅ Form fields reset (or retain values appropriately)
- ✅ No layout shift

### Test 10.2: All Text in Russian
**Steps:**
1. Review all auth pages

**Expected Result:**
- ✅ All labels, buttons, messages in Russian
- ✅ Consistent terminology

### Test 10.3: Responsive Design
**Steps:**
1. Test on different screen sizes:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

**Expected Result:**
- ✅ Forms remain usable
- ✅ No horizontal scrolling
- ✅ Touch targets adequate on mobile

### Test 10.4: Loading States
**Steps:**
1. During login/signup, observe button state

**Expected Result:**
- ✅ Button shows "Входим..." or "Регистрация..." during submission
- ✅ Button disabled during submission
- ✅ No double-submit possible

---

## 11. Error Recovery

### Test 11.1: Backend Down
**Steps:**
1. Stop backend server
2. Try login

**Expected Result:**
- ✅ Frontend shows appropriate error
- ✅ User not stuck in loading state

### Test 11.2: Supabase Unreachable
**Steps:**
1. Block Supabase URL in network DevTools
2. Try login

**Expected Result:**
- ✅ Error message shown
- ✅ Can retry after unblocking

---

## Test Result Summary

| Test Category | Pass | Fail | Notes |
|---------------|------|------|-------|
| Registration | | | |
| Login | | | |
| Password Reset | | | |
| OAuth (Google) | | | |
| OAuth (Yandex) | | | |
| Session Persistence | | | |
| Logout | | | |
| Route Protection | | | |
| UI/UX | | | |
| Error Handling | | | |

**Tested By:**  
**Date:**  
**Environment:** Local (localhost:5174)

---

## Known Issues / Notes

(Document any issues found during testing here)
