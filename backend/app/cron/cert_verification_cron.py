"""
Certification Verification Cron Jobs.

Scheduled tasks for automated certificate verification:
1. Auto-verify pending certifications (runs every 6 hours)
2. Check and mark expired certifications (runs daily)
3. Send expiry alerts (runs daily)
4. Re-verify existing certifications (runs weekly)
"""

import asyncio
import logging
from datetime import datetime, timedelta

from ..services.cert_verification_api import (
    get_verification_service,
    VerificationRequest,
    VerificationResult,
)
from ..core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def auto_verify_pending_certifications():
    """
    Auto-verify pending certifications.

    Runs every 6 hours.
    Processes certifications that:
    - Have verification_status = 'pending'
    - Have a certificate_number
    - Have auto_verify_enabled = true for their type
    """
    logger.info("Starting auto-verification of pending certifications")
    supabase = get_supabase_client()
    verification_service = get_verification_service()

    try:
        # Get pending certifications with auto-verify enabled types
        result = (
            supabase.table("producer_certifications")
            .select("*, certification_types!inner(*)")
            .eq("verification_status", "pending")
            .eq("certification_types.auto_verify_enabled", True)
            .is_not("certificate_number", "null")
            .execute()
        )

        verified_count = 0
        not_found_count = 0
        error_count = 0

        async with verification_service:
            for cert in result.data:
                cert_id = cert["id"]
                cert_type = cert["certification_types"]

                # Build verification request
                request = VerificationRequest(
                    certificate_number=cert["certificate_number"],
                    certification_type_code=cert_type["code"],
                    organization_name=None,  # Would need to fetch from organizations table
                    issued_date=cert.get("issued_date"),
                    expiry_date=cert.get("expiry_date"),
                )

                # Verify
                logger.info(f"Verifying certificate {cert_id}: {cert['certificate_number']}")
                response = await verification_service.verify_certificate(
                    certification_id=cert_id,
                    request=request,
                )

                # Track results
                if response.result == VerificationResult.VERIFIED:
                    verified_count += 1
                    logger.info(f"✓ Verified: {cert['certificate_number']}")
                elif response.result == VerificationResult.NOT_FOUND:
                    not_found_count += 1
                    logger.warning(f"✗ Not found: {cert['certificate_number']}")
                elif response.result == VerificationResult.RATE_LIMITED:
                    logger.warning(f"⏳ Rate limited, will retry later")
                    break  # Stop processing to avoid hammering API
                else:
                    error_count += 1
                    logger.error(f"⚠ Error verifying {cert['certificate_number']}: {response.error_message}")

                # Small delay to be respectful to APIs
                await asyncio.sleep(1)

        logger.info(
            f"Auto-verification complete: "
            f"{verified_count} verified, "
            f"{not_found_count} not found, "
            f"{error_count} errors"
        )

    except Exception as e:
        logger.exception(f"Auto-verification cron failed: {e}")


async def check_expired_certifications():
    """
    Check and mark expired certifications.

    Runs daily at midnight UTC.
    Marks certifications as 'expired' if expiry_date < today.
    """
    logger.info("Checking for expired certifications")
    verification_service = get_verification_service()

    try:
        expired_count = await verification_service.check_and_update_expired_certifications()
        logger.info(f"Marked {expired_count} certifications as expired")

    except Exception as e:
        logger.exception(f"Expired certifications check failed: {e}")


async def send_expiry_alerts():
    """
    Send expiry alerts to producers.

    Runs daily at 09:00 UTC.
    Sends alerts for certifications expiring in: 90, 60, 30, 14, 7, 1 days.
    """
    logger.info("Sending expiry alerts")
    supabase = get_supabase_client()

    try:
        # Get pending alerts scheduled for today or earlier
        result = (
            supabase.table("certification_expiry_alerts")
            .select("*, producer_certifications!inner(*, certification_types(*)), organizations!inner(*)")
            .is_("sent_at", "null")
            .lte("scheduled_at", datetime.utcnow().isoformat())
            .execute()
        )

        sent_count = 0
        for alert in result.data:
            cert = alert["producer_certifications"]
            org = alert["organizations"]
            cert_type = cert.get("certification_types", {})

            # Send notification (would integrate with notification service)
            logger.info(
                f"Alert: {org['name']} - {cert_type.get('name_ru')} "
                f"expires in {alert['alert_days_before']} days"
            )

            # Mark as sent
            supabase.table("certification_expiry_alerts").update({
                "sent_at": datetime.utcnow().isoformat()
            }).eq("id", alert["id"]).execute()

            sent_count += 1

        logger.info(f"Sent {sent_count} expiry alerts")

    except Exception as e:
        logger.exception(f"Expiry alerts cron failed: {e}")


async def reverify_existing_certifications():
    """
    Re-verify existing auto-verified certifications.

    Runs weekly on Sundays at 02:00 UTC.
    Checks if certificates are still valid in registry (detect revocations).
    """
    logger.info("Re-verifying existing certifications")
    supabase = get_supabase_client()
    verification_service = get_verification_service()

    try:
        # Get auto-verified certifications not checked recently (>7 days)
        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

        result = (
            supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .eq("verification_status", "auto_verified")
            .or_(f"last_auto_check_at.is.null,last_auto_check_at.lt.{week_ago}")
            .limit(100)  # Process in batches to avoid overload
            .execute()
        )

        reverified_count = 0
        revoked_count = 0

        async with verification_service:
            for cert in result.data:
                cert_id = cert["id"]
                cert_type = cert["certification_types"]

                request = VerificationRequest(
                    certificate_number=cert["certificate_number"],
                    certification_type_code=cert_type["code"],
                    issued_date=cert.get("issued_date"),
                    expiry_date=cert.get("expiry_date"),
                )

                response = await verification_service.verify_certificate(
                    certification_id=cert_id,
                    request=request,
                )

                if response.result == VerificationResult.VERIFIED:
                    reverified_count += 1
                elif response.result == VerificationResult.REVOKED:
                    revoked_count += 1
                    # Mark as revoked
                    supabase.table("producer_certifications").update({
                        "verification_status": "revoked",
                        "verification_notes": "Detected as revoked during re-verification",
                        "updated_at": datetime.utcnow().isoformat(),
                    }).eq("id", cert_id).execute()

                    logger.warning(f"Certificate {cert['certificate_number']} was REVOKED")

                await asyncio.sleep(2)  # Be extra respectful during re-verification

        logger.info(
            f"Re-verification complete: "
            f"{reverified_count} still valid, "
            f"{revoked_count} revoked"
        )

    except Exception as e:
        logger.exception(f"Re-verification cron failed: {e}")


# =============================================================================
# Cron Job Registration
# =============================================================================

# These would be registered with your task scheduler (e.g., APScheduler, Celery)
CRON_JOBS = {
    "auto_verify_pending": {
        "func": auto_verify_pending_certifications,
        "schedule": "0 */6 * * *",  # Every 6 hours
        "description": "Auto-verify pending certifications",
    },
    "check_expired": {
        "func": check_expired_certifications,
        "schedule": "0 0 * * *",  # Daily at midnight
        "description": "Check and mark expired certifications",
    },
    "send_expiry_alerts": {
        "func": send_expiry_alerts,
        "schedule": "0 9 * * *",  # Daily at 09:00 UTC
        "description": "Send expiry alerts to producers",
    },
    "reverify_existing": {
        "func": reverify_existing_certifications,
        "schedule": "0 2 * * 0",  # Sundays at 02:00 UTC
        "description": "Re-verify existing certifications",
    },
}
