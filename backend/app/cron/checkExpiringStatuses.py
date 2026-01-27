"""
Check Expiring Status Levels - Daily Cron Job

This script runs daily at 02:00 UTC via Railway cron job.
It checks for status levels that are expiring soon and logs findings.

Schedule: 0 2 * * * (daily at 02:00 UTC)
Railway Command: python -m app.cron.checkExpiringStatuses

Phase 4 (Current): Logging only
Phase 5 (Future): Send notifications via email/in-app

Expiration Thresholds:
- 60 days: First notice
- 30 days: Reminder
- 7 days: Urgent warning
- 1 day: Final notice
"""

import sys
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import asyncio

from app.core.db import get_connection
from app.core.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_expiring_statuses(days_until_expiry: int) -> List[Dict[str, Any]]:
    """
    Query status levels expiring in exactly N days.

    Args:
        days_until_expiry: Number of days until expiration (60, 30, 7, or 1)

    Returns:
        List of status level records that expire in N days
    """
    query = """
        SELECT
            id,
            organization_id,
            level,
            valid_until,
            granted_at,
            granted_by,
            subscription_id
        FROM organization_status_levels
        WHERE is_active = true
          AND valid_until IS NOT NULL
          AND DATE(valid_until) = DATE(NOW() + INTERVAL '%s days')
        ORDER BY organization_id, level
    """

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, (days_until_expiry,))

        columns = [desc[0] for desc in cursor.description]
        results = []

        for row in cursor.fetchall():
            status_dict = dict(zip(columns, row))
            # Convert datetime objects to ISO strings for logging
            if status_dict.get('valid_until'):
                status_dict['valid_until'] = status_dict['valid_until'].isoformat()
            if status_dict.get('granted_at'):
                status_dict['granted_at'] = status_dict['granted_at'].isoformat()
            results.append(status_dict)

        cursor.close()
        logger.info(f"Found {len(results)} status(es) expiring in {days_until_expiry} days")
        return results

    except Exception as e:
        logger.error(f"Database error querying expiring statuses: {e}", exc_info=True)
        raise
    finally:
        conn.close()


def send_expiration_notification(status: Dict, days_remaining: int):
    """
    Send notification about expiring status level.

    Args:
        status: Status level record with organization_id, level, valid_until
        days_remaining: Number of days until expiration

    TODO Phase 5: Implement notification sending
    - Email notification to organization admins
    - In-app notification
    - Log notification in database
    """
    org_id = status.get('organization_id', 'UNKNOWN')
    level = status.get('level', 'UNKNOWN')

    logger.info(
        f"[SKELETON] Would send notification: "
        f"Org {org_id} level {level} expires in {days_remaining} days"
    )

    # TODO Phase 5: Implement notification logic
    # - Get organization admin emails from database
    # - Compose email with expiration warning
    # - Send via email service (e.g., SendGrid, AWS SES)
    # - Create in-app notification record
    # - Log notification sent


async def check_expiring_statuses():
    """
    Main cron job function: Check for expiring status levels.

    This function is called by Railway cron on schedule: 0 2 * * *
    It checks for statuses expiring in 60, 30, 7, and 1 days.

    Phase 4: Logs findings only
    Phase 5: Will send notifications
    """
    logger.info("=" * 80)
    logger.info("Starting expiring status check (Daily @ 02:00 UTC)")
    logger.info(f"Run time: {datetime.utcnow().isoformat()}")
    logger.info("=" * 80)

    # Check each expiration threshold
    expiration_thresholds = [60, 30, 7, 1]
    total_expiring = 0

    for days in expiration_thresholds:
        logger.info(f"\nChecking statuses expiring in {days} days...")

        try:
            expiring_statuses = await get_expiring_statuses(days)
            count = len(expiring_statuses)
            total_expiring += count

            logger.info(f"Found {count} status(es) expiring in {days} days")

            # Process each expiring status
            for status in expiring_statuses:
                send_expiration_notification(status, days)

        except Exception as e:
            logger.error(
                f"Error checking {days}-day expiring statuses: {e}",
                exc_info=True
            )
            # Continue with other thresholds even if one fails
            continue

    logger.info("\n" + "=" * 80)
    logger.info(f"Expiring status check complete: {total_expiring} total found")
    logger.info("=" * 80)


def main():
    """
    Entry point for Railway cron job.

    Railway expects cron jobs to:
    1. Execute task
    2. Terminate cleanly (no open resources)
    3. Exit with code 0 on success

    Setup in Railway:
    1. Go to Service Settings → Cron Schedule
    2. Enter: 0 2 * * * (daily at 02:00 UTC)
    3. Set start command: python -m app.cron.checkExpiringStatuses
    """
    try:
        asyncio.run(check_expiring_statuses())
        logger.info("Cron job completed successfully")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Fatal error in cron job: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
