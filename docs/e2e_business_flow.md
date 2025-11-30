# E2E Tests: Business Registration, Approval & Reviews Flow

This document describes the end-to-end (E2E) test that validates the complete business lifecycle on the production environment.

## Overview

The E2E test covers the full lifecycle of a business in the platform:

1. **Business Registration**: A new business registers (via API, as UI may not support full business registration yet)
2. **Admin Approval**: An admin sees the new business in the admin panel and approves it
3. **User Registration & Review**: A regular user registers, finds the business, and leaves a review
4. **Business Owner Dashboard**: The business owner logs into their dashboard and sees the new review
5. **Public Profile**: The review is visible on the public company profile for anonymous visitors

## Test Location

- **Test File**: `frontend/tests/e2e/business_flow.spec.ts`
- **Framework**: Playwright
- **Language**: TypeScript

## URLs Used

### Public Site
- **Base URL**: `E2E_BASE_URL` environment variable (default: `https://chestnoru-production.up.railway.app`)
- **Public Organization Page**: `/org/{organizationId}`
- **Review Creation Page**: `/org/{organizationId}/review`

### Admin Panel
- **Admin Panel**: `/admin` (derived from `E2E_BASE_URL`)
- **Pending Registrations Tab**: `/admin` → "Pending Registrations" tab

### User Dashboard
- **Dashboard**: `/dashboard`
- **Organization Reviews**: `/dashboard/organization/reviews`

### Authentication
- **Auth Page**: `/auth` (login and registration tabs)

## Environment Variables

The following environment variables are required to run the E2E tests:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `E2E_BASE_URL` | Base URL of the production site | No (has default) | `https://chestnoru-production.up.railway.app` |
| `E2E_ADMIN_EMAIL` | Admin user email for approval step | **Yes** | `admin@example.com` |
| `E2E_ADMIN_PASSWORD` | Admin user password | **Yes** | `SecurePassword123!` |
| `VITE_SUPABASE_URL` | Supabase URL (for API registration) | No (test will skip if missing) | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | No (test will skip if missing) | `eyJhbGc...` |

## Running the Tests

### Prerequisites

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

### Run Tests

**Basic run:**
```bash
npm run test:e2e
```

**With UI mode (interactive):**
```bash
npm run test:e2e:ui
```

**Headed mode (see browser):**
```bash
npm run test:e2e:headed
```

**With environment variables:**
```bash
E2E_BASE_URL=https://chestnoru-production.up.railway.app \
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD=SecurePassword123! \
npm run test:e2e
```

### Windows PowerShell

```powershell
$env:E2E_BASE_URL="https://chestnoru-production.up.railway.app"
$env:E2E_ADMIN_EMAIL="admin@example.com"
$env:E2E_ADMIN_PASSWORD="SecurePassword123!"
npm run test:e2e
```

## Test Flow Details

### Step 1: Business Registration

The test registers a new business via API calls:

1. Creates a user in Supabase Auth (`/auth/v1/signup`)
2. Completes business registration via `/api/auth/after-signup` endpoint
3. Creates an organization with:
   - Unique business name: `Test Business {timestamp}`
   - Email: `test-business-owner-{timestamp}@example.com`
   - Password: `TestBiz!{timestamp}`
   - Country: `Россия`
   - City: `Москва`

**Note**: Business registration via UI is not yet fully implemented, so the test uses the API directly. Once the UI supports full business registration, the test can be updated to use the UI flow.

### Step 2: Admin Approval

1. Admin logs in at `/auth`
2. Navigates to `/admin`
3. Clicks "Pending Registrations" tab
4. Finds the pending business by name or email
5. Clicks "Подтвердить" (Approve) button
6. Confirms approval (handles prompt if needed)

**Expected Result**: Business status changes from `pending` to `verified/approved`

### Step 3: User Registration & Review

1. Logs out admin
2. Registers a new regular user:
   - Email: `test-user-{timestamp}@example.com`
   - Password: `TestUser!{timestamp}`
3. Navigates to business public profile: `/org/{organizationId}`
4. Clicks "Оставить отзыв" (Leave review)
5. Fills review form:
   - Rating: 5 stars
   - Text: `Automated E2E test review – please ignore. Timestamp: {timestamp}`
   - Optional title
6. Submits review

**Expected Result**: Review is submitted successfully and user is redirected to organization page

### Step 4: Business Owner Sees Review

1. Logs out regular user
2. Logs in as business owner
3. Navigates to `/dashboard/organization/reviews`
4. Verifies review is visible (may show as "pending" if moderation is required)

**Expected Result**: Review appears in business owner's dashboard

### Step 5: Review on Public Profile

1. Logs out business owner
2. Visits public organization page as anonymous user: `/org/{organizationId}`
3. Checks if review is visible

**Expected Result**: Review is visible on public profile (or shows moderation status if pending)

## Test Data

The test generates unique data for each run using a timestamp:

- **Business Name**: `Test Business {timestamp}`
- **Business Owner Email**: `test-business-owner-{timestamp}@example.com`
- **Regular User Email**: `test-user-{timestamp}@example.com`
- **Review Text**: `Automated E2E test review – please ignore. Timestamp: {timestamp}`

This ensures tests can be run multiple times without conflicts.

## Known Limitations & Notes

1. **Business Registration**: Currently uses API directly as UI may not support full business registration flow yet. Once UI is updated, test should be modified to use UI flow.

2. **Review Moderation**: Reviews may require moderation before appearing publicly. The test checks for both approved and pending states.

3. **Timing**: Some steps may require waiting for backend processing. The test includes appropriate timeouts and waits.

4. **Supabase Credentials**: If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not available, the business registration step will be skipped with a message.

## Troubleshooting

### Test Fails at Business Registration

- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Verify Supabase credentials are valid
- Check network connectivity to Supabase

### Test Fails at Admin Approval

- Verify `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are correct
- Ensure admin user has `platform_admin` or `platform_owner` role
- Check that business appears in pending registrations list

### Test Fails at Review Submission

- Verify business was approved in previous step
- Check that business is publicly visible (`public_visible=true`)
- Ensure review form fields are accessible

### Review Not Visible

- Reviews may require moderation before appearing publicly
- Check review status in admin panel or business dashboard
- Verify organization is verified and publicly visible

## Test Reports

After running tests, Playwright generates an HTML report:

```bash
npx playwright show-report
```

The report includes:
- Test execution timeline
- Screenshots on failure
- Video recordings (if enabled)
- Network requests
- Console logs

## CI/CD Integration

To run tests in CI/CD:

```yaml
# Example GitHub Actions
- name: Run E2E tests
  env:
    E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
    E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
    E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: |
    cd frontend
    npm run test:e2e
```

## Future Improvements

1. **UI Business Registration**: Update test to use UI flow once business registration is fully implemented in the frontend
2. **More Assertions**: Add more detailed assertions for each step
3. **Parallel Execution**: Run multiple test scenarios in parallel
4. **Test Data Cleanup**: Add cleanup step to remove test data after test completion
5. **Screenshot Comparison**: Add visual regression testing for UI components

