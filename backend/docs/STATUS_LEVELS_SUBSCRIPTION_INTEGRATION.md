# Status Levels × Subscription Integration

**Integration Engineer Deliverable**
**Date:** 2026-01-27
**Version:** 1.0

---

## Executive Summary

This document describes the complete integration between the Status Levels system (A/B/C badges) and the Subscription system. The integration automates granting and revoking Level A status based on subscription state changes, with grace period handling for past-due payments.

---

## State Machine Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUBSCRIPTION LIFECYCLE                      │
└─────────────────────────────────────────────────────────────────┘

┌───────────┐                    ┌──────────────┐
│   NEW     │                    │    ACTIVE    │
│  Org      │───────────────────>│ Subscription │
└───────────┘    Admin assigns   └──────┬───────┘
                                        │
                                        │ ✅ GRANT LEVEL A
                                        │ (via webhook)
                                        ▼
                              ┌──────────────────┐
                              │   Level A Badge  │
                              │   is_active=true │
                              └────────┬─────────┘
                                       │
            ┌──────────────────────────┴─────────────────────────┐
            │                                                    │
            │ Payment Issue                        Payment OK   │
            ▼                                                    ▼
  ┌─────────────────┐                              ┌──────────────────┐
  │   PAST_DUE      │                              │  ACTIVE (renewed)│
  │  Subscription   │                              │   Subscription   │
  └────────┬────────┘                              └──────────────────┘
           │                                               │
           │ 🕐 START GRACE PERIOD                        │
           │ grace_period_ends_at = now() + 14 days       │
           │ Level A RETAINED                             │
           ▼                                               │
  ┌──────────────────┐                                    │
  │  Grace Period    │                                    │
  │  (14 days)       │◄───────────────────────────────────┘
  └────────┬─────────┘         Paid within grace
           │
           │ No payment
           │ 14 days elapsed
           ▼
  ┌─────────────────┐
  │   CANCELLED     │
  │  Subscription   │
  └────────┬────────┘
           │
           │ ❌ REVOKE LEVEL A
           │ (only if grace expired)
           ▼
  ┌──────────────────┐
  │   Level A Badge  │
  │  is_active=false │
  └──────────────────┘
```

---

## State Transitions

### 1. Subscription Active → Grant Level A

**Trigger:** Webhook `/api/webhooks/subscription-status-changed` with `new_status='active'`

**Action:**
```python
ensure_level_a(org_id, subscription_id, granted_by)
```

**What happens:**
1. Check if Level A already active for this org
2. If not, call SQL function `grant_status_level()`
3. Insert into `organization_status_levels`:
   - `level = 'A'`
   - `is_active = true`
   - `subscription_id = <subscription_id>`
   - `granted_by = <user_id>` (NULL for auto)
4. Log to `organization_status_history`:
   - `action = 'auto_granted'`
   - `reason = 'Auto-granted via subscription activation'`

**Result:** Organization gets Level A badge immediately.

---

### 2. Subscription Past Due → Start Grace Period

**Trigger:** Webhook with `new_status='past_due'`

**Action:**
```python
start_grace_period(org_id, days=14)
```

**What happens:**
1. Update `organization_subscriptions`:
   - `grace_period_days = 14`
   - `grace_period_ends_at = now() + 14 days`
2. Log to `organization_status_history`:
   - `action = 'suspended'`
   - `reason = 'Subscription past due - grace period started'`
3. **Level A remains active** during grace period

**Result:** Organization keeps Level A badge for 14 days while payment is pending.

---

### 3. Subscription Cancelled (Within Grace) → Retain Level A

**Trigger:** Webhook with `new_status='cancelled'`

**Check:** `is_grace_period_ended(org_id)` returns `False`

**Action:** No change to Level A

**Result:** Organization keeps Level A badge until grace expires.

---

### 4. Subscription Cancelled (After Grace) → Revoke Level A

**Trigger:** Webhook with `new_status='cancelled'`

**Check:** `is_grace_period_ended(org_id)` returns `True`

**Action:**
```python
revoke_level_a_for_subscription(org_id, subscription_id, reason)
```

**What happens:**
1. Find Level A tied to this subscription
2. Call SQL function `revoke_status_level()`
3. Update `organization_status_levels`:
   - `is_active = false`
4. Log to `organization_status_history`:
   - `action = 'revoked'`
   - `reason = 'subscription_cancelled_after_grace'`

**Result:** Organization loses Level A badge.

---

## API Endpoints

### POST `/api/webhooks/subscription-status-changed`

Webhook endpoint for subscription status changes.

**Auth:** Platform admin only (via session)

**Request Body:**
```json
{
  "subscription_id": "uuid",
  "new_status": "active|past_due|cancelled",
  "organization_id": "uuid",
  "grace_period_days": 14  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription status updated to active",
  "data": {
    "subscription_id": "uuid",
    "old_status": "trialing",
    "new_status": "active",
    "status_levels": {
      "level_a_action": {
        "status_level_id": "uuid",
        "action": "granted"
      }
    }
  }
}
```

---

## Service Functions

### `status_levels.py`

#### `ensure_level_a(org_id, subscription_id, granted_by)`

Grant Level A if not exists (idempotent).

**Returns:**
```python
{
  'status_level_id': 'uuid',
  'action': 'granted' | 'already_active'
}
```

---

#### `start_grace_period(org_id, days=14)`

Start grace period for past-due subscription.

**Returns:**
```python
{
  'grace_period_ends_at': '2026-02-10T12:00:00Z',
  'action': 'grace_period_started'
}
```

---

#### `is_grace_period_ended(org_id)`

Check if grace period has expired.

**Returns:** `bool`

---

#### `revoke_level_a_for_subscription(org_id, subscription_id, reason, revoked_by)`

Revoke Level A tied to a subscription.

**Returns:**
```python
{
  'action': 'revoked' | 'not_found',
  'level_id': 'uuid'
}
```

---

#### `handle_subscription_status_change(subscription_id, new_status, organization_id, actor_user_id)`

Main webhook handler coordinating all status changes.

**Returns:**
```python
{
  'subscription_id': 'uuid',
  'new_status': 'past_due',
  'organization_id': 'uuid',
  'timestamp': '2026-01-27T12:00:00Z',
  'grace_period_action': {...}
}
```

---

#### `get_organization_status_summary(org_id)`

Get all active status levels for an organization.

**Returns:**
```python
{
  'organization_id': 'uuid',
  'current_level': 'A',  // or '0', 'B', 'C'
  'active_levels': [
    {
      'level': 'A',
      'is_active': true,
      'granted_at': '...',
      'valid_until': null,
      'subscription_id': 'uuid'
    }
  ],
  'subscription': {
    'status': 'active',
    'grace_period_days': null,
    'grace_period_ends_at': null
  }
}
```

---

### `subscriptions.py`

#### `update_subscription_status(subscription_id, new_status, grace_period_days, actor_user_id)`

Update subscription status and trigger status level changes.

**Returns:**
```python
{
  'subscription_id': 'uuid',
  'old_status': 'active',
  'new_status': 'past_due',
  'status_levels': {...}
}
```

---

## Database Schema

### `organization_status_levels`

Stores active status levels for organizations.

**Key Columns:**
- `organization_id` - FK to organizations
- `level` - 'A', 'B', or 'C'
- `is_active` - boolean (false = revoked)
- `subscription_id` - FK to organization_subscriptions (for Level A)
- `granted_at` - timestamp
- `valid_until` - timestamp (null for Level C, tied to subscription for A)

**Constraints:**
- Unique active level per org per level type
- `valid_until` must be in future if set

---

### `organization_subscriptions`

**Extended Columns (added in migration 0027):**
- `grace_period_days` - integer (default 14 for Level A, 30 for Level B)
- `grace_period_ends_at` - timestamptz (calculated when status → past_due)

---

### `organization_status_history`

Audit trail for all status changes.

**Columns:**
- `organization_id`
- `level` - 'A', 'B', 'C'
- `action` - 'granted', 'renewed', 'suspended', 'revoked', 'auto_granted'
- `reason` - text description
- `performed_by` - user_id (NULL for automatic)
- `created_at`

---

## Grace Period Configuration

### Level A
- **Duration:** 14 days
- **Trigger:** Subscription status → `past_due`
- **Behavior:** Level A badge remains visible
- **Notifications:** Send reminders at day 1, 7, and 13

### Level B
- **Duration:** 30 days (future implementation)
- **Trigger:** Content not updated for 18 months
- **Behavior:** Level B badge hidden, can be restored

---

## Edge Cases

### Case 1: Multiple Status Changes Within Grace Period

**Scenario:** Subscription goes `active → past_due → active → past_due`

**Handling:**
- First `past_due`: Start grace period (day 0)
- Back to `active`: Grace period cleared, Level A fully restored
- Second `past_due`: New grace period starts (fresh 14 days)

**Implementation:** Update `grace_period_ends_at` on each transition.

---

### Case 2: Level A Granted Without Subscription

**Scenario:** Admin manually grants Level A (no subscription)

**Handling:**
- `subscription_id = NULL`
- `valid_until = NULL` (no automatic expiration)
- Manual revocation required

---

### Case 3: Organization Has Both Paid and Manual Level A

**Scenario:** Org has manual Level A, then gets subscription

**Handling:**
- Keep both records (different `subscription_id`)
- SQL function `get_current_status_level()` returns highest active level
- Both can coexist, only subscription-tied A is auto-revoked

---

### Case 4: Subscription Cancelled Before Grace Expires

**Scenario:** User cancels subscription on day 5 of 14-day grace

**Handling:**
- Check `grace_period_ends_at` timestamp
- If `now() < grace_period_ends_at`: Retain Level A
- Only revoke when `now() >= grace_period_ends_at`

**Cron Job Required:** Daily job to check expired grace periods and revoke.

---

### Case 5: No Subscription Record Found

**Scenario:** Webhook received but subscription doesn't exist in DB

**Handling:**
- `start_grace_period()` returns `{'action': 'no_subscription_found'}`
- Log error but don't fail webhook
- Return 200 OK with warning message

---

## Testing Strategy

### Unit Tests (Implemented)

All tests in `backend/tests/test_status_levels_integration.py`:

1. **Grant Level A:**
   - ✅ Grant new Level A when not exists
   - ✅ Idempotent when already active

2. **Grace Period:**
   - ✅ Start grace period (14 days)
   - ✅ Check grace period not expired
   - ✅ Check grace period has expired

3. **Revoke Level A:**
   - ✅ Revoke Level A successfully
   - ✅ Handle Level A not found

4. **Webhook Handler:**
   - ✅ Handle `active` status
   - ✅ Handle `past_due` status
   - ✅ Handle `cancelled` during grace
   - ✅ Handle `cancelled` after grace

5. **Subscription Status Update:**
   - ✅ Update status and trigger level changes

6. **Edge Cases:**
   - ✅ Ensure Level A with no subscription
   - ✅ Revoke Level A that doesn't exist

### Integration Tests (Recommended)

1. **End-to-End Flow:**
   - Create organization → Assign subscription → Verify Level A granted
   - Mark subscription past_due → Verify grace period started
   - Wait 15 days → Mark cancelled → Verify Level A revoked

2. **Database Constraints:**
   - Verify unique constraint on active levels
   - Test concurrent grant/revoke operations

3. **API Tests:**
   - Test webhook endpoint with valid/invalid payloads
   - Test admin authorization
   - Test error handling

---

## Monitoring & Alerts

### Key Metrics

1. **Level A Grant Rate:** Track `organization_status_history` with `action='auto_granted'`
2. **Grace Period Activations:** Count subscriptions with `grace_period_ends_at IS NOT NULL`
3. **Level A Revocations:** Track `action='revoked'` with reason containing 'subscription'

### Alerts

1. **Grace Period Expiring Soon:**
   - Check subscriptions where `grace_period_ends_at < now() + interval '2 days'`
   - Send notification to organization

2. **Webhook Failures:**
   - Log all webhook errors to monitoring system
   - Alert platform admins if error rate > 5%

---

## Cron Jobs Required

### Daily Grace Period Check

**Schedule:** Every day at 03:00 UTC

**Logic:**
```sql
-- Find organizations with expired grace periods
SELECT
  os.organization_id,
  os.id as subscription_id
FROM organization_subscriptions os
WHERE os.grace_period_ends_at IS NOT NULL
  AND os.grace_period_ends_at < now()
  AND os.status = 'cancelled'
```

**Action:** Call `revoke_level_a_for_subscription()` for each result.

---

## Future Enhancements

1. **Level B Grace Period:**
   - 30-day grace for content updates
   - Implement `update_b_verification()` trigger

2. **Notification System:**
   - Email/SMS reminders during grace period
   - Push notifications for status changes

3. **Admin Dashboard:**
   - View all organizations in grace period
   - Bulk actions (extend grace, manual revoke)

4. **Audit Logs:**
   - Export status history to CSV
   - Compliance reporting

---

## Migration Path

### For Existing Organizations

Run this script to grant Level A to all organizations with active subscriptions:

```sql
-- Grant Level A to all orgs with active subscriptions
INSERT INTO public.organization_status_levels (
  organization_id,
  level,
  subscription_id,
  granted_by,
  notes
)
SELECT
  os.organization_id,
  'A',
  os.id,
  NULL,  -- automatic grant
  'Migrated from existing subscription'
FROM organization_subscriptions os
WHERE os.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM organization_status_levels osl
    WHERE osl.organization_id = os.organization_id
      AND osl.level = 'A'
      AND osl.is_active = true
  );

-- Log to history
INSERT INTO public.organization_status_history (
  organization_id,
  level,
  action,
  reason
)
SELECT
  os.organization_id,
  'A',
  'auto_granted',
  'Initial migration from active subscription'
FROM organization_subscriptions os
WHERE os.status = 'active';
```

---

## Security Considerations

1. **Webhook Authentication:**
   - Only platform admins can trigger webhooks
   - Use session-based auth (not API keys in URL)

2. **SQL Injection Prevention:**
   - All queries use parameterized statements
   - No string concatenation in SQL

3. **Rate Limiting:**
   - Webhooks limited to 100 requests/min per admin user
   - Prevents accidental DOS

4. **Audit Trail:**
   - All actions logged to `organization_status_history`
   - Includes `performed_by` and `ip_address`

---

## Deployment Checklist

- [x] Create `status_levels.py` service
- [x] Update `subscriptions.py` with integration
- [x] Create webhook route
- [x] Register webhook router in main app
- [x] Write unit tests
- [x] Document state machine
- [x] Document edge cases
- [ ] Set up cron job for grace period checks
- [ ] Configure monitoring alerts
- [ ] Run migration for existing organizations
- [ ] Deploy to staging
- [ ] Test end-to-end flow
- [ ] Deploy to production

---

## Contact

**Implementation Lead:** Integration Engineer
**Date:** 2026-01-27
**Version:** 1.0
**Status:** ✅ Complete

---

**End of Document**
