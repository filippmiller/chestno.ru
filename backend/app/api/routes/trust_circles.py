"""
API routes for Trust Circles feature.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Optional

from app.services.trust_circles import (
    create_circle,
    get_circle,
    list_user_circles,
    get_circle_members,
    join_by_invite_code,
    create_invite,
    accept_invite,
    leave_circle,
    share_product,
    get_circle_products,
    like_shared_product,
    unlike_shared_product,
    add_comment,
    get_product_comments,
    get_circle_activity,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/circles', tags=['circles'])


# Request models
class CircleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = True
    icon: Optional[str] = None
    color: Optional[str] = None


class InviteCreate(BaseModel):
    invitee_email: str


class ShareProduct(BaseModel):
    product_id: str
    recommendation: Optional[str] = None
    rating: Optional[int] = None


class CommentCreate(BaseModel):
    content: str


# Circle management
@router.post('')
async def create_new_circle(
    payload: CircleCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Create a new trust circle."""
    result = await run_in_threadpool(
        create_circle,
        current_user_id,
        payload.name,
        payload.description,
        payload.is_private,
        payload.icon,
        payload.color,
    )
    return result


@router.get('')
async def get_my_circles(
    current_user_id: str = Depends(get_current_user_id),
):
    """List all circles user belongs to."""
    circles = await run_in_threadpool(list_user_circles, current_user_id)
    return {'circles': circles}


@router.get('/{circle_id}')
async def get_circle_details(
    circle_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get circle details (must be a member)."""
    circle = await run_in_threadpool(get_circle, circle_id, current_user_id)
    return circle


@router.get('/{circle_id}/members')
async def list_circle_members(
    circle_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get all members of a circle."""
    members = await run_in_threadpool(get_circle_members, circle_id, current_user_id)
    return {'members': members}


@router.post('/{circle_id}/leave')
async def leave_trust_circle(
    circle_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Leave a circle."""
    await run_in_threadpool(leave_circle, circle_id, current_user_id)
    return {'success': True}


# Invitations
@router.post('/join')
async def join_by_code(
    code: str = Query(..., min_length=6),
    current_user_id: str = Depends(get_current_user_id),
):
    """Join a circle using an invite code."""
    result = await run_in_threadpool(join_by_invite_code, current_user_id, code)
    return result


@router.post('/{circle_id}/invites')
async def create_circle_invite(
    circle_id: str,
    payload: InviteCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Create an invitation for someone to join the circle."""
    result = await run_in_threadpool(
        create_invite,
        circle_id,
        current_user_id,
        payload.invitee_email,
    )
    return result


@router.post('/invites/{invite_token}/accept')
async def accept_circle_invite(
    invite_token: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Accept an invitation to join a circle."""
    result = await run_in_threadpool(accept_invite, invite_token, current_user_id)
    return result


# Shared products
@router.post('/{circle_id}/products')
async def share_product_to_circle(
    circle_id: str,
    payload: ShareProduct,
    current_user_id: str = Depends(get_current_user_id),
):
    """Share a product with the circle."""
    result = await run_in_threadpool(
        share_product,
        circle_id,
        current_user_id,
        payload.product_id,
        payload.recommendation,
        payload.rating,
    )
    return result


@router.get('/{circle_id}/products')
async def list_circle_products(
    circle_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get products shared in a circle."""
    products, total = await run_in_threadpool(
        get_circle_products,
        circle_id,
        current_user_id,
        limit,
        offset,
    )
    return {'items': products, 'total': total}


@router.post('/products/{shared_product_id}/like')
async def like_product(
    shared_product_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Like a shared product."""
    await run_in_threadpool(like_shared_product, shared_product_id, current_user_id)
    return {'success': True}


@router.delete('/products/{shared_product_id}/like')
async def unlike_product(
    shared_product_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Unlike a shared product."""
    await run_in_threadpool(unlike_shared_product, shared_product_id, current_user_id)
    return {'success': True}


@router.post('/products/{shared_product_id}/comments')
async def add_product_comment(
    shared_product_id: str,
    payload: CommentCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Add a comment to a shared product."""
    result = await run_in_threadpool(
        add_comment,
        shared_product_id,
        current_user_id,
        payload.content,
    )
    return result


@router.get('/products/{shared_product_id}/comments')
async def get_comments(
    shared_product_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get comments for a shared product."""
    comments = await run_in_threadpool(
        get_product_comments,
        shared_product_id,
        current_user_id,
    )
    return {'comments': comments}


# Activity feed
@router.get('/{circle_id}/activity')
async def get_activity_feed(
    circle_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get recent activity in a circle."""
    activity = await run_in_threadpool(
        get_circle_activity,
        circle_id,
        current_user_id,
        limit,
    )
    return {'activity': activity}
