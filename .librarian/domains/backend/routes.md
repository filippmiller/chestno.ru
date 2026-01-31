# Backend API Routes

> Last updated: 2026-01-28
> Domain: backend
> Keywords: api, route, endpoint, fastapi, http, rest, controller

## Overview

FastAPI REST API with cookie-based authentication. All routes are in `backend/app/api/routes/`.

---

## App Middleware

### Request Context & Security Headers
**File:** `backend/app/main.py`
**Purpose:** Adds `X-Request-ID` to responses, logs method/path/status/duration, and applies basic security headers.

### Dev-Only Debug Routes
**File:** `backend/app/main.py`
**Purpose:** `health-check-direct`, `debug-token-direct`, and `echo` endpoints are only registered when environment is not production.

---

## Authentication Routes

### `/api/auth/v2/*` - Cookie-Based Auth (Current)
**File:** `backend/app/api/routes/auth_v2.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/v2/login` | Email/password login, sets session cookie |
| POST | `/api/auth/v2/signup` | User registration with email confirmation |
| POST | `/api/auth/v2/oauth-callback` | Google/Yandex OAuth token exchange |
| POST | `/api/auth/v2/logout` | Clear session cookie |
| GET | `/api/auth/v2/me` | Get current user with full session data |
| GET | `/api/auth/v2/session` | Lightweight session info |
| GET | `/api/auth/v2/google/start` | Initiate Google OAuth |
| GET | `/api/auth/v2/yandex/start` | Initiate Yandex OAuth |

**Features:**
- Rate limiting per email + IP
- Role-based redirects (admin → `/admin/dashboard`, business → `/dashboard`)
- Email confirmation required for new signups

---

## Organization Routes

### `/api/organizations/*` - Organization Management
**File:** `backend/app/api/routes/organizations.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/api/organizations/{org_id}/profile` | Get org profile | Member |
| PUT | `/api/organizations/{org_id}/profile` | Update org profile | Editor+ |
| GET | `/api/organizations/{org_id}/onboarding` | Get onboarding progress | Member |

### `/api/public/organizations/*` - Public Organization Access
**File:** `backend/app/api/routes/organizations.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/public/organizations/search` | Search public orgs |
| GET | `/api/public/organizations/by-slug/{slug}` | Get by slug |
| GET | `/api/public/organizations/details/{slug}` | Full details with products/reviews |
| GET | `/api/public/organizations/{org_id}` | Get by ID |

---

## Content Routes

### `/api/organizations/{org_id}/posts/*` - Posts Management
**File:** `backend/app/api/routes/posts.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/api/organizations/{org_id}/posts` | List posts | Member |
| POST | `/api/organizations/{org_id}/posts` | Create post | Editor+ |
| GET | `/api/organizations/{org_id}/posts/{post_id}` | Get post | Member |
| PATCH | `/api/organizations/{org_id}/posts/{post_id}` | Update post | Editor+ |
| DELETE | `/api/organizations/{org_id}/posts/{post_id}` | Delete post | Editor+ |

**Public:**
- `GET /api/public/organizations/by-slug/{slug}/posts` - Published posts
- `GET /api/public/organizations/by-slug/{slug}/posts/{post_slug}` - Single post

### `/api/organizations/{org_id}/products/*` - Products Management
**File:** `backend/app/api/routes/products.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/api/organizations/{org_id}/products` | List products | Member |
| POST | `/api/organizations/{org_id}/products` | Create product | Editor+ |
| GET | `/api/organizations/{org_id}/products/{product_id}` | Get product | Member |
| PUT | `/api/organizations/{org_id}/products/{product_id}` | Update product | Editor+ |
| POST | `/api/organizations/{org_id}/products/{product_id}/archive` | Archive | Editor+ |

**Public:**
- `GET /api/public/organizations/{slug}/products` - Published products
- `GET /api/public/products/{slug}` - Single product

### `/api/organizations/{org_id}/reviews/*` - Reviews Management
**File:** `backend/app/api/routes/reviews.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/api/organizations/{org_id}/reviews` | List reviews | Member |
| GET | `/api/organizations/{org_id}/reviews/stats` | Rating stats | Member |
| PATCH | `/api/organizations/{org_id}/reviews/{review_id}/moderate` | Approve/reject | Manager+ |
| POST | `/api/organizations/{org_id}/reviews/{review_id}/respond` | Org response | Manager+ |
| DELETE | `/api/organizations/{org_id}/reviews/{review_id}` | Delete review | Author/Manager+ |

**Public:**
- `GET /api/public/organizations/by-slug/{slug}/reviews` - Approved reviews
- `POST /api/public/organizations/by-slug/{slug}/reviews` - Create review (auth required)

---

## QR Routes

### `/api/organizations/{org_id}/qr-codes/*` - QR Management
**File:** `backend/app/api/routes/qr.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| POST | `/api/organizations/{org_id}/qr-codes` | Create QR code | Manager+ |
| GET | `/api/organizations/{org_id}/qr-codes` | List QR codes | Member |
| GET | `/api/organizations/{org_id}/qr-codes/{qr_id}/stats` | Basic stats | Analyst+ |
| GET | `/api/organizations/{org_id}/qr-codes/{qr_id}/detailed-stats` | Geo/UTM breakdown | Analyst+ |

### `/q/{code}` - Public QR Redirect
**File:** `backend/app/api/routes/qr.py`

Logs event (IP hash, UTM, geo) and redirects to organization page.

---

## Notification Routes

### `/api/notifications/*` - Notification Management
**File:** `backend/app/api/routes/notifications.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | List notifications (paginated) |
| GET | `/api/notifications/unread-count` | Count unread |
| POST | `/api/notifications/{delivery_id}/read` | Mark as read |
| POST | `/api/notifications/{delivery_id}/dismiss` | Mark as dismissed |
| GET | `/api/notification-settings` | List settings |
| PATCH | `/api/notification-settings` | Update settings |
| POST | `/api/notification-settings/push-subscription` | Save push subscription |
| DELETE | `/api/notification-settings/push-subscription` | Remove push subscription |

---

## Admin Routes

### `/api/admin/*` - Admin Operations
**Files:** `backend/app/api/routes/admin_*.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/{user_id}/role` | Update user role |
| POST | `/api/admin/users/{user_id}/block` | Block user |
| GET | `/api/admin/organizations` | List all organizations |
| PATCH | `/api/admin/organizations/{org_id}/status` | Update org status |
| GET | `/api/admin/dashboard/summary` | Dashboard metrics |
| GET | `/api/admin/db/tables` | List DB tables |
| GET | `/api/admin/db/tables/{table}/columns` | Table columns |
| GET | `/api/admin/db/tables/{table}/rows` | Table data |

### `/api/moderation/*` - Moderation
**File:** `backend/app/api/routes/moderation.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/moderation/organizations` | List pending orgs |
| POST | `/api/moderation/organizations/{org_id}/verify` | Verify org |
| POST | `/api/moderation/organizations/{org_id}/reject` | Reject org |

---

## Other Routes

### Health Checks
**File:** `backend/app/api/routes/health.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health/` | Full health check (DB + Supabase) |
| GET | `/api/health/db` | Database only |
| GET | `/api/health/supabase` | Supabase connectivity |

### Subscriptions
**File:** `backend/app/api/routes/subscriptions.py`

- `GET /api/organizations/{org_id}/subscription` - Get subscription & usage

### Invites
**File:** `backend/app/api/routes/invites.py`

- `GET /api/organizations/{org_id}/invites` - List invites
- `POST /api/organizations/{org_id}/invites` - Create invite
- `POST /api/invites/{code}/accept` - Accept invite
- `GET /api/invites/{code}/preview` - Preview invite

### Marketing
**File:** `backend/app/api/routes/marketing.py`

- `GET /api/marketing/templates` - List templates
- `GET /api/organizations/{org_id}/marketing-materials` - List materials
- `POST /api/organizations/{org_id}/marketing-materials` - Create material

### Benchmarks - Competitor Comparison
**File:** `backend/app/api/routes/benchmarks.py`

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/api/v1/organizations/{org_id}/benchmarks` | Compare org vs category peers | Member |

**Query Parameters:**
- `days`: Trend analysis period (7-90, default 30)

**Response includes:**
- Average rating vs category average
- Total reviews vs category average
- Response rate vs category average
- Percentile rankings (0-100)
- Trend data (current vs previous period)
- Category info (name, org count, review count)

### Widgets - Embeddable Trust Badges
**File:** `backend/app/api/routes/widgets.py`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/widgets/badge/{org_slug}` | JavaScript embed code for widget |
| GET | `/api/v1/widgets/iframe/{org_slug}` | HTML page for iframe embedding |
| GET | `/api/v1/widgets/preview/{org_slug}` | Preview HTML for configurator |
| GET | `/api/organizations/{org_id}/widget/embed-code` | Get embed code snippets |

**Query Parameters:**
- `size`: small, medium, large (default: medium)
- `theme`: light, dark, auto (default: light)
- `color`: Custom hex color without # (e.g., 3B82F6)
- `logo`: Show Chestno.ru logo (default: true)
- `reviews`: Show review count (default: true)
- `rating`: Show star rating (default: true)
- `lang`: ru, en (default: ru)
- `radius`: Border radius 0-24 (default: 8)

**Features:**
- Full CORS support for cross-origin embedding
- ETag caching with 5-minute max-age
- Responsive sizing based on widget size
- Automatic theme detection (auto mode)

---

## Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| owner | 1 | Full access |
| admin | 2 | Full access except ownership transfer |
| manager | 3 | Content management, moderation, invites |
| editor | 4 | Create/edit content |
| analyst | 5 | View analytics |
| viewer | 6 | View only |

Platform roles: `platform_admin`, `moderator`, `support`
