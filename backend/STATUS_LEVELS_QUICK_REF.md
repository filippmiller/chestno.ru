# Status Levels Service - Quick Reference

## Import
```python
from app.services import status_levels
```

## Core Functions

### Get Organization Status
```python
status = status_levels.get_organization_status(
    organization_id="org-uuid",
    user_id="user-uuid"  # Optional
)
# Returns: dict with current_level, active_levels, level_c_progress, can_manage
```

### Check Level C Eligibility
```python
eligibility = status_levels.check_level_c_eligibility("org-uuid")
# Returns: dict with meets_criteria, criteria breakdown, timestamp
```

### Grant Status Level
```python
result = status_levels.grant_status_level(
    organization_id="org-uuid",
    level='A'|'B'|'C',
    granted_by="user-uuid",
    valid_until=datetime|None,      # Optional
    subscription_id="sub-uuid",     # Optional (for A)
    notes="Admin notes"             # Optional
)
# Returns: dict with created status level record
# Raises: HTTPException if business rules violated
```

### Revoke Status Level
```python
success = status_levels.revoke_status_level(
    organization_id="org-uuid",
    level='A'|'B'|'C',
    revoked_by="user-uuid",
    reason="Reason text"  # Optional
)
# Returns: bool (True if revoked, False if not active)
```

### Subscription Integration
```python
# Ensure level A (idempotent)
result = status_levels.ensure_level_a(
    org_id="org-uuid",
    subscription_id="sub-uuid",
    granted_by="user-uuid"  # Optional
)

# Handle subscription status change
result = status_levels.handle_subscription_status_change(
    subscription_id="sub-uuid",
    new_status="active"|"past_due"|"cancelled",
    organization_id="org-uuid",
    actor_user_id="user-uuid"  # Optional
)
```

### Upgrade Requests
```python
# Create request
request = status_levels.create_upgrade_request(
    organization_id="org-uuid",
    target_level='B'|'C',
    requested_by="user-uuid",
    message="Explanation",           # Optional
    evidence_urls=["url1", "url2"]   # Optional
)

# Get requests
requests = status_levels.get_upgrade_requests_for_org(
    organization_id="org-uuid",
    limit=20
)
```

### History
```python
history, total = status_levels.get_status_history(
    organization_id="org-uuid",
    user_id="user-uuid",
    page=1,
    per_page=20
)
```

## Business Rules

### Level A (Self-Declaration)
- Tied to subscription
- Granted automatically on subscription activation
- 14-day grace period on past_due
- Revoked after grace period expires

### Level B (Platform Verified)
- Manually granted by admins
- Valid for 18 months (auto-set)
- Can be renewed/extended
- Required for level C

### Level C (Highest Reputation)
**Requirements:**
- Active level B ✓
- 15+ reviews (last 12 months) ✓
- 85%+ response rate (last 90 days) ✓
- <48h avg response time ✓
- 1+ public case study ✓

## Error Codes
- **400** - Business rule violation (e.g., granting C without B)
- **409** - Duplicate request (e.g., pending upgrade exists)
- **500** - Database error

## Caching
- **TTL:** 60 seconds
- **Auto-invalidation:** On grant/revoke
- **Key format:** `org_status:{org_id}:{user_id}`

## Testing
```bash
# Run unit tests
pytest backend/tests/test_status_levels.py -v

# Run with coverage
pytest backend/tests/test_status_levels.py --cov=app.services.status_levels
```

## Files
- **Service:** `backend/app/services/status_levels.py` (923 lines)
- **Schemas:** `backend/app/schemas/status_levels.py` (142 lines)
- **Tests:** `backend/tests/test_status_levels.py` (549 lines)
- **Docs:** `backend/STATUS_LEVELS_SERVICE_README.md` (625 lines)

## SQL Functions (Migration 0029)
1. `get_current_status_level(org_id)` → '0'|'A'|'B'|'C'
2. `check_level_c_criteria(org_id)` → JSONB eligibility
3. `grant_status_level(...)` → Creates level + history
4. `revoke_status_level(...)` → Deactivates level + history

---
**Version:** 1.0.0 | **Date:** 2026-01-27
