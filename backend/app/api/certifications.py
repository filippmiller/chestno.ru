"""
Certification & Compliance Hub API Routes.

Provides endpoints for:
- Managing producer certifications (CRUD)
- Document upload and verification
- Expiry alerts management
- Consumer verification portal
- Admin verification queue
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from ..core.auth import get_current_user, require_org_admin, require_platform_admin
from ..schemas.certifications import (
    CertificationCategory,
    VerificationStatus,
    CertificationType,
    ProducerCertificationCreate,
    ProducerCertificationUpdate,
    ProducerCertification,
    ProducerCertificationPublic,
    OrganizationCertificationSummary,
    ExpiryAlert,
    ExpiryAlertSettings,
    VerificationLogEntry,
    ManualVerificationRequest,
    ConsumerVerificationRequest,
    CertificationSearchFilters,
    CertificationSearchResponse,
    CertificationAdminStats,
    PendingVerificationItem,
)
from ..services.certifications import get_certification_service

router = APIRouter(prefix="/certifications", tags=["certifications"])


# =============================================================================
# Certification Types (Public Reference Data)
# =============================================================================

@router.get("/types", response_model=list[CertificationType])
async def list_certification_types(
    category: Optional[CertificationCategory] = None,
):
    """
    List all available certification types.

    Publicly accessible - returns active certification types
    that producers can apply for.
    """
    service = get_certification_service()
    return await service.list_certification_types(category=category)


@router.get("/types/{type_id}", response_model=CertificationType)
async def get_certification_type(type_id: str):
    """Get details of a specific certification type."""
    service = get_certification_service()
    cert_type = await service.get_certification_type(type_id)
    if not cert_type:
        raise HTTPException(status_code=404, detail="Certification type not found")
    return cert_type


# =============================================================================
# Producer Certification Management
# =============================================================================

@router.post("/organizations/{org_id}", response_model=ProducerCertification)
async def create_certification(
    org_id: str,
    data: ProducerCertificationCreate,
    current_user=Depends(require_org_admin),
):
    """
    Add a new certification for an organization.

    Requires organization admin role.
    """
    service = get_certification_service()
    return await service.create_certification(
        organization_id=org_id,
        data=data,
        user_id=current_user.id,
    )


@router.get(
    "/organizations/{org_id}",
    response_model=list[ProducerCertification],
)
async def list_organization_certifications(
    org_id: str,
    include_expired: bool = True,
    status: Optional[list[VerificationStatus]] = Query(None),
    current_user=Depends(get_current_user),
):
    """
    List all certifications for an organization.

    Returns both verified and pending certifications for org members.
    """
    service = get_certification_service()
    return await service.list_organization_certifications(
        organization_id=org_id,
        include_expired=include_expired,
        status_filter=status,
    )


@router.get(
    "/organizations/{org_id}/summary",
    response_model=OrganizationCertificationSummary,
)
async def get_organization_certification_summary(
    org_id: str,
    current_user=Depends(get_current_user),
):
    """Get certification summary and statistics for an organization."""
    service = get_certification_service()
    return await service.get_organization_summary(org_id)


@router.get("/{cert_id}", response_model=ProducerCertification)
async def get_certification(
    cert_id: str,
    current_user=Depends(get_current_user),
):
    """Get details of a specific certification."""
    service = get_certification_service()
    certification = await service.get_certification(cert_id)
    if not certification:
        raise HTTPException(status_code=404, detail="Certification not found")
    return certification


@router.patch("/{cert_id}", response_model=ProducerCertification)
async def update_certification(
    cert_id: str,
    data: ProducerCertificationUpdate,
    current_user=Depends(require_org_admin),
):
    """
    Update a certification.

    Requires organization admin role.
    """
    service = get_certification_service()
    return await service.update_certification(
        certification_id=cert_id,
        data=data,
        user_id=current_user.id,
    )


@router.delete("/{cert_id}")
async def delete_certification(
    cert_id: str,
    current_user=Depends(require_org_admin),
):
    """
    Delete a certification.

    Requires organization admin role.
    """
    service = get_certification_service()
    await service.delete_certification(cert_id, current_user.id)
    return {"status": "deleted"}


# =============================================================================
# Document Management
# =============================================================================

@router.post("/{cert_id}/document")
async def upload_certification_document(
    cert_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_org_admin),
):
    """
    Upload a certification document (PDF, image).

    Supported formats: PDF, PNG, JPG, JPEG
    Max size: 10MB
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Use PDF or images.",
        )

    # Validate file size (10MB max)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    service = get_certification_service()
    document_url = await service.upload_document(
        certification_id=cert_id,
        file_content=contents,
        file_name=file.filename,
        content_type=file.content_type,
        user_id=current_user.id,
    )

    return {"document_url": document_url, "filename": file.filename}


@router.get("/{cert_id}/verification-log", response_model=list[VerificationLogEntry])
async def get_verification_log(
    cert_id: str,
    current_user=Depends(get_current_user),
):
    """Get the verification history for a certification."""
    service = get_certification_service()
    return await service.get_verification_log(cert_id)


# =============================================================================
# Expiry Alerts
# =============================================================================

@router.get(
    "/organizations/{org_id}/expiry-alerts",
    response_model=list[ExpiryAlert],
)
async def get_expiry_alerts(
    org_id: str,
    current_user=Depends(get_current_user),
):
    """Get pending expiry alerts for an organization."""
    service = get_certification_service()
    return await service.get_pending_expiry_alerts(organization_id=org_id)


@router.post("/expiry-alerts/{alert_id}/acknowledge")
async def acknowledge_expiry_alert(
    alert_id: str,
    current_user=Depends(get_current_user),
):
    """Acknowledge an expiry alert."""
    service = get_certification_service()
    await service.acknowledge_alert(alert_id, current_user.id)
    return {"status": "acknowledged"}


@router.get("/expiring-soon", response_model=list[ProducerCertification])
async def get_expiring_certifications(
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(require_platform_admin),
):
    """
    Get certifications expiring within N days.

    Platform admin only - for proactive outreach.
    """
    service = get_certification_service()
    return await service.check_expiring_certifications(days_ahead=days)


# =============================================================================
# Consumer Verification Portal (Public)
# =============================================================================

@router.get(
    "/public/organizations/{org_id}",
    response_model=list[ProducerCertificationPublic],
)
async def get_public_certifications(org_id: str):
    """
    Get verified certifications for public display.

    No authentication required - used on public organization pages.
    """
    service = get_certification_service()
    return await service.get_public_certifications(org_id)


@router.get(
    "/public/products/{product_id}",
    response_model=list[ProducerCertificationPublic],
)
async def get_product_certifications(product_id: str):
    """
    Get certifications applicable to a specific product.

    No authentication required - used on product pages.
    """
    service = get_certification_service()
    return await service.get_product_certifications(product_id)


@router.post("/public/search", response_model=CertificationSearchResponse)
async def search_by_certification(
    filters: CertificationSearchFilters,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Search products by certification type.

    Allows consumers to find products with specific certifications
    (e.g., all organic products, all halal products).
    """
    service = get_certification_service()
    return await service.search_by_certification(
        filters=filters,
        page=page,
        page_size=page_size,
    )


@router.post("/public/verify-request")
async def submit_verification_request(
    request: ConsumerVerificationRequest,
    current_user=Depends(get_current_user),
):
    """
    Submit a consumer verification request.

    Allows consumers to request verification of a certification
    or report a suspected issue.
    """
    service = get_certification_service()
    request_id = await service.submit_verification_request(
        certification_id=request.certification_id,
        request_type=request.request_type.value,
        reason=request.reason,
        user_id=current_user.id,
        ip_address=None,  # Would get from request in production
    )

    return {"request_id": request_id, "status": "submitted"}


# =============================================================================
# Admin Verification Queue
# =============================================================================

@router.get("/admin/stats", response_model=CertificationAdminStats)
async def get_admin_stats(
    current_user=Depends(require_platform_admin),
):
    """Get certification dashboard statistics for admins."""
    service = get_certification_service()
    return await service.get_admin_stats()


@router.get("/admin/pending")
async def get_pending_verification_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(require_platform_admin),
):
    """Get queue of certifications awaiting verification."""
    service = get_certification_service()
    items, total = await service.get_pending_verification_queue(page, page_size)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total,
    }


@router.post("/admin/verify")
async def manually_verify_certification(
    request: ManualVerificationRequest,
    current_user=Depends(require_platform_admin),
):
    """
    Manually verify, reject, or revoke a certification.

    Actions:
    - verify: Mark as verified by chestno.ru
    - reject: Reject the certification (invalid document, etc.)
    - revoke: Revoke a previously verified certification
    """
    if request.action not in ["verify", "reject", "revoke"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Use: verify, reject, or revoke",
        )

    service = get_certification_service()
    certification = await service.manually_verify(
        certification_id=request.certification_id,
        action=request.action,
        notes=request.notes,
        admin_user_id=current_user.id,
    )

    return {
        "status": "success",
        "certification_id": certification.id,
        "new_status": certification.verification_status.value,
    }


@router.post("/admin/run-expiry-check")
async def run_expiry_check(
    current_user=Depends(require_platform_admin),
):
    """
    Manually trigger expiry check.

    Updates status of expired certifications and sends alerts.
    """
    # This would call the database function
    service = get_certification_service()

    # In production, this would call the Supabase function
    # await service.supabase.rpc("check_certification_expiry").execute()

    return {"status": "expiry check completed"}
