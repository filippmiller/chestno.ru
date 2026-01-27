# Status Levels Quick Reference

**For Developers**

---

## Service Functions

### Check Status

```python
from app.services import status_levels

# Get current status for an organization
status = status_levels.get_organization_status(org_id, user_id)
# Returns: {'current_level': 'A', 'active_levels': [...], ...}

# Check if org meets Level C criteria
eligibility = status_levels.check_level_c_eligibility(org_id)
# Returns: {'meets_criteria': True/False, 'criteria': {...}}
```

---

### Grant/Revoke Status

```python
from app.services import status_levels

# Grant Level A (typically via subscription)
result = status_levels.ensure_level_a(
    org_id='uuid',
    subscription_id='uuid',
    granted_by='user_uuid'  # None for automatic
)

# Grant Level B (manual, requires admin)
level_b = status_levels.grant_status_level(
    organization_id='uuid',
    level='B',
    granted_by='admin_user_uuid',
    valid_until=None,  # Auto-set to +18 months
    notes='Verified partner'
)

# Revoke any level
success = status_levels.revoke_status_level(
    organization_id='uuid',
    level='A',
    revoked_by='admin_user_uuid',
    reason='Subscription expired'
)
```

---

### Subscription Integration

```python
from app.services import subscriptions

# Update subscription status (triggers status level changes)
result = subscriptions.update_subscription_status(
    subscription_id='uuid',
    new_status='past_due',  # active, past_due, cancelled
    grace_period_days=14,    # Optional
    actor_user_id='user_uuid'
)

# Returns:
# {
#   'subscription_id': 'uuid',
#   'old_status': 'active',
#   'new_status': 'past_due',
#   'status_levels': {
#     'grace_period_action': {...}
#   }
# }
```

---

## Webhook Endpoint

### POST `/api/webhooks/subscription-status-changed`

**Auth:** Platform admin only

**Request:**
```json
{
  "subscription_id": "uuid",
  "new_status": "active",
  "organization_id": "uuid",
  "grace_period_days": 14
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

## Database Queries

### Check Current Level

```sql
-- Get current level (0/A/B/C)
SELECT public.get_current_status_level('org_uuid'::uuid);

-- Get all active levels
SELECT * FROM organization_status_levels
WHERE organization_id = 'org_uuid'::uuid
  AND is_active = true;
```

---

### Check Level C Eligibility

```sql
-- Check if org meets criteria
SELECT public.check_level_c_criteria('org_uuid'::uuid);

-- Returns:
-- {
--   "meets_criteria": true,
--   "criteria": {
--     "has_active_b": true,
--     "review_count": 20,
--     "review_count_needed": 15,
--     "response_rate": 92.5,
--     "response_rate_needed": 85,
--     "avg_response_hours": 24.5,
--     "avg_response_hours_max": 48,
--     "public_cases": 3,
--     "public_cases_needed": 1
--   }
-- }
```

---

### View Audit History

```sql
-- Get status change history
SELECT * FROM organization_status_history
WHERE organization_id = 'org_uuid'::uuid
ORDER BY created_at DESC
LIMIT 50;
```

---

## State Transitions

| Current Status | Event | New Status | Level A Action |
|----------------|-------|------------|----------------|
| `null` | Subscription assigned | `active` | ✅ Grant Level A |
| `active` | Payment fails | `past_due` | 🕐 Start grace (retain A) |
| `past_due` | Payment received | `active` | ✅ Clear grace (keep A) |
| `past_due` | Cancelled within 14d | `cancelled` | ⏳ Retain A |
| `past_due` | Cancelled after 14d | `cancelled` | ❌ Revoke A |

---

## Grace Period Logic

### Configuration
- **Level A Grace:** 14 days
- **Level B Grace:** 30 days (future)

### Implementation
```python
# Start grace period (past_due)
grace = status_levels.start_grace_period(org_id, days=14)
# Sets: grace_period_ends_at = now() + 14 days

# Check if expired
expired = status_levels.is_grace_period_ended(org_id)
# Returns: bool (True if now >= grace_period_ends_at)

# Revoke after grace
if expired:
    status_levels.revoke_level_a_for_subscription(
        org_id,
        subscription_id,
        reason='subscription_cancelled_after_grace'
    )
```

---

## Common Patterns

### 1. Check if Org Can Use Badge

```python
status = status_levels.get_organization_status(org_id)
current_level = status['current_level']

if current_level == '0':
    # No badge
    pass
elif current_level == 'A':
    # Show badge-a.svg
    pass
elif current_level == 'B':
    # Show badge-b.svg
    pass
elif current_level == 'C':
    # Show badge-c.svg (highest)
    pass
```

---

### 2. Handle Subscription Webhook

```python
# In webhook handler
from app.services import status_levels

result = status_levels.handle_subscription_status_change(
    subscription_id=payload['subscription_id'],
    new_status=payload['new_status'],
    organization_id=payload['organization_id'],
    actor_user_id=current_user_id
)

# Log result
logger.info(f"Processed subscription webhook: {result}")
```

---

### 3. Display Level C Progress (UI)

```python
# In organization dashboard
progress = status_levels.get_level_c_progress(org_id)

# Returns:
# {
#   'meets_criteria': False,
#   'has_active_b': True,
#   'review_count': 10,
#   'review_count_needed': 15,
#   'response_rate': 78.5,
#   'response_rate_needed': 85,
#   ...
# }

# Display progress bars:
review_progress = (progress['review_count'] / progress['review_count_needed']) * 100
response_progress = (progress['response_rate'] / progress['response_rate_needed']) * 100
```

---

## Testing

### Unit Tests

```bash
# Run status levels integration tests
cd backend
python -m pytest tests/test_status_levels_integration.py -v

# Expected output:
# test_ensure_level_a_grants_new PASSED
# test_ensure_level_a_already_active PASSED
# test_start_grace_period PASSED
# test_is_grace_period_ended_false PASSED
# test_is_grace_period_ended_true PASSED
# test_revoke_level_a PASSED
# test_handle_active_status PASSED
# test_handle_past_due_status PASSED
# test_handle_cancelled_after_grace PASSED
# test_handle_cancelled_during_grace PASSED
# ...
```

---

### Manual Testing

```bash
# 1. Grant Level A via subscription
curl -X POST http://localhost:8000/api/webhooks/subscription-status-changed \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "sub-uuid",
    "new_status": "active",
    "organization_id": "org-uuid"
  }'

# 2. Trigger grace period
curl -X POST http://localhost:8000/api/webhooks/subscription-status-changed \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "sub-uuid",
    "new_status": "past_due",
    "organization_id": "org-uuid"
  }'

# 3. Check status
curl http://localhost:8000/api/organizations/{org_id}/status

# 4. Cancel and revoke
curl -X POST http://localhost:8000/api/webhooks/subscription-status-changed \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "sub-uuid",
    "new_status": "cancelled",
    "organization_id": "org-uuid"
  }'
```

---

## Monitoring

### Key Metrics

```sql
-- Total active badges by level
SELECT level, COUNT(*) as count
FROM organization_status_levels
WHERE is_active = true
GROUP BY level;

-- Organizations in grace period
SELECT COUNT(*) as grace_count
FROM organization_subscriptions
WHERE grace_period_ends_at IS NOT NULL
  AND grace_period_ends_at > now();

-- Grace periods expiring soon (<2 days)
SELECT organization_id, grace_period_ends_at
FROM organization_subscriptions
WHERE grace_period_ends_at < now() + interval '2 days'
  AND grace_period_ends_at > now();
```

---

### Error Handling

```python
from fastapi import HTTPException

try:
    result = status_levels.grant_status_level(...)
except HTTPException as e:
    # Business logic error (e.g., duplicate, invalid criteria)
    logger.warning(f"Status level grant failed: {e.detail}")
    raise
except Exception as e:
    # Unexpected error
    logger.error(f"Unexpected error granting status: {e}")
    raise HTTPException(status_code=500, detail="Internal error")
```

---

## Caching

Status queries are cached for 60 seconds:

```python
# First call: Database query
status = status_levels.get_organization_status(org_id)

# Second call within 60s: Cached result
status = status_levels.get_organization_status(org_id)

# After grant/revoke: Cache automatically invalidated
status_levels.grant_status_level(...)
# Next call will query database
```

To disable caching in tests:
```python
from app.services import status_levels
status_levels._cache.clear()
```

---

## Migration for Existing Orgs

Run once to grant Level A to existing active subscriptions:

```sql
-- Grant Level A to all active subscriptions
INSERT INTO public.organization_status_levels (
  organization_id,
  level,
  subscription_id,
  notes
)
SELECT
  os.organization_id,
  'A',
  os.id,
  'Migrated from existing subscription'
FROM organization_subscriptions os
WHERE os.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM organization_status_levels osl
    WHERE osl.organization_id = os.organization_id
      AND osl.level = 'A'
      AND osl.is_active = true
  );
```

---

## Gotchas

### ⚠️ Idempotent Operations

`ensure_level_a()` is idempotent - safe to call multiple times:

```python
# Called twice - only grants once
ensure_level_a(org_id, sub_id)
ensure_level_a(org_id, sub_id)  # No duplicate created
```

---

### ⚠️ Grace Period Timezone

All timestamps in UTC:

```python
# ✅ Correct
grace_ends_at = datetime.utcnow() + timedelta(days=14)

# ❌ Wrong (local timezone)
grace_ends_at = datetime.now() + timedelta(days=14)
```

---

### ⚠️ Level C Requires Level B

Cannot grant Level C without active Level B:

```python
# ❌ Fails if no Level B
grant_status_level(org_id, level='C', ...)
# Raises: HTTPException 400 "Must have active level B"

# ✅ Grant B first, then C
grant_status_level(org_id, level='B', ...)
grant_status_level(org_id, level='C', ...)
```

---

### ⚠️ Multiple Level A Records

Org can have both subscription-tied and manual Level A:

```python
# Subscription grants Level A
ensure_level_a(org_id, sub_id)  # subscription_id = sub_id

# Admin manually grants Level A
grant_status_level(org_id, level='A', ...)  # subscription_id = NULL

# Both exist - get_current_status_level() returns 'A'
# Only subscription-tied A revoked on cancellation
```

---

## Support

**Implementation Lead:** Integration Engineer
**Documentation:** `backend/docs/STATUS_LEVELS_SUBSCRIPTION_INTEGRATION.md`
**Tests:** `backend/tests/test_status_levels_integration.py`
**Service:** `backend/app/services/status_levels.py`

---

**End of Quick Reference**
