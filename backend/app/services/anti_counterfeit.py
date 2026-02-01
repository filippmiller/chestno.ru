"""
Anti-Counterfeiting Service

Provides scan fingerprinting, anomaly detection, and counterfeit investigation workflows.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.anti_counterfeit import (
    ScanFingerprint,
    ScanFingerprintCreate,
    AnomalyRule,
    AnomalyRuleCreate,
    AnomalyRuleUpdate,
    CounterfeitAlert,
    CounterfeitAlertCreate,
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
    RiskAssessment,
    GeographicCluster,
    AlertStatistics,
)

MANAGER_ROLES = ("owner", "admin", "manager")
ANALYST_ROLES = ("owner", "admin", "manager", "analyst")


def _ensure_role(cur, organization_id: str, user_id: str, allowed_roles: tuple) -> str:
    """Check user has required role in organization."""
    cur.execute(
        """
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        """,
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )
    return row["role"]


def _compute_fingerprint_hash(data: ScanFingerprintCreate) -> str:
    """Compute a stable hash from fingerprint components."""
    components = [
        data.device_id_hash or "",
        data.screen_resolution or "",
        str(data.color_depth or 0),
        str(data.timezone_offset or 0),
        data.language or "",
        data.platform or "",
        data.canvas_hash or "",
        data.webgl_hash or "",
        data.audio_hash or "",
        data.fonts_hash or "",
    ]
    combined = "|".join(components)
    return hashlib.sha256(combined.encode()).hexdigest()


def _calculate_risk_score(data: ScanFingerprintCreate) -> tuple[int, list[str]]:
    """Calculate risk score based on fingerprint signals."""
    score = 0
    factors = []

    # VPN/Proxy detection
    if data.is_vpn:
        score += 15
        factors.append("vpn_detected")

    # Datacenter IP
    if data.is_datacenter:
        score += 25
        factors.append("datacenter_ip")

    # Tor exit node
    if data.is_tor:
        score += 35
        factors.append("tor_exit_node")

    # Low GPS accuracy (might be spoofed)
    if data.accuracy_meters and data.accuracy_meters > 1000:
        score += 10
        factors.append("low_gps_accuracy")

    # Very fast scan (might be automated)
    if data.scan_duration_ms and data.scan_duration_ms < 100:
        score += 20
        factors.append("unusually_fast_scan")

    # No touch support on mobile platform
    mobile_platforms = ["iphone", "ipad", "android", "arm"]
    if data.platform and any(p in data.platform.lower() for p in mobile_platforms):
        if not data.touch_support:
            score += 15
            factors.append("mobile_no_touch")

    return min(score, 100), factors


# =============================================================================
# Fingerprint Management
# =============================================================================


def record_scan_fingerprint(
    qr_code_id: str,
    qr_event_id: int | None,
    data: ScanFingerprintCreate,
) -> ScanFingerprint:
    """
    Record a scan fingerprint and compute risk assessment.

    This is called during QR scan processing to capture device/context signals.
    """
    fingerprint_hash = _compute_fingerprint_hash(data)
    risk_score, risk_factors = _calculate_risk_score(data)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO scan_fingerprints (
                    qr_code_id, qr_event_id,
                    device_id_hash, screen_resolution, color_depth, timezone_offset,
                    language, platform, touch_support, device_memory, hardware_concurrency,
                    canvas_hash, webgl_hash, audio_hash, fonts_hash,
                    connection_type, ip_asn, ip_org, is_vpn, is_datacenter, is_tor,
                    latitude, longitude, accuracy_meters, altitude_meters,
                    country_code, region_code, city, postal_code,
                    scan_duration_ms, interaction_pattern, gyroscope_data,
                    fingerprint_hash, risk_score, risk_factors
                )
                VALUES (
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
                RETURNING *
                """,
                (
                    qr_code_id,
                    qr_event_id,
                    data.device_id_hash,
                    data.screen_resolution,
                    data.color_depth,
                    data.timezone_offset,
                    data.language,
                    data.platform,
                    data.touch_support,
                    data.device_memory,
                    data.hardware_concurrency,
                    data.canvas_hash,
                    data.webgl_hash,
                    data.audio_hash,
                    data.fonts_hash,
                    data.connection_type,
                    data.ip_asn,
                    data.ip_org,
                    data.is_vpn,
                    data.is_datacenter,
                    data.is_tor,
                    data.latitude,
                    data.longitude,
                    data.accuracy_meters,
                    data.altitude_meters,
                    data.country_code,
                    data.region_code,
                    data.city,
                    data.postal_code,
                    data.scan_duration_ms,
                    json.dumps(data.interaction_pattern) if data.interaction_pattern else None,
                    json.dumps(data.gyroscope_data) if data.gyroscope_data else None,
                    fingerprint_hash,
                    risk_score,
                    json.dumps(risk_factors),
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return ScanFingerprint(**row)


def get_fingerprints_for_qr(
    organization_id: str,
    qr_code_id: str,
    user_id: str,
    limit: int = 100,
    offset: int = 0,
) -> list[ScanFingerprint]:
    """Get fingerprints for a QR code (analyst role required)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            # Verify QR belongs to org
            cur.execute(
                "SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s",
                (qr_code_id, organization_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="QR code not found")

            cur.execute(
                """
                SELECT * FROM scan_fingerprints
                WHERE qr_code_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (qr_code_id, limit, offset),
            )
            return [ScanFingerprint(**row) for row in cur.fetchall()]


# =============================================================================
# Anomaly Detection
# =============================================================================


def run_anomaly_check(qr_code_id: str, organization_id: str) -> AnomalyCheckResult:
    """
    Run all active anomaly detection rules against a QR code.

    Returns a summary of detected anomalies.
    """
    anomalies = []

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get active rules for the organization
            cur.execute(
                """
                SELECT * FROM anomaly_rules
                WHERE organization_id = %s AND is_active = true
                """,
                (organization_id,),
            )
            rules = cur.fetchall()

            for rule in rules:
                rule_type = rule["rule_type"]
                params = rule["parameters"]

                detected = False
                details = {}

                if rule_type == "velocity":
                    max_scans = params.get("max_scans", 100)
                    window_hours = params.get("window_hours", 24)

                    cur.execute(
                        """
                        SELECT COUNT(*) as count FROM scan_fingerprints
                        WHERE qr_code_id = %s
                          AND created_at >= NOW() - (%s || ' hours')::interval
                        """,
                        (qr_code_id, window_hours),
                    )
                    count = cur.fetchone()["count"]
                    if count > max_scans:
                        detected = True
                        details = {"scan_count": count, "threshold": max_scans}

                elif rule_type == "geographic_spread":
                    max_distance_km = params.get("max_distance_km", 500)
                    window_hours = params.get("window_hours", 1)

                    cur.execute(
                        """
                        SELECT * FROM detect_geographic_impossibility(%s, %s, %s)
                        """,
                        (qr_code_id, max_distance_km, window_hours),
                    )
                    result = cur.fetchone()
                    if result and result["is_anomaly"]:
                        detected = True
                        details = {
                            "max_distance_km": float(result["max_distance"]) if result["max_distance"] else 0,
                            "impossible_pairs": result["scan_pairs"],
                        }

                elif rule_type == "device_diversity":
                    threshold = params.get("unique_devices_threshold", 50)
                    window_hours = params.get("window_hours", 24)

                    cur.execute(
                        """
                        SELECT * FROM get_device_diversity(%s, %s)
                        """,
                        (qr_code_id, window_hours),
                    )
                    result = cur.fetchone()
                    if result and result["unique_devices"] > threshold:
                        detected = True
                        details = {
                            "unique_devices": result["unique_devices"],
                            "threshold": threshold,
                        }

                elif rule_type == "network_anomaly":
                    threshold_percent = params.get("threshold_percent", 20)
                    window_hours = params.get("window_hours", 24)

                    cur.execute(
                        """
                        SELECT
                            COUNT(*) as total,
                            COUNT(*) FILTER (WHERE is_vpn = true) as vpn_count,
                            COUNT(*) FILTER (WHERE is_datacenter = true) as datacenter_count,
                            COUNT(*) FILTER (WHERE is_tor = true) as tor_count
                        FROM scan_fingerprints
                        WHERE qr_code_id = %s
                          AND created_at >= NOW() - (%s || ' hours')::interval
                        """,
                        (qr_code_id, window_hours),
                    )
                    result = cur.fetchone()
                    if result and result["total"] > 0:
                        total = result["total"]
                        suspicious = result["vpn_count"] + result["datacenter_count"] + result["tor_count"]
                        percent = (suspicious / total) * 100
                        if percent > threshold_percent:
                            detected = True
                            details = {
                                "suspicious_percent": round(percent, 1),
                                "vpn_count": result["vpn_count"],
                                "datacenter_count": result["datacenter_count"],
                                "tor_count": result["tor_count"],
                            }

                elif rule_type == "device_repetition":
                    max_per_device = params.get("max_scans_per_device", 10)
                    window_hours = params.get("window_hours", 1)

                    cur.execute(
                        """
                        SELECT device_id_hash, COUNT(*) as count
                        FROM scan_fingerprints
                        WHERE qr_code_id = %s
                          AND device_id_hash IS NOT NULL
                          AND created_at >= NOW() - (%s || ' hours')::interval
                        GROUP BY device_id_hash
                        HAVING COUNT(*) > %s
                        """,
                        (qr_code_id, window_hours, max_per_device),
                    )
                    rows = cur.fetchall()
                    if rows:
                        detected = True
                        details = {
                            "repetitive_devices": len(rows),
                            "max_scans": max(r["count"] for r in rows),
                        }

                if detected:
                    anomalies.append({
                        "rule_id": str(rule["id"]),
                        "rule_name": rule["rule_name"],
                        "rule_type": rule_type,
                        "severity": rule["severity"],
                        "details": details,
                    })

            return AnomalyCheckResult(
                qr_code_id=qr_code_id,
                checked_at=datetime.now(timezone.utc),
                rules_checked=len(rules),
                anomalies_detected=len(anomalies),
                anomalies=anomalies,
                highest_severity=max((a["severity"] for a in anomalies), default=None),
            )


def auto_create_alert_if_needed(
    qr_code_id: str,
    organization_id: str,
    check_result: AnomalyCheckResult,
) -> CounterfeitAlert | None:
    """
    Automatically create an alert if anomalies exceed threshold.

    Returns the created alert or None if no alert was needed.
    """
    if check_result.anomalies_detected == 0:
        return None

    # Determine if we should create an alert based on severity
    severities = [a["severity"] for a in check_result.anomalies]
    if "critical" in severities or "high" in severities or len(check_result.anomalies) >= 2:
        # Create alert
        title = f"Suspicious activity detected ({check_result.anomalies_detected} anomalies)"
        description = "\n".join(
            f"- {a['rule_name']}: {json.dumps(a['details'])}" for a in check_result.anomalies
        )

        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO counterfeit_alerts (
                        organization_id, qr_code_id, alert_type, severity,
                        title, description, evidence
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        organization_id,
                        qr_code_id,
                        "anomaly_detected",
                        check_result.highest_severity,
                        title,
                        description,
                        json.dumps(check_result.anomalies),
                    ),
                )
                row = cur.fetchone()
                conn.commit()

                # Update authenticity score
                cur.execute("SELECT update_authenticity_score(%s)", (qr_code_id,))
                conn.commit()

                return CounterfeitAlert(**row)

    return None


# =============================================================================
# Anomaly Rules Management
# =============================================================================


def list_anomaly_rules(organization_id: str, user_id: str) -> list[AnomalyRule]:
    """List all anomaly rules for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            cur.execute(
                """
                SELECT * FROM anomaly_rules
                WHERE organization_id = %s
                ORDER BY severity DESC, rule_name
                """,
                (organization_id,),
            )
            return [AnomalyRule(**row) for row in cur.fetchall()]


def create_anomaly_rule(
    organization_id: str, user_id: str, data: AnomalyRuleCreate
) -> AnomalyRule:
    """Create a new anomaly detection rule."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            cur.execute(
                """
                INSERT INTO anomaly_rules (
                    organization_id, rule_name, rule_type, parameters,
                    severity, auto_actions, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    organization_id,
                    data.rule_name,
                    data.rule_type,
                    json.dumps(data.parameters),
                    data.severity,
                    json.dumps(data.auto_actions),
                    data.is_active,
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return AnomalyRule(**row)


def update_anomaly_rule(
    organization_id: str, rule_id: str, user_id: str, data: AnomalyRuleUpdate
) -> AnomalyRule:
    """Update an anomaly detection rule."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Build update query dynamically
            updates = []
            params = []

            if data.rule_name is not None:
                updates.append("rule_name = %s")
                params.append(data.rule_name)
            if data.parameters is not None:
                updates.append("parameters = %s")
                params.append(json.dumps(data.parameters))
            if data.severity is not None:
                updates.append("severity = %s")
                params.append(data.severity)
            if data.auto_actions is not None:
                updates.append("auto_actions = %s")
                params.append(json.dumps(data.auto_actions))
            if data.is_active is not None:
                updates.append("is_active = %s")
                params.append(data.is_active)

            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")

            params.extend([rule_id, organization_id])

            cur.execute(
                f"""
                UPDATE anomaly_rules
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                """,
                params,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Rule not found")
            conn.commit()
            return AnomalyRule(**row)


def delete_anomaly_rule(organization_id: str, rule_id: str, user_id: str) -> None:
    """Delete an anomaly detection rule."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            cur.execute(
                """
                DELETE FROM anomaly_rules
                WHERE id = %s AND organization_id = %s
                """,
                (rule_id, organization_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Rule not found")
            conn.commit()


def initialize_default_rules(organization_id: str, user_id: str) -> list[AnomalyRule]:
    """Initialize default anomaly rules for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            cur.execute("SELECT create_default_anomaly_rules(%s)", (organization_id,))
            conn.commit()

            # Return the created rules
            cur.execute(
                "SELECT * FROM anomaly_rules WHERE organization_id = %s",
                (organization_id,),
            )
            return [AnomalyRule(**row) for row in cur.fetchall()]


# =============================================================================
# Counterfeit Alerts
# =============================================================================


def list_alerts(
    organization_id: str,
    user_id: str,
    status_filter: str | None = None,
    severity_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CounterfeitAlert]:
    """List counterfeit alerts with optional filtering."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            conditions = ["organization_id = %s"]
            params = [organization_id]

            if status_filter:
                conditions.append("status = %s")
                params.append(status_filter)
            if severity_filter:
                conditions.append("severity = %s")
                params.append(severity_filter)

            params.extend([limit, offset])

            cur.execute(
                f"""
                SELECT * FROM counterfeit_alerts
                WHERE {' AND '.join(conditions)}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params,
            )
            return [CounterfeitAlert(**row) for row in cur.fetchall()]


def get_alert(organization_id: str, alert_id: str, user_id: str) -> CounterfeitAlert:
    """Get a single counterfeit alert."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            cur.execute(
                """
                SELECT * FROM counterfeit_alerts
                WHERE id = %s AND organization_id = %s
                """,
                (alert_id, organization_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Alert not found")
            return CounterfeitAlert(**row)


def update_alert(
    organization_id: str, alert_id: str, user_id: str, data: CounterfeitAlertUpdate
) -> CounterfeitAlert:
    """Update a counterfeit alert (status, assignment, resolution)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            updates = []
            params = []

            if data.status is not None:
                updates.append("status = %s")
                params.append(data.status)
                if data.status in ("resolved", "false_positive", "dismissed"):
                    updates.append("resolved_at = NOW()")
                elif data.status == "investigating":
                    updates.append("acknowledged_at = COALESCE(acknowledged_at, NOW())")

            if data.assigned_to is not None:
                updates.append("assigned_to = %s")
                params.append(data.assigned_to)

            if data.resolution_notes is not None:
                updates.append("resolution_notes = %s")
                params.append(data.resolution_notes)

            if data.resolution_action is not None:
                updates.append("resolution_action = %s")
                params.append(data.resolution_action)

            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")

            params.extend([alert_id, organization_id])

            cur.execute(
                f"""
                UPDATE counterfeit_alerts
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                """,
                params,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Alert not found")
            conn.commit()

            # Update authenticity score if status changed
            if data.status and row["qr_code_id"]:
                cur.execute("SELECT update_authenticity_score(%s)", (row["qr_code_id"],))
                conn.commit()

            return CounterfeitAlert(**row)


def get_alert_statistics(organization_id: str, user_id: str) -> AlertStatistics:
    """Get summary statistics for alerts."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            cur.execute(
                """
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'new') as new_count,
                    COUNT(*) FILTER (WHERE status = 'investigating') as investigating_count,
                    COUNT(*) FILTER (WHERE status = 'confirmed_counterfeit') as confirmed_count,
                    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
                    COUNT(*) FILTER (WHERE severity = 'high') as high_count,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - interval '24 hours') as last_24h,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - interval '7 days') as last_7d
                FROM counterfeit_alerts
                WHERE organization_id = %s
                """,
                (organization_id,),
            )
            row = cur.fetchone()
            return AlertStatistics(**row)


# =============================================================================
# Consumer Reports
# =============================================================================


def submit_counterfeit_report(
    qr_code_id: str | None,
    organization_id: str,
    data: CounterfeitReportCreate,
) -> CounterfeitReport:
    """
    Submit a consumer counterfeit report.

    This endpoint is public (no auth required) but captures device fingerprint.
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO counterfeit_reports (
                    qr_code_id, organization_id,
                    reporter_user_id, reporter_email, reporter_phone, is_anonymous,
                    reason, description,
                    purchase_location, purchase_date, purchase_price, purchase_currency,
                    seller_name, seller_url,
                    photo_urls, receipt_url,
                    scan_fingerprint_id, device_info, location_lat, location_lng
                )
                VALUES (
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    qr_code_id,
                    organization_id,
                    data.reporter_user_id,
                    data.reporter_email,
                    data.reporter_phone,
                    data.is_anonymous,
                    data.reason,
                    data.description,
                    data.purchase_location,
                    data.purchase_date,
                    data.purchase_price,
                    data.purchase_currency,
                    data.seller_name,
                    data.seller_url,
                    json.dumps(data.photo_urls) if data.photo_urls else "[]",
                    data.receipt_url,
                    data.scan_fingerprint_id,
                    json.dumps(data.device_info) if data.device_info else None,
                    data.location_lat,
                    data.location_lng,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            # Update authenticity score
            if qr_code_id:
                cur.execute("SELECT update_authenticity_score(%s)", (qr_code_id,))
                conn.commit()

            return CounterfeitReport(**row)


def list_reports(
    organization_id: str,
    user_id: str,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CounterfeitReport]:
    """List counterfeit reports for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            conditions = ["organization_id = %s"]
            params = [organization_id]

            if status_filter:
                conditions.append("status = %s")
                params.append(status_filter)

            params.extend([limit, offset])

            cur.execute(
                f"""
                SELECT * FROM counterfeit_reports
                WHERE {' AND '.join(conditions)}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params,
            )
            return [CounterfeitReport(**row) for row in cur.fetchall()]


def update_report(
    organization_id: str,
    report_id: str,
    user_id: str,
    data: CounterfeitReportUpdate,
) -> CounterfeitReport:
    """Update a counterfeit report (review, status change)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            updates = ["reviewed_by = %s", "reviewed_at = NOW()"]
            params = [user_id]

            if data.status is not None:
                updates.append("status = %s")
                params.append(data.status)

            if data.internal_notes is not None:
                updates.append("internal_notes = %s")
                params.append(data.internal_notes)

            if data.alert_id is not None:
                updates.append("alert_id = %s")
                params.append(data.alert_id)

            params.extend([report_id, organization_id])

            cur.execute(
                f"""
                UPDATE counterfeit_reports
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                """,
                params,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Report not found")
            conn.commit()

            # Update authenticity score
            if row["qr_code_id"]:
                cur.execute("SELECT update_authenticity_score(%s)", (row["qr_code_id"],))
                conn.commit()

            return CounterfeitReport(**row)


# =============================================================================
# Investigation Cases
# =============================================================================


def create_investigation(
    organization_id: str,
    user_id: str,
    data: InvestigationCaseCreate,
) -> InvestigationCase:
    """Create a new investigation case."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            cur.execute(
                """
                INSERT INTO investigation_cases (
                    organization_id, case_type, priority, title, summary,
                    affected_qr_codes, related_alerts, related_reports,
                    lead_investigator, team_members
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    organization_id,
                    data.case_type,
                    data.priority,
                    data.title,
                    data.summary,
                    json.dumps(data.affected_qr_codes) if data.affected_qr_codes else "[]",
                    json.dumps(data.related_alerts) if data.related_alerts else "[]",
                    json.dumps(data.related_reports) if data.related_reports else "[]",
                    data.lead_investigator or user_id,
                    json.dumps(data.team_members) if data.team_members else "[]",
                ),
            )
            row = cur.fetchone()

            # Log creation activity
            cur.execute(
                """
                INSERT INTO investigation_activities (
                    case_id, activity_type, description, performed_by
                )
                VALUES (%s, 'created', %s, %s)
                """,
                (row["id"], f"Investigation case created: {data.title}", user_id),
            )

            conn.commit()
            return InvestigationCase(**row)


def list_investigations(
    organization_id: str,
    user_id: str,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[InvestigationCase]:
    """List investigation cases."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            conditions = ["organization_id = %s"]
            params = [organization_id]

            if status_filter:
                conditions.append("status = %s")
                params.append(status_filter)

            params.extend([limit, offset])

            cur.execute(
                f"""
                SELECT * FROM investigation_cases
                WHERE {' AND '.join(conditions)}
                ORDER BY
                    CASE priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                LIMIT %s OFFSET %s
                """,
                params,
            )
            return [InvestigationCase(**row) for row in cur.fetchall()]


def get_investigation(
    organization_id: str, case_id: str, user_id: str
) -> InvestigationCase:
    """Get a single investigation case."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            cur.execute(
                """
                SELECT * FROM investigation_cases
                WHERE id = %s AND organization_id = %s
                """,
                (case_id, organization_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Investigation not found")
            return InvestigationCase(**row)


def update_investigation(
    organization_id: str,
    case_id: str,
    user_id: str,
    data: InvestigationCaseUpdate,
) -> InvestigationCase:
    """Update an investigation case."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Get current state for activity logging
            cur.execute(
                "SELECT * FROM investigation_cases WHERE id = %s AND organization_id = %s",
                (case_id, organization_id),
            )
            current = cur.fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Investigation not found")

            updates = []
            params = []
            activities = []

            if data.status is not None and data.status != current["status"]:
                updates.append("status = %s")
                params.append(data.status)
                activities.append(f"Status changed from {current['status']} to {data.status}")

                if data.status.startswith("closed"):
                    updates.append("closed_at = NOW()")
                elif data.status == "escalated":
                    updates.append("escalated_at = NOW()")

            if data.priority is not None and data.priority != current["priority"]:
                updates.append("priority = %s")
                params.append(data.priority)
                activities.append(f"Priority changed to {data.priority}")

            if data.lead_investigator is not None:
                updates.append("lead_investigator = %s")
                params.append(data.lead_investigator)
                activities.append("Lead investigator reassigned")

            if data.resolution_summary is not None:
                updates.append("resolution_summary = %s")
                params.append(data.resolution_summary)

            if data.lessons_learned is not None:
                updates.append("lessons_learned = %s")
                params.append(data.lessons_learned)

            if data.law_enforcement_notified is not None:
                updates.append("law_enforcement_notified = %s")
                params.append(data.law_enforcement_notified)
                if data.law_enforcement_notified:
                    activities.append("Law enforcement notified")

            if data.law_enforcement_case_number is not None:
                updates.append("law_enforcement_case_number = %s")
                params.append(data.law_enforcement_case_number)

            if not updates:
                return InvestigationCase(**current)

            params.extend([case_id, organization_id])

            cur.execute(
                f"""
                UPDATE investigation_cases
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                """,
                params,
            )
            row = cur.fetchone()

            # Log activities
            for activity in activities:
                cur.execute(
                    """
                    INSERT INTO investigation_activities (
                        case_id, activity_type, description, performed_by
                    )
                    VALUES (%s, 'status_change', %s, %s)
                    """,
                    (case_id, activity, user_id),
                )

            conn.commit()
            return InvestigationCase(**row)


def get_investigation_activities(
    organization_id: str, case_id: str, user_id: str
) -> list[InvestigationActivity]:
    """Get activity log for an investigation."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Verify case belongs to org
            cur.execute(
                "SELECT id FROM investigation_cases WHERE id = %s AND organization_id = %s",
                (case_id, organization_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Investigation not found")

            cur.execute(
                """
                SELECT * FROM investigation_activities
                WHERE case_id = %s
                ORDER BY created_at DESC
                """,
                (case_id,),
            )
            return [InvestigationActivity(**row) for row in cur.fetchall()]


def add_investigation_note(
    organization_id: str,
    case_id: str,
    user_id: str,
    note: str,
) -> InvestigationActivity:
    """Add a note to an investigation."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Verify case belongs to org
            cur.execute(
                "SELECT id FROM investigation_cases WHERE id = %s AND organization_id = %s",
                (case_id, organization_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Investigation not found")

            cur.execute(
                """
                INSERT INTO investigation_activities (
                    case_id, activity_type, description, performed_by
                )
                VALUES (%s, 'note_added', %s, %s)
                RETURNING *
                """,
                (case_id, note, user_id),
            )
            row = cur.fetchone()
            conn.commit()
            return InvestigationActivity(**row)


# =============================================================================
# Authenticity Verification (Public API)
# =============================================================================


def get_authenticity_score(qr_code_id: str) -> AuthenticityScore | None:
    """
    Get the public authenticity score for a QR code.

    This is called during consumer scans to display verification status.
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT * FROM authenticity_scores WHERE qr_code_id = %s",
                (qr_code_id,),
            )
            row = cur.fetchone()
            if row:
                return AuthenticityScore(**row)
            return None


def refresh_authenticity_score(qr_code_id: str) -> AuthenticityScore:
    """Force refresh of authenticity score."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT update_authenticity_score(%s)", (qr_code_id,))
            conn.commit()

            cur.execute(
                "SELECT * FROM authenticity_scores WHERE qr_code_id = %s",
                (qr_code_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="QR code not found")
            return AuthenticityScore(**row)


# =============================================================================
# Geographic Analysis
# =============================================================================


def get_scan_clusters(
    organization_id: str,
    qr_code_id: str,
    user_id: str,
    min_cluster_size: int = 5,
) -> list[GeographicCluster]:
    """
    Identify geographic clusters of scans for a QR code.

    Useful for detecting counterfeit distribution patterns.
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYST_ROLES)

            # Verify QR belongs to org
            cur.execute(
                "SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s",
                (qr_code_id, organization_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="QR code not found")

            # Get clusters by city/region
            cur.execute(
                """
                SELECT
                    country_code,
                    region_code,
                    city,
                    COUNT(*) as scan_count,
                    AVG(latitude) as center_lat,
                    AVG(longitude) as center_lng,
                    AVG(risk_score) as avg_risk_score,
                    MIN(created_at) as first_scan,
                    MAX(created_at) as last_scan
                FROM scan_fingerprints
                WHERE qr_code_id = %s
                  AND latitude IS NOT NULL
                GROUP BY country_code, region_code, city
                HAVING COUNT(*) >= %s
                ORDER BY scan_count DESC
                """,
                (qr_code_id, min_cluster_size),
            )

            clusters = []
            for row in cur.fetchall():
                clusters.append(
                    GeographicCluster(
                        country_code=row["country_code"],
                        region_code=row["region_code"],
                        city=row["city"],
                        scan_count=row["scan_count"],
                        center_lat=float(row["center_lat"]) if row["center_lat"] else None,
                        center_lng=float(row["center_lng"]) if row["center_lng"] else None,
                        avg_risk_score=float(row["avg_risk_score"]) if row["avg_risk_score"] else 0,
                        first_scan=row["first_scan"],
                        last_scan=row["last_scan"],
                    )
                )

            return clusters
