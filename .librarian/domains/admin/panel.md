# Admin Panel

> Last updated: 2026-01-18
> Domain: admin
> Keywords: admin, panel, dashboard, moderation, user, management, platform

## Overview

Platform administration features for managing users, organizations,
subscriptions, and system health. Accessible only to platform admins.

---

## Access Control

**Required Role:** `platform_admin`

**Check Pattern:**
```python
if 'platform_admin' not in platform_roles:
    raise HTTPException(403, "Admin access required")
```

Frontend guards routes with `RoleProtectedRoute`:
```tsx
<RoleProtectedRoute allowedRoles={['platform_admin']}>
  <AdminPanel />
</RoleProtectedRoute>
```

---

## Admin Features

### User Management
- List all users with search
- View user details
- Change user roles
- Block/unblock users

### Organization Management
- List all organizations
- View organization details
- Change verification status
- Block/unblock organizations

### Subscription Plans
- List all plans
- Create new plans
- Update plan details
- Deactivate plans

### Database Explorer
- View table list
- View column definitions
- Browse table data
- Create migration drafts

### AI Integrations
- List AI providers
- Configure integrations
- Run health checks

### Development Tasks
- Track internal tasks
- Update task status
- Filter by category/priority

---

## Backend Routes

### User Management
**File:** `backend/app/api/routes/admin_users.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | List users (paginated, searchable) |
| GET | `/api/admin/users/{user_id}` | Get user details |
| PATCH | `/api/admin/users/{user_id}/role` | Update platform role |
| POST | `/api/admin/users/{user_id}/block` | Block user |
| POST | `/api/admin/users/{user_id}/unblock` | Unblock user |

### Organization Management
**File:** `backend/app/api/routes/admin_organizations.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/organizations` | List orgs (filtered) |
| GET | `/api/admin/organizations/{org_id}` | Get org details |
| PATCH | `/api/admin/organizations/{org_id}/status` | Update status |
| POST | `/api/admin/organizations/{org_id}/block` | Block org |

### Subscription Plans
**File:** `backend/app/api/routes/admin_subscriptions.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/subscription-plans` | List plans |
| POST | `/api/admin/subscription-plans` | Create plan |
| PUT | `/api/admin/subscription-plans/{id}` | Update plan |
| DELETE | `/api/admin/subscription-plans/{id}` | Deactivate |

### Dashboard
**File:** `backend/app/api/routes/admin_dashboard.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/dashboard/summary` | Platform metrics |

### Database Explorer
**File:** `backend/app/api/routes/admin_db.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/db/tables` | List tables |
| GET | `/api/admin/db/tables/{table}/columns` | Column info |
| GET | `/api/admin/db/tables/{table}/rows` | Table data |
| POST | `/api/admin/db/migration-drafts` | Create draft |

---

## Frontend Pages

### AdminPanel.tsx
**Route:** `/admin`
**Purpose:** Main admin control center
**Sections:**
- User management tab
- Organization management tab
- Subscription plans tab
- Database explorer tab

### AdminDashboard.tsx
**Route:** `/dashboard/admin`
**Purpose:** Platform metrics dashboard
**Metrics:**
- Total organizations (verified/public counts)
- Total products
- Total QR codes
- Total scan events
- Recent activity

### ModerationDashboard.tsx
**Route:** `/dashboard/moderation/organizations`
**Purpose:** Organization verification queue
**Features:**
- List pending verifications
- View organization details
- Approve with comment
- Reject with reason
- Search and filter

### DatabaseExplorer.tsx
**Route:** `/admin/db`
**Purpose:** Direct database access
**Features:**
- Table browser
- Column viewer
- Data viewer (paginated)
- Migration draft creation

---

## Dashboard Metrics

**Response Schema:**
```typescript
interface AdminDashboardSummary {
  total_organizations: number;
  verified_organizations: number;
  public_organizations: number;
  total_products: number;
  total_qr_codes: number;
  total_scan_events: number;
  pending_verifications: number;
  recent_signups: number;
}
```

---

## Moderation Workflow

### Organization Verification

```
1. User creates organization → status='pending'
2. Appears in moderation queue
3. Moderator reviews profile
4. Approve:
   - verification_status='approved'
   - public_visible=true (if requested)
5. OR Reject:
   - verification_status='rejected'
   - verification_comment='Reason...'
6. User notified of decision
```

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/moderation/organizations` | List pending |
| POST | `/api/moderation/organizations/{org_id}/verify` | Approve |
| POST | `/api/moderation/organizations/{org_id}/reject` | Reject |

---

## Backend Services

### admin_users.py
- `list_users(search, page, per_page)`
- `get_user(user_id)`
- `update_user_role(user_id, role)`
- `block_user(user_id)`
- `unblock_user(user_id)`

### admin_organizations.py
- `list_organizations(search, status, page)`
- `get_organization(org_id)`
- `update_organization_status(org_id, status, comment)`
- `block_organization(org_id)`

### admin_dashboard.py
- `get_dashboard_summary()`

### admin_db.py
- `list_tables()`
- `get_table_columns(table)`
- `get_table_rows(table, page)`
- `create_migration_draft(draft)`

---

## Security Notes

1. All admin endpoints require `platform_admin` role
2. Actions are logged with actor user ID
3. Destructive operations require confirmation
4. Sensitive data (passwords, tokens) never exposed
5. Database explorer is read-only except for drafts

---

## Admin Layout Component

> Added: 2026-01-18
> File: `frontend/src/components/admin/AdminLayout.tsx`

### Overview

Dedicated admin layout with collapsible sidebar navigation, separate from the main application layout.
Used automatically for all `/admin*` routes when user has admin privileges.

### Features

- **Collapsible Sidebar** - Desktop users can minimize sidebar to icons only
- **Mobile Menu** - Responsive hamburger menu on smaller screens
- **URL-based Tab Navigation** - AdminPanel sections accessible via `?tab=` param
- **User Section** - Shows admin user email and logout button

### Navigation Items

| Label | Route | Icon |
|-------|-------|------|
| Dashboard | /admin | LayoutDashboard |
| Organizations | /admin?tab=businesses | Building2 |
| Users | /admin?tab=users | Users |
| Reviews | /admin?tab=reviews | MessageSquare |
| Registrations | /admin?tab=pending | Shield |
| Imports Catalog | /admin/imports | FileUp |
| Database Explorer | /admin/db | Database |
| Subscriptions | /admin?tab=subscriptions | CreditCard |
| QR Codes | /admin?tab=qr | QrCode |
| AI Integrations | /admin?tab=ai | Zap |
| Dev Tasks | /admin?tab=dev | ClipboardList |

### Quick Links

- Dashboard (User) → /dashboard
- Settings → /dashboard/settings/notifications

### App.tsx Integration

```tsx
// AdminLayout auto-applied for admin routes
const isAdminRoute = location.pathname.startsWith('/admin')

if (isAdminRoute && isAdmin && isAuthenticated) {
  return (
    <AdminLayout>
      <AppRoutes />
    </AdminLayout>
  )
}
```

### Admin Check

```tsx
const isAdmin = role === 'admin' ||
  platformRoles.includes('platform_admin') ||
  platformRoles.includes('platform_owner')
```

---

## Admin Imports Section

> Added: 2026-01-18

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| AdminImports.tsx | /admin/imports | List all import jobs across platform |
| AdminImportDetails.tsx | /admin/imports/:id | View specific import job details |

### API Routes

**File:** `backend/app/api/routes/admin_imports.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/imports` | List all imports (paginated) |
| GET | `/api/admin/imports/{id}` | Get import details |
| GET | `/api/admin/imports/{id}/items` | List import items |

### Features

- View all import jobs across all organizations
- Filter by status, source type, organization
- View detailed job info and validation errors
- Track image download queue status

---

## Authentication Migration

> Updated: 2026-01-18

### Cookie-based Session Auth

All admin API routes now use cookie-based session authentication:

**Old (Bearer token):**
```python
from app.core.auth import get_current_user_id
current_user_id: str = Depends(get_current_user_id)
```

**New (Cookie session):**
```python
from app.core.session_deps import get_current_user_id_from_session
current_user_id: str = Depends(get_current_user_id_from_session)
```

### Files Updated

All admin route files updated to use cookie-based auth:
- moderation.py
- admin_database.py
- admin_organizations.py
- admin_users.py
- admin_reviews.py
- admin_ai.py
- admin_imports.py
- admin_notifications.py
- admin_dashboard.py
- dev_tasks.py
- subscriptions.py

---

## Common Gotchas (Bug Fixes Log)

> Updated: 2026-01-18

### 1. Admin Role Checks Must Check Both Tables

**Problem:** Moderation endpoints returned 403 for admins.

**Root Cause:** `moderation.py` only checked `platform_roles` table, but Auth V2 uses `app_profiles.role`.

**Fix:** Check both:
```python
# Check app_profiles.role first (Auth V2)
cur.execute("SELECT 1 FROM app_profiles WHERE id = %s AND role = 'admin'", (user_id,))
if cur.fetchone():
    return  # Is admin

# Fall back to platform_roles (legacy)
cur.execute("SELECT role FROM platform_roles WHERE user_id = %s AND role = ANY(%s)",
            (user_id, list(MODERATOR_ROLES)))
```

### 2. import_jobs Column Name

**Problem:** `/api/admin/imports` returned 500.

**Root Cause:** Code used `j.original_filename` but table column is `source_filename`.

**Fix:** Use correct column name `j.source_filename` in SQL queries.

### 3. organizations vs organization_profiles Columns

**Problem:** `/api/admin/organizations` search returned 500.

**Root Cause:** Code searched `o.contact_email` but `contact_email` is on `organization_profiles` (p), not `organizations` (o).

**Fix:** Use `p.contact_email` in search queries (must JOIN organization_profiles).

### 4. FastAPI Route Trailing Slashes

**Problem:** `/api/admin/dev-tasks` returned 404.

**Root Cause:** Route defined as `@router.get('/')` requires trailing slash.

**Fix:** Use `@router.get('')` for routes without trailing slash requirement.

### 5. Service Worker MIME Type

**Problem:** Service Worker registration failed with MIME type error.

**Root Cause:** Backend served HTML (fallback) for `/sw.js` instead of JavaScript.

**Fix:** Add dedicated route in `main.py`:
```python
@app.get('/sw.js', include_in_schema=False)
async def serve_service_worker():
    return Response(content=sw_content, media_type='application/javascript')
```
