# Backend Services

> Last updated: 2026-01-18
> Domain: backend
> Keywords: service, business logic, function, python, backend

## Overview

Business logic layer in `backend/app/services/`. Services handle database operations,
validation, and cross-cutting concerns. All use `psycopg` for direct SQL queries.

---

## Organization Services

### organization_profiles.py
**Purpose:** Organization profile CRUD operations

**Key Functions:**
- `get_organization_profile(org_id, user_id)` - Fetch with permission check
- `upsert_organization_profile(org_id, user_id, payload)` - Create/update profile
- `get_public_profile_by_slug(slug)` - Public access (no auth)
- `search_public_organizations(q, country, category, verified_only, limit, offset)`
  - Full-text search on name, city, tags
  - Filters: `verification_status='verified' OR public_visible=true`
- `get_public_organization_details_by_slug(slug)` - Full details with products/reviews
- `_require_role(cur, org_id, user_id, allowed_roles)` - Permission helper, throws 403

**Database:** organizations, organization_profiles, organization_members

---

## Content Services

### posts.py
**Purpose:** Blog post management

**Key Functions:**
- `list_organization_posts(org_id, user_id, status, search, limit, offset)`
- `get_organization_post(org_id, post_id, user_id)`
- `create_organization_post(org_id, user_id, payload)` - Editor+ only
- `update_organization_post(org_id, post_id, user_id, payload)` - Slug uniqueness check
- `delete_organization_post(org_id, post_id, user_id)`
- `list_public_organization_posts(slug, limit, offset)` - Published only
- `get_public_organization_post(slug, post_slug)`

**Features:** Slug permalinks, draft/published/archived, pinning, gallery support

**Database:** organization_posts, organizations

### products.py
**Purpose:** Product catalog management

**Key Functions:**
- `list_products(org_id, user_id, status_filter, limit, offset)`
- `create_product(org_id, user_id, payload)` - Checks org product quota
- `get_product(org_id, product_id, user_id)`
- `update_product(org_id, product_id, user_id, payload)`
- `archive_product(org_id, product_id, user_id)`
- `list_public_products_by_org_slug(slug)` - Published only
- `get_public_product_by_slug(slug)`

**Features:** Pricing (cents + currency), featured flag, external URLs, categories

**Database:** products, organizations, organization_members

### reviews.py
**Purpose:** Customer review system

**Key Functions:**
- `list_organization_reviews(org_id, user_id, status, product_id, limit, offset)`
- `get_review_stats(org_id)` - Rating distribution & average
- `create_review(org_id, user_id, payload)` - Creates 'pending' review, emits notification
- `moderate_review(org_id, review_id, user_id, payload)` - Approve/reject with comment
- `respond_to_review(org_id, review_id, user_id, response_text)` - Manager+ only
- `delete_review(org_id, review_id, user_id)` - Author deletes pending; manager deletes any
- `list_public_organization_reviews(slug, product_slug, limit, offset, order)`

**Workflow:** pending → approved/rejected
**Ordering:** newest or highest_rating

**Database:** reviews, organizations, products, notification_types, notification_deliveries

---

## QR Services

### qr.py
**Purpose:** QR code generation and analytics

**Key Functions:**
- `create_qr_code(org_id, user_id, payload)` - Generates unique code, checks quota
- `list_qr_codes(org_id, user_id)` - All codes for org
- `get_qr_stats(org_id, qr_id, user_id)` - Total, last 7/30 days
- `log_event_and_get_redirect(code, client_ip, user_agent, referer, raw_query)`
  - Hashes IP with salt for privacy
  - Extracts UTM params
  - Performs GeoIP lookup
  - Returns redirect URL
- `get_qr_detailed_stats(org_id, qr_id, user_id)` - Top 20 geo & UTM breakdowns

**Analytics:** IP hash, User-Agent, Referer, UTM params, country/city (GeoIP)

**Database:** qr_codes, qr_events, organizations

### qr_business.py
**Purpose:** Business-specific QR functionality (legacy scan events)

**Database:** qr_scan_events

---

## Notification Services

### notifications.py
**Purpose:** Multi-channel notification system

**Key Functions:**
- `list_notifications(user_id, cursor, limit)` - Paginated deliveries
- `get_unread_count(user_id)` - Count pending/sent
- `mark_notification_read(user_id, delivery_id)`
- `dismiss_notification(user_id, delivery_id)`
- `list_notification_settings(user_id)` - Per-type preferences
- `update_notification_settings(user_id, updates)` - Toggle channels/mute
- `emit_notification(request, actor_user_id)` - Create & deliver
  - Resolves recipients (user/org/platform scope)
  - Creates `notification_deliveries` for each recipient
  - Respects user channel preferences
- `render_template(template, payload)` - Replace `{{key}}` placeholders
- `save_push_subscription(user_id, endpoint, p256dh, auth)`
- `delete_push_subscription(user_id)`

**Background Workers:**
- `process_reminders()` - Scheduled notifications
- `process_email_deliveries()` - Send pending emails
- `process_telegram_deliveries()` - Send Telegram messages
- `process_push_deliveries()` - Mark push as ready

**Channels:** in_app, email, telegram, push

**Database:** notification_types, notifications, notification_deliveries, user_notification_settings, user_push_subscriptions

### push.py
**Purpose:** Web Push subscription management

**Database:** user_push_subscriptions

---

## Authentication Services

### auth_events.py
**Purpose:** Rate limiting and login attempt tracking

**Key Functions:**
- `check_rate_limit(email, ip)` - Returns (allowed, wait_seconds)
- `record_failed_attempt(email, ip)`
- `clear_failed_attempts(email, ip)`

**Database:** login_throttle

### sessions.py
**Purpose:** Session creation and management

**Key Functions:**
- `create_session(user_id, access_token, refresh_token)`
- `delete_session(session_id)`
- `get_session(session_id)`

**Database:** sessions

### session_data.py
**Purpose:** Hydrate session with user/org/membership data

**Key Functions:**
- `get_session_data(user_id)` - Returns full session payload

### app_profiles.py
**Purpose:** User profile management (app_users table)

---

## Subscription Services

### subscriptions.py
**Purpose:** Plan limits and quota enforcement

**Key Functions:**
- `check_org_limit(org_id, feature)` - Returns (allowed, current, max)
- `get_organization_subscription(org_id)` - Plan details + usage

**Features checked:** products, qr_codes, members

**Database:** subscription_plans, organization_subscriptions, products, qr_codes, organization_members

---

## Admin Services

### admin_users.py
**Purpose:** User management for admins

### admin_organizations.py
**Purpose:** Organization management for admins

### admin_dashboard.py
**Purpose:** Dashboard metrics

### admin_db.py
**Purpose:** Database explorer

---

## External Integration Services

### email.py
**Purpose:** SMTP email sending via aiosmtplib

### telegram.py
**Purpose:** Telegram Bot API integration

---

## Service Architecture Pattern

```
Route → Service → Database
         ↓
    Permission Check (_require_role)
         ↓
    Business Logic
         ↓
    SQL Query (psycopg)
         ↓
    Return Result/Raise HTTPException
```

All services use raw SQL with parameterized queries for security.
