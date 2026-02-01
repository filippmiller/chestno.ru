"""
Certification Verification API Endpoints.

Provides REST API for:
- Manual verification triggers
- Verification status checks
- Badge data retrieval
- Admin monitoring
"""

from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..services.cert_verification_api import (
    get_verification_service,
    VerificationRequest,
    VerificationResponse,
    BadgeLevel,
    ExpiryAlert,
)
from ..services.admin_guard import require_admin
from ..core.supabase import get_supabase_client

router = APIRouter(prefix="/api/certifications/verification", tags=["certification-verification"])


# =============================================================================
# Request/Response Models
# =============================================================================

class TriggerVerificationRequest(BaseModel):
    """Request to manually trigger verification."""
    certification_id: str


class VerificationStatusResponse(BaseModel):
    """Current verification status of a certification."""
    certification_id: str
    verification_status: str
    badge_level: BadgeLevel
    verified_at: Optional[str] = None
    verified_by_registry: bool
    registry_url: Optional[str] = None
    last_check_at: Optional[str] = None
    next_check_at: Optional[str] = None


class BadgeDataResponse(BaseModel):
    """Badge display data for frontend."""
    show_badge: bool
    badge_level: BadgeLevel
    badge_text: str
    badge_color: str
    tooltip_text: str
    verified_at: Optional[str] = None
    registry_url: Optional[str] = None


class VerificationStatsResponse(BaseModel):
    """Admin dashboard statistics."""
    total_certifications: int
    auto_verified_count: int
    manually_verified_count: int
    pending_count: int
    verification_rate: float  # % auto-verified
    certifications_expiring_soon: int
    last_verification_run: Optional[str] = None


# =============================================================================
# Producer Endpoints
# =============================================================================

@router.post("/trigger", response_model=VerificationResponse)
async def trigger_verification(
    request: TriggerVerificationRequest,
    user_id: str = Depends(require_admin),  # Or check org ownership
):
    """
    Manually trigger verification for a certification.

    Producer or admin can request immediate verification.
    """
    supabase = get_supabase_client()

    # Get certification details
    cert_result = (
        supabase.table("producer_certifications")
        .select("*, certification_types(*)")
        .eq("id", request.certification_id)
        .single()
        .execute()
    )

    if not cert_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certification not found"
        )

    cert = cert_result.data
    cert_type = cert["certification_types"]

    # Build verification request
    verification_request = VerificationRequest(
        certificate_number=cert["certificate_number"],
        certification_type_code=cert_type["code"],
        issued_date=cert.get("issued_date"),
        expiry_date=cert.get("expiry_date"),
    )

    # Verify
    verification_service = get_verification_service()
    async with verification_service:
        response = await verification_service.verify_certificate(
            certification_id=request.certification_id,
            request=verification_request,
        )

    return response


@router.get("/{certification_id}/status", response_model=VerificationStatusResponse)
async def get_verification_status(certification_id: str):
    """Get current verification status of a certification."""
    supabase = get_supabase_client()

    result = (
        supabase.table("producer_certifications")
        .select("*")
        .eq("id", certification_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certification not found"
        )

    cert = result.data

    # Determine badge level
    badge_level = BadgeLevel.PENDING
    if cert["verification_status"] == "auto_verified":
        badge_level = BadgeLevel.VERIFIED_BY_REGISTRY
    elif cert["verification_status"] == "verified":
        badge_level = BadgeLevel.MANUALLY_VERIFIED
    elif cert["document_url"]:
        badge_level = BadgeLevel.DOCUMENT_ONLY

    return VerificationStatusResponse(
        certification_id=certification_id,
        verification_status=cert["verification_status"],
        badge_level=badge_level,
        verified_at=cert.get("verified_at"),
        verified_by_registry=(cert["verification_status"] == "auto_verified"),
        registry_url=None,  # Would need to fetch from verification log
        last_check_at=cert.get("last_auto_check_at"),
        next_check_at=cert.get("next_auto_check_at"),
    )


@router.get("/{certification_id}/badge", response_model=BadgeDataResponse)
async def get_badge_data(certification_id: str):
    """
    Get badge display data for frontend.

    Returns UI-ready badge configuration for displaying verification status.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("producer_certifications")
        .select("*, certification_types(*)")
        .eq("id", certification_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certification not found"
        )

    cert = result.data
    status_val = cert["verification_status"]

    # Badge configuration based on verification status
    badge_config = {
        "auto_verified": {
            "show": True,
            "level": BadgeLevel.VERIFIED_BY_REGISTRY,
            "text": "Проверено в реестре",
            "color": "#22C55E",
            "tooltip": "Сертификат подтверждён через официальный реестр",
        },
        "verified": {
            "show": True,
            "level": BadgeLevel.MANUALLY_VERIFIED,
            "text": "Проверено администратором",
            "color": "#3B82F6",
            "tooltip": "Сертификат проверен модератором chestno.ru",
        },
        "pending": {
            "show": cert.get("document_url") is not None,
            "level": BadgeLevel.DOCUMENT_ONLY if cert.get("document_url") else BadgeLevel.PENDING,
            "text": "Ожидает проверки",
            "color": "#F59E0B",
            "tooltip": "Документ загружен, проверка в процессе",
        },
        "rejected": {
            "show": False,
            "level": BadgeLevel.PENDING,
            "text": "",
            "color": "",
            "tooltip": "",
        },
        "expired": {
            "show": False,
            "level": BadgeLevel.PENDING,
            "text": "",
            "color": "",
            "tooltip": "",
        },
        "revoked": {
            "show": False,
            "level": BadgeLevel.PENDING,
            "text": "",
            "color": "",
            "tooltip": "",
        },
    }

    config = badge_config.get(status_val, badge_config["pending"])

    return BadgeDataResponse(
        show_badge=config["show"],
        badge_level=config["level"],
        badge_text=config["text"],
        badge_color=config["color"],
        tooltip_text=config["tooltip"],
        verified_at=cert.get("verified_at"),
        registry_url=None,  # Would fetch from verification log
    )


# =============================================================================
# Admin Endpoints
# =============================================================================

@router.get("/admin/stats", response_model=VerificationStatsResponse)
async def get_verification_stats(user_id: str = Depends(require_admin)):
    """Get admin dashboard statistics for verification system."""
    supabase = get_supabase_client()

    # Get all certifications
    all_certs = (
        supabase.table("producer_certifications")
        .select("id, verification_status, expiry_date")
        .execute()
    )

    total = len(all_certs.data)
    auto_verified = sum(1 for c in all_certs.data if c["verification_status"] == "auto_verified")
    manually_verified = sum(1 for c in all_certs.data if c["verification_status"] == "verified")
    pending = sum(1 for c in all_certs.data if c["verification_status"] == "pending")

    # Verification rate
    verification_rate = (auto_verified / total * 100) if total > 0 else 0.0

    # Expiring soon (next 30 days)
    today = date.today()
    cutoff = (today + timedelta(days=30)).isoformat()
    expiring_soon = sum(
        1 for c in all_certs.data
        if c.get("expiry_date")
        and c["expiry_date"] >= today.isoformat()
        and c["expiry_date"] <= cutoff
    )

    # Last verification run (from verification log)
    last_run = (
        supabase.table("certification_verification_log")
        .select("performed_at")
        .eq("action", "auto_check_passed")
        .order("performed_at", desc=True)
        .limit(1)
        .execute()
    )
    last_verification_run = last_run.data[0]["performed_at"] if last_run.data else None

    return VerificationStatsResponse(
        total_certifications=total,
        auto_verified_count=auto_verified,
        manually_verified_count=manually_verified,
        pending_count=pending,
        verification_rate=round(verification_rate, 2),
        certifications_expiring_soon=expiring_soon,
        last_verification_run=last_verification_run,
    )


@router.get("/admin/expiring", response_model=list[ExpiryAlert])
async def get_expiring_certifications(
    days_ahead: int = 30,
    user_id: str = Depends(require_admin)
):
    """Get certifications expiring soon."""
    verification_service = get_verification_service()
    alerts = await verification_service.get_expiring_certifications(days_ahead=days_ahead)
    return alerts


@router.post("/admin/check-expired")
async def trigger_expired_check(user_id: str = Depends(require_admin)):
    """Manually trigger expired certifications check."""
    verification_service = get_verification_service()
    expired_count = await verification_service.check_and_update_expired_certifications()
    return {"expired_count": expired_count}
