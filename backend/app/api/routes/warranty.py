"""
Warranty Management API Routes
REST API endpoints for warranty registration, claims, and management.
"""

from datetime import date
from typing import Literal, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.warranty import (
    WarrantyRegistration,
    WarrantyRegistrationCreate,
    WarrantyRegistrationWithProduct,
    WarrantyRegistrationsResponse,
    WarrantyClaim,
    WarrantyClaimCreate,
    WarrantyClaimUpdate,
    WarrantyClaimWithDetails,
    WarrantyClaimsResponse,
    WarrantyValidityResponse,
    WarrantyPolicy,
    WarrantyPolicyCreate,
    WarrantyStatsResponse,
    WarrantyClaimHistoryEntry,
)

logger = logging.getLogger(__name__)

# Consumer routes (authenticated users)
router = APIRouter(prefix='/api/warranty', tags=['warranty'])

# Organization routes (business management)
org_router = APIRouter(prefix='/api/organizations', tags=['warranty-business'])


# ==================== Consumer Routes ====================

@router.post('/register', response_model=WarrantyRegistrationWithProduct)
async def register_warranty(
    payload: WarrantyRegistrationCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyRegistrationWithProduct:
    """
    Register a warranty for a purchased product.

    Can be triggered via QR code scan or manual registration.
    Automatically calculates warranty period based on organization policy.

    Args:
        payload: Registration details including product_id and purchase_date

    Returns:
        Created warranty registration with product details

    Errors:
        404: Product not found
        409: Warranty already registered for this product
        400: Registration deadline passed (if applicable)
    """
    from app.services.warranty import register_warranty as register_fn

    try:
        result = await run_in_threadpool(
            register_fn,
            user_id=current_user_id,
            product_id=payload.product_id,
            purchase_date=payload.purchase_date,
            qr_code_id=payload.qr_code_id,
            serial_number=payload.serial_number,
            purchase_location=payload.purchase_location,
            purchase_proof_url=payload.purchase_proof_url,
            contact_email=payload.contact_email,
            contact_phone=payload.contact_phone
        )
        return WarrantyRegistrationWithProduct(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error registering warranty: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to register warranty: {str(e)}'
        )


@router.get('/my', response_model=WarrantyRegistrationsResponse)
async def get_my_warranties(
    status_filter: Optional[Literal['pending', 'active', 'expired', 'voided', 'transferred']] = Query(
        None, alias='status', description='Filter by warranty status'
    ),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyRegistrationsResponse:
    """
    Get all warranties registered by the current user.

    Returns:
        Paginated list of warranty registrations with product details
    """
    from app.services.warranty import get_user_warranties

    try:
        items, total = await run_in_threadpool(
            get_user_warranties,
            user_id=current_user_id,
            status_filter=status_filter,
            page=page,
            per_page=per_page
        )
        return WarrantyRegistrationsResponse(
            items=[WarrantyRegistrationWithProduct(**item) for item in items],
            total=total
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting user warranties: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve warranties: {str(e)}'
        )


@router.get('/{registration_id}', response_model=WarrantyRegistrationWithProduct)
async def get_warranty_details(
    registration_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyRegistrationWithProduct:
    """
    Get detailed information about a specific warranty registration.

    Accessible by:
    - The warranty owner
    - Organization members of the product's organization

    Returns:
        Full warranty details including product, organization, and policy info
    """
    from app.services.warranty import get_warranty_details as get_details

    try:
        result = await run_in_threadpool(
            get_details,
            registration_id=registration_id,
            user_id=current_user_id
        )
        return WarrantyRegistrationWithProduct(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting warranty details: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve warranty details: {str(e)}'
        )


@router.get('/{registration_id}/validity', response_model=WarrantyValidityResponse)
async def check_warranty_validity(
    registration_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyValidityResponse:
    """
    Check if a warranty is currently valid.

    Returns:
        Validity status, days remaining, and human-readable message
    """
    from app.services.warranty import check_warranty_validity as check_fn

    try:
        result = await run_in_threadpool(check_fn, registration_id)
        return WarrantyValidityResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error checking warranty validity: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to check warranty validity: {str(e)}'
        )


@router.post('/{registration_id}/claim', response_model=WarrantyClaimWithDetails)
async def submit_warranty_claim(
    registration_id: str,
    payload: WarrantyClaimCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyClaimWithDetails:
    """
    Submit a warranty claim for a registered product.

    Requirements:
    - Must be the warranty owner
    - Warranty must be active and not expired

    Args:
        registration_id: Warranty registration ID
        payload: Claim details (type, description, photos)

    Returns:
        Created warranty claim

    Errors:
        403: Not the warranty owner
        400: Warranty not active or expired
    """
    from app.services.warranty import submit_claim

    try:
        result = await run_in_threadpool(
            submit_claim,
            registration_id=registration_id,
            user_id=current_user_id,
            claim_type=payload.claim_type,
            description=payload.description,
            photos=payload.photos
        )
        return WarrantyClaimWithDetails(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error submitting warranty claim: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to submit warranty claim: {str(e)}'
        )


@router.get('/claims/my', response_model=WarrantyClaimsResponse)
async def get_my_claims(
    status_filter: Optional[str] = Query(None, alias='status'),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyClaimsResponse:
    """
    Get all warranty claims submitted by the current user.

    Returns:
        Paginated list of claims with product details
    """
    from app.services.warranty import get_user_claims

    try:
        items, total = await run_in_threadpool(
            get_user_claims,
            user_id=current_user_id,
            status_filter=status_filter,
            page=page,
            per_page=per_page
        )
        return WarrantyClaimsResponse(
            items=[WarrantyClaimWithDetails(**item) for item in items],
            total=total
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting user claims: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve claims: {str(e)}'
        )


@router.get('/claims/{claim_id}/history', response_model=list[WarrantyClaimHistoryEntry])
async def get_claim_history(
    claim_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[WarrantyClaimHistoryEntry]:
    """
    Get status change history for a warranty claim.

    Returns:
        List of history entries showing status changes
    """
    from app.services.warranty import get_claim_history as get_history

    try:
        result = await run_in_threadpool(get_history, claim_id)
        return [WarrantyClaimHistoryEntry(**entry) for entry in result]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting claim history: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve claim history: {str(e)}'
        )


# ==================== Organization Routes ====================

@org_router.get('/{organization_id}/warranty/claims', response_model=WarrantyClaimsResponse)
async def get_organization_claims(
    organization_id: str,
    status_filter: Optional[str] = Query(None, alias='status'),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyClaimsResponse:
    """
    Get all warranty claims for an organization's products.

    Requires organization membership.
    Claims are sorted by priority (urgent first) then by creation date.

    Returns:
        Paginated list of claims with customer details
    """
    from app.services.warranty import get_organization_claims

    # TODO: Verify user is org member (add middleware or check here)

    try:
        items, total = await run_in_threadpool(
            get_organization_claims,
            organization_id=organization_id,
            status_filter=status_filter,
            page=page,
            per_page=per_page
        )
        return WarrantyClaimsResponse(
            items=[WarrantyClaimWithDetails(**item) for item in items],
            total=total
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting organization claims: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve organization claims: {str(e)}'
        )


@org_router.put('/{organization_id}/warranty/claims/{claim_id}', response_model=WarrantyClaim)
async def update_claim_status(
    organization_id: str,
    claim_id: str,
    payload: WarrantyClaimUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyClaim:
    """
    Update a warranty claim status.

    Requires organization membership with appropriate role.
    Can update status, priority, assignment, and resolution details.

    Returns:
        Updated claim record
    """
    from app.services.warranty import update_claim_status as update_fn

    # TODO: Verify user is org member with manager+ role

    try:
        result = await run_in_threadpool(
            update_fn,
            claim_id=claim_id,
            updated_by=current_user_id,
            status=payload.status,
            priority=payload.priority,
            assigned_to=payload.assigned_to,
            resolution_notes=payload.resolution_notes,
            resolution_type=payload.resolution_type
        )
        return WarrantyClaim(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error updating claim: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to update claim: {str(e)}'
        )


@org_router.get('/{organization_id}/warranty/stats', response_model=WarrantyStatsResponse)
async def get_warranty_stats(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyStatsResponse:
    """
    Get warranty statistics for an organization.

    Returns:
        Statistics including registration counts, claim counts, and averages
    """
    from app.services.warranty import get_organization_warranty_stats

    try:
        result = await run_in_threadpool(get_organization_warranty_stats, organization_id)
        return WarrantyStatsResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting warranty stats: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve warranty statistics: {str(e)}'
        )


@org_router.get('/{organization_id}/warranty/policies', response_model=list[WarrantyPolicy])
async def list_warranty_policies(
    organization_id: str,
    include_inactive: bool = Query(default=False),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[WarrantyPolicy]:
    """
    List all warranty policies for an organization.

    Returns:
        List of warranty policies
    """
    from app.services.warranty import list_organization_policies

    try:
        result = await run_in_threadpool(
            list_organization_policies,
            organization_id=organization_id,
            include_inactive=include_inactive
        )
        return [WarrantyPolicy(**policy) for policy in result]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error listing warranty policies: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve warranty policies: {str(e)}'
        )


@org_router.post('/{organization_id}/warranty/policies', response_model=WarrantyPolicy)
async def create_warranty_policy(
    organization_id: str,
    payload: WarrantyPolicyCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> WarrantyPolicy:
    """
    Create a new warranty policy for an organization.

    Requires organization membership with manager+ role.

    Returns:
        Created warranty policy
    """
    from app.services.warranty import create_warranty_policy as create_fn

    # TODO: Verify user is org member with manager+ role

    try:
        result = await run_in_threadpool(
            create_fn,
            organization_id=organization_id,
            product_category=payload.product_category,
            duration_months=payload.duration_months,
            coverage_description=payload.coverage_description,
            terms=payload.terms,
            is_transferable=payload.is_transferable,
            requires_registration=payload.requires_registration,
            registration_deadline_days=payload.registration_deadline_days
        )
        return WarrantyPolicy(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error creating warranty policy: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create warranty policy: {str(e)}'
        )
