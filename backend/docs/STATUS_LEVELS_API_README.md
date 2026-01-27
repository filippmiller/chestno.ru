# Status Levels API Implementation

## Overview

Complete REST API implementation for the Organization Status Levels system. This provides endpoints for managing three levels of organization badges: A (Self-Declaration), B (Platform Verified), and C (Highest Reputation).

## Files Created

### 1. Route Handlers
**File:** `backend/app/api/routes/status_levels.py`

Contains all API endpoint definitions:
- Public routes (no authentication)
- Authenticated routes (organization members)
- Admin routes (platform administrators only)

### 2. Service Layer Extensions
**File:** `backend/app/services/status_levels.py` (updated)

Added/modified functions:
- `get_status_history()` - Now returns tuple with total count for pagination
- `get_status_levels_info()` - Public information about all levels

The existing service already had comprehensive implementations for:
- `get_organization_status()` - Get current status and active levels
- `grant_status_level()` - Grant a status level (admin only)
- `revoke_status_level()` - Revoke a status level (admin only)
- `create_upgrade_request()` - Create upgrade request
- `check_level_c_eligibility()` - Check Level C criteria
- Subscription integration functions

### 3. Integration Tests
**File:** `backend/tests/test_status_levels_api.py`

Comprehensive test suite covering:
- All endpoint functionality
- Authentication and authorization
- Business rule validation
- Error handling
- Edge cases

### 4. API Documentation
**File:** `backend/docs/status_levels_api.yaml`

OpenAPI 3.0 specification with:
- Complete endpoint documentation
- Request/response schemas
- Examples for each endpoint
- Error codes and descriptions

## API Endpoints Summary

### Public Endpoints (No Auth Required)

#### GET `/api/status-levels/info`
Get public information about all status levels.

**Response:**
```json
{
  "levels": {
    "A": {
      "name": "Самодекларация",
      "description": "...",
      "price": {"monthly": 990, "yearly": 9900},
      "features": [...]
    },
    "B": {...},
    "C": {...}
  }
}
```

### Authenticated Endpoints

#### GET `/api/organizations/{org_id}/status`
Get current status for an organization.
- **Public access:** Limited data (current level only)
- **Authenticated:** Full details including progress

**Response:**
```json
{
  "organization_id": "uuid",
  "current_level": "B",
  "active_levels": [...],
  "badge_visible": true,
  "level_c_progress": {...},
  "can_manage": true
}
```

#### POST `/api/organizations/{org_id}/status-upgrade-request`
Request upgrade to higher level (org admin only).

**Requirements:**
- Must be org admin/owner
- Rate limit: 1 request per 30 days
- Level C requires active Level B

**Request:**
```json
{
  "target_level": "B",
  "message": "We have excellent reviews...",
  "evidence_urls": ["https://..."]
}
```

#### GET `/api/organizations/{org_id}/status-history`
Get paginated status change history.

**Query params:**
- `page` (default: 1)
- `per_page` (default: 20, max: 100)

**Response:**
```json
{
  "history": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### Admin Endpoints (Platform Admin Only)

#### POST `/api/admin/organizations/{org_id}/status-levels`
Grant a status level to an organization.

**Request:**
```json
{
  "level": "B",
  "valid_until": "2026-07-01T00:00:00Z",
  "notes": "Verified business documents",
  "subscription_id": null
}
```

**Business Rules:**
- Level C requires active Level B
- Cannot grant duplicate active level
- Validates admin permissions

#### DELETE `/api/admin/organizations/{org_id}/status-levels/{level}`
Revoke a status level.

**Query params:**
- `reason` (optional): Reason for revocation
- `notify` (optional, default true): Send notification

**Response:**
```json
{
  "revoked": true,
  "level": "B",
  "organization_id": "uuid",
  "revoked_at": "2026-01-27T...",
  "revoked_by": "uuid",
  "reason": "...",
  "notification_sent": false
}
```

## Authentication & Authorization

### Authentication Methods
- **Session Cookie:** Primary method using `session_id` cookie
- **Bearer Token:** Legacy support for mobile apps

### Authorization Levels
1. **Public:** Anyone (limited data)
2. **Organization Member:** Member of the organization
3. **Organization Admin:** Admin or owner role
4. **Platform Admin:** `platform_admin` role in `app_profiles.role`

### Middleware Used
- `get_current_user_id_from_session` - Extract user ID from session
- `assert_platform_admin` - Verify admin permissions

## Business Logic Rules

### Level Requirements
1. **Level A:** Subscription-based, auto-granted when subscription active
2. **Level B:** Manually granted by admin, valid for 18 months (default)
3. **Level C:** Earned through metrics, requires active Level B

### Level C Criteria
Organization must meet ALL of:
- Has active Level B
- 50+ approved reviews in last 12 months
- 95%+ response rate in last 90 days
- Average response time ≤ 48 hours
- 30+ public case studies

### Rate Limits
- **Upgrade Requests:** 1 request per 30 days per organization
- **Status Queries:** 60-second cache TTL

### Validation Rules
- Cannot grant Level C without active Level B
- Cannot grant duplicate active level (returns 409)
- `valid_until` must be in future
- Only admins can grant/revoke levels
- Only org admins can create upgrade requests

## Error Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | Success | Request completed successfully |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized for this action |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., level already active) |
| 422 | Unprocessable Entity | Business rule violation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected error |

## Database Dependencies

### Tables Used
- `organization_status_levels` - Active status levels
- `organization_status_history` - Audit trail
- `status_upgrade_requests` - Upgrade request tracking
- `organization_members` - Authorization checks
- `app_profiles` - Admin role verification

### SQL Functions Used
- `get_current_status_level(org_id)` - Get current level (0/A/B/C)
- `check_level_c_criteria(org_id)` - Check Level C eligibility
- `grant_status_level(...)` - Grant with history logging
- `revoke_status_level(...)` - Revoke with history logging

## Integration Points

### With Other Services
1. **Subscriptions Service:** Auto-grant Level A on subscription activation
2. **Notifications Service:** TODO - Send notifications on grant/revoke
3. **Analytics Service:** Track status level progression metrics
4. **QR Service:** Enhanced features for verified organizations

### Webhook Support
The service includes `handle_subscription_status_change()` for webhook integration:
- Active subscription → Grant Level A
- Past due → Start grace period
- Cancelled → Revoke Level A (after grace period)

## Caching Strategy

### Status Endpoint Cache
- **TTL:** 60 seconds
- **Key:** `org_status:{org_id}:{user_id}`
- **Invalidation:** On grant/revoke operations

### Cache Implementation
Simple in-memory cache with expiration tracking. For production, consider:
- Redis for distributed caching
- Cache warming for popular organizations
- Cache versioning for schema changes

## Testing

### Running Tests
```bash
pytest backend/tests/test_status_levels_api.py -v
```

### Test Coverage
- ✅ All endpoint responses
- ✅ Authentication/authorization
- ✅ Business rule validation
- ✅ Rate limiting
- ✅ Pagination
- ✅ Error handling
- ✅ Integration scenarios

## Deployment Checklist

Before deploying to production:

- [ ] Database migrations applied
- [ ] SQL functions deployed
- [ ] Environment variables configured
- [ ] Admin users have `role='admin'` in `app_profiles`
- [ ] Rate limiting configured
- [ ] Caching configured (Redis recommended)
- [ ] Monitoring alerts set up
- [ ] API documentation published
- [ ] Integration tests passing
- [ ] Load testing completed

## Usage Examples

### Example 1: Check Organization Status (Public)
```bash
curl https://api.chestno.ru/api/organizations/{org_id}/status
```

### Example 2: Request Upgrade (Authenticated)
```bash
curl -X POST https://api.chestno.ru/api/organizations/{org_id}/status-upgrade-request \
  -H "Cookie: session_id=..." \
  -H "Content-Type: application/json" \
  -d '{
    "target_level": "B",
    "message": "We have 3 years of excellent operation",
    "evidence_urls": ["https://example.com/cert.pdf"]
  }'
```

### Example 3: Grant Level (Admin)
```bash
curl -X POST https://api.chestno.ru/api/admin/organizations/{org_id}/status-levels \
  -H "Cookie: session_id=..." \
  -H "Content-Type: application/json" \
  -d '{
    "level": "B",
    "valid_until": "2026-07-01T00:00:00Z",
    "notes": "Verified business registration"
  }'
```

### Example 4: Get Status History
```bash
curl https://api.chestno.ru/api/organizations/{org_id}/status-history?page=1&per_page=20 \
  -H "Cookie: session_id=..."
```

## Future Enhancements

### Planned Features
1. **Notification Integration:** Send emails/push notifications on status changes
2. **Webhook Support:** Notify external systems of status changes
3. **Analytics Dashboard:** Track status level distribution and progression
4. **Automated Level C:** Auto-grant when criteria met
5. **Appeal Process:** Allow organizations to appeal rejections
6. **Level Renewal:** Automated reminders before Level B expiration
7. **Batch Operations:** Grant/revoke levels for multiple orgs

### Technical Improvements
1. **Redis Caching:** Replace in-memory cache
2. **Rate Limiting:** Use Redis for distributed rate limiting
3. **Background Jobs:** Process upgrade requests asynchronously
4. **Audit Logging:** Enhanced logging with request metadata
5. **Metrics Collection:** Track API performance and usage

## Support & Maintenance

### Logs
Check logs for:
```
[status_levels] Granted level B to org {org_id}
[status_levels] Error granting level: ...
```

### Common Issues
1. **403 Forbidden:** User doesn't have admin role
2. **409 Conflict:** Level already active
3. **422 Validation:** Level C without Level B
4. **429 Rate Limit:** Too many upgrade requests

### Monitoring
Key metrics to track:
- Upgrade request volume
- Grant/revoke frequency
- Level distribution (how many A/B/C)
- Average time to Level C
- Cache hit rate

## Contact

For questions or issues:
- Backend Team Lead
- Platform Architecture Team
- API Documentation: https://api.chestno.ru/docs
