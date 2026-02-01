"""
Anti-Counterfeiting Schemas

Pydantic models for scan fingerprinting, anomaly detection, and counterfeit investigation.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Scan Fingerprint Models
# =============================================================================


class ScanFingerprintCreate(BaseModel):
    """Data collected during a QR scan for fingerprinting."""

    # Device fingerprint
    device_id_hash: str | None = None
    screen_resolution: str | None = None
    color_depth: int | None = None
    timezone_offset: int | None = None
    language: str | None = None
    platform: str | None = None
    touch_support: bool = False
    device_memory: int | None = None
    hardware_concurrency: int | None = None

    # Browser fingerprint
    canvas_hash: str | None = None
    webgl_hash: str | None = None
    audio_hash: str | None = None
    fonts_hash: str | None = None

    # Network fingerprint
    connection_type: str | None = None
    ip_asn: str | None = None
    ip_org: str | None = None
    is_vpn: bool = False
    is_datacenter: bool = False
    is_tor: bool = False

    # Location
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    accuracy_meters: int | None = None
    altitude_meters: int | None = None
    country_code: str | None = None
    region_code: str | None = None
    city: str | None = None
    postal_code: str | None = None

    # Behavioral signals
    scan_duration_ms: int | None = None
    interaction_pattern: dict[str, Any] | None = None
    gyroscope_data: dict[str, Any] | None = None


class ScanFingerprint(BaseModel):
    """Complete scan fingerprint record."""

    id: UUID
    qr_event_id: int | None = None
    qr_code_id: UUID

    # All fields from ScanFingerprintCreate
    device_id_hash: str | None = None
    screen_resolution: str | None = None
    color_depth: int | None = None
    timezone_offset: int | None = None
    language: str | None = None
    platform: str | None = None
    touch_support: bool = False
    device_memory: int | None = None
    hardware_concurrency: int | None = None

    canvas_hash: str | None = None
    webgl_hash: str | None = None
    audio_hash: str | None = None
    fonts_hash: str | None = None

    connection_type: str | None = None
    ip_asn: str | None = None
    ip_org: str | None = None
    is_vpn: bool = False
    is_datacenter: bool = False
    is_tor: bool = False

    latitude: Decimal | None = None
    longitude: Decimal | None = None
    accuracy_meters: int | None = None
    altitude_meters: int | None = None
    country_code: str | None = None
    region_code: str | None = None
    city: str | None = None
    postal_code: str | None = None

    scan_duration_ms: int | None = None
    interaction_pattern: str | None = None
    gyroscope_data: str | None = None

    # Computed fields
    fingerprint_hash: str
    risk_score: int = 0
    risk_factors: list[str] | str = Field(default_factory=list)

    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Anomaly Detection Models
# =============================================================================


RuleType = Literal[
    "velocity",
    "geographic_spread",
    "geographic_cluster",
    "device_diversity",
    "device_repetition",
    "network_anomaly",
    "temporal_pattern",
    "behavioral",
    "fingerprint_collision",
    "product_lifecycle",
]

Severity = Literal["low", "medium", "high", "critical"]


class AnomalyRuleCreate(BaseModel):
    """Create a new anomaly detection rule."""

    rule_name: str
    rule_type: RuleType
    parameters: dict[str, Any] = Field(default_factory=dict)
    severity: Severity = "medium"
    auto_actions: list[str] = Field(default_factory=list)
    is_active: bool = True


class AnomalyRuleUpdate(BaseModel):
    """Update an anomaly rule."""

    rule_name: str | None = None
    parameters: dict[str, Any] | None = None
    severity: Severity | None = None
    auto_actions: list[str] | None = None
    is_active: bool | None = None


class AnomalyRule(BaseModel):
    """Anomaly detection rule."""

    id: UUID
    organization_id: UUID
    rule_name: str
    rule_type: str
    parameters: dict[str, Any] | str
    severity: str
    auto_actions: list[str] | str = Field(default_factory=list)
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnomalyCheckResult(BaseModel):
    """Result of running anomaly detection."""

    qr_code_id: str
    checked_at: datetime
    rules_checked: int
    anomalies_detected: int
    anomalies: list[dict[str, Any]]
    highest_severity: str | None = None


# =============================================================================
# Counterfeit Alert Models
# =============================================================================


AlertType = Literal["anomaly_detected", "consumer_report", "pattern_match", "manual_flag"]
AlertStatus = Literal[
    "new",
    "investigating",
    "confirmed_counterfeit",
    "false_positive",
    "resolved",
    "dismissed",
]


class CounterfeitAlertCreate(BaseModel):
    """Create a counterfeit alert."""

    qr_code_id: UUID | None = None
    rule_id: UUID | None = None
    alert_type: AlertType
    severity: Severity = "medium"
    title: str
    description: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    cluster_center_lat: Decimal | None = None
    cluster_center_lng: Decimal | None = None
    cluster_radius_km: Decimal | None = None


class CounterfeitAlertUpdate(BaseModel):
    """Update a counterfeit alert."""

    status: AlertStatus | None = None
    assigned_to: UUID | None = None
    resolution_notes: str | None = None
    resolution_action: str | None = None


class CounterfeitAlert(BaseModel):
    """Counterfeit alert record."""

    id: UUID
    organization_id: UUID
    qr_code_id: UUID | None = None
    rule_id: UUID | None = None

    alert_type: str
    severity: str
    title: str
    description: str | None = None
    evidence: dict[str, Any] | str = Field(default_factory=dict)

    cluster_center_lat: Decimal | None = None
    cluster_center_lng: Decimal | None = None
    cluster_radius_km: Decimal | None = None

    status: str
    assigned_to: UUID | None = None

    created_at: datetime
    updated_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None

    resolution_notes: str | None = None
    resolution_action: str | None = None

    class Config:
        from_attributes = True


class AlertStatistics(BaseModel):
    """Summary statistics for alerts."""

    total: int
    new_count: int
    investigating_count: int
    confirmed_count: int
    critical_count: int
    high_count: int
    last_24h: int
    last_7d: int


# =============================================================================
# Consumer Report Models
# =============================================================================


ReportReason = Literal[
    "product_quality",
    "packaging_different",
    "qr_not_working",
    "suspicious_seller",
    "price_too_low",
    "missing_features",
    "other",
]

ReportStatus = Literal[
    "pending",
    "under_review",
    "verified_counterfeit",
    "verified_authentic",
    "insufficient_evidence",
    "duplicate",
]


class CounterfeitReportCreate(BaseModel):
    """Consumer counterfeit report submission."""

    reporter_user_id: UUID | None = None
    reporter_email: str | None = None
    reporter_phone: str | None = None
    is_anonymous: bool = False

    reason: ReportReason
    description: str | None = None

    purchase_location: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_currency: str = "RUB"
    seller_name: str | None = None
    seller_url: str | None = None

    photo_urls: list[str] | None = None
    receipt_url: str | None = None

    scan_fingerprint_id: UUID | None = None
    device_info: dict[str, Any] | None = None
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None


class CounterfeitReportUpdate(BaseModel):
    """Update a counterfeit report."""

    status: ReportStatus | None = None
    internal_notes: str | None = None
    alert_id: UUID | None = None


class CounterfeitReport(BaseModel):
    """Counterfeit report record."""

    id: UUID
    qr_code_id: UUID | None = None
    organization_id: UUID

    reporter_user_id: UUID | None = None
    reporter_email: str | None = None
    reporter_phone: str | None = None
    is_anonymous: bool

    reason: str
    description: str | None = None

    purchase_location: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_currency: str | None = None
    seller_name: str | None = None
    seller_url: str | None = None

    photo_urls: list[str] | str = Field(default_factory=list)
    receipt_url: str | None = None

    scan_fingerprint_id: UUID | None = None
    device_info: dict[str, Any] | str | None = None
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None

    status: str
    alert_id: UUID | None = None
    internal_notes: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Investigation Case Models
# =============================================================================


CaseType = Literal[
    "single_incident",
    "pattern",
    "organized",
    "supply_chain",
    "regional",
]

CasePriority = Literal["low", "medium", "high", "urgent"]

CaseStatus = Literal[
    "open",
    "investigating",
    "evidence_gathering",
    "escalated",
    "closed_confirmed",
    "closed_false_alarm",
    "closed_inconclusive",
]


class InvestigationCaseCreate(BaseModel):
    """Create an investigation case."""

    case_type: CaseType
    priority: CasePriority = "medium"
    title: str
    summary: str | None = None
    affected_qr_codes: list[str] | None = None
    related_alerts: list[str] | None = None
    related_reports: list[str] | None = None
    lead_investigator: UUID | None = None
    team_members: list[str] | None = None


class InvestigationCaseUpdate(BaseModel):
    """Update an investigation case."""

    status: CaseStatus | None = None
    priority: CasePriority | None = None
    lead_investigator: UUID | None = None
    resolution_summary: str | None = None
    lessons_learned: str | None = None
    law_enforcement_notified: bool | None = None
    law_enforcement_case_number: str | None = None


class InvestigationCase(BaseModel):
    """Investigation case record."""

    id: UUID
    organization_id: UUID
    case_number: str

    case_type: str
    priority: str
    title: str
    summary: str | None = None

    affected_qr_codes: list[str] | str = Field(default_factory=list)
    related_alerts: list[str] | str = Field(default_factory=list)
    related_reports: list[str] | str = Field(default_factory=list)
    affected_regions: list[str] | str = Field(default_factory=list)

    primary_location_lat: Decimal | None = None
    primary_location_lng: Decimal | None = None

    estimated_counterfeit_volume: int | None = None
    estimated_financial_impact: Decimal | None = None
    impact_currency: str | None = None

    status: str
    lead_investigator: UUID | None = None
    team_members: list[str] | str = Field(default_factory=list)

    law_enforcement_notified: bool = False
    law_enforcement_case_number: str | None = None
    legal_action_initiated: bool = False

    created_at: datetime
    updated_at: datetime
    escalated_at: datetime | None = None
    closed_at: datetime | None = None

    resolution_summary: str | None = None
    lessons_learned: str | None = None
    preventive_actions: list[str] | str = Field(default_factory=list)

    class Config:
        from_attributes = True


class InvestigationActivity(BaseModel):
    """Investigation activity log entry."""

    id: UUID
    case_id: UUID
    activity_type: str
    description: str
    metadata: dict[str, Any] | str = Field(default_factory=dict)
    performed_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Authenticity Score Models
# =============================================================================


VerificationBadge = Literal["verified", "caution", "warning", "blocked"]


class AuthenticityScore(BaseModel):
    """Public authenticity score for a QR code."""

    qr_code_id: UUID
    score: int = Field(ge=0, le=100)
    confidence: str

    scan_pattern_score: int | None = None
    geographic_score: int | None = None
    temporal_score: int | None = None
    report_score: int | None = None

    has_active_alerts: bool = False
    has_pending_reports: bool = False
    is_under_investigation: bool = False

    total_scans: int = 0
    verified_scans: int = 0
    suspicious_scans: int = 0

    last_scan_at: datetime | None = None
    last_verified_at: datetime | None = None

    verification_message: str | None = None
    verification_badge: str = "verified"

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Analysis Models
# =============================================================================


class RiskAssessment(BaseModel):
    """Risk assessment result."""

    qr_code_id: str
    overall_risk: Severity
    risk_score: int
    factors: list[dict[str, Any]]
    recommendations: list[str]


class GeographicCluster(BaseModel):
    """Geographic scan cluster."""

    country_code: str | None = None
    region_code: str | None = None
    city: str | None = None
    scan_count: int
    center_lat: float | None = None
    center_lng: float | None = None
    avg_risk_score: float = 0
    first_scan: datetime
    last_scan: datetime
