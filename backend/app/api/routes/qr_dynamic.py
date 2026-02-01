"""
API Routes for Dynamic QR URL System

Provides endpoints for:
- URL version management
- Campaign scheduling
- A/B testing
- Analytics and overview
"""

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.qr_dynamic import (
    QRUrlVersion,
    QRUrlVersionCreate,
    QRUrlVersionUpdate,
    QRUrlVersionWithStats,
    QRCampaign,
    QRCampaignCreate,
    QRCampaignUpdate,
    QRCampaignWithStats,
    QRABTestCreate,
    QRABTestUpdate,
    QRABTestConclude,
    QRABTestWithVariants,
    QRABTestResults,
    QRDynamicOverview,
    QRUrlVersionHistoryItem,
)
from app.services import qr_dynamic as qr_dynamic_service


router = APIRouter(prefix='/api', tags=['qr-dynamic'])


# ============================================================================
# URL VERSIONS
# ============================================================================

@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions',
    response_model=list[QRUrlVersionWithStats]
)
async def list_url_versions(
    organization_id: str,
    qr_code_id: str,
    include_archived: bool = Query(default=False),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRUrlVersionWithStats]:
    """
    List all URL versions for a QR code.

    Each QR code can have multiple URL versions. Only one can be the default,
    which is used when no campaign or A/B test is active.

    Query Parameters:
    - include_archived: Include archived versions (default: false)

    Requires: viewer+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.list_url_versions,
        qr_code_id, current_user_id, include_archived
    )


@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions/{version_id}',
    response_model=QRUrlVersionWithStats
)
async def get_url_version(
    organization_id: str,
    qr_code_id: str,
    version_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRUrlVersionWithStats:
    """
    Get a specific URL version with statistics.

    Requires: viewer+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.get_url_version,
        qr_code_id, version_id, current_user_id
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions',
    response_model=QRUrlVersion,
    status_code=201
)
async def create_url_version(
    organization_id: str,
    qr_code_id: str,
    payload: QRUrlVersionCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRUrlVersion:
    """
    Create a new URL version for a QR code.

    The version will be assigned the next version number automatically.
    Set is_default=true to make this the default destination.

    Target types:
    - organization: Link to organization page (/org/{slug})
    - product: Link to product page (/p/{slug})
    - custom: Any internal path (must start with /)
    - external: External URL (must start with http:// or https://)

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.create_url_version,
        qr_code_id, current_user_id, payload
    )


@router.patch(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions/{version_id}',
    response_model=QRUrlVersion
)
async def update_url_version(
    organization_id: str,
    qr_code_id: str,
    version_id: str,
    payload: QRUrlVersionUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRUrlVersion:
    """
    Update a URL version.

    Changes are tracked in the version history for audit purposes.
    Setting is_default=true will unset the default flag on other versions.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.update_url_version,
        qr_code_id, version_id, current_user_id, payload
    )


@router.delete(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions/{version_id}',
    status_code=204
)
async def archive_url_version(
    organization_id: str,
    qr_code_id: str,
    version_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Archive a URL version (soft delete).

    Archived versions are not shown by default but their analytics are preserved.
    Cannot archive the only remaining version.

    Requires: manager+ role
    """
    await run_in_threadpool(
        qr_dynamic_service.archive_url_version,
        qr_code_id, version_id, current_user_id
    )


@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/versions/{version_id}/history',
    response_model=list[QRUrlVersionHistoryItem]
)
async def get_version_history(
    organization_id: str,
    qr_code_id: str,
    version_id: str,
    limit: int = Query(default=50, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRUrlVersionHistoryItem]:
    """
    Get change history for a URL version.

    Returns audit trail of all changes made to this version.

    Requires: analyst+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.get_version_history,
        qr_code_id, version_id, current_user_id, limit
    )


# ============================================================================
# CAMPAIGNS
# ============================================================================

@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/campaigns',
    response_model=list[QRCampaignWithStats]
)
async def list_campaigns(
    organization_id: str,
    qr_code_id: str,
    status: str | None = Query(default=None, regex="^(draft|scheduled|active|paused|completed|cancelled)$"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRCampaignWithStats]:
    """
    List all campaigns for a QR code.

    Campaigns allow scheduling different URLs for specific time periods.
    When a campaign is active, its URL version overrides the default.

    Query Parameters:
    - status: Filter by campaign status

    Requires: viewer+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.list_campaigns,
        qr_code_id, current_user_id, status
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/campaigns',
    response_model=QRCampaign,
    status_code=201
)
async def create_campaign(
    organization_id: str,
    qr_code_id: str,
    payload: QRCampaignCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCampaign:
    """
    Create a new campaign.

    A campaign activates a specific URL version during a scheduled time period.
    Higher priority campaigns take precedence when multiple are active.

    Example use cases:
    - Holiday promotions
    - Flash sales
    - Seasonal content
    - Event-specific landing pages

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.create_campaign,
        qr_code_id, current_user_id, payload
    )


@router.patch(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/campaigns/{campaign_id}',
    response_model=QRCampaign
)
async def update_campaign(
    organization_id: str,
    qr_code_id: str,
    campaign_id: str,
    payload: QRCampaignUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCampaign:
    """
    Update a campaign.

    Can modify schedule, priority, or pause/cancel the campaign.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.update_campaign,
        qr_code_id, campaign_id, current_user_id, payload
    )


@router.delete(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/campaigns/{campaign_id}',
    status_code=204
)
async def delete_campaign(
    organization_id: str,
    qr_code_id: str,
    campaign_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Delete a campaign.

    Analytics data will be preserved even after deletion.

    Requires: manager+ role
    """
    await run_in_threadpool(
        qr_dynamic_service.delete_campaign,
        qr_code_id, campaign_id, current_user_id
    )


# ============================================================================
# A/B TESTS
# ============================================================================

@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests',
    response_model=list[QRABTestWithVariants]
)
async def list_ab_tests(
    organization_id: str,
    qr_code_id: str,
    status: str | None = Query(default=None, regex="^(draft|running|paused|concluded)$"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRABTestWithVariants]:
    """
    List all A/B tests for a QR code.

    A/B tests split traffic between multiple URL versions to determine
    which performs better.

    Query Parameters:
    - status: Filter by test status

    Requires: viewer+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.list_ab_tests,
        qr_code_id, current_user_id, status
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests',
    response_model=QRABTestWithVariants,
    status_code=201
)
async def create_ab_test(
    organization_id: str,
    qr_code_id: str,
    payload: QRABTestCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRABTestWithVariants:
    """
    Create a new A/B test.

    An A/B test allows comparing 2-5 different URL versions by splitting
    traffic according to specified weights.

    Requirements:
    - Variant weights must sum to 100
    - All URL versions must belong to this QR code
    - Only one A/B test can run at a time per QR code

    The test is created in 'draft' status. Use the start endpoint to begin.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.create_ab_test,
        qr_code_id, current_user_id, payload
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests/{test_id}/start',
    response_model=QRABTestWithVariants
)
async def start_ab_test(
    organization_id: str,
    qr_code_id: str,
    test_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRABTestWithVariants:
    """
    Start an A/B test.

    Changes status from 'draft' or 'paused' to 'running'.
    While running, QR code scans will be split between variants.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.start_ab_test,
        qr_code_id, test_id, current_user_id
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests/{test_id}/pause',
    response_model=QRABTestWithVariants
)
async def pause_ab_test(
    organization_id: str,
    qr_code_id: str,
    test_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRABTestWithVariants:
    """
    Pause a running A/B test.

    Traffic will revert to default/campaign behavior while paused.
    Test can be resumed later.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.pause_ab_test,
        qr_code_id, test_id, current_user_id
    )


@router.post(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests/{test_id}/conclude',
    response_model=QRABTestWithVariants
)
async def conclude_ab_test(
    organization_id: str,
    qr_code_id: str,
    test_id: str,
    payload: QRABTestConclude,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRABTestWithVariants:
    """
    Conclude an A/B test with a winner.

    Marks the test as completed and records the winning variant.
    Optionally applies the winner as the new default URL version.

    Requires: manager+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.conclude_ab_test,
        qr_code_id, test_id, current_user_id, payload
    )


@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/ab-tests/{test_id}/results',
    response_model=QRABTestResults
)
async def get_ab_test_results(
    organization_id: str,
    qr_code_id: str,
    test_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRABTestResults:
    """
    Get statistical results for an A/B test.

    Returns:
    - Variant performance metrics
    - Statistical significance analysis
    - Recommended winner (if data is sufficient)
    - Confidence level

    Requires: analyst+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.get_ab_test_results,
        qr_code_id, test_id, current_user_id
    )


# ============================================================================
# OVERVIEW
# ============================================================================

@router.get(
    '/organizations/{organization_id}/qr-codes/{qr_code_id}/dynamic-overview',
    response_model=QRDynamicOverview
)
async def get_dynamic_overview(
    organization_id: str,
    qr_code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRDynamicOverview:
    """
    Get overview of dynamic QR features for a QR code.

    Returns a summary of:
    - Total URL versions
    - Currently active version
    - Active campaign (if any)
    - Running A/B test (if any)
    - Click statistics

    Requires: viewer+ role
    """
    return await run_in_threadpool(
        qr_dynamic_service.get_dynamic_overview,
        qr_code_id, current_user_id
    )
