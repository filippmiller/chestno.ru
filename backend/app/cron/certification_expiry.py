"""
Certification Expiry Cron Job.

Scheduled task to:
1. Check and update expired certifications
2. Send expiry alert notifications
3. Run automated verification checks

Designed to run daily via Railway/Supabase cron or external scheduler.
"""
import asyncio
from datetime import date, datetime, timedelta
from typing import Optional

from ..core.supabase import get_supabase_client
from ..services.certifications import get_certification_service
from ..services.notifications import get_notification_service  # Assumed existing


async def run_expiry_check():
    """
    Main expiry check job.

    1. Updates certification status for expired certs
    2. Processes pending expiry alerts
    3. Creates notifications for organization admins
    """
    supabase = get_supabase_client()
    cert_service = get_certification_service()

    print(f"[{datetime.utcnow().isoformat()}] Starting certification expiry check...")

    # Step 1: Run database function to update expired certs
    try:
        supabase.rpc("check_certification_expiry").execute()
        print("  - Updated expired certification statuses")
    except Exception as e:
        print(f"  - Error updating expired certs: {e}")

    # Step 2: Schedule new expiry alerts
    try:
        supabase.rpc("schedule_expiry_alerts").execute()
        print("  - Scheduled new expiry alerts")
    except Exception as e:
        print(f"  - Error scheduling alerts: {e}")

    # Step 3: Process pending alerts
    pending_alerts = await cert_service.get_pending_expiry_alerts()
    print(f"  - Found {len(pending_alerts)} pending alerts to send")

    for alert in pending_alerts:
        try:
            await send_expiry_notification(alert)
            await cert_service.mark_alert_sent(alert.id)
            print(f"    - Sent alert for cert {alert.certification_id}")
        except Exception as e:
            print(f"    - Error sending alert {alert.id}: {e}")

    print(f"[{datetime.utcnow().isoformat()}] Expiry check complete.")


async def send_expiry_notification(alert):
    """
    Send expiry notification via email and/or push.

    This integrates with the existing notification system.
    """
    # Get notification service (assumed to exist)
    try:
        notification_service = get_notification_service()
    except Exception:
        # Fallback if notification service not available
        print(f"    - Would send notification for alert {alert.id}")
        return

    # Determine urgency based on days until expiry
    if alert.alert_days_before <= 7:
        urgency = "high"
    elif alert.alert_days_before <= 30:
        urgency = "medium"
    else:
        urgency = "low"

    # Create notification content
    if alert.alert_days_before == 1:
        title = "Сертификат истекает завтра!"
        message = f"Ваш сертификат '{alert.certification_type_name}'"
        if alert.certificate_number:
            message += f" (№{alert.certificate_number})"
        message += " истекает завтра. Требуется срочное обновление."
    elif alert.alert_days_before <= 7:
        title = f"Сертификат истекает через {alert.alert_days_before} дней"
        message = f"Ваш сертификат '{alert.certification_type_name}' требует обновления."
    else:
        title = f"Напоминание: сертификат истекает через {alert.alert_days_before} дней"
        message = f"Рекомендуем начать процесс обновления сертификата '{alert.certification_type_name}'."

    # Send notification (organization-level)
    await notification_service.create_organization_notification(
        organization_id=alert.organization_id,
        notification_type="certification_expiry",
        title=title,
        message=message,
        data={
            "certification_id": alert.certification_id,
            "days_until_expiry": alert.alert_days_before,
            "expiry_date": alert.expiry_date,
            "urgency": urgency,
        },
        send_email=True,
        send_push=True,
    )


async def run_auto_verification():
    """
    Run automated verification for certifications that support it.

    Checks with external APIs (Rosstandart, Roskachestvo, etc.)
    for certifications that have auto_verify_enabled.
    """
    supabase = get_supabase_client()
    cert_service = get_certification_service()

    print(f"[{datetime.utcnow().isoformat()}] Starting auto-verification check...")

    # Get certifications due for auto-check
    result = (
        supabase.table("producer_certifications")
        .select("*, certification_types!inner(*)")
        .eq("certification_types.auto_verify_enabled", True)
        .in_("verification_status", ["pending", "verified", "auto_verified"])
        .or_(
            "next_auto_check_at.is.null,"
            f"next_auto_check_at.lte.{datetime.utcnow().isoformat()}"
        )
        .limit(50)  # Process in batches
        .execute()
    )

    print(f"  - Found {len(result.data)} certifications to verify")

    for row in result.data:
        cert_id = row["id"]
        cert_number = row.get("certificate_number")
        cert_type_code = row["certification_types"]["code"]

        if not cert_number:
            print(f"    - Skipping {cert_id}: no certificate number")
            continue

        try:
            # Call external verification API
            verification = await cert_service.verify_with_external_api(
                certification_id=cert_id,
                certificate_number=cert_number,
                cert_type_code=cert_type_code,
            )

            if verification.is_verified:
                # Update to auto_verified status
                await cert_service.manually_verify(
                    certification_id=cert_id,
                    action="verify",
                    notes=f"Auto-verified via {verification.verification_source}",
                    admin_user_id=None,  # System action
                )
                print(f"    - Auto-verified {cert_id}")
            else:
                print(f"    - Verification failed for {cert_id}: {verification.details}")

            # Schedule next check (weekly)
            supabase.table("producer_certifications").update(
                {
                    "last_auto_check_at": datetime.utcnow().isoformat(),
                    "next_auto_check_at": (
                        datetime.utcnow() + timedelta(days=7)
                    ).isoformat(),
                }
            ).eq("id", cert_id).execute()

        except Exception as e:
            print(f"    - Error verifying {cert_id}: {e}")

    print(f"[{datetime.utcnow().isoformat()}] Auto-verification complete.")


# Entry point for cron job
if __name__ == "__main__":
    asyncio.run(run_expiry_check())
