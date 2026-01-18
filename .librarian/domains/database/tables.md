# Database Tables

> Last updated: 2026-01-18
> Domain: database
> Keywords: table, schema, postgresql, supabase, migration, column, foreign key, RLS

## Overview

The platform uses PostgreSQL via Supabase with 23 tables across multiple functional areas.
All tables use UUID primary keys and have `created_at`/`updated_at` timestamps.
Row Level Security (RLS) is enabled on all tables except `login_throttle`.

---

## Core User Tables

### app_users
**Purpose:** Extended user profiles linked to Supabase auth
**File:** `supabase/migrations/0001_initial.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References auth.users(id), CASCADE |
| email | text | NOT NULL, UNIQUE |
| full_name | text | |
| locale | text | DEFAULT 'ru' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**RLS:** Users can view only their own profile; platform admins have full access.

### platform_roles
**Purpose:** Platform-level administrative roles
**File:** `supabase/migrations/0001_initial.sql`

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid (PK) | References app_users(id), CASCADE |
| role | text | CHECK: 'platform_admin', 'moderator', 'support' |
| created_at | timestamptz | |

### auth_providers
**Purpose:** Track social authentication provider links
**File:** `supabase/migrations/0007_auth_providers.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | References auth.users(id), CASCADE |
| provider | text | Provider name (Google, Yandex, etc.) |
| provider_user_id | text | |
| email | text | |
| created_at | timestamptz | |

**Index:** UNIQUE(provider, provider_user_id)

---

## Organization Tables

### organizations
**Purpose:** Core organization/business records
**File:** `supabase/migrations/0001_initial.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | NOT NULL |
| slug | text | NOT NULL, UNIQUE |
| legal_name | text | |
| country | text | |
| city | text | |
| website_url | text | |
| phone | text | |
| primary_category | text | |
| tags | text | |
| is_verified | boolean | DEFAULT false |
| verification_status | text | 'pending', 'approved', 'rejected' |
| verification_comment | text | Moderation notes |
| public_visible | boolean | DEFAULT false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### organization_members
**Purpose:** User membership in organizations
**File:** `supabase/migrations/0001_initial.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| user_id | uuid | References app_users(id), CASCADE |
| role | text | 'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer' |
| invited_by | uuid | References app_users(id) |
| created_at | timestamptz | |

**Constraint:** UNIQUE(organization_id, user_id)

### organization_profiles
**Purpose:** Rich public profile for organizations
**File:** `supabase/migrations/0002_org_profiles.sql`, `0015_profile_enhancements.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | UNIQUE, References organizations(id), CASCADE |
| short_description | text | |
| long_description | text | |
| production_description | text | |
| safety_and_quality | text | |
| video_url | text | |
| gallery | jsonb | DEFAULT '[]' |
| tags | text | |
| language | text | DEFAULT 'ru' |
| founded_year | integer | |
| employee_count | integer | |
| factory_size | text | |
| category | text | |
| certifications | jsonb | DEFAULT '[]' |
| sustainability_practices | text | |
| quality_standards | text | |
| buy_links | jsonb | DEFAULT '[]' |
| contact_* | text | email, phone, website, address, telegram, whatsapp |
| social_links | jsonb | DEFAULT '[]' - [{type, label, url}] |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### organization_invites
**Purpose:** Team member invitation system
**File:** `supabase/migrations/0004_invites.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| email | text | |
| role | text | 'admin', 'manager', 'editor', 'analyst', 'viewer' |
| code | text | UNIQUE |
| status | text | 'pending', 'accepted', 'revoked', 'expired' |
| expires_at | timestamptz | |
| created_by | uuid | References app_users(id) |
| accepted_by | uuid | References app_users(id) |
| accepted_at | timestamptz | |
| created_at | timestamptz | |

---

## Content Tables

### organization_posts
**Purpose:** News/blog posts by organizations
**File:** `supabase/migrations/0016_reviews_posts.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| author_user_id | uuid | References app_users(id) |
| slug | text | |
| title | text | NOT NULL |
| excerpt | text | |
| body | text | NOT NULL |
| status | text | 'draft', 'published', 'archived' |
| main_image_url | text | |
| gallery | jsonb | DEFAULT '[]' - [{url, alt, sort_order}] |
| video_url | text | |
| published_at | timestamptz | |
| is_pinned | boolean | DEFAULT false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** UNIQUE(organization_id, slug)

### products
**Purpose:** Product catalog for organizations
**File:** `supabase/migrations/0013_products.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| slug | text | |
| name | text | NOT NULL |
| short_description | text | |
| long_description | text | |
| category | text | |
| tags | text | |
| price_cents | integer | |
| currency | text | DEFAULT 'RUB' |
| status | text | 'draft', 'published', 'archived' |
| is_featured | boolean | DEFAULT false |
| main_image_url | text | |
| gallery | jsonb | |
| external_url | text | |
| created_by | uuid | References app_users(id) |
| updated_by | uuid | References app_users(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** UNIQUE(organization_id, slug)

### reviews
**Purpose:** Customer reviews of organizations/products
**File:** `supabase/migrations/0016_reviews_posts.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| product_id | uuid | References products(id), SET NULL |
| author_user_id | uuid | References app_users(id) |
| rating | smallint | CHECK: 1-5 |
| title | text | |
| body | text | NOT NULL |
| media | jsonb | DEFAULT '[]' - [{type, url, thumbnail_url, alt}] |
| status | text | 'pending', 'approved', 'rejected' |
| moderated_by | uuid | References app_users(id) |
| moderated_at | timestamptz | |
| moderation_comment | text | |
| response | text | Organization's response |
| response_by | uuid | References app_users(id) |
| response_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## QR & Analytics Tables

### qr_codes
**Purpose:** Trackable QR codes for organizations
**File:** `supabase/migrations/0006_qr_codes.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid | References organizations(id), CASCADE |
| code | text | UNIQUE |
| label | text | |
| target_type | text | 'organization', 'product', 'post' |
| target_slug | text | |
| is_active | boolean | DEFAULT true |
| created_by | uuid | References app_users(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### qr_events
**Purpose:** QR scan event logging
**File:** `supabase/migrations/0006_qr_codes.sql`, `0021_qr_enhancements.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial (PK) | |
| qr_code_id | uuid | References qr_codes(id), CASCADE |
| occurred_at | timestamptz | |
| ip_hash | text | Anonymized IP |
| user_agent | text | |
| referer | text | |
| country | text | GeoIP |
| city | text | GeoIP |
| utm_source | text | |
| utm_medium | text | |
| utm_campaign | text | |
| raw_query | text | Full query string |

---

## Notification Tables

### notification_types
**Purpose:** Notification template definitions
**File:** `supabase/migrations/0012_notifications.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| key | text | UNIQUE identifier |
| category | text | |
| severity | text | |
| title_template | text | With {{placeholders}} |
| body_template | text | With {{placeholders}} |
| default_channels | text[] | DEFAULT ['in_app'] |
| created_at | timestamptz | |

### notifications
**Purpose:** Sent notification records
**File:** `supabase/migrations/0012_notifications.sql`

### notification_deliveries
**Purpose:** Per-user delivery tracking
**File:** `supabase/migrations/0012_notifications.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| notification_id | uuid | References notifications(id), CASCADE |
| user_id | uuid | References auth.users(id), CASCADE |
| channel | text | 'in_app', 'email', 'push' |
| status | text | 'pending', 'sent', 'read', 'dismissed', 'failed' |
| read_at | timestamptz | |
| dismissed_at | timestamptz | |
| sent_at | timestamptz | |
| error_message | text | |
| created_at | timestamptz | |

### user_notification_settings
**Purpose:** User notification preferences
**File:** `supabase/migrations/0012_notifications.sql`

### user_push_subscriptions
**Purpose:** Web Push API subscriptions
**File:** `supabase/migrations/0022_push_subscriptions.sql`

---

## Subscription Tables

### subscription_plans
**Purpose:** Pricing tier definitions
**File:** `supabase/migrations/0014_subscriptions.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| code | text | UNIQUE ('free', 'standard', 'pro') |
| name | text | |
| description | text | |
| price_monthly_cents | integer | |
| price_yearly_cents | integer | |
| max_products | integer | |
| max_qr_codes | integer | |
| max_members | integer | |
| analytics_level | text | 'basic', 'advanced' |
| is_default | boolean | |
| is_active | boolean | |

### organization_subscriptions
**Purpose:** Active subscription per organization
**File:** `supabase/migrations/0014_subscriptions.sql`

---

## Marketing Tables

### marketing_templates
**Purpose:** Global marketing material blueprints
**File:** `supabase/migrations/0023_marketing_materials.sql`

### marketing_materials
**Purpose:** Organization-specific marketing materials
**File:** `supabase/migrations/0023_marketing_materials.sql`

---

## System Tables

### login_throttle
**Purpose:** Rate limiting for login attempts
**File:** `supabase/migrations/0010_login_throttle.sql`

### dev_tasks
**Purpose:** Development task tracking
**File:** `supabase/migrations/0009_dev_tasks.sql`

### ai_integrations
**Purpose:** AI provider configuration
**File:** `supabase/migrations/0008_ai_integrations.sql`

### migration_drafts
**Purpose:** UI-generated migration drafts
**File:** `supabase/migrations/0011_migration_drafts.sql`

---

## Key Relationships

```
auth.users (Supabase)
├── app_users (1:1)
├── platform_roles (1:1)
├── auth_providers (1:N)
├── organization_members (1:N)
└── reviews, posts, products (author)

organizations (1:N)
├── organization_members (1:N)
├── organization_profiles (1:1)
├── organization_invites (1:N)
├── products (1:N)
├── organization_posts (1:N)
├── reviews (1:N)
├── qr_codes (1:N)
└── marketing_materials (1:N)

qr_codes (1:N)
└── qr_events (1:N)

notification_types (1:N)
├── notifications (1:N)
└── notification_deliveries (1:N)
```
