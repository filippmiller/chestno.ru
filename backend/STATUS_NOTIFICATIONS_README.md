# Status Levels Notification Service

Complete notification system for Organization Status Levels (A/B/C badges).

## 📁 Files Created

```
backend/
├── app/
│   ├── services/
│   │   └── status_notification_service.py    # Main notification service
│   └── templates/
│       └── email/
│           ├── status_granted.html            # Celebration email
│           ├── status_expiring.html           # Warning email
│           ├── status_revoked.html            # Revocation notice
│           └── upgrade_request_reviewed.html  # Review result
└── test_status_notifications.py               # Test suite
```

---

## 🚀 Quick Start

### Import and Use

```python
from app.services import status_notification_service

# Send status granted notification
await status_notification_service.notify_status_granted(
    org_id='uuid-here',
    level='B',
    granted_by='admin-uuid',
    valid_until=datetime.now() + timedelta(days=365)
)

# Send expiring warning
await status_notification_service.notify_status_expiring(
    org_id='uuid-here',
    level='A',
    days_left=7
)

# Send revoked notification
await status_notification_service.notify_status_revoked(
    org_id='uuid-here',
    level='C',
    reason='Policy violation'
)

# Send review result
await status_notification_service.notify_upgrade_request_reviewed(
    request_id='uuid-here',
    status='approved'  # or 'rejected'
)
```

---

## 📧 Notification Types

### 1. Status Granted (`notify_status_granted`)

**When to use:** Organization receives a new status level

**Email includes:**
- Celebration banner with status badge
- List of benefits
- Link to organization profile
- Validity period (if applicable)

**Template:** `status_granted.html`

**Example:**
```python
await notify_status_granted(
    org_id='123e4567-e89b-12d3-a456-426614174000',
    level='B',
    granted_by='admin-uuid',
    valid_until=datetime(2027, 1, 27)
)
```

---

### 2. Status Expiring (`notify_status_expiring`)

**When to use:** Status is about to expire (30, 14, 7, 3, or 1 day before)

**Email includes:**
- Warning banner with urgency level
- Countdown (days remaining)
- Consequences of expiration
- Renewal instructions
- Link to renewal page

**Template:** `status_expiring.html`

**Example:**
```python
await notify_status_expiring(
    org_id='123e4567-e89b-12d3-a456-426614174000',
    level='A',
    days_left=7
)
```

---

### 3. Status Revoked (`notify_status_revoked`)

**When to use:** Status is removed from organization

**Email includes:**
- Revocation notice
- Reason for revocation
- Next steps for restoration
- Link to support
- Link to request new status

**Template:** `status_revoked.html`

**Example:**
```python
await notify_status_revoked(
    org_id='123e4567-e89b-12d3-a456-426614174000',
    level='B',
    reason='Content not updated for 18+ months'
)
```

---

### 4. Upgrade Request Reviewed (`notify_upgrade_request_reviewed`)

**When to use:** Admin reviews an upgrade request

**Email includes:**
- Approval/rejection status
- Review notes
- Rejection reason (if rejected)
- Next steps
- Link to profile or resubmission

**Template:** `upgrade_request_reviewed.html`

**Example:**
```python
# Approved
await notify_upgrade_request_reviewed(
    request_id='request-uuid',
    status='approved'
)

# Rejected
await notify_upgrade_request_reviewed(
    request_id='request-uuid',
    status='rejected'
)
```

---

## 🎨 Email Templates

All templates use responsive HTML design with:

- **Mobile-friendly layout** (max-width: 600px)
- **Branded header** (Работаем Честно! gradient)
- **Status badges** with proper colors (A=green, B=blue, C=purple)
- **Call-to-action buttons** (branded colors, hover effects)
- **Professional footer** (links, unsubscribe option)
- **Plain text fallback** (for email clients without HTML support)

### Template Variables

Templates use simple `{{variable}}` syntax:

```html
<h2>Здравствуйте, {{recipient_name}}!</h2>
<p>Организация «{{org_name}}» получила статус {{level_name}}.</p>
```

### Status Level Configuration

```python
STATUS_LEVEL_CONFIG = {
    'A': {
        'name': 'Партнёр',
        'color': '#10B981',  # Green
        'emoji': '🌟',
    },
    'B': {
        'name': 'Проверенный',
        'color': '#3B82F6',  # Blue
        'emoji': '✓',
    },
    'C': {
        'name': 'Честный Выбор',
        'color': '#8B5CF6',  # Purple
        'emoji': '👑',
    },
}
```

---

## 🔄 Background Worker

### Process Expiring Statuses

Run daily to check for expiring statuses and send warnings:

```python
from app.services import status_notification_service

# In your background job scheduler
async def daily_status_check():
    result = await status_notification_service.process_expiring_statuses()
    print(f"Processed: {result['processed']}, Notified: {result['notified']}")
```

**Triggers notifications at:** 30, 14, 7, 3, and 1 day before expiration

---

## 🧪 Testing

### Run Test Suite

```bash
# From backend directory
python test_status_notifications.py
```

### Test Coverage

- ✅ Service module import
- ✅ Email template files exist
- ✅ Template rendering (HTML + text)
- ✅ Helper functions (pluralization, etc.)
- ✅ Database integration
- ✅ Function signatures
- ✅ Background worker
- ✅ Email service integration

### Expected Output

```
Status Levels Notification Service - Test Suite
Date: 2026-01-27 15:30:00

============================================================
TEST 1: Service Module Import
============================================================

✅ PASS - Service functions exist
✅ PASS - Helper functions exist
✅ PASS - Status level configuration exists
  └─ Levels: ['A', 'B', 'C']

...

============================================================
TEST SUMMARY
============================================================

✅ PASS - Service Import
✅ PASS - Template Files
✅ PASS - Template Rendering
✅ PASS - Helper Functions
✅ PASS - Database Integration
✅ PASS - Function Signatures
✅ PASS - Background Worker
✅ PASS - Email Service Integration

Results: 8/8 tests passed
✅ ALL TESTS PASSED!
```

---

## 📊 Database Integration

### Tables Used

1. **organizations** - Organization details
2. **organization_members** - Members and roles
3. **app_users** - User email addresses
4. **organization_status_levels** - Active status records
5. **organization_status_history** - Audit trail
6. **status_upgrade_requests** - Upgrade requests

### Logging

All notifications are logged to `organization_status_history` table:

```sql
INSERT INTO organization_status_history (
    organization_id,
    level,
    action,
    reason,
    metadata
) VALUES (
    '...',
    'B',
    'status_granted',
    'Notification sent: status_granted',
    '{"level": "B", "email": "user@example.com"}'
);
```

---

## ⚙️ Configuration

### SMTP Settings

Required environment variables (already configured in your project):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@chestno.ru
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@chestno.ru
SMTP_FROM_NAME=Работаем Честно!
SMTP_USE_TLS=true
```

### Frontend URL

Configure in `app/core/config.py`:

```python
FRONTEND_URL=https://chestno.ru
```

Used for generating links in emails.

---

## 🔌 Integration Examples

### Integration with Admin API

```python
from fastapi import APIRouter
from app.services import status_notification_service

@router.post('/admin/organizations/{org_id}/grant-status')
async def grant_status(org_id: str, level: str, admin_id: str):
    # Grant status in database
    result = grant_status_level(org_id, level, admin_id)

    # Send notification
    await status_notification_service.notify_status_granted(
        org_id=org_id,
        level=level,
        granted_by=admin_id,
        valid_until=result.get('valid_until')
    )

    return {"success": True}
```

### Integration with Subscription System

```python
from app.services import status_notification_service

async def on_subscription_expiring(subscription):
    org_id = subscription.organization_id
    days_left = (subscription.ends_at - datetime.now()).days

    # Send expiring notification
    await status_notification_service.notify_status_expiring(
        org_id=org_id,
        level='A',  # Subscription-based status
        days_left=days_left
    )
```

### Integration with Upgrade Request Review

```python
@router.post('/admin/upgrade-requests/{request_id}/review')
async def review_upgrade_request(request_id: str, status: str, notes: str):
    # Update request in database
    update_upgrade_request(request_id, status, notes)

    # Send notification
    await status_notification_service.notify_upgrade_request_reviewed(
        request_id=request_id,
        status=status  # 'approved' or 'rejected'
    )

    return {"success": True}
```

---

## 🐛 Troubleshooting

### Issue: Templates Not Found

**Solution:** Ensure templates directory exists:

```bash
mkdir -p backend/app/templates/email
```

### Issue: No Email Sent

**Possible causes:**
1. SMTP not configured (check environment variables)
2. Organization has no email (check `app_users` table)
3. Email service returns False (check logs)

**Debug:**
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Issue: Template Variables Not Replaced

**Solution:** Ensure context keys match template placeholders:

```python
# Template uses {{org_name}}
context = {'org_name': 'Test Company'}  # ✅ Correct
context = {'organization_name': 'Test'}  # ❌ Wrong key
```

---

## 📚 API Reference

### `notify_status_granted(org_id, level, granted_by=None, valid_until=None)`

Send celebration email when status is granted.

**Parameters:**
- `org_id` (str|UUID) - Organization ID
- `level` (Literal['A','B','C']) - Status level
- `granted_by` (str|UUID, optional) - Admin who granted
- `valid_until` (datetime, optional) - Expiration date

**Returns:** `bool` - True if sent successfully

---

### `notify_status_expiring(org_id, level, days_left)`

Send warning email when status is about to expire.

**Parameters:**
- `org_id` (str|UUID) - Organization ID
- `level` (Literal['A','B','C']) - Status level
- `days_left` (int) - Days until expiration

**Returns:** `bool` - True if sent successfully

---

### `notify_status_revoked(org_id, level, reason=None)`

Send notification when status is revoked.

**Parameters:**
- `org_id` (str|UUID) - Organization ID
- `level` (Literal['A','B','C']) - Status level
- `reason` (str, optional) - Revocation reason

**Returns:** `bool` - True if sent successfully

---

### `notify_upgrade_request_reviewed(request_id, status)`

Send notification when upgrade request is reviewed.

**Parameters:**
- `request_id` (str|UUID) - Request ID
- `status` (Literal['approved','rejected']) - Review result

**Returns:** `bool` - True if sent successfully

---

### `process_expiring_statuses()`

Background worker to check and notify about expiring statuses.

**Returns:** `dict` - `{'processed': int, 'notified': int}`

**Usage:**
```python
# Run daily via cron or scheduler
result = await status_notification_service.process_expiring_statuses()
```

---

## 🎯 Best Practices

1. **Always use async/await** - All notification functions are async
2. **Don't block API responses** - Queue notifications if possible
3. **Log failures** - Check console for error messages
4. **Test templates** - Use test suite before deploying
5. **Monitor email delivery** - Check SMTP logs regularly
6. **Rate limit** - Background worker includes delays (0.5s between emails)
7. **Graceful failures** - Service returns False on error, doesn't crash

---

## 📝 Checklist for Implementation

- [x] Create notification service module
- [x] Implement 4 notification functions
- [x] Create 4 HTML email templates
- [x] Add plain text fallbacks
- [x] Integrate with existing email service
- [x] Add database logging
- [x] Create background worker
- [x] Write comprehensive tests
- [x] Document API and usage
- [ ] Add to admin API endpoints
- [ ] Configure background job scheduler
- [ ] Test in staging environment
- [ ] Deploy to production

---

## 🤝 Support

For questions or issues:
- Check logs in console output
- Run test suite: `python test_status_notifications.py`
- Review this documentation
- Contact: engineering team

---

**Version:** 1.0.0
**Date:** 2026-01-27
**Author:** Notification Engineer
**Status:** ✅ Complete and Ready for Integration
