"""API routes for verified business response system."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.business_responses import (
    VerificationRequestCreate,
    VerificationRequestResponse,
    VerificationDocumentUpload,
    VerificationDocumentResponse,
    VerificationReview,
    ResponseTemplateCreate,
    ResponseTemplateUpdate,
    ResponseTemplateResponse,
    ResponseTemplatesResponse,
    ResponseHistoryItem,
    MetricsResponse,
    AccountabilityScoresResponse,
    PublicAccountability,
    SatisfactionRatingCreate,
    SatisfactionRatingResponse,
    SatisfactionSummary,
    ResponseDashboard,
    TemplateCategory,
)
from app.services.business_responses import (
    create_verification_request,
    get_verification_request,
    upload_verification_document,
    review_verification_request,
    list_response_templates,
    create_response_template,
    update_response_template,
    delete_response_template,
    get_suggested_templates,
    get_response_history,
    get_response_metrics,
    get_accountability_scores,
    get_public_accountability,
    rate_response_satisfaction,
    get_satisfaction_summary,
    get_response_dashboard,
)

from .auth import get_current_user_id

router = APIRouter(prefix='/api/organizations', tags=['business-responses'])
public_router = APIRouter(prefix='/api/public', tags=['business-responses'])
admin_router = APIRouter(prefix='/api/admin', tags=['business-responses-admin'])


# ============================================
# Business Verification Routes
# ============================================

@router.post('/{organization_id}/verification', response_model=VerificationRequestResponse)
async def create_verification(
    organization_id: str,
    payload: VerificationRequestCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> VerificationRequestResponse:
    """Create a new business verification request."""
    try:
        return await run_in_threadpool(
            create_verification_request,
            organization_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get('/{organization_id}/verification', response_model=VerificationRequestResponse | None)
async def get_verification(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> VerificationRequestResponse | None:
    """Get current verification request for the organization."""
    return await run_in_threadpool(
        get_verification_request,
        organization_id,
        current_user_id,
    )


@router.post('/{organization_id}/verification/{request_id}/documents', response_model=VerificationDocumentResponse)
async def upload_document(
    organization_id: str,
    request_id: str,
    payload: VerificationDocumentUpload,
    current_user_id: str = Depends(get_current_user_id),
) -> VerificationDocumentResponse:
    """Upload a document for verification."""
    try:
        return await run_in_threadpool(
            upload_verification_document,
            organization_id,
            request_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# Response Templates Routes
# ============================================

@router.get('/{organization_id}/response-templates', response_model=ResponseTemplatesResponse)
async def list_templates(
    organization_id: str,
    category: TemplateCategory | None = Query(default=None),
    active_only: bool = Query(default=True),
    current_user_id: str = Depends(get_current_user_id),
) -> ResponseTemplatesResponse:
    """List response templates for the organization."""
    items, total = await run_in_threadpool(
        list_response_templates,
        organization_id,
        current_user_id,
        category,
        active_only,
    )
    return ResponseTemplatesResponse(items=items, total=total)


@router.post('/{organization_id}/response-templates', response_model=ResponseTemplateResponse, status_code=201)
async def create_template(
    organization_id: str,
    payload: ResponseTemplateCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> ResponseTemplateResponse:
    """Create a new response template."""
    return await run_in_threadpool(
        create_response_template,
        organization_id,
        current_user_id,
        payload,
    )


@router.patch('/{organization_id}/response-templates/{template_id}', response_model=ResponseTemplateResponse)
async def update_template(
    organization_id: str,
    template_id: str,
    payload: ResponseTemplateUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> ResponseTemplateResponse:
    """Update a response template."""
    try:
        return await run_in_threadpool(
            update_response_template,
            organization_id,
            template_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete('/{organization_id}/response-templates/{template_id}', status_code=204)
async def delete_template_route(
    organization_id: str,
    template_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete a response template."""
    try:
        await run_in_threadpool(
            delete_response_template,
            organization_id,
            template_id,
            current_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get('/{organization_id}/reviews/{review_id}/suggested-templates', response_model=list[ResponseTemplateResponse])
async def get_suggested(
    organization_id: str,
    review_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> list[ResponseTemplateResponse]:
    """Get suggested templates for a specific review."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row
    from app.services.organization_profiles import _require_role

    _require_role(None, organization_id, current_user_id, {'owner', 'admin', 'manager'})

    # Get review details
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT rating, body FROM reviews WHERE id = %s AND organization_id = %s',
                (review_id, organization_id),
            )
            review = cur.fetchone()
            if not review:
                raise HTTPException(status_code=404, detail='Review not found')

    return await run_in_threadpool(
        get_suggested_templates,
        organization_id,
        review['rating'],
        review['body'],
    )


# ============================================
# Response History Routes
# ============================================

@router.get('/{organization_id}/reviews/{review_id}/response-history', response_model=list[ResponseHistoryItem])
async def get_history(
    organization_id: str,
    review_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> list[ResponseHistoryItem]:
    """Get response history for a review."""
    return await run_in_threadpool(
        get_response_history,
        organization_id,
        review_id,
        current_user_id,
    )


# ============================================
# Metrics Routes
# ============================================

@router.get('/{organization_id}/response-metrics', response_model=MetricsResponse)
async def get_metrics(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
) -> MetricsResponse:
    """Get response metrics for the organization."""
    return await run_in_threadpool(
        get_response_metrics,
        organization_id,
        current_user_id,
        days,
    )


@router.get('/{organization_id}/accountability-scores', response_model=AccountabilityScoresResponse)
async def get_scores(
    organization_id: str,
    months: int = Query(default=12, ge=1, le=24),
    current_user_id: str = Depends(get_current_user_id),
) -> AccountabilityScoresResponse:
    """Get accountability scores for the organization."""
    return await run_in_threadpool(
        get_accountability_scores,
        organization_id,
        current_user_id,
        months,
    )


@router.get('/{organization_id}/satisfaction-summary', response_model=SatisfactionSummary)
async def get_satisfaction(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
) -> SatisfactionSummary:
    """Get response satisfaction summary for the organization."""
    return await run_in_threadpool(
        get_satisfaction_summary,
        organization_id,
        current_user_id,
        days,
    )


@router.get('/{organization_id}/response-dashboard', response_model=ResponseDashboard)
async def get_dashboard(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> ResponseDashboard:
    """Get complete response dashboard data."""
    return await run_in_threadpool(
        get_response_dashboard,
        organization_id,
        current_user_id,
    )


# ============================================
# Public Routes
# ============================================

@public_router.get('/organizations/{organization_id}/accountability', response_model=PublicAccountability | None)
async def public_accountability(
    organization_id: str,
) -> PublicAccountability | None:
    """Get public accountability data for an organization."""
    return await run_in_threadpool(
        get_public_accountability,
        organization_id,
    )


# ============================================
# Consumer Routes (for review authors)
# ============================================

@public_router.post('/reviews/{review_id}/response-satisfaction', response_model=SatisfactionRatingResponse)
async def rate_satisfaction(
    review_id: str,
    payload: SatisfactionRatingCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> SatisfactionRatingResponse:
    """Rate the helpfulness of a business response (for review authors)."""
    try:
        return await run_in_threadpool(
            rate_response_satisfaction,
            review_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# Admin Routes
# ============================================

@admin_router.patch('/verification-requests/{request_id}/review', response_model=VerificationRequestResponse)
async def admin_review_verification(
    request_id: str,
    payload: VerificationReview,
    current_user_id: str = Depends(get_current_user_id),
) -> VerificationRequestResponse:
    """Admin: Review a verification request."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row

    # Check admin role
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT role FROM platform_roles WHERE user_id = %s',
                (current_user_id,),
            )
            role = cur.fetchone()
            if not role or role['role'] != 'platform_admin':
                raise HTTPException(status_code=403, detail='Admin access required')

    try:
        return await run_in_threadpool(
            review_verification_request,
            request_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@admin_router.get('/verification-requests', response_model=list[VerificationRequestResponse])
async def admin_list_verifications(
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> list[VerificationRequestResponse]:
    """Admin: List all verification requests."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row
    from app.services.business_responses import _serialize_verification_request

    # Check admin role
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT role FROM platform_roles WHERE user_id = %s',
                (current_user_id,),
            )
            role = cur.fetchone()
            if not role or role['role'] != 'platform_admin':
                raise HTTPException(status_code=403, detail='Admin access required')

            query = '''
                SELECT * FROM business_verification_requests
                WHERE 1=1
            '''
            params = []

            if status:
                query += ' AND status = %s'
                params.append(status)

            query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

            results = []
            for row in rows:
                cur.execute(
                    'SELECT * FROM business_verification_documents WHERE request_id = %s',
                    (str(row['id']),),
                )
                documents = cur.fetchall()
                results.append(_serialize_verification_request(row, documents))

            return results
