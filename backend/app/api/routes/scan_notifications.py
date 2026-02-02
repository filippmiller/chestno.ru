"""
Scan Notifications API Routes

REST API endpoints for producer scan notifications management.
Includes WebSocket endpoint for real-time updates.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.scan_notifications import (
    ScanNotificationPreferences,
    ScanNotificationPreferencesUpdate,
    ScanNotificationHistoryListResponse,
    LiveScanFeedResponse,
    ScanNotificationStats,
    LiveScanStats,
)
from app.services import scan_notifications as notifications_service

logger = logging.getLogger(__name__)

# Main router for authenticated organization endpoints
router = APIRouter(prefix='/api/organizations', tags=['scan-notifications'])

# WebSocket connections store
_active_connections: dict[str, list[WebSocket]] = {}


# ============================================================
# PREFERENCES ENDPOINTS
# ============================================================

@router.get('/{organization_id}/scan-notifications/preferences', response_model=ScanNotificationPreferences)
async def get_notification_preferences(
    organization_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ScanNotificationPreferences:
    """
    Get scan notification preferences for an organization.

    Returns the current notification settings including:
    - Enabled/disabled status
    - Notification channels
    - Region filters
    - Business hours settings
    - Batching configuration

    Accessible by: Organization members (all roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.get_notification_preferences,
            organization_id,
            current_user_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting notification preferences: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get notification preferences: {str(e)}'
        )


@router.put('/{organization_id}/scan-notifications/preferences', response_model=ScanNotificationPreferences)
async def update_notification_preferences(
    organization_id: str,
    payload: ScanNotificationPreferencesUpdate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ScanNotificationPreferences:
    """
    Update scan notification preferences for an organization.

    Updateable fields:
    - enabled: Master switch for notifications
    - channels: List of notification channels
    - regions_filter: List of country codes to filter
    - notify_business_hours_only: Only notify during business hours
    - business_hours_start/end: Business hours time range
    - timezone: Timezone for business hours
    - batch_notifications: Batch multiple scans into one notification
    - batch_interval_minutes: Interval for batching
    - min_scans_for_notification: Minimum scans before notifying
    - notify_new_regions_only: Only notify for new regions
    - notify_first_scan_per_product: Notify on first product scan
    - notify_on_suspicious_scans: Notify on suspicious activity
    - product_ids_filter: Filter to specific products

    Accessible by: Organization managers (owner, admin, manager roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.update_notification_preferences,
            organization_id,
            current_user_id,
            payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error updating notification preferences: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to update notification preferences: {str(e)}'
        )


# ============================================================
# HISTORY ENDPOINTS
# ============================================================

@router.get('/{organization_id}/scan-notifications/history', response_model=ScanNotificationHistoryListResponse)
async def get_notification_history(
    organization_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    channel: Optional[str] = Query(default=None),
    notification_type: Optional[str] = Query(default=None),
    notification_status: Optional[str] = Query(default=None, alias='status'),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ScanNotificationHistoryListResponse:
    """
    Get paginated notification history for an organization.

    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    - channel: Filter by notification channel
    - notification_type: Filter by notification type
    - status: Filter by delivery status
    - date_from: Filter from date
    - date_to: Filter to date

    Returns paginated list with:
    - items: List of notification history entries
    - total: Total count
    - page, per_page, total_pages: Pagination info

    Accessible by: Organization members (all roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.get_notification_history,
            organization_id,
            current_user_id,
            page,
            per_page,
            channel,
            notification_type,
            notification_status,
            date_from,
            date_to
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting notification history: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get notification history: {str(e)}'
        )


# ============================================================
# LIVE SCAN FEED ENDPOINTS
# ============================================================

@router.get('/{organization_id}/scan-notifications/live-feed', response_model=LiveScanFeedResponse)
async def get_live_scan_feed(
    organization_id: str,
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    since: Optional[datetime] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> LiveScanFeedResponse:
    """
    Get live scan feed for real-time dashboard display.

    This endpoint returns recent scans for displaying in the live feed.
    Use the WebSocket endpoint for real-time updates.

    Query parameters:
    - limit: Maximum items to return (default: 50, max: 100)
    - since: Only return scans after this timestamp (for polling)

    Returns:
    - items: List of recent scan events
    - total: Total count in feed
    - has_more: Whether more items exist

    Accessible by: Organization members (all roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.get_live_scan_feed,
            organization_id,
            current_user_id,
            limit,
            since
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting live scan feed: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get live scan feed: {str(e)}'
        )


# ============================================================
# STATISTICS ENDPOINTS
# ============================================================

@router.get('/{organization_id}/scan-notifications/stats', response_model=ScanNotificationStats)
async def get_notification_stats(
    organization_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ScanNotificationStats:
    """
    Get notification statistics for an organization.

    Returns:
    - total_notifications_sent: All-time count
    - notifications_today: Count for today
    - notifications_this_week: Count for this week
    - by_channel: Breakdown by notification channel
    - by_type: Breakdown by notification type
    - by_status: Breakdown by delivery status

    Accessible by: Organization members (all roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.get_notification_stats,
            organization_id,
            current_user_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting notification stats: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get notification stats: {str(e)}'
        )


@router.get('/{organization_id}/scan-notifications/live-stats', response_model=LiveScanStats)
async def get_live_scan_stats(
    organization_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> LiveScanStats:
    """
    Get live scan statistics for an organization.

    Returns:
    - total_scans_today: Scans today
    - total_scans_week: Scans this week
    - unique_products_scanned: Unique products in feed
    - unique_regions: Unique countries/regions
    - suspicious_scans_count: Suspicious scan count
    - first_scans_count: First-time scans count
    - top_countries: Top 10 countries by scan count
    - top_products: Top 10 products by scan count

    Accessible by: Organization members (all roles)
    """
    try:
        return await run_in_threadpool(
            notifications_service.get_live_scan_stats,
            organization_id,
            current_user_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting live scan stats: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get live scan stats: {str(e)}'
        )


# ============================================================
# WEBSOCKET ENDPOINT
# ============================================================

@router.websocket('/{organization_id}/scan-notifications/ws')
async def websocket_scan_feed(
    websocket: WebSocket,
    organization_id: str,
):
    """
    WebSocket endpoint for real-time scan notifications.

    Connect to receive live updates when products are scanned.

    Authentication:
    - Pass session cookie in connection headers
    - Or pass token as query parameter: ?token=...

    Message format (incoming):
    - {"type": "subscribe"} - Subscribe to updates
    - {"type": "unsubscribe"} - Unsubscribe from updates
    - {"type": "ping"} - Keep-alive ping

    Message format (outgoing):
    - {"type": "connected", "organization_id": "..."} - Connection confirmed
    - {"type": "scan", "data": {...}} - New scan event
    - {"type": "pong"} - Response to ping
    - {"type": "error", "message": "..."} - Error message
    """
    await websocket.accept()

    # TODO: Implement proper authentication for WebSocket
    # For now, we'll accept all connections but in production
    # this should validate the session/token

    # Add to active connections
    if organization_id not in _active_connections:
        _active_connections[organization_id] = []
    _active_connections[organization_id].append(websocket)

    logger.info(f"[ws] Client connected to org {organization_id}")

    try:
        # Send connection confirmation
        await websocket.send_json({
            'type': 'connected',
            'organization_id': organization_id,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for message with timeout for heartbeat
                message = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0
                )

                if message.get('type') == 'ping':
                    await websocket.send_json({
                        'type': 'pong',
                        'timestamp': datetime.utcnow().isoformat()
                    })

            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({
                    'type': 'heartbeat',
                    'timestamp': datetime.utcnow().isoformat()
                })

    except WebSocketDisconnect:
        logger.info(f"[ws] Client disconnected from org {organization_id}")
    except Exception as e:
        logger.error(f"[ws] Error in WebSocket connection: {e}")
    finally:
        # Remove from active connections
        if organization_id in _active_connections:
            _active_connections[organization_id].remove(websocket)
            if not _active_connections[organization_id]:
                del _active_connections[organization_id]


async def broadcast_scan_event(organization_id: str, scan_data: dict) -> None:
    """
    Broadcast a scan event to all connected WebSocket clients for an organization.

    Called by the scan notification service when a new scan occurs.

    Args:
        organization_id: Organization UUID
        scan_data: Scan event data to broadcast
    """
    if organization_id not in _active_connections:
        return

    message = {
        'type': 'scan',
        'data': scan_data,
        'timestamp': datetime.utcnow().isoformat()
    }

    disconnected = []
    for websocket in _active_connections[organization_id]:
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"[ws] Failed to send to client: {e}")
            disconnected.append(websocket)

    # Clean up disconnected clients
    for websocket in disconnected:
        _active_connections[organization_id].remove(websocket)
