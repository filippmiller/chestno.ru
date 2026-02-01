"""
QR Gamification API Routes.

Endpoints for the QR code scanning gamification system.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, get_optional_user
from app.services import gamification

router = APIRouter(prefix="/gamification", tags=["gamification"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class RecordScanRequest(BaseModel):
    """Request to record a QR scan."""
    organization_id: Optional[str] = None
    product_id: Optional[str] = None
    qr_code_id: Optional[str] = None
    scan_type: str = "product"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None


class ClaimRewardRequest(BaseModel):
    """Request to claim a reward."""
    reward_id: str


class MarkAchievementSeenRequest(BaseModel):
    """Request to mark an achievement as seen."""
    achievement_id: str


# =============================================================================
# PROFILE ENDPOINTS
# =============================================================================

@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get the current user's scanner profile."""
    return gamification.get_scanner_profile(user["id"])


@router.get("/dashboard")
async def get_dashboard(
    user_id: Optional[str] = Query(None, description="User ID (admin only)"),
    user: dict = Depends(get_current_user),
):
    """
    Get the complete gamification dashboard.

    Returns profile, achievements, rewards, and recent activity.
    """
    # Use provided user_id for admin viewing, otherwise current user
    target_user_id = user_id if user.get("role") == "admin" else user["id"]
    return gamification.get_gamification_dashboard(target_user_id)


# =============================================================================
# SCAN ENDPOINTS
# =============================================================================

@router.post("/scan")
async def record_scan(
    request: RecordScanRequest,
    user: dict = Depends(get_current_user),
):
    """
    Record a QR code scan.

    Returns scan result including tier changes and new achievements.
    """
    return gamification.record_scan(
        user_id=user["id"],
        organization_id=request.organization_id,
        product_id=request.product_id,
        qr_code_id=request.qr_code_id,
        scan_type=request.scan_type,
        latitude=request.latitude,
        longitude=request.longitude,
        city=request.city,
    )


@router.get("/history")
async def get_scan_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """Get the user's scan history."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row

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
            LIMIT %s OFFSET %s
            """,
            (user["id"], limit, offset)
        )
        history = [dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT COUNT(*) as count FROM qr_scan_history WHERE user_id = %s",
            (user["id"],)
        )
        total = cur.fetchone()["count"]

    return {
        "history": history,
        "total": total,
        "has_more": (offset + limit) < total,
    }


# =============================================================================
# ACHIEVEMENT ENDPOINTS
# =============================================================================

@router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    """Get all achievements with user's progress."""
    all_achievements = gamification.get_all_achievements()
    user_achievements = gamification.get_user_achievements(user["id"])
    progress = gamification.get_achievement_progress(user["id"])

    earned_ids = {ua["achievement_id"] for ua in user_achievements}

    return {
        "all": all_achievements,
        "earned": user_achievements,
        "available": [a for a in all_achievements if a["id"] not in earned_ids],
        "progress": progress,
    }


@router.post("/achievements/mark-seen")
async def mark_achievement_seen(
    request: MarkAchievementSeenRequest,
    user: dict = Depends(get_current_user),
):
    """Mark an achievement as seen by the user."""
    success = gamification.mark_achievement_seen(user["id"], request.achievement_id)
    return {"success": success}


# =============================================================================
# REWARD ENDPOINTS
# =============================================================================

@router.get("/rewards")
async def get_rewards(user: dict = Depends(get_current_user)):
    """Get available and claimed rewards for the user."""
    return {
        "available": gamification.get_available_rewards(user["id"]),
        "claimed": gamification.get_user_claimed_rewards(user["id"]),
    }


@router.post("/rewards/claim")
async def claim_reward(
    request: ClaimRewardRequest,
    user: dict = Depends(get_current_user),
):
    """Claim a reward."""
    return gamification.claim_reward(user["id"], request.reward_id)


# =============================================================================
# LEADERBOARD ENDPOINTS
# =============================================================================

@router.get("/leaderboard")
async def get_leaderboard(
    period: str = Query("monthly", regex="^(all_time|monthly|weekly)$"),
    limit: int = Query(20, ge=1, le=100),
    user: Optional[dict] = Depends(get_optional_user),
):
    """
    Get the QR scanning leaderboard.

    Supports all_time, monthly, and weekly periods.
    """
    current_user_id = user["id"] if user else None
    return gamification.get_leaderboard(
        period=period,
        limit=limit,
        current_user_id=current_user_id,
    )


@router.get("/leaderboard/monthly/{year}/{month}")
async def get_monthly_leaderboard_archive(
    year: int,
    month: int,
    limit: int = Query(100, ge=1, le=100),
):
    """Get archived monthly leaderboard for a specific month."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT ml.*,
                   COALESCE(p.display_name, u.email) as display_name,
                   p.avatar_url
            FROM qr_monthly_leaderboards ml
            JOIN auth.users u ON u.id = ml.user_id
            LEFT JOIN profiles p ON p.id = ml.user_id
            WHERE ml.year = %s AND ml.month = %s
            ORDER BY ml.rank
            LIMIT %s
            """,
            (year, month, limit)
        )
        entries = [dict(r) for r in cur.fetchall()]

    return {
        "year": year,
        "month": month,
        "entries": entries,
    }


# =============================================================================
# TIER INFO ENDPOINTS
# =============================================================================

@router.get("/tiers")
async def get_tier_info():
    """Get information about all tiers and their requirements."""
    return {
        "tiers": [
            {
                "tier": "none",
                "threshold": 0,
                "name_ru": "Новичок",
                "name_en": "Newcomer",
                "color": "#6B7280",
                "benefits_ru": ["Базовое сканирование"],
            },
            {
                "tier": "bronze",
                "threshold": 5,
                "name_ru": "Бронза",
                "name_en": "Bronze",
                "color": "#CD7F32",
                "benefits_ru": [
                    "Бронзовый сертификат",
                    "Доступ к базовым наградам",
                    "+10% к очкам за сканирование",
                ],
            },
            {
                "tier": "silver",
                "threshold": 20,
                "name_ru": "Серебро",
                "name_en": "Silver",
                "color": "#C0C0C0",
                "benefits_ru": [
                    "Серебряный сертификат",
                    "Ранний доступ к бета-функциям",
                    "+25% к очкам за сканирование",
                    "Эксклюзивные скидки от партнеров",
                ],
            },
            {
                "tier": "gold",
                "threshold": 50,
                "name_ru": "Золото",
                "name_en": "Gold",
                "color": "#FFD700",
                "benefits_ru": [
                    "Золотой сертификат",
                    "VIP-доступ к новым функциям",
                    "+50% к очкам за сканирование",
                    "Премиум-скидки от партнеров",
                    "Возможность выиграть призы",
                ],
            },
        ],
    }
