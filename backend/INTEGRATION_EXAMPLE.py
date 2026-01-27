"""
Integration Example: How to use Status Notification Service
This file shows how to integrate the notification service with your admin API.
"""

from datetime import datetime, timedelta
from uuid import UUID
from fastapi import APIRouter, HTTPException

from app.services import status_notification_service

router = APIRouter(prefix='/api/admin', tags=['admin-status-levels'])


# ============================================================
# EXAMPLE 1: Grant Status with Notification
# ============================================================

@router.post('/organizations/{org_id}/status/grant')
async def grant_status_with_notification(
    org_id: str,
    level: str,
    admin_id: str,
    duration_days: int | None = None,
):
    """
    Grant status level to organization and send celebration email.

    Args:
        org_id: Organization UUID
        level: Status level ('A', 'B', or 'C')
        admin_id: Admin user ID granting the status
        duration_days: Optional duration in days (None = permanent)
    """
    try:
        # Calculate expiration date
        valid_until = None
        if duration_days:
            valid_until = datetime.now() + timedelta(days=duration_days)

        # Grant status in database (call existing function)
        from app.core.db import get_connection
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT grant_status_level(%s, %s, %s, %s, NULL, %s)',
                (org_id, level, admin_id, valid_until, f'Granted by admin')
            )
            conn.commit()

        # Send notification
        success = await status_notification_service.notify_status_granted(
            org_id=org_id,
            level=level,
            granted_by=admin_id,
            valid_until=valid_until,
        )

        return {
            'success': True,
            'level': level,
            'valid_until': valid_until.isoformat() if valid_until else None,
            'notification_sent': success,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EXAMPLE 2: Revoke Status with Notification
# ============================================================

@router.post('/organizations/{org_id}/status/revoke')
async def revoke_status_with_notification(
    org_id: str,
    level: str,
    admin_id: str,
    reason: str,
):
    """
    Revoke status level from organization and send notification.

    Args:
        org_id: Organization UUID
        level: Status level ('A', 'B', or 'C')
        admin_id: Admin user ID revoking the status
        reason: Reason for revocation
    """
    try:
        # Revoke status in database
        from app.core.db import get_connection
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT revoke_status_level(%s, %s, %s, %s)',
                (org_id, level, admin_id, reason)
            )
            revoked = cur.fetchone()[0]
            conn.commit()

        if not revoked:
            raise HTTPException(status_code=404, detail='No active status found to revoke')

        # Send notification
        success = await status_notification_service.notify_status_revoked(
            org_id=org_id,
            level=level,
            reason=reason,
        )

        return {
            'success': True,
            'level': level,
            'reason': reason,
            'notification_sent': success,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EXAMPLE 3: Review Upgrade Request with Notification
# ============================================================

@router.post('/upgrade-requests/{request_id}/review')
async def review_upgrade_request_with_notification(
    request_id: str,
    admin_id: str,
    status: str,  # 'approved' or 'rejected'
    review_notes: str | None = None,
    rejection_reason: str | None = None,
):
    """
    Review upgrade request and send notification to requester.

    Args:
        request_id: Upgrade request UUID
        admin_id: Admin user ID reviewing the request
        status: 'approved' or 'rejected'
        review_notes: Optional notes for the organization
        rejection_reason: Required if status is 'rejected'
    """
    try:
        if status not in ['approved', 'rejected']:
            raise HTTPException(status_code=400, detail='Status must be approved or rejected')

        if status == 'rejected' and not rejection_reason:
            raise HTTPException(status_code=400, detail='Rejection reason is required')

        # Update request in database
        from app.core.db import get_connection
        from psycopg.rows import dict_row

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get request details
            cur.execute(
                'SELECT * FROM status_upgrade_requests WHERE id = %s',
                (request_id,)
            )
            request = cur.fetchone()

            if not request:
                raise HTTPException(status_code=404, detail='Request not found')

            if request['status'] != 'pending':
                raise HTTPException(status_code=400, detail='Request already reviewed')

            # Update request
            cur.execute(
                '''
                UPDATE status_upgrade_requests
                SET status = %s,
                    reviewed_by = %s,
                    reviewed_at = now(),
                    review_notes = %s,
                    rejection_reason = %s
                WHERE id = %s
                ''',
                (status, admin_id, review_notes, rejection_reason, request_id)
            )

            # If approved, grant the status
            if status == 'approved':
                cur.execute(
                    'SELECT grant_status_level(%s, %s, %s, NULL, NULL, %s)',
                    (
                        request['organization_id'],
                        request['target_level'],
                        admin_id,
                        f'Approved via upgrade request {request_id}'
                    )
                )

            conn.commit()

        # Send notification
        success = await status_notification_service.notify_upgrade_request_reviewed(
            request_id=request_id,
            status=status,
        )

        return {
            'success': True,
            'request_id': request_id,
            'status': status,
            'notification_sent': success,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EXAMPLE 4: Background Job for Expiring Statuses
# ============================================================

async def background_job_check_expiring_statuses():
    """
    Background job to check for expiring statuses and send warnings.
    Should be run daily via cron or job scheduler.

    Example cron: 0 9 * * * (Every day at 9 AM)
    """
    try:
        print('[Background Job] Checking for expiring statuses...')

        result = await status_notification_service.process_expiring_statuses()

        print(f'[Background Job] Processed: {result["processed"]}, Notified: {result["notified"]}')

        return result

    except Exception as e:
        print(f'[Background Job] Error: {e}')
        import traceback
        traceback.print_exc()
        return {'processed': 0, 'notified': 0, 'error': str(e)}


# ============================================================
# EXAMPLE 5: Subscription Expiring Handler
# ============================================================

async def on_subscription_expiring(subscription):
    """
    Called when subscription is about to expire.
    Integrates with existing subscription system.
    """
    try:
        # Get organization and status level
        org_id = subscription.organization_id
        days_left = (subscription.ends_at - datetime.now()).days

        # Check if organization has level A (subscription-based)
        from app.core.db import get_connection
        from psycopg.rows import dict_row

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT level FROM organization_status_levels
                WHERE organization_id = %s
                  AND level = 'A'
                  AND is_active = true
                  AND subscription_id = %s
                ''',
                (org_id, subscription.id)
            )
            status = cur.fetchone()

        if status:
            # Send expiring notification
            await status_notification_service.notify_status_expiring(
                org_id=org_id,
                level='A',
                days_left=days_left,
            )

    except Exception as e:
        print(f'[Subscription Handler] Error: {e}')


# ============================================================
# EXAMPLE 6: Test Notification Endpoint (Development Only)
# ============================================================

@router.post('/test-notification')
async def test_notification(
    notification_type: str,
    org_id: str,
    level: str = 'B',
):
    """
    Test notification endpoint for development.
    Remove or protect in production!

    Args:
        notification_type: 'granted', 'expiring', 'revoked', or 'reviewed'
        org_id: Organization UUID to test with
        level: Status level ('A', 'B', or 'C')
    """
    try:
        if notification_type == 'granted':
            success = await status_notification_service.notify_status_granted(
                org_id=org_id,
                level=level,
                granted_by=None,
                valid_until=datetime.now() + timedelta(days=365),
            )

        elif notification_type == 'expiring':
            success = await status_notification_service.notify_status_expiring(
                org_id=org_id,
                level=level,
                days_left=7,
            )

        elif notification_type == 'revoked':
            success = await status_notification_service.notify_status_revoked(
                org_id=org_id,
                level=level,
                reason='This is a test revocation',
            )

        elif notification_type == 'reviewed':
            # Create a test request first
            from app.core.db import get_connection
            from uuid import uuid4
            test_request_id = str(uuid4())

            with get_connection() as conn, conn.cursor() as cur:
                # Get org owner
                cur.execute(
                    '''
                    SELECT om.user_id
                    FROM organization_members om
                    WHERE om.organization_id = %s
                      AND om.role = 'owner'
                    LIMIT 1
                    ''',
                    (org_id,)
                )
                owner = cur.fetchone()

                if not owner:
                    raise HTTPException(status_code=404, detail='Organization owner not found')

                # Insert test request
                cur.execute(
                    '''
                    INSERT INTO status_upgrade_requests
                    (id, organization_id, requested_by, target_level, status, message, reviewed_at)
                    VALUES (%s, %s, %s, %s, 'approved', 'Test request', now())
                    ''',
                    (test_request_id, org_id, owner[0], level)
                )
                conn.commit()

            success = await status_notification_service.notify_upgrade_request_reviewed(
                request_id=test_request_id,
                status='approved',
            )

        else:
            raise HTTPException(
                status_code=400,
                detail='Invalid notification_type. Must be: granted, expiring, revoked, or reviewed'
            )

        return {
            'success': success,
            'notification_type': notification_type,
            'org_id': org_id,
            'level': level,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# SETUP INSTRUCTIONS
# ============================================================

"""
To integrate this into your application:

1. Add this router to your main FastAPI app:

   from app.api.routes import status_notifications_integration
   app.include_router(status_notifications_integration.router)

2. Configure background job scheduler (e.g., APScheduler):

   from apscheduler.schedulers.asyncio import AsyncIOScheduler
   from app.api.routes.status_notifications_integration import background_job_check_expiring_statuses

   scheduler = AsyncIOScheduler()
   scheduler.add_job(
       background_job_check_expiring_statuses,
       'cron',
       hour=9,
       minute=0,
   )
   scheduler.start()

3. Ensure SMTP is configured in .env:

   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=noreply@chestno.ru
   SMTP_PASSWORD=your-password
   SMTP_FROM_EMAIL=noreply@chestno.ru
   SMTP_FROM_NAME=Работаем Честно!

4. Test with the test endpoint (development only):

   POST /api/admin/test-notification
   {
       "notification_type": "granted",
       "org_id": "your-org-uuid",
       "level": "B"
   }
"""
