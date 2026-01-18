# Notification System

> Last updated: 2026-01-18
> Domain: notifications
> Keywords: notification, alert, email, push, telegram, channel, delivery, settings

## Overview

Multi-channel notification system supporting in-app, email, Telegram, and
web push notifications. Users can configure preferences per notification type.

---

## Architecture

```
Event Trigger → emit_notification()
      ↓
Create notification record
      ↓
Resolve recipients (user/org/platform scope)
      ↓
Check user preferences per channel
      ↓
Create notification_deliveries for each recipient+channel
      ↓
Background workers process deliveries:
  - in_app: Mark ready (frontend polls)
  - email: SMTP send via aiosmtplib
  - telegram: Bot API send
  - push: Web Push API
```

---

## Database Tables

### notification_types
**Purpose:** Template definitions
**File:** `supabase/migrations/0012_notifications.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| key | text | Unique identifier (e.g., 'business.new_review') |
| category | text | Group category |
| severity | text | info, warning, critical |
| title_template | text | With {{placeholders}} |
| body_template | text | With {{placeholders}} |
| default_channels | text[] | ['in_app'], ['in_app', 'email'], etc. |

**Seeded Types:**
- `business.new_review` - "New review posted"
- `business.new_views` - "Profile views summary"
- `business.new_country_view` - "First view from new country"
- `billing.invoice_unpaid` - "Invoice overdue"
- `billing.subscription_expiring` - "Subscription expiring"
- `platform.new_pending_registration` - "New business registration"
- `system.integration_failed` - "Integration error"

### notifications
**Purpose:** Sent notification records
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| notification_type_id | uuid | References notification_types |
| org_id | uuid | Target organization (optional) |
| recipient_user_id | uuid | Target user (optional) |
| recipient_scope | text | 'user', 'organization', 'platform' |
| title | text | Resolved title |
| body | text | Resolved body |
| payload | jsonb | Additional data |
| severity | text | |
| category | text | |
| created_at | timestamptz | |

### notification_deliveries
**Purpose:** Per-user, per-channel delivery tracking
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| notification_id | uuid | References notifications |
| user_id | uuid | Target user |
| channel | text | 'in_app', 'email', 'push' |
| status | text | 'pending', 'sent', 'read', 'dismissed', 'failed' |
| read_at | timestamptz | |
| dismissed_at | timestamptz | |
| sent_at | timestamptz | |
| error_message | text | |

### user_notification_settings
**Purpose:** User preferences
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | |
| notification_type_id | uuid | |
| channels | text[] | Active channels |
| muted | boolean | Completely muted |

### user_push_subscriptions
**Purpose:** Web Push subscriptions
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | |
| endpoint | text | Push API endpoint |
| p256dh | text | Public key |
| auth | text | Auth token |

---

## Backend Service

### notifications.py
**File:** `backend/app/services/notifications.py`

**Core Functions:**
```python
emit_notification(request, actor_user_id)
# Main entry point for sending notifications
# request: { type_key, org_id, recipient_user_id, recipient_scope, payload, channels }

render_template(template, payload)
# Replace {{key}} placeholders with values
```

**User Functions:**
```python
list_notifications(user_id, cursor, limit)
# Paginated delivery list with cursor

get_unread_count(user_id)
# Count pending/sent deliveries

mark_notification_read(user_id, delivery_id)
# Set status='read', read_at=now()

dismiss_notification(user_id, delivery_id)
# Set status='dismissed', dismissed_at=now()
```

**Settings Functions:**
```python
list_notification_settings(user_id)
# Get settings per notification type

update_notification_settings(user_id, updates)
# Update channels/muted for types
```

**Push Functions:**
```python
save_push_subscription(user_id, endpoint, p256dh, auth)
# Store Web Push subscription

delete_push_subscription(user_id)
# Remove subscription
```

**Background Workers:**
```python
process_reminders()
# Process scheduled/recurring reminders

process_email_deliveries()
# Send pending emails via SMTP

process_telegram_deliveries()
# Send via Telegram Bot API

process_push_deliveries()
# Mark push notifications as ready
```

---

## API Endpoints

### Notifications
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | List notifications (paginated) |
| GET | `/api/notifications/unread-count` | Count unread |
| POST | `/api/notifications/{delivery_id}/read` | Mark read |
| POST | `/api/notifications/{delivery_id}/dismiss` | Dismiss |

### Settings
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notification-settings` | Get preferences |
| PATCH | `/api/notification-settings` | Update preferences |
| POST | `/api/notification-settings/push-subscription` | Save push subscription |
| DELETE | `/api/notification-settings/push-subscription` | Remove push |

---

## Frontend Integration

### Notifications.tsx
**Route:** `/dashboard/notifications`
**Purpose:** Notification inbox
**Features:**
- Paginated list
- Mark read/dismiss buttons
- Filter by read/unread

### NotificationSettings.tsx
**Route:** `/dashboard/settings/notifications`
**Purpose:** Configure preferences
**Features:**
- Toggle per notification type
- Select channels (in_app, email, push)
- Mute toggle

### pushNotifications.ts
**File:** `frontend/src/utils/pushNotifications.ts`
**Purpose:** Web Push API utilities

```typescript
requestNotificationPermission()
// Request browser permission

subscribeToPushNotifications()
// Get/create subscription

unsubscribeFromPushNotifications()
// Remove subscription

registerServiceWorker()
// Register /sw.js
```

---

## Recipient Scopes

### user
Single user receives notification.

### organization
All members of organization receive notification.
Delivered to each user based on their channel preferences.

### platform
Platform admins receive notification.
Used for system events like new registrations.

---

## Channel Delivery

### in_app
- Created with status='pending' or 'ready'
- Frontend polls `/api/notifications` periodically
- User marks read/dismissed via API

### email
- Background worker sends via SMTP
- Config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- Library: `aiosmtplib`

### telegram
- Background worker sends via Bot API
- Config: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- User must have Telegram linked (future feature)

### push
- Uses Web Push API
- Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Library: `pywebpush`
- Requires service worker on frontend

---

## Template Placeholders

Templates use `{{key}}` syntax for dynamic values:

```
title_template: "New review from {{author_name}}"
body_template: "{{author_name}} left a {{rating}}-star review on {{org_name}}"
```

Payload provides values:
```json
{
  "author_name": "John Doe",
  "rating": 5,
  "org_name": "My Company"
}
```

---

## Usage Example

**Emit notification when review is created:**
```python
# In reviews.py create_review()
await emit_notification(
    NotificationEmitRequest(
        type_key='business.new_review',
        org_id=org_id,
        recipient_scope='organization',
        payload={
            'author_name': user.full_name,
            'rating': review.rating,
            'review_excerpt': review.body[:100]
        }
    ),
    actor_user_id=user_id
)
```
