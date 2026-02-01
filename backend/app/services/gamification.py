"""
QR Gamification Service.

Manages the QR code scanning gamification system including:
- Tier progression (Bronze 5, Silver 20, Gold 50 scans)
- Achievements tracking
- Rewards claiming
- Monthly leaderboards
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)


# =============================================================================
# TIER CONFIGURATION
# =============================================================================

TIER_THRESHOLDS = {
    "none": 0,
    "bronze": 5,
    "silver": 20,
    "gold": 50,
}

TIER_ORDER = ["none", "bronze", "silver", "gold"]


def get_tier_from_scans(total_scans: int) -> str:
    """Calculate tier based on total scan count."""
    if total_scans >= 50:
        return "gold"
    elif total_scans >= 20:
        return "silver"
    elif total_scans >= 5:
        return "bronze"
    return "none"


def get_next_tier(current_tier: str) -> Optional[str]:
    """Get the next tier after current."""
    try:
        idx = TIER_ORDER.index(current_tier)
        if idx < len(TIER_ORDER) - 1:
            return TIER_ORDER[idx + 1]
    except ValueError:
        pass
    return None


def calculate_tier_progress(total_scans: int, current_tier: str) -> tuple[Optional[int], float]:
    """Calculate scans needed for next tier and progress percentage."""
    next_tier = get_next_tier(current_tier)
    if not next_tier:
        return None, 100.0

    current_threshold = TIER_THRESHOLDS[current_tier]
    next_threshold = TIER_THRESHOLDS[next_tier]

    scans_in_tier = total_scans - current_threshold
    tier_range = next_threshold - current_threshold
    progress = (scans_in_tier / tier_range) * 100 if tier_range > 0 else 100.0

    scans_needed = next_threshold - total_scans
    return max(0, scans_needed), min(100.0, max(0.0, progress))


# =============================================================================
# SCANNER PROFILE
# =============================================================================

def ensure_scanner_profile(user_id: str) -> dict:
    """
    Ensure a scanner profile exists for the user.
    Creates one if it doesn't exist.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM qr_scanner_profiles WHERE user_id = %s",
            (user_id,)
        )
        profile = cur.fetchone()

        if profile:
            return dict(profile)

        cur.execute(
            """
            INSERT INTO qr_scanner_profiles (user_id)
            VALUES (%s)
            RETURNING *
            """,
            (user_id,)
        )
        conn.commit()
        return dict(cur.fetchone())


def get_scanner_profile(user_id: str) -> dict:
    """Get enriched scanner profile with computed fields."""
    profile = ensure_scanner_profile(user_id)

    current_tier = profile["current_tier"]
    next_tier = get_next_tier(current_tier)
    scans_to_next, progress = calculate_tier_progress(
        profile["total_scans"],
        current_tier
    )

    profile["next_tier"] = next_tier
    profile["scans_to_next_tier"] = scans_to_next
    profile["tier_progress_percent"] = progress

    return profile


# =============================================================================
# SCAN RECORDING
# =============================================================================

def record_scan(
    user_id: str,
    organization_id: Optional[str] = None,
    product_id: Optional[str] = None,
    qr_code_id: Optional[str] = None,
    scan_type: str = "product",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    city: Optional[str] = None,
) -> dict:
    """
    Record a QR scan and return the result with tier/achievement updates.

    Returns:
        Dict with scan_id, new_tier, tier_changed, new_achievements, points_earned, profile
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Call the database function that handles all the logic
        cur.execute(
            """
            SELECT * FROM record_qr_scan(
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                user_id,
                organization_id,
                product_id,
                qr_code_id,
                scan_type,
                latitude,
                longitude,
                city,
            )
        )
        result = cur.fetchone()
        conn.commit()

        # Fetch the updated profile
        profile = get_scanner_profile(user_id)

        # Fetch details of new achievements
        new_achievements = []
        if result["new_achievements"]:
            cur.execute(
                """
                SELECT * FROM qr_achievements WHERE id = ANY(%s)
                """,
                (result["new_achievements"],)
            )
            new_achievements = [dict(r) for r in cur.fetchall()]

        return {
            "scan_id": str(result["scan_id"]),
            "new_tier": result["new_tier"],
            "tier_changed": result["tier_changed"],
            "new_achievements": new_achievements,
            "points_earned": result["points_earned"],
            "profile": profile,
        }


# =============================================================================
# ACHIEVEMENTS
# =============================================================================

def get_all_achievements() -> list[dict]:
    """Get all active achievements."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT * FROM qr_achievements
            WHERE is_active = true
            ORDER BY sort_order
            """
        )
        return [dict(r) for r in cur.fetchall()]


def get_user_achievements(user_id: str) -> list[dict]:
    """Get all achievements earned by a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT ua.*, a.*
            FROM user_qr_achievements ua
            JOIN qr_achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = %s
            ORDER BY ua.earned_at DESC
            """,
            (user_id,)
        )
        return [dict(r) for r in cur.fetchall()]


def get_achievement_progress(user_id: str) -> dict[str, dict]:
    """
    Calculate progress toward each achievement for a user.

    Returns dict mapping achievement_id to {current, required}.
    """
    profile = ensure_scanner_profile(user_id)
    achievements = get_all_achievements()
    progress = {}

    for achievement in achievements:
        criteria = achievement["criteria"]
        criteria_type = criteria.get("type")
        threshold = criteria.get("threshold", 0)

        current = 0
        if criteria_type == "total_scans":
            current = profile["total_scans"]
        elif criteria_type == "unique_organizations":
            current = profile["unique_organizations_scanned"]
        elif criteria_type == "unique_products":
            current = profile["unique_products_scanned"]
        elif criteria_type == "streak_days":
            current = profile["current_streak_days"]

        progress[str(achievement["id"])] = {
            "current": current,
            "required": threshold,
        }

    return progress


def mark_achievement_seen(user_id: str, achievement_id: str) -> bool:
    """Mark an achievement as seen by the user."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE user_qr_achievements
            SET is_seen = true
            WHERE user_id = %s AND achievement_id = %s
            RETURNING id
            """,
            (user_id, achievement_id)
        )
        result = cur.fetchone()
        conn.commit()
        return result is not None


# =============================================================================
# REWARDS
# =============================================================================

def get_available_rewards(user_id: str) -> list[dict]:
    """Get all rewards available to the user based on their tier."""
    profile = ensure_scanner_profile(user_id)
    current_tier = profile["current_tier"]
    tier_index = TIER_ORDER.index(current_tier)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT r.*,
                   o.name as partner_name,
                   CASE
                       WHEN r.total_available IS NULL THEN true
                       WHEN r.claimed_count < r.total_available THEN true
                       ELSE false
                   END as is_available,
                   CASE
                       WHEN r.total_available IS NULL THEN NULL
                       ELSE r.total_available - r.claimed_count
                   END as remaining
            FROM qr_rewards r
            LEFT JOIN organizations o ON o.id = r.partner_organization_id
            WHERE r.is_active = true
              AND (r.available_until IS NULL OR r.available_until > now())
              AND r.available_from <= now()
            ORDER BY r.required_tier, r.points_cost
            """
        )
        all_rewards = [dict(r) for r in cur.fetchall()]

    # Filter by tier eligibility
    rewards = []
    for reward in all_rewards:
        required_tier_index = TIER_ORDER.index(reward["required_tier"])
        if tier_index >= required_tier_index:
            rewards.append(reward)

    return rewards


def get_user_claimed_rewards(user_id: str) -> list[dict]:
    """Get all rewards claimed by a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT ucr.*, r.*
            FROM user_claimed_rewards ucr
            JOIN qr_rewards r ON r.id = ucr.reward_id
            WHERE ucr.user_id = %s
            ORDER BY ucr.claimed_at DESC
            """,
            (user_id,)
        )
        return [dict(r) for r in cur.fetchall()]


def claim_reward(user_id: str, reward_id: str) -> dict:
    """
    Claim a reward for the user.

    Args:
        user_id: User claiming the reward
        reward_id: Reward to claim

    Returns:
        The claimed reward record with claim_data

    Raises:
        HTTPException: If reward is unavailable or user is ineligible
    """
    profile = ensure_scanner_profile(user_id)
    current_tier = profile["current_tier"]
    tier_index = TIER_ORDER.index(current_tier)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get reward with lock
        cur.execute(
            """
            SELECT * FROM qr_rewards WHERE id = %s FOR UPDATE
            """,
            (reward_id,)
        )
        reward = cur.fetchone()

        if not reward:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reward not found"
            )

        if not reward["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reward is no longer active"
            )

        # Check tier requirement
        required_tier_index = TIER_ORDER.index(reward["required_tier"])
        if tier_index < required_tier_index:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {reward['required_tier']} tier"
            )

        # Check availability
        if reward["total_available"] is not None:
            if reward["claimed_count"] >= reward["total_available"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reward is sold out"
                )

        # Check if already claimed (for one-time rewards like certificates)
        cur.execute(
            """
            SELECT 1 FROM user_claimed_rewards
            WHERE user_id = %s AND reward_id = %s
            """,
            (user_id, reward_id)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reward already claimed"
            )

        # Check points cost (if any)
        # For simplicity, using total_scans as "points" for now
        if reward["points_cost"] > profile["total_scans"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough points"
            )

        # Generate claim data based on reward type
        claim_data = _generate_claim_data(reward, user_id, cur)

        # Calculate expiration
        expires_at = None
        if reward["reward_type"] in ("early_access", "premium_feature"):
            duration_days = reward["reward_data"].get("duration_days", 30)
            expires_at = datetime.now().replace(
                hour=23, minute=59, second=59
            ) + timedelta(days=duration_days)

        # Create claim record
        cur.execute(
            """
            INSERT INTO user_claimed_rewards (
                user_id, reward_id, points_spent, claim_data, expires_at
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (user_id, reward_id, reward["points_cost"], claim_data, expires_at)
        )
        claimed = dict(cur.fetchone())

        # Update reward claimed count
        cur.execute(
            """
            UPDATE qr_rewards SET claimed_count = claimed_count + 1
            WHERE id = %s
            """,
            (reward_id,)
        )

        conn.commit()

        claimed["reward"] = dict(reward)
        return claimed


def _generate_claim_data(reward: dict, user_id: str, cur) -> dict:
    """Generate claim-specific data based on reward type."""
    from datetime import timedelta

    reward_type = reward["reward_type"]
    reward_data = reward["reward_data"] or {}

    if reward_type == "certification_pdf":
        # Generate certificate URL (would trigger actual PDF generation)
        return {
            "certificate_id": str(uuid4()),
            "template": reward_data.get("template", "default"),
            "tier": reward_data.get("tier", "bronze"),
            "generated_at": datetime.now().isoformat(),
            # In production, this would be a signed URL to the generated PDF
            "download_url": f"/api/v1/gamification/certificates/{uuid4()}",
        }

    elif reward_type == "discount_code":
        # Assign a discount code from the partner pool
        partner_id = reward.get("partner_organization_id")
        if partner_id:
            cur.execute(
                """
                UPDATE partner_discount_codes
                SET is_used = true, used_by_user_id = %s, used_at = now()
                WHERE id = (
                    SELECT id FROM partner_discount_codes
                    WHERE partner_organization_id = %s
                      AND is_used = false
                      AND valid_until > now()
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING discount_code, discount_percent, valid_until
                """,
                (user_id, partner_id)
            )
            code_row = cur.fetchone()
            if code_row:
                return {
                    "discount_code": code_row[0],
                    "discount_percent": code_row[1],
                    "valid_until": code_row[2].isoformat() if code_row[2] else None,
                }

        # Fallback: generate a generic code
        return {
            "discount_code": f"QR{uuid4().hex[:8].upper()}",
            "discount_percent": reward_data.get("discount_percent", 10),
        }

    elif reward_type == "early_access":
        return {
            "feature": reward_data.get("feature", "beta_features"),
            "enabled_at": datetime.now().isoformat(),
        }

    elif reward_type == "premium_feature":
        return {
            "feature": reward_data.get("feature", "premium"),
            "enabled_at": datetime.now().isoformat(),
        }

    return {}


# =============================================================================
# LEADERBOARDS
# =============================================================================

def get_leaderboard(
    period: str = "monthly",
    limit: int = 20,
    current_user_id: Optional[str] = None,
) -> dict:
    """
    Get the QR scanning leaderboard.

    Args:
        period: "all_time", "monthly", or "weekly"
        limit: Number of entries to return
        current_user_id: Optional user to find their rank

    Returns:
        Dict with entries, user_entry, total_participants, period, period_label
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build query based on period
        if period == "weekly":
            score_column = "scans_this_month"  # Simplified for now
            date_filter = "AND qsp.last_scan_date > CURRENT_DATE - 7"
        elif period == "monthly":
            score_column = "scans_this_month"
            date_filter = "AND qsp.month_start = date_trunc('month', CURRENT_DATE)::DATE"
        else:
            score_column = "total_scans"
            date_filter = ""

        # Get leaderboard
        cur.execute(
            f"""
            WITH ranked AS (
                SELECT
                    qsp.user_id,
                    COALESCE(p.display_name, u.email) as display_name,
                    p.avatar_url,
                    qsp.total_scans,
                    qsp.{score_column} as scans_this_period,
                    qsp.current_tier as tier,
                    qsp.unique_organizations_scanned as unique_organizations,
                    ROW_NUMBER() OVER (ORDER BY qsp.{score_column} DESC, qsp.total_scans DESC) as rank
                FROM qr_scanner_profiles qsp
                JOIN auth.users u ON u.id = qsp.user_id
                LEFT JOIN profiles p ON p.id = qsp.user_id
                WHERE qsp.{score_column} > 0
                {date_filter}
            )
            SELECT * FROM ranked
            ORDER BY rank
            LIMIT %s
            """,
            (limit,)
        )
        entries = [dict(r) for r in cur.fetchall()]

        # Get total count
        cur.execute(
            f"""
            SELECT COUNT(*) as count
            FROM qr_scanner_profiles qsp
            WHERE qsp.{score_column} > 0
            {date_filter}
            """
        )
        total = cur.fetchone()["count"]

        # Get current user's entry if provided
        user_entry = None
        if current_user_id:
            cur.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        qsp.user_id,
                        COALESCE(p.display_name, u.email) as display_name,
                        p.avatar_url,
                        qsp.total_scans,
                        qsp.{score_column} as scans_this_period,
                        qsp.current_tier as tier,
                        qsp.unique_organizations_scanned as unique_organizations,
                        ROW_NUMBER() OVER (ORDER BY qsp.{score_column} DESC, qsp.total_scans DESC) as rank
                    FROM qr_scanner_profiles qsp
                    JOIN auth.users u ON u.id = qsp.user_id
                    LEFT JOIN profiles p ON p.id = qsp.user_id
                    WHERE qsp.{score_column} > 0
                    {date_filter}
                )
                SELECT * FROM ranked WHERE user_id = %s
                """,
                (current_user_id,)
            )
            user_row = cur.fetchone()
            if user_row:
                user_entry = dict(user_row)

    period_labels = {
        "all_time": "Все время",
        "monthly": "Этот месяц",
        "weekly": "Эта неделя",
    }

    return {
        "entries": entries,
        "user_entry": user_entry,
        "total_participants": total,
        "period": period,
        "period_label": period_labels.get(period, period),
    }


def archive_monthly_leaderboard(year: int, month: int) -> int:
    """
    Archive the monthly leaderboard for historical records.

    Call this at the end of each month (e.g., via cron job).

    Returns number of entries archived.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT archive_monthly_leaderboard(%s, %s) as count",
            (year, month)
        )
        result = cur.fetchone()
        conn.commit()
        return result["count"]


# =============================================================================
# DASHBOARD
# =============================================================================

def get_gamification_dashboard(user_id: str) -> dict:
    """
    Get complete gamification dashboard data for a user.

    Returns:
        Dict with profile, recent_scans, achievements, available_rewards, claimed_rewards
    """
    profile = get_scanner_profile(user_id)

    # Get recent scans
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT sh.*,
                   o.name as organization_name,
                   p.name as product_name
            FROM qr_scan_history sh
            LEFT JOIN organizations o ON o.id = sh.organization_id
            LEFT JOIN products p ON p.id = sh.product_id
            WHERE sh.user_id = %s
            ORDER BY sh.scanned_at DESC
            LIMIT 10
            """,
            (user_id,)
        )
        recent_scans = [dict(r) for r in cur.fetchall()]

    # Get achievements
    all_achievements = get_all_achievements()
    user_achievements = get_user_achievements(user_id)
    progress = get_achievement_progress(user_id)

    # Determine which achievements are available (not yet earned)
    earned_ids = {ua["achievement_id"] for ua in user_achievements}
    available_achievements = [a for a in all_achievements if a["id"] not in earned_ids]

    # Get rewards
    available_rewards = get_available_rewards(user_id)
    claimed_rewards = get_user_claimed_rewards(user_id)

    return {
        "profile": profile,
        "recent_scans": recent_scans,
        "achievements": {
            "earned": user_achievements,
            "available": available_achievements,
            "progress": progress,
        },
        "available_rewards": available_rewards,
        "claimed_rewards": claimed_rewards,
    }
