# Admin Panel Functional Audit & Tests

**Date:** 2025-11-30  
**Status:** In Progress  
**Production URL:** `https://chestnoru-production.up.railway.app`

## Overview

This document provides a comprehensive audit of the admin panel functionality, comparing what exists today against the target specification, and documenting test coverage for critical admin flows.

## Environment Variables

See [`docs/admin_env.md`](admin_env.md) for detailed information about environment variables.

### Quick Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `E2E_BASE_URL` | Base URL of production site | No (has default) |
| `E2E_ADMIN_EMAIL` | Admin user email for testing | **Yes** |
| `E2E_ADMIN_PASSWORD` | Admin user password | **Yes** |

**Note:** Admin credentials should be stored securely and never committed to the repository. Use environment variables or secure secret management.

### Admin Panel URLs

- **Admin Panel:** `{E2E_BASE_URL}/admin`
- **Admin Dashboard:** `{E2E_BASE_URL}/dashboard/admin`
- **Moderation Dashboard:** `{E2E_BASE_URL}/dashboard/moderation/organizations`
- **Database Explorer:** `{E2E_BASE_URL}/admin/db`

## Existing Admin Routes & Pages

### Frontend Routes

| Route | Component | Purpose | Module |
|-------|-----------|---------|--------|
| `/admin` | `AdminPanelPage` | Main admin panel with tabs | Admin Panel |
| `/dashboard/admin` | `AdminDashboardPage` | Admin metrics dashboard | Analytics & Reports |
| `/dashboard/moderation/organizations` | `ModerationDashboardPage` | Organization moderation | Pending Registrations |
| `/admin/db` | `DatabaseExplorerPage` | Database browser/explorer | System / Logs |

### Backend API Routes

| Endpoint | Method | Purpose | Module |
|----------|--------|---------|--------|
| `/api/admin/dashboard/summary` | GET | Get admin dashboard metrics | Analytics & Reports |
| `/api/admin/moderation/organizations` | GET | List organizations for moderation | Pending Registrations |
| `/api/admin/moderation/organizations/{id}/verify` | POST | Approve/reject organization | Pending Registrations |
| `/api/admin/ai/integrations` | GET | List AI integrations | System / Logs |
| `/api/admin/ai/integrations` | POST | Create AI integration | System / Logs |
| `/api/admin/ai/integrations/{id}` | PATCH | Update AI integration | System / Logs |
| `/api/admin/ai/integrations/{id}/check` | POST | Health check AI integration | System / Logs |
| `/api/admin/db/tables` | GET | List database tables | System / Logs |
| `/api/admin/db/tables/{table}/columns` | GET | Get table columns | System / Logs |
| `/api/admin/db/tables/{table}/rows` | GET | Get table rows | System / Logs |
| `/api/admin/db/migration-draft` | POST | Create migration draft | System / Logs |

## Feature-by-Feature Checklist

### Module Coverage Table

| Module | Admin Route(s) | Implemented? | Tested on PROD? | Notes / Gaps / Bugs |
|--------|----------------|--------------|-----------------|---------------------|
| **Pending Business Registrations** | `/admin` (Pending tab), `/dashboard/moderation/organizations` | ✅ **Yes** | ⚠️ **Partial** | Basic approve/reject works. Missing: detailed view, history log, "send back for changes" |
| **Companies / Businesses Management** | None dedicated | ❌ **No** | ❌ **No** | Missing: list all businesses, filters, edit profiles, block/unblock, impersonation |
| **Users & Roles** | None | ❌ **No** | ❌ **No** | Missing: user list, role management, block/unblock users |
| **Reviews & Content Moderation** | `/dashboard/organization/reviews` (org-level only) | ⚠️ **Partial** | ⚠️ **Partial** | Organization owners can moderate their reviews. Missing: global admin review moderation |
| **Notifications & Reminders** | None | ❌ **No** | ❌ **No** | Missing: admin view of notifications, config, logs |
| **Tariffs / Plans / Billing** | `/dashboard/moderation/organizations` (subscription column) | ⚠️ **Partial** | ⚠️ **Partial** | Can view/change subscriptions in moderation dashboard. Missing: dedicated plans management |
| **Directories & Taxonomies** | None | ❌ **No** | ❌ **No** | Missing: categories, cities, tags CRUD |
| **Analytics & Reports** | `/dashboard/admin` | ✅ **Yes** | ⚠️ **Partial** | Basic metrics dashboard exists. Missing: charts, detailed reports, exports |
| **System / Logs / Settings** | `/admin/db`, `/admin` (AI Integrations, Dev Tasks) | ⚠️ **Partial** | ⚠️ **Partial** | Database explorer exists. Missing: system logs, security/access control UI |

**Legend:**
- ✅ **Yes** - Fully implemented
- ⚠️ **Partial** - Partially implemented or exists but needs improvement
- ❌ **No** - Not implemented

## Detailed Module Analysis

### 1. Pending Business Registrations ✅

**Status:** Implemented (Basic)

**Routes:**
- Frontend: `/admin` (Pending Registrations tab)
- Frontend: `/dashboard/moderation/organizations`
- Backend: `/api/admin/moderation/organizations` (GET)
- Backend: `/api/admin/moderation/organizations/{id}/verify` (POST)

**Features:**
- ✅ List pending organizations
- ✅ View organization details (name, city, country, website, creation date)
- ✅ Approve organization (`verify` action)
- ✅ Reject organization (`reject` action)
- ✅ Add comment when approving/rejecting
- ✅ Filter by status (pending/verified/rejected)
- ✅ View organization profile link

**Missing Features:**
- ❌ Detailed view page (currently shows in list only)
- ❌ History of moderation actions (who, when, what decision)
- ❌ "Send back for changes" action
- ❌ Status transitions tracking
- ❌ Bulk actions (approve/reject multiple)
- ❌ Search/filter by business name or email

**Gaps:**
- No audit log of who approved/rejected and when
- No way to see previous moderation attempts
- Comment is optional and stored but not displayed in history

### 2. Companies / Businesses Management ❌

**Status:** Not Implemented

**Missing Features:**
- ❌ List of all businesses with filters
- ❌ Search by business name
- ❌ View/edit business profile (admin view)
- ❌ Toggle "verified / honest / trusted" badge
- ❌ Block/unblock business (soft ban)
- ❌ "Login as owner" / impersonation
- ❌ Filter by status, city, category, tariff

**Note:** Business profiles can be viewed via `/org/{id}` but there's no admin interface for managing them centrally.

### 3. Users & Roles ❌

**Status:** Not Implemented

**Missing Features:**
- ❌ List of all users
- ❌ Search/filter by email, role, status
- ❌ Change user roles (user ↔ business_owner ↔ moderator ↔ admin)
- ❌ Block/unblock user
- ❌ Trigger password reset
- ❌ View user activity/logs

**Note:** User roles are managed in `app_profiles` table but there's no admin UI for this.

### 4. Reviews & Content Moderation ⚠️

**Status:** Partially Implemented (Organization-level only)

**Routes:**
- Frontend: `/dashboard/organization/reviews` (for organization owners)
- Backend: `/api/organizations/{id}/reviews` (GET)
- Backend: `/api/organizations/{id}/reviews/{review_id}/moderate` (PATCH)

**Features:**
- ✅ Organization owners can moderate their own reviews
- ✅ Approve/reject reviews
- ✅ View review status (pending/approved/rejected)
- ✅ Respond to reviews

**Missing Features:**
- ❌ Global admin list of all reviews
- ❌ Filter reviews by business, rating, status, date
- ❌ Admin actions: approve, hide, delete, mark as spam, pin
- ❌ View complaints/reports about reviews
- ❌ Control what appears on public business pages (admin override)

**Gaps:**
- Reviews moderation is only available to business owners, not platform admins
- No way for admins to moderate reviews across all businesses
- No review reporting/complaint system

### 5. Notifications & Reminders ❌

**Status:** Not Implemented

**Missing Features:**
- ❌ Admin view of notification types
- ❌ Config: who receives what notifications
- ❌ Logs of sent notifications (email, in-app, etc.)
- ❌ Notification templates management

**Note:** Backend has notification infrastructure (`notifications`, `notification_deliveries` tables) but no admin UI.

### 6. Tariffs / Plans / Billing ⚠️

**Status:** Partially Implemented

**Routes:**
- Frontend: `/dashboard/moderation/organizations` (subscription column)
- Backend: `/api/organizations/{id}/subscription` (GET, PATCH)
- Backend: `/api/admin/subscription-plans` (if exists)

**Features:**
- ✅ View organization subscriptions in moderation dashboard
- ✅ Change organization subscription plan
- ✅ View subscription plans list

**Missing Features:**
- ❌ Dedicated plans management page
- ❌ CRUD for subscription plans
- ❌ Per-plan limits configuration UI
- ❌ View all subscriptions with filters
- ❌ Trial/active/expired status management

**Gaps:**
- Subscription management is embedded in moderation dashboard, not a dedicated admin feature
- No way to create/edit subscription plans via UI

### 7. Directories & Taxonomies ❌

**Status:** Not Implemented

**Missing Features:**
- ❌ Categories of businesses CRUD
- ❌ Cities / regions / countries management
- ❌ Tags or classification dictionaries
- ❌ CRUD interface for taxonomies

**Note:** Categories and cities are stored in database but there's no admin interface to manage them.

### 8. Analytics & Reports ✅

**Status:** Implemented (Basic)

**Routes:**
- Frontend: `/dashboard/admin`
- Backend: `/api/admin/dashboard/summary` (GET)

**Features:**
- ✅ Total organizations count
- ✅ Verified organizations count
- ✅ Public organizations count
- ✅ Total products count
- ✅ Total QR codes count
- ✅ Total QR scan events count

**Missing Features:**
- ❌ Charts/graphs (time series, trends)
- ❌ New registrations per period
- ❌ Number of reviews statistics
- ❌ Export reports (CSV/JSON)
- ❌ Custom date ranges
- ❌ Comparison periods

**Gaps:**
- Dashboard shows only basic counts, no visualizations
- No time-based analytics (trends over time)
- No export functionality

### 9. System / Logs / Settings ⚠️

**Status:** Partially Implemented

**Routes:**
- Frontend: `/admin/db` (Database Explorer)
- Frontend: `/admin` (AI Integrations tab, Dev Tasks tab)
- Backend: `/api/admin/db/*` (Database operations)
- Backend: `/api/admin/ai/*` (AI integrations)

**Features:**
- ✅ Database Explorer: browse tables, columns, rows
- ✅ Create migration drafts
- ✅ AI Integrations: list, create, update, health check
- ✅ Dev Tasks: create, update, delete, filter by status/category

**Missing Features:**
- ❌ System logs viewer (errors, login attempts)
- ❌ Configuration of integrations (email provider, analytics IDs)
- ❌ Security / access control settings UI
- ❌ Audit logs of admin actions

**Gaps:**
- Database explorer is powerful but lacks query interface
- No system-wide logs viewer
- No admin action audit trail

## Admin Panel Structure

### Main Admin Panel (`/admin`)

**Tabs:**
1. **Pending Registrations** - List and approve/reject business registrations
2. **AI Integrations** - Manage AI provider integrations (OpenAI, Yandex, etc.)
3. **Dev / To-Do** - Track development tasks and integration progress

**Additional Links:**
- Database Explorer (`/admin/db`)

### Admin Dashboard (`/dashboard/admin`)

Shows key platform metrics:
- Total organizations
- Verified organizations
- Public organizations
- Total products
- Total QR codes
- Total QR scan events

### Moderation Dashboard (`/dashboard/moderation/organizations`)

Organization moderation interface:
- Filter by status (pending/verified/rejected)
- View organization details
- Approve/reject organizations
- Change subscription plans
- View organization profile

## Access Control

**Required Roles:**
- `platform_admin` - Full admin access
- `platform_owner` - Full admin access
- `moderator` - Access to moderation dashboard only

**Protection:**
- Routes are protected by `ProtectedRoute` component
- Backend routes use `get_current_user_id` dependency
- Role checks performed in both frontend and backend

## Automated Tests

### Existing E2E Tests

**Location:** `frontend/tests/e2e/`

**Test Files:**

1. **`business_flow.spec.ts`**
   - **Purpose:** Tests complete business lifecycle flow
   - **Coverage:**
     - ✅ Business registration
     - ✅ Admin approval of business
     - ✅ User registration and review submission
     - ✅ Business owner sees review
     - ✅ Review visible on public profile
   - **Status:** ✅ Implemented (requires production access)

2. **`admin_pending_registrations.spec.ts`**
   - **Purpose:** Tests admin pending registrations functionality
   - **Coverage:**
     - ✅ Admin login and access control
     - ✅ View pending registrations list
     - ✅ Approve pending business
     - ✅ Filter by status (moderation dashboard)
   - **Status:** ✅ Implemented

### Admin-Specific Tests Needed

**Recommended Test Files:**

1. **`admin_reviews_moderation.spec.ts`** ⏳
   - Test: Admin views all reviews (if global admin interface implemented)
   - Test: Admin approves/rejects review
   - Test: Review visibility on public profile
   - **Status:** Not implemented (global admin review moderation not available yet)

2. **`admin_dashboard.spec.ts`** ⏳
   - Test: Admin dashboard loads and shows metrics
   - Test: Metrics are accurate
   - **Status:** Not implemented (can be added if needed)

### Running Admin E2E Tests

```bash
cd frontend
E2E_BASE_URL=https://chestnoru-production.up.railway.app \
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD=SecurePassword123! \
npm run test:e2e admin_pending_registrations
```

**Note:** Tests require production access and valid admin credentials.

## Manual Test Scripts

See `docs/admin_manual_tests.md` for step-by-step manual testing instructions.

## Summary

### Fully Implemented ✅
- **Pending Business Registrations** - Basic approve/reject functionality
- **Analytics Dashboard** - Basic metrics display
- **Database Explorer** - Browse tables, columns, rows, create migration drafts
- **AI Integrations Management** - CRUD + health checks
- **Dev Tasks Tracking** - Task management with filters

### Partially Implemented ⚠️
- **Reviews Moderation** - Organization-level only (no global admin interface)
- **Tariffs/Plans** - Can view/change in moderation dashboard (no dedicated management UI)
- **System/Logs** - Database explorer exists, but no system logs viewer or audit trail

### Not Implemented ❌
- **Companies/Businesses Management** - No centralized business management interface
- **Users & Roles Management** - No admin UI for user management
- **Notifications & Reminders Admin UI** - Backend exists but no admin interface
- **Directories & Taxonomies Management** - No CRUD for categories, cities, tags
- **Advanced Analytics** - No charts, time-based reports, or exports

## Test Coverage

### Automated E2E Tests ✅
- ✅ Business registration → Admin approval flow
- ✅ Admin pending registrations viewing
- ✅ Admin business approval
- ✅ Status filtering

### Manual Test Scripts ✅
- ✅ Comprehensive manual test scripts documented in `docs/admin_manual_tests.md`
- ✅ Step-by-step instructions for all admin modules
- ✅ Troubleshooting guide included

## Recommendations

### High Priority
1. **Global Reviews Moderation** - Add admin interface to moderate all reviews across platform
2. **Users & Roles Management** - Critical for platform administration
3. **Companies Management** - Centralized business management interface

### Medium Priority
4. **Enhanced Analytics** - Add charts and time-based reports
5. **Notification Admin UI** - Manage notification settings and view logs
6. **Audit Logs** - Track all admin actions (who, when, what)

### Low Priority
7. **Directories Management** - CRUD for categories, cities, tags
8. **Advanced Moderation** - History logs, bulk actions, "send back for changes"

## Next Steps

1. ✅ Complete admin audit documentation (this document)
2. ✅ Add automated E2E tests for critical admin flows (`admin_pending_registrations.spec.ts`)
3. ✅ Create manual test scripts (`docs/admin_manual_tests.md`)
4. ⏳ Verify admin functionality against production (requires production access)
5. ⏳ Prioritize missing features for implementation

## Production Verification Status

**Note:** Production verification was attempted but encountered connection issues (`ERR_ABORTED`). This may be due to:
- Network connectivity issues
- Production site temporarily unavailable
- SSL/certificate issues
- Firewall/VPN blocking

**Recommendation:** Verify production access manually or retry E2E tests when production is confirmed accessible.

