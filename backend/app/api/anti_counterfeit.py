"""
Anti-Counterfeiting API Routes

Endpoints for scan fingerprinting, anomaly detection, alerts, reports, and investigations.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user_id
from app.schemas.anti_counterfeit import (
    ScanFingerprint,
    ScanFingerprintCreate,
    AnomalyRule,
    AnomalyRuleCreate,
    AnomalyRuleUpdate,
    CounterfeitAlert,
    CounterfeitAlertUpdate,
    CounterfeitReport,
    CounterfeitReportCreate,
    CounterfeitReportUpdate,
    InvestigationCase,
    InvestigationCaseCreate,
    InvestigationCaseUpdate,
    InvestigationActivity,
    AuthenticityScore,
    AnomalyCheckResult,
    AlertStatistics,
    GeographicCluster,
)
from app.services import anti_counterfeit as service

router = APIRouter(prefix="/anti-counterfeit", tags=["Anti-Counterfeiting"])


# =============================================================================
# Fingerprint Endpoints
# =============================================================================


@router.post(
    "/qr/{qr_code_id}/fingerprint",
    response_model=ScanFingerprint,
    summary="Record scan fingerprint",
)
async def record_fingerprint(
    qr_code_id: UUID,
    data: ScanFingerprintCreate,
    qr_event_id: int | None = None,
):
    """
    Record a scan fingerprint for anomaly detection.

    This endpoint is called during QR scan processing to capture device
    and context signals. No authentication required (called from scan flow).
    """
    return service.record_scan_fingerprint(
        str(qr_code_id),
        qr_event_id,
        data,
    )


@router.get(
    "/organizations/{organization_id}/qr/{qr_code_id}/fingerprints",
    response_model=list[ScanFingerprint],
    summary="List fingerprints for QR code",
)
async def list_fingerprints(
    organization_id: UUID,
    qr_code_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    List scan fingerprints for a QR code.

    Requires analyst role or higher.
    """
    return service.get_fingerprints_for_qr(
        str(organization_id),
        str(qr_code_id),
        user_id,
        limit,
        offset,
    )


# =============================================================================
# Anomaly Detection Endpoints
# =============================================================================


@router.post(
    "/organizations/{organization_id}/qr/{qr_code_id}/check",
    response_model=AnomalyCheckResult,
    summary="Run anomaly detection",
)
async def run_anomaly_check(
    organization_id: UUID,
    qr_code_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    auto_alert: bool = Query(True, description="Automatically create alert if anomalies found"),
):
    """
    Run all active anomaly detection rules against a QR code.

    Returns detected anomalies and optionally creates an alert.
    """
    result = service.run_anomaly_check(str(qr_code_id), str(organization_id))

    if auto_alert and result.anomalies_detected > 0:
        service.auto_create_alert_if_needed(
            str(qr_code_id),
            str(organization_id),
            result,
        )

    return result


@router.get(
    "/organizations/{organization_id}/qr/{qr_code_id}/clusters",
    response_model=list[GeographicCluster],
    summary="Get geographic scan clusters",
)
async def get_geographic_clusters(
    organization_id: UUID,
    qr_code_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    min_cluster_size: int = Query(5, ge=2, le=100),
):
    """
    Identify geographic clusters of scans.

    Useful for detecting counterfeit distribution patterns.
    """
    return service.get_scan_clusters(
        str(organization_id),
        str(qr_code_id),
        user_id,
        min_cluster_size,
    )


# =============================================================================
# Anomaly Rules Management
# =============================================================================


@router.get(
    "/organizations/{organization_id}/rules",
    response_model=list[AnomalyRule],
    summary="List anomaly rules",
)
async def list_rules(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """List all anomaly detection rules for the organization."""
    return service.list_anomaly_rules(str(organization_id), user_id)


@router.post(
    "/organizations/{organization_id}/rules",
    response_model=AnomalyRule,
    status_code=status.HTTP_201_CREATED,
    summary="Create anomaly rule",
)
async def create_rule(
    organization_id: UUID,
    data: AnomalyRuleCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Create a new anomaly detection rule."""
    return service.create_anomaly_rule(str(organization_id), user_id, data)


@router.patch(
    "/organizations/{organization_id}/rules/{rule_id}",
    response_model=AnomalyRule,
    summary="Update anomaly rule",
)
async def update_rule(
    organization_id: UUID,
    rule_id: UUID,
    data: AnomalyRuleUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Update an anomaly detection rule."""
    return service.update_anomaly_rule(str(organization_id), str(rule_id), user_id, data)


@router.delete(
    "/organizations/{organization_id}/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete anomaly rule",
)
async def delete_rule(
    organization_id: UUID,
    rule_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Delete an anomaly detection rule."""
    service.delete_anomaly_rule(str(organization_id), str(rule_id), user_id)


@router.post(
    "/organizations/{organization_id}/rules/initialize",
    response_model=list[AnomalyRule],
    summary="Initialize default rules",
)
async def initialize_rules(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Initialize default anomaly detection rules for the organization."""
    return service.initialize_default_rules(str(organization_id), user_id)


# =============================================================================
# Alert Endpoints
# =============================================================================


@router.get(
    "/organizations/{organization_id}/alerts",
    response_model=list[CounterfeitAlert],
    summary="List alerts",
)
async def list_alerts(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    status_filter: str | None = Query(None, alias="status"),
    severity_filter: str | None = Query(None, alias="severity"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List counterfeit alerts with optional filtering."""
    return service.list_alerts(
        str(organization_id),
        user_id,
        status_filter,
        severity_filter,
        limit,
        offset,
    )


@router.get(
    "/organizations/{organization_id}/alerts/statistics",
    response_model=AlertStatistics,
    summary="Get alert statistics",
)
async def get_alert_stats(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get summary statistics for alerts."""
    return service.get_alert_statistics(str(organization_id), user_id)


@router.get(
    "/organizations/{organization_id}/alerts/{alert_id}",
    response_model=CounterfeitAlert,
    summary="Get alert details",
)
async def get_alert(
    organization_id: UUID,
    alert_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get details of a specific alert."""
    return service.get_alert(str(organization_id), str(alert_id), user_id)


@router.patch(
    "/organizations/{organization_id}/alerts/{alert_id}",
    response_model=CounterfeitAlert,
    summary="Update alert",
)
async def update_alert(
    organization_id: UUID,
    alert_id: UUID,
    data: CounterfeitAlertUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Update an alert (status, assignment, resolution)."""
    return service.update_alert(str(organization_id), str(alert_id), user_id, data)


# =============================================================================
# Consumer Report Endpoints
# =============================================================================


@router.post(
    "/organizations/{organization_id}/reports",
    response_model=CounterfeitReport,
    status_code=status.HTTP_201_CREATED,
    summary="Submit counterfeit report",
)
async def submit_report(
    organization_id: UUID,
    data: CounterfeitReportCreate,
    qr_code_id: UUID | None = None,
):
    """
    Submit a consumer counterfeit report.

    This endpoint is public (no authentication required).
    """
    return service.submit_counterfeit_report(
        str(qr_code_id) if qr_code_id else None,
        str(organization_id),
        data,
    )


@router.get(
    "/organizations/{organization_id}/reports",
    response_model=list[CounterfeitReport],
    summary="List reports",
)
async def list_reports(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List counterfeit reports."""
    return service.list_reports(
        str(organization_id),
        user_id,
        status_filter,
        limit,
        offset,
    )


@router.patch(
    "/organizations/{organization_id}/reports/{report_id}",
    response_model=CounterfeitReport,
    summary="Update report",
)
async def update_report(
    organization_id: UUID,
    report_id: UUID,
    data: CounterfeitReportUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Update a counterfeit report (review, status change)."""
    return service.update_report(str(organization_id), str(report_id), user_id, data)


# =============================================================================
# Investigation Endpoints
# =============================================================================


@router.post(
    "/organizations/{organization_id}/investigations",
    response_model=InvestigationCase,
    status_code=status.HTTP_201_CREATED,
    summary="Create investigation",
)
async def create_investigation(
    organization_id: UUID,
    data: InvestigationCaseCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Create a new investigation case."""
    return service.create_investigation(str(organization_id), user_id, data)


@router.get(
    "/organizations/{organization_id}/investigations",
    response_model=list[InvestigationCase],
    summary="List investigations",
)
async def list_investigations(
    organization_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List investigation cases."""
    return service.list_investigations(
        str(organization_id),
        user_id,
        status_filter,
        limit,
        offset,
    )


@router.get(
    "/organizations/{organization_id}/investigations/{case_id}",
    response_model=InvestigationCase,
    summary="Get investigation details",
)
async def get_investigation(
    organization_id: UUID,
    case_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get details of a specific investigation."""
    return service.get_investigation(str(organization_id), str(case_id), user_id)


@router.patch(
    "/organizations/{organization_id}/investigations/{case_id}",
    response_model=InvestigationCase,
    summary="Update investigation",
)
async def update_investigation(
    organization_id: UUID,
    case_id: UUID,
    data: InvestigationCaseUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Update an investigation case."""
    return service.update_investigation(str(organization_id), str(case_id), user_id, data)


@router.get(
    "/organizations/{organization_id}/investigations/{case_id}/activities",
    response_model=list[InvestigationActivity],
    summary="Get investigation activities",
)
async def get_investigation_activities(
    organization_id: UUID,
    case_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get activity log for an investigation."""
    return service.get_investigation_activities(str(organization_id), str(case_id), user_id)


@router.post(
    "/organizations/{organization_id}/investigations/{case_id}/notes",
    response_model=InvestigationActivity,
    status_code=status.HTTP_201_CREATED,
    summary="Add investigation note",
)
async def add_investigation_note(
    organization_id: UUID,
    case_id: UUID,
    note: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Add a note to an investigation."""
    return service.add_investigation_note(str(organization_id), str(case_id), user_id, note)


# =============================================================================
# Public Authenticity Endpoints
# =============================================================================


@router.get(
    "/verify/{qr_code_id}",
    response_model=AuthenticityScore | None,
    summary="Verify authenticity",
)
async def verify_authenticity(qr_code_id: UUID):
    """
    Get the public authenticity score for a QR code.

    This endpoint is public (no authentication required) and is called
    during consumer scans to display verification status.
    """
    return service.get_authenticity_score(str(qr_code_id))


@router.post(
    "/verify/{qr_code_id}/refresh",
    response_model=AuthenticityScore,
    summary="Refresh authenticity score",
)
async def refresh_authenticity(qr_code_id: UUID):
    """Force refresh of authenticity score calculation."""
    return service.refresh_authenticity_score(str(qr_code_id))
