# Admin Panel Manual Test Scripts

This document provides step-by-step instructions for manually testing admin panel functionality on production.

## Prerequisites

1. **Admin Credentials:**
   - Email: Set via `E2E_ADMIN_EMAIL` environment variable
   - Password: Set via `E2E_ADMIN_PASSWORD` environment variable

2. **Production URL:**
   - Base URL: `https://chestnoru-production.up.railway.app`
   - Admin Panel: `https://chestnoru-production.up.railway.app/admin`

3. **Browser:**
   - Chrome, Firefox, or Edge (latest version)
   - Developer tools enabled (F12)

## Test Scripts

### 1. Admin Login & Access Control

**Steps:**
1. Navigate to `{BASE_URL}/auth`
2. Enter admin email and password
3. Click "Войти" (Login)
4. Verify redirect to `/dashboard` or `/admin`
5. Navigate to `/admin`
6. Verify admin panel loads without "Access Denied" message

**Expected Result:**
- Admin successfully logs in
- Admin panel is accessible
- No access denied errors

**If Failed:**
- Check admin credentials
- Verify user has `platform_admin` or `platform_owner` role in database
- Check browser console for errors

---

### 2. Pending Business Registrations

**Steps:**
1. Login as admin (see Test 1)
2. Navigate to `/admin`
3. Click "Pending Registrations" tab
4. Verify list of pending businesses loads
5. Click on a business card to view details
6. Click "Подтвердить" (Approve) button
7. Enter comment in prompt (e.g., "Approved for testing")
8. Click OK
9. Verify business disappears from pending list or status changes

**Expected Result:**
- Pending registrations list displays
- Business details are visible
- Approval action succeeds
- Business status updates

**If Failed:**
- Check browser console for API errors
- Verify backend `/api/moderation/organizations` endpoint is accessible
- Check network tab for failed requests

---

### 3. Reject Business Registration

**Steps:**
1. Login as admin
2. Navigate to `/admin` → "Pending Registrations"
3. Find a pending business
4. Click "Отклонить" (Reject) button
5. Enter rejection comment
6. Click OK
7. Verify business status changes to "rejected"

**Expected Result:**
- Rejection action succeeds
- Business status updates to rejected
- Comment is saved

---

### 4. Filter by Status (Moderation Dashboard)

**Steps:**
1. Login as admin
2. Navigate to `/dashboard/moderation/organizations`
3. Look for status filter buttons/tabs
4. Click "Pending" filter
5. Verify only pending businesses show
6. Click "Verified" filter
7. Verify only verified businesses show
8. Click "Rejected" filter
9. Verify only rejected businesses show

**Expected Result:**
- Filters work correctly
- List updates based on selected status
- No errors in console

---

### 5. Admin Dashboard Metrics

**Steps:**
1. Login as admin
2. Navigate to `/dashboard/admin`
3. Verify dashboard loads
4. Check for metric cards:
   - Total organizations
   - Verified organizations
   - Public organizations
   - Total products
   - Total QR codes
   - Total QR scan events
5. Verify numbers are displayed (not loading or error)

**Expected Result:**
- Dashboard loads successfully
- All metric cards display numbers
- No errors

**If Failed:**
- Check `/api/admin/dashboard/summary` endpoint
- Verify backend service is running
- Check browser console for errors

---

### 6. Database Explorer

**Steps:**
1. Login as admin
2. Navigate to `/admin/db`
3. Verify table list loads
4. Click on a table name (e.g., `organizations`)
5. Verify columns are displayed
6. Verify rows are displayed (if any)
7. Try searching/filtering rows
8. Try creating a migration draft (if feature exists)

**Expected Result:**
- Database explorer loads
- Tables list is visible
- Table details (columns, rows) are accessible
- No database errors

**If Failed:**
- Check `/api/admin/db/tables` endpoint
- Verify admin has database access
- Check browser console

---

### 7. AI Integrations Management

**Steps:**
1. Login as admin
2. Navigate to `/admin`
3. Click "AI Integrations" tab
4. Verify list of integrations loads (or empty state)
5. Fill in form to create new integration:
   - Provider ID: `test-provider`
   - Display Name: `Test Provider`
   - ENV Variable: `TEST_PROVIDER_API_KEY`
6. Click "Добавить интеграцию" (Add Integration)
7. Verify integration appears in list
8. Click "Run check" on an integration
9. Verify health check runs

**Expected Result:**
- AI Integrations tab loads
- Can create new integration
- Health check works

---

### 8. Dev Tasks Management

**Steps:**
1. Login as admin
2. Navigate to `/admin`
3. Click "Dev / To-Do" tab
4. Verify tasks list loads
5. Fill in form to create new task:
   - Title: `Test Task`
   - Category: `integration`
   - Priority: `medium`
6. Click "Добавить задачу" (Add Task)
7. Verify task appears in list
8. Change task status using dropdown
9. Verify status updates

**Expected Result:**
- Dev Tasks tab loads
- Can create tasks
- Can update task status
- Filters work

---

### 9. Organization Reviews Moderation (Organization Owner)

**Note:** This is currently only available to organization owners, not platform admins.

**Steps:**
1. Login as business owner (not admin)
2. Navigate to `/dashboard/organization/reviews`
3. Verify reviews list loads
4. Find a pending review
5. Click approve/reject button
6. Verify review status changes

**Expected Result:**
- Reviews page loads
- Can moderate reviews
- Status updates correctly

**Gap:** No global admin review moderation interface exists yet.

---

### 10. Subscription Plan Management (Moderation Dashboard)

**Steps:**
1. Login as admin
2. Navigate to `/dashboard/moderation/organizations`
3. Find an organization
4. Look for subscription plan dropdown/selector
5. Change organization's subscription plan
6. Verify plan updates

**Expected Result:**
- Can view organization subscriptions
- Can change subscription plans
- Changes persist

---

## Test Results Template

Use this template to record test results:

```markdown
## Test Run: [Date]

### Test 1: Admin Login
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 2: Pending Registrations
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 3: Reject Business
- Status: ✅ Pass / ❌ Fail
- Notes: 

[... continue for all tests ...]
```

## Common Issues & Troubleshooting

### Issue: "Access Denied" Error

**Possible Causes:**
- User doesn't have `platform_admin` or `platform_owner` role
- Session expired
- Cookie issues

**Solutions:**
- Verify user role in database: `SELECT role FROM app_profiles WHERE email = 'admin@example.com'`
- Clear browser cookies and login again
- Check `platform_roles` table if using legacy auth

### Issue: API Endpoints Return 401

**Possible Causes:**
- Session cookie expired
- Auth token invalid
- CORS issues

**Solutions:**
- Logout and login again
- Check browser network tab for actual error
- Verify `withCredentials: true` is set in httpClient

### Issue: Empty Lists / No Data

**Possible Causes:**
- No data exists (valid state)
- API endpoint error
- Filter applied incorrectly

**Solutions:**
- Check API response in network tab
- Verify backend is running
- Try different filters
- Check database directly

### Issue: Actions Don't Persist

**Possible Causes:**
- Backend error
- Database transaction failed
- Validation error

**Solutions:**
- Check browser console for errors
- Check network tab for failed requests
- Verify backend logs
- Check database directly

## Reporting Issues

When reporting issues, include:

1. **Test Name:** Which manual test failed
2. **Steps to Reproduce:** Exact steps taken
3. **Expected Result:** What should happen
4. **Actual Result:** What actually happened
5. **Browser Console:** Any errors in console
6. **Network Tab:** Failed API requests
7. **Screenshots:** If applicable

## Next Steps After Manual Testing

1. Document any bugs found
2. Update `docs/admin_audit.md` with findings
3. Create GitHub issues for critical bugs
4. Prioritize missing features based on test results


