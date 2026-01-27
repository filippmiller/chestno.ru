# Status Levels Service - Implementation Guide

Complete implementation of the Status Levels service layer for managing organization A/B/C badges.

## Files Created

### 1. Service Layer
**File:** `backend/app/services/status_levels.py`

Comprehensive service with 15+ functions covering:
- Organization status queries
- Level C eligibility checks
- Grant/revoke status levels
- Subscription integration (Level A)
- Grace period management
- Upgrade request handling
- Status history and audit
- In-memory caching (60s TTL)

### 2. Schema Definitions
**File:** `backend/app/schemas/status_levels.py`

Pydantic models for:
- `StatusLevel` - Full status level record
- `OrganizationStatus` - Current status with progress
- `LevelCProgress` - Level C criteria breakdown
- `LevelCEligibility` - Eligibility check result
- `GrantStatusLevelRequest` - Grant request
- `RevokeStatusLevelRequest` - Revoke request
- `StatusHistoryEntry` - History entry
- `UpgradeRequest` - Upgrade request
- `CreateUpgradeRequest` - Create upgrade request

### 3. Unit Tests
**File:** `backend/tests/test_status_levels.py`

Comprehensive test suite with 25+ tests covering:
- Cache utilities
- Organization status queries
- Level C eligibility
- Grant/revoke operations
- Subscription integration
- Upgrade requests
- History queries

---

## Core Functions

### 1. Query Functions

#### `get_organization_status(organization_id, user_id=None)`
Get current status and all active levels for an organization.

**Returns:**
```python
{
    'organization_id': str,
    'current_level': '0' | 'A' | 'B' | 'C',
    'active_levels': [StatusLevel],
    'level_c_progress': LevelCProgress | None,
    'can_manage': bool
}
```

**Caching:** Results cached for 60 seconds

**Example:**
```python
from app.services import status_levels

status = status_levels.get_organization_status(
    organization_id="123e4567-...",
    user_id="987e6543-..."  # Optional
)

print(f"Current level: {status['current_level']}")
print(f"Active levels: {len(status['active_levels'])}")
```

#### `check_level_c_eligibility(organization_id)`
Check if organization meets all criteria for level C.

**Criteria:**
- Has active level B ✓
- 15+ published reviews (last 12 months) ✓
- 85%+ response rate (last 90 days) ✓
- <48 hour avg response time ✓
- 1+ published case study ✓

**Returns:**
```python
{
    'organization_id': str,
    'meets_criteria': bool,
    'criteria': {
        'has_active_b': bool,
        'review_count': int,
        'review_count_needed': 15,
        'response_rate': float,
        'response_rate_needed': 85.0,
        'avg_response_hours': float,
        'avg_response_hours_max': 48.0,
        'public_cases': int,
        'public_cases_needed': 1
    },
    'timestamp': datetime
}
```

**Example:**
```python
eligibility = status_levels.check_level_c_eligibility("123e4567-...")

if eligibility['meets_criteria']:
    print("✓ Organization qualifies for level C!")
else:
    criteria = eligibility['criteria']
    print(f"Reviews: {criteria['review_count']}/{criteria['review_count_needed']}")
    print(f"Response rate: {criteria['response_rate']}%")
```

#### `get_level_c_progress(organization_id)`
Get detailed progress toward level C eligibility.

**Returns:** Just the `criteria` dict from `check_level_c_eligibility`

---

### 2. Grant/Revoke Functions

#### `grant_status_level(organization_id, level, granted_by, valid_until=None, subscription_id=None, notes=None)`
Grant a status level to an organization.

**Business Rules:**
- Level C requires active level B (validated)
- Level A tied to subscription (provide subscription_id)
- Level B valid for 18 months (auto-set if not provided)
- Level C is permanent (valid_until should be None)

**Example:**
```python
# Grant level B
result = status_levels.grant_status_level(
    organization_id="123e4567-...",
    level='B',
    granted_by="admin-user-id",
    notes="Verified quality content"
)

# Grant level C (requires B)
result = status_levels.grant_status_level(
    organization_id="123e4567-...",
    level='C',
    granted_by="admin-user-id",
    valid_until=None  # Permanent
)

# Grant level A (subscription-based)
result = status_levels.grant_status_level(
    organization_id="123e4567-...",
    level='A',
    granted_by="system",
    subscription_id="sub-uuid"
)
```

#### `revoke_status_level(organization_id, level, revoked_by, reason=None)`
Revoke a status level from an organization.

**Returns:** `True` if revoked, `False` if level was not active

**Example:**
```python
success = status_levels.revoke_status_level(
    organization_id="123e4567-...",
    level='A',
    revoked_by="admin-user-id",
    reason="Subscription cancelled"
)

if success:
    print("Level A revoked successfully")
```

---

### 3. Subscription Integration

#### `ensure_level_a(org_id, subscription_id, granted_by=None)`
Ensure organization has active level A status (idempotent).

**Returns:**
```python
{
    'status_level_id': str,
    'action': 'granted' | 'already_active'
}
```

**Example:**
```python
result = status_levels.ensure_level_a(
    org_id="123e4567-...",
    subscription_id="sub-uuid"
)
```

#### `handle_subscription_status_change(subscription_id, new_status, organization_id, actor_user_id=None)`
Main webhook handler for subscription status changes.

**Status Handling:**
- `active` → Grant level A
- `past_due` → Start 14-day grace period
- `cancelled` → Revoke level A if grace period ended

**Example:**
```python
result = status_levels.handle_subscription_status_change(
    subscription_id="sub-uuid",
    new_status="active",
    organization_id="123e4567-...",
    actor_user_id="user-uuid"
)
```

---

### 4. Upgrade Requests

#### `create_upgrade_request(organization_id, target_level, requested_by, message=None, evidence_urls=None)`
Create a new status upgrade request (B or C only).

**Constraint:** Only one pending request per organization

**Example:**
```python
request = status_levels.create_upgrade_request(
    organization_id="123e4567-...",
    target_level='B',
    requested_by="user-uuid",
    message="We have high-quality content and engaged community",
    evidence_urls=["https://example.com/portfolio"]
)
```

#### `get_upgrade_requests_for_org(organization_id, limit=20)`
Get all upgrade requests for an organization.

**Example:**
```python
requests = status_levels.get_upgrade_requests_for_org("123e4567-...")

for req in requests:
    print(f"{req['target_level']}: {req['status']}")
```

---

### 5. History and Audit

#### `get_status_history(organization_id, limit=50, offset=0)`
Get status change history for an organization.

**Example:**
```python
history = status_levels.get_status_history(
    organization_id="123e4567-...",
    limit=10
)

for entry in history:
    print(f"{entry['created_at']}: {entry['action']} {entry['level']}")
```

---

## Integration Steps

### Step 1: Update Service Exports

**File:** `backend/app/services/__init__.py`

Add the following import:
```python
from . import status_levels  # noqa: F401
```

### Step 2: Create API Endpoints

**File:** `backend/app/api/status_levels.py` (create new)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services import status_levels
from app.core.auth import get_current_user
from app.schemas.status_levels import (
    OrganizationStatus,
    LevelCEligibility,
    GrantStatusLevelRequest,
    RevokeStatusLevelRequest,
    CreateUpgradeRequest,
)

router = APIRouter(prefix="/status-levels", tags=["status-levels"])

@router.get("/organizations/{org_id}")
def get_org_status(
    org_id: str,
    current_user = Depends(get_current_user)
):
    """Get current status levels for an organization"""
    return status_levels.get_organization_status(org_id, current_user.id)

@router.get("/organizations/{org_id}/eligibility")
def check_eligibility(org_id: str):
    """Check level C eligibility"""
    return status_levels.check_level_c_eligibility(org_id)

@router.post("/organizations/{org_id}/grant")
def grant_level(
    org_id: str,
    request: GrantStatusLevelRequest,
    current_user = Depends(get_current_user)
):
    """Grant a status level (admin only)"""
    return status_levels.grant_status_level(
        organization_id=org_id,
        level=request.level,
        granted_by=current_user.id,
        valid_until=request.valid_until,
        subscription_id=request.subscription_id,
        notes=request.notes
    )

@router.post("/organizations/{org_id}/revoke")
def revoke_level(
    org_id: str,
    request: RevokeStatusLevelRequest,
    current_user = Depends(get_current_user)
):
    """Revoke a status level (admin only)"""
    success = status_levels.revoke_status_level(
        organization_id=org_id,
        level=request.level,
        revoked_by=current_user.id,
        reason=request.reason
    )
    return {"success": success}

@router.get("/organizations/{org_id}/history")
def get_history(org_id: str, limit: int = 50, offset: int = 0):
    """Get status change history"""
    return status_levels.get_status_history(org_id, limit, offset)

@router.post("/upgrade-requests")
def create_request(
    request: CreateUpgradeRequest,
    current_user = Depends(get_current_user)
):
    """Create upgrade request"""
    return status_levels.create_upgrade_request(
        organization_id=request.organization_id,
        target_level=request.target_level,
        requested_by=current_user.id,
        message=request.message,
        evidence_urls=request.evidence_urls
    )

@router.get("/organizations/{org_id}/upgrade-requests")
def get_requests(org_id: str):
    """Get upgrade requests for organization"""
    return status_levels.get_upgrade_requests_for_org(org_id)
```

### Step 3: Register Router

**File:** `backend/app/main.py`

```python
from app.api import status_levels

app.include_router(status_levels.router)
```

---

## Testing

### Run Unit Tests

```bash
# Run all status levels tests
pytest backend/tests/test_status_levels.py -v

# Run specific test
pytest backend/tests/test_status_levels.py::test_grant_status_level_b -v

# Run with coverage
pytest backend/tests/test_status_levels.py --cov=app.services.status_levels --cov-report=html
```

### Manual Testing

```bash
# Test database connection
python backend/verify_status_levels.py

# Test grant level B
curl -X POST http://localhost:8000/status-levels/organizations/{org_id}/grant \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"level": "B", "notes": "Test grant"}'

# Check eligibility
curl http://localhost:8000/status-levels/organizations/{org_id}/eligibility
```

---

## Cache Management

The service uses in-memory caching with 60-second TTL for performance:

```python
# Cache is automatically managed:
# - Set on first query
# - Invalidated on grant/revoke
# - Expired after 60 seconds

# Manual cache operations (if needed):
status_levels._invalidate_cache(organization_id)  # Clear org cache
status_levels._cache.clear()  # Clear all cache
```

---

## SQL Functions Used

All SQL functions are defined in migration `0029_status_levels_functions.sql`:

1. **`get_current_status_level(org_id)`** - Returns '0', 'A', 'B', or 'C'
2. **`check_level_c_criteria(org_id)`** - Returns JSONB with eligibility
3. **`grant_status_level(...)`** - Grants level with history logging
4. **`revoke_status_level(...)`** - Revokes level with history logging
5. **`update_status_validity(...)`** - Updates expiration date
6. **`update_b_verification(org_id)`** - Updates level B verification timestamp

---

## Error Handling

All functions use proper error handling:

```python
try:
    result = status_levels.grant_status_level(...)
except HTTPException as e:
    # FastAPI will handle these automatically
    # 400: Business rule violation
    # 409: Duplicate request
    # 500: Database error
    print(f"Error: {e.detail}")
except Exception as e:
    # Unexpected errors
    print(f"Unexpected error: {str(e)}")
```

---

## Performance Considerations

1. **Caching:** All read operations cached for 60s
2. **Batch queries:** Use `get_organization_status()` for complete view
3. **Indexes:** All queries use proper indexes from migrations
4. **Connection pooling:** Uses psycopg connection pool (1-8 connections)

---

## Next Steps

1. ✅ Service layer implementation complete
2. ✅ Schema definitions complete
3. ✅ Unit tests complete
4. ⏳ Create API endpoints (see Step 2 above)
5. ⏳ Add admin UI integration
6. ⏳ Add webhook handlers for subscriptions
7. ⏳ Add frontend badge display
8. ⏳ Add automated level B verification cron job

---

## Support

For questions or issues:
1. Check migration files: `supabase/migrations/0027-0029`
2. Review spec: `C:\Dev\_OpsVault\Chestno.ru\Docs\specs\SPEC_Status_Levels_v1.md`
3. Run verification script: `python backend/verify_status_levels.py`
4. Check logs: `[status_levels]` prefix in application logs

---

**Implementation Date:** 2026-01-27
**Author:** Backend Service Engineer (Claude)
**Status:** Complete - Ready for API Integration
