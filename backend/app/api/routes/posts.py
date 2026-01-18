from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.posts import (
    OrganizationPost,
    OrganizationPostCreate,
    OrganizationPostUpdate,
    OrganizationPostsResponse,
    PublicOrganizationPost,
    PublicOrganizationPostsResponse,
)
from app.services.posts import (
    create_organization_post,
    delete_organization_post,
    get_organization_post,
    get_public_organization_post,
    list_organization_posts,
    list_public_organization_posts,
    update_organization_post,
)

from .auth import get_current_user_id

router = APIRouter(prefix='/api/organizations', tags=['posts'])
public_router = APIRouter(prefix='/api/public/organizations', tags=['posts'])


@router.get('/{organization_id}/posts', response_model=OrganizationPostsResponse)
async def list_posts(
    organization_id: str,
    status: str | None = Query(default=None, pattern='^(draft|published|archived)$'),
    search: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationPostsResponse:
    """Список постов организации (для кабинета)."""
    items, total = await run_in_threadpool(
        list_organization_posts,
        organization_id,
        current_user_id,
        status,
        search,
        limit,
        offset,
    )
    return OrganizationPostsResponse(items=items, total=total)


@router.get('/{organization_id}/posts/{post_id}', response_model=OrganizationPost)
async def get_post(
    organization_id: str,
    post_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationPost:
    """Получить пост по ID."""
    post = await run_in_threadpool(get_organization_post, organization_id, post_id, current_user_id)
    if not post:
        raise HTTPException(status_code=404, detail='Post not found')
    return post


@router.post('/{organization_id}/posts', response_model=OrganizationPost, status_code=201)
async def create_post(
    organization_id: str,
    payload: OrganizationPostCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationPost:
    """Создать новый пост."""
    try:
        return await run_in_threadpool(
            create_organization_post,
            organization_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch('/{organization_id}/posts/{post_id}', response_model=OrganizationPost)
async def update_post(
    organization_id: str,
    post_id: str,
    payload: OrganizationPostUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationPost:
    """Обновить пост."""
    try:
        return await run_in_threadpool(
            update_organization_post,
            organization_id,
            post_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete('/{organization_id}/posts/{post_id}', status_code=204)
async def delete_post(
    organization_id: str,
    post_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Удалить пост."""
    try:
        await run_in_threadpool(
            delete_organization_post,
            organization_id,
            post_id,
            current_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# Public routes
# ============================================


@public_router.get('/by-slug/{slug}/posts', response_model=PublicOrganizationPostsResponse)
async def public_list_posts(
    slug: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PublicOrganizationPostsResponse:
    """Список опубликованных постов организации (публичный API)."""
    items, total = await run_in_threadpool(
        list_public_organization_posts,
        slug,
        limit,
        offset,
    )
    return PublicOrganizationPostsResponse(items=items, total=total)


@public_router.get('/{organization_id}/posts', response_model=PublicOrganizationPostsResponse)
async def public_list_posts_by_id(
    organization_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PublicOrganizationPostsResponse:
    """Список опубликованных постов организации по ID (публичный API)."""
    from app.services.posts import list_public_organization_posts_by_id
    items, total = await run_in_threadpool(
        list_public_organization_posts_by_id,
        organization_id,
        limit,
        offset,
    )
    return PublicOrganizationPostsResponse(items=items, total=total)


@public_router.get('/by-slug/{slug}/posts/{post_slug}', response_model=PublicOrganizationPost)
async def public_get_post(
    slug: str,
    post_slug: str,
) -> PublicOrganizationPost:
    """Получить опубликованный пост по slug (публичный API)."""
    post = await run_in_threadpool(get_public_organization_post, slug, post_slug)
    if not post:
        raise HTTPException(status_code=404, detail='Post not found')
    return post

