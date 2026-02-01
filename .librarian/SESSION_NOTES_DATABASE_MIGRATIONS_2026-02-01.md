# Session Notes: Database Migrations for Consumer Features
**Date:** 2026-02-01
**Domain:** Database / Schema Design

## Summary

Created four new database migrations to support consumer-facing features:

1. **Product Pages Enhancement** (0036)
2. **Consumer Subscriptions / Follow System** (0037)
3. **Product Journey Steps / Supply Chain Transparency** (0038)
4. **Social Sharing and Referrals** (0039)

## Migration Details

### 0036_product_pages_enhancement.sql

**Purpose:** Enable public product URLs and featured products

**Changes:**
- Added `global_slug` column to `products` table (unique across all products)
- Added `featured_at` timestamp column for featured products ordering
- Created function `generate_product_global_slug()` with Russian transliteration
- Added auto-trigger to generate global_slug when product is published
- Added RLS policy for public access to published products

**Key Design Decisions:**
- `global_slug` is separate from existing `slug` (which is org-scoped)
- `featured_at` timestamp preferred over boolean for natural ordering
- Russian-to-Latin transliteration built into slug generator

### 0037_consumer_subscriptions.sql

**Purpose:** Allow consumers to follow organizations, products, categories

**New Table:** `consumer_subscriptions`
- Polymorphic design: `target_type` + `target_id`
- JSONB `notification_preferences` for flexible settings
- Source tracking for attribution

**Functions:**
- `toggle_subscription()` - Subscribe/unsubscribe toggle
- `get_subscriber_count()` - Count subscribers for any target

**RLS Policies:**
- Users can manage their own subscriptions
- Org admins can view their subscribers (read-only)
- Platform admins have full read access

### 0038_product_journey_steps.sql

**Purpose:** Supply chain transparency and traceability

**New Table:** `product_journey_steps`
- Step types: sourcing, processing, packaging, distribution, quality_check, certification, storage
- Location support with coordinates (JSONB)
- Media attachments (JSONB array)
- Verification workflow fields

**Functions:**
- `get_product_journey()` - Returns ordered steps for a product
- `reorder_journey_steps()` - Drag-drop reordering support

**Indexes:**
- Full-text search on Russian content
- Ordered steps per product
- Verified steps filter

### 0039_social_sharing.sql

**Purpose:** Track shares and implement referral system

**Schema Changes:**
- Added `referral_code` to `app_users` and `app_profiles`
- Added `referred_by` to `app_profiles`

**New Tables:**
- `share_events` - Records all sharing activity
- `share_clicks` - Tracks click-through attribution

**Functions:**
- `generate_referral_code()` - Creates unique 8-char codes
- `ensure_user_referral_code()` - Gets or creates referral code
- `record_share_event()` - Records share with auto referral code
- `record_share_click()` - Records click and updates counters
- `get_share_analytics()` - Returns analytics for content

**Supported Platforms:**
- whatsapp, telegram, vk, facebook, twitter, linkedin
- email, sms, copy_link, native_share, qr_scan

## File Locations

```
supabase/migrations/
  0036_product_pages_enhancement.sql  (4.7KB)
  0037_consumer_subscriptions.sql     (8.8KB)
  0038_product_journey_steps.sql      (9.4KB)
  0039_social_sharing.sql             (15.3KB)
```

## Integration Notes

### Frontend Requirements

1. **Product Pages:**
   - Use `global_slug` for `/product/:slug` routes
   - Query `featured_at IS NOT NULL` for featured products

2. **Follow System:**
   - Call `toggle_subscription(type, id)` for follow buttons
   - Use `get_subscriber_count(type, id)` for counts

3. **Product Journey:**
   - Use `get_product_journey(product_id)` for timeline display
   - Media URLs are JSONB arrays with `url`, `type`, `caption`

4. **Sharing:**
   - Call `record_share_event()` when share button clicked
   - Include referral code in share URLs
   - Call `record_share_click()` on landing page load

### Backend Requirements

1. Notification service should query `consumer_subscriptions` for sending updates
2. Analytics dashboard should use `get_share_analytics()` function
3. Consider cron job for expired referral tracking

## Known Issues / TODOs

1. Two conflicting 0035 migrations exist - should be resolved
2. Categories table doesn't exist yet - `consumer_subscriptions` uses UUID for categories
3. Consider adding rate limiting for share event creation

## Related Migrations

- 0013_products.sql - Original products table
- 0014_subscriptions.sql - Business subscriptions (different from consumer subscriptions)
- 0027_status_levels_tables.sql - Organization status system
- 0033_loyalty_points.sql - Gamification system
