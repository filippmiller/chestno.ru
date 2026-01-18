from fastapi import APIRouter, Depends, Query, Request

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.products import (
    Product,
    ProductCreate,
    ProductUpdate,
    PublicProduct,
    ProductWithVariants,
    ProductVariantCreate,
    VariantAttribute,
    AttributeTemplate,
    AttributeTemplateCreate,
    AttributeTemplateUpdate,
    BulkVariantCreate,
)
from app.services import products as products_service

router = APIRouter(prefix='/api', tags=['products'])
public_router = APIRouter(prefix='/api/public', tags=['public'])


@router.get('/organizations/{organization_id}/products', response_model=list[Product])
async def list_products(
    request: Request,
    organization_id: str,
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[Product]:
    return products_service.list_products(organization_id, current_user_id, status, limit, offset)


@router.post('/organizations/{organization_id}/products', response_model=Product)
async def create_product(
    request: Request,
    organization_id: str,
    payload: ProductCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Product:
    return products_service.create_product(organization_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/products/{product_id}', response_model=Product)
async def get_product(
    request: Request,
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Product:
    return products_service.get_product(organization_id, product_id, current_user_id)


@router.put('/organizations/{organization_id}/products/{product_id}', response_model=Product)
async def update_product(
    request: Request,
    organization_id: str,
    product_id: str,
    payload: ProductUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Product:
    return products_service.update_product(organization_id, product_id, current_user_id, payload)


@router.post('/organizations/{organization_id}/products/{product_id}/archive', response_model=Product)
async def archive_product(
    request: Request,
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Product:
    return products_service.archive_product(organization_id, product_id, current_user_id)


@public_router.get('/organizations/{slug}/products', response_model=list[PublicProduct])
async def public_products(slug: str) -> list[PublicProduct]:
    return products_service.list_public_products_by_org_slug(slug)


@public_router.get('/products/{slug}', response_model=PublicProduct)
async def public_product(slug: str) -> PublicProduct:
    return products_service.get_public_product_by_slug(slug)


# =====================
# Variant Endpoints
# =====================

@router.get('/organizations/{organization_id}/products/{product_id}/with-variants', response_model=ProductWithVariants)
async def get_product_with_variants(
    request: Request,
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ProductWithVariants:
    """Get a product with all its variants."""
    return products_service.get_product_with_variants(organization_id, product_id, current_user_id)


@router.get('/organizations/{organization_id}/products/{product_id}/variants', response_model=list[Product])
async def list_variants(
    request: Request,
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[Product]:
    """List all variants of a product."""
    return products_service.list_variants(organization_id, product_id, current_user_id)


@router.post('/organizations/{organization_id}/products/{product_id}/variants', response_model=Product)
async def create_variant(
    request: Request,
    organization_id: str,
    product_id: str,
    payload: ProductVariantCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Product:
    """Create a variant of a product."""
    return products_service.create_variant(organization_id, product_id, current_user_id, payload)


@router.post('/organizations/{organization_id}/products/{product_id}/variants/bulk', response_model=list[Product])
async def create_bulk_variants(
    request: Request,
    organization_id: str,
    product_id: str,
    payload: BulkVariantCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[Product]:
    """Create multiple variants at once (e.g., size x color matrix)."""
    return products_service.create_bulk_variants(organization_id, product_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/products/{product_id}/attributes', response_model=list[VariantAttribute])
async def get_variant_attributes(
    request: Request,
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[VariantAttribute]:
    """Get attributes for a variant product."""
    return products_service.get_variant_attributes(organization_id, product_id, current_user_id)


@router.delete('/organizations/{organization_id}/variants/{variant_id}')
async def delete_variant(
    request: Request,
    organization_id: str,
    variant_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Delete a variant."""
    products_service.delete_variant(organization_id, variant_id, current_user_id)
    return {'success': True}


# =====================
# Attribute Templates
# =====================

@router.get('/organizations/{organization_id}/attribute-templates', response_model=list[AttributeTemplate])
async def list_attribute_templates(
    request: Request,
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[AttributeTemplate]:
    """List attribute templates for an organization."""
    return products_service.list_attribute_templates(organization_id, current_user_id)


@router.post('/organizations/{organization_id}/attribute-templates', response_model=AttributeTemplate)
async def create_attribute_template(
    request: Request,
    organization_id: str,
    payload: AttributeTemplateCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AttributeTemplate:
    """Create an attribute template."""
    return products_service.create_attribute_template(organization_id, current_user_id, payload)


@router.put('/organizations/{organization_id}/attribute-templates/{template_id}', response_model=AttributeTemplate)
async def update_attribute_template(
    request: Request,
    organization_id: str,
    template_id: str,
    payload: AttributeTemplateUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AttributeTemplate:
    """Update an attribute template."""
    return products_service.update_attribute_template(organization_id, template_id, current_user_id, payload)


@router.delete('/organizations/{organization_id}/attribute-templates/{template_id}')
async def delete_attribute_template(
    request: Request,
    organization_id: str,
    template_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Delete an attribute template."""
    products_service.delete_attribute_template(organization_id, template_id, current_user_id)
    return {'success': True}
