"""
API routes for Consumer Verification Challenges.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Optional

from app.services.verification_challenges import (
    create_challenge,
    list_organization_challenges,
    list_public_challenges,
    approve_challenge,
    reject_challenge,
    respond_to_challenge,
    vote_on_challenge,
    get_challenge_stats,
    CHALLENGE_CATEGORIES,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/challenges', tags=['challenges'])
public_router = APIRouter(prefix='/api/public/challenges', tags=['challenges'])
org_router = APIRouter(prefix='/api/organizations', tags=['challenges'])


# Request/Response models
class ChallengeCreate(BaseModel):
    organization_id: str
    product_id: Optional[str] = None
    category: str
    claim_text: str
    challenge_question: str


class ChallengeResponse(BaseModel):
    response_text: str
    evidence_urls: Optional[List[dict]] = None


class ChallengeVote(BaseModel):
    vote_type: str  # 'satisfied' or 'unsatisfied'


class ChallengeReject(BaseModel):
    reason: str


# Consumer endpoints
@router.post('')
async def create_new_challenge(
    payload: ChallengeCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Create a new verification challenge (requires moderation)."""
    result = await run_in_threadpool(
        create_challenge,
        payload.organization_id,
        current_user_id,
        payload.category,
        payload.claim_text,
        payload.challenge_question,
        payload.product_id,
    )
    return result


@router.get('/categories')
async def get_categories():
    """Get available challenge categories."""
    return {'categories': CHALLENGE_CATEGORIES}


@router.post('/{challenge_id}/vote')
async def vote_challenge(
    challenge_id: str,
    payload: ChallengeVote,
    current_user_id: str = Depends(get_current_user_id),
):
    """Vote on whether a challenge response was satisfactory."""
    return await run_in_threadpool(
        vote_on_challenge,
        challenge_id,
        current_user_id,
        payload.vote_type,
    )


# Public endpoints
@public_router.get('/organization/{organization_id}')
async def list_public_org_challenges(
    organization_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List public challenges for an organization (active, responded, expired)."""
    challenges, total = await run_in_threadpool(
        list_public_challenges,
        organization_id,
        limit,
        offset,
    )
    return {'items': challenges, 'total': total}


# Organization endpoints (business dashboard)
@org_router.get('/{organization_id}/challenges')
async def list_org_challenges(
    organization_id: str,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
):
    """List challenges for organization dashboard."""
    challenges, total = await run_in_threadpool(
        list_organization_challenges,
        organization_id,
        current_user_id,
        status,
        limit,
        offset,
    )
    return {'items': challenges, 'total': total}


@org_router.get('/{organization_id}/challenges/stats')
async def get_org_challenge_stats(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get challenge statistics for an organization."""
    return await run_in_threadpool(get_challenge_stats, organization_id)


@org_router.post('/{organization_id}/challenges/{challenge_id}/respond')
async def respond_to_org_challenge(
    organization_id: str,
    challenge_id: str,
    payload: ChallengeResponse,
    current_user_id: str = Depends(get_current_user_id),
):
    """Respond to a challenge from the organization."""
    return await run_in_threadpool(
        respond_to_challenge,
        challenge_id,
        current_user_id,
        payload.response_text,
        payload.evidence_urls,
    )


# Moderation endpoints
mod_router = APIRouter(prefix='/api/moderation/challenges', tags=['moderation'])


@mod_router.post('/{challenge_id}/approve')
async def approve_mod_challenge(
    challenge_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Approve a pending challenge (moderator only)."""
    return await run_in_threadpool(approve_challenge, challenge_id, current_user_id)


@mod_router.post('/{challenge_id}/reject')
async def reject_mod_challenge(
    challenge_id: str,
    payload: ChallengeReject,
    current_user_id: str = Depends(get_current_user_id),
):
    """Reject a pending challenge (moderator only)."""
    return await run_in_threadpool(reject_challenge, challenge_id, current_user_id, payload.reason)
