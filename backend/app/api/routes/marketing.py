"""
Marketing Materials API Routes

Provides endpoints for:
- Listing active templates (public)
- CRUD operations on materials (organization-scoped)
- Admin endpoints for support team
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.marketing import (
    MarketingMaterial,
    MarketingMaterialCreate,
    MarketingMaterialUpdate,
    MarketingMaterialAdminUpdate,
    MarketingMaterialsResponse,
    MarketingTemplate,
    MarketingTemplatesResponse,
)
from app.services.marketing import (
    admin_list_materials,
    admin_update_material,
    create_material,
    delete_material,
    get_material,
    get_template,
    list_materials,
    list_templates,
    update_material,
)

from .auth import get_current_user_id

# ============================================
# Public routes (templates)
# ============================================

router = APIRouter(prefix='/api/marketing', tags=['marketing'])


@router.get('/templates', response_model=MarketingTemplatesResponse)
async def api_list_templates() -> MarketingTemplatesResponse:
    """List all active marketing templates."""
    items, total = await run_in_threadpool(list_templates)
    return MarketingTemplatesResponse(items=items, total=total)


@router.get('/templates/{template_id}', response_model=MarketingTemplate)
async def api_get_template(template_id: str) -> MarketingTemplate:
    """Get a specific template."""
    template = await run_in_threadpool(get_template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail='Шаблон не найден')
    return template


# ============================================
# Organization-scoped routes (materials)
# ============================================

org_router = APIRouter(prefix='/api/organizations', tags=['marketing'])


@org_router.get('/{organization_id}/marketing/materials', response_model=MarketingMaterialsResponse)
async def api_list_materials(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterialsResponse:
    """List all marketing materials for an organization."""
    items, total = await run_in_threadpool(list_materials, organization_id, current_user_id)
    return MarketingMaterialsResponse(items=items, total=total)


@org_router.get('/{organization_id}/marketing/materials/{material_id}', response_model=MarketingMaterial)
async def api_get_material(
    organization_id: str,
    material_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterial:
    """Get a specific material."""
    material = await run_in_threadpool(get_material, organization_id, material_id, current_user_id)
    if not material:
        raise HTTPException(status_code=404, detail='Материал не найден')
    return material


@org_router.post('/{organization_id}/marketing/materials', response_model=MarketingMaterial, status_code=201)
async def api_create_material(
    organization_id: str,
    payload: MarketingMaterialCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterial:
    """Create a new marketing material from a template."""
    return await run_in_threadpool(create_material, organization_id, current_user_id, payload)


@org_router.patch('/{organization_id}/marketing/materials/{material_id}', response_model=MarketingMaterial)
async def api_update_material(
    organization_id: str,
    material_id: str,
    payload: MarketingMaterialUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterial:
    """Update a marketing material."""
    return await run_in_threadpool(update_material, organization_id, material_id, current_user_id, payload)


@org_router.delete('/{organization_id}/marketing/materials/{material_id}', status_code=204)
async def api_delete_material(
    organization_id: str,
    material_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete a marketing material."""
    await run_in_threadpool(delete_material, organization_id, material_id, current_user_id)


# ============================================
# Admin routes (support team)
# ============================================

admin_router = APIRouter(prefix='/api/admin/marketing', tags=['admin-marketing'])


@admin_router.get('/materials', response_model=MarketingMaterialsResponse)
async def api_admin_list_materials(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterialsResponse:
    """List all marketing materials (admin/support only)."""
    items, total = await run_in_threadpool(admin_list_materials, current_user_id, limit, offset)
    return MarketingMaterialsResponse(items=items, total=total)


@admin_router.patch('/materials/{material_id}', response_model=MarketingMaterial)
async def api_admin_update_material(
    material_id: str,
    payload: MarketingMaterialAdminUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> MarketingMaterial:
    """Update any marketing material (admin/support - can edit all blocks)."""
    return await run_in_threadpool(admin_update_material, material_id, current_user_id, payload)
