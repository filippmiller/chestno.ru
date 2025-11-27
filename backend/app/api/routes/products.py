from fastapi import APIRouter, Depends, Query

from app.api.routes.auth import get_current_user_id
from app.schemas.products import Product, ProductCreate, ProductUpdate, PublicProduct
from app.services import products as products_service

router = APIRouter(prefix='/api', tags=['products'])
public_router = APIRouter(prefix='/api/public', tags=['public'])


@router.get('/organizations/{organization_id}/products', response_model=list[Product])
async def list_products(
    organization_id: str,
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> list[Product]:
    return products_service.list_products(organization_id, current_user_id, status, limit, offset)


@router.post('/organizations/{organization_id}/products', response_model=Product)
async def create_product(
    organization_id: str,
    payload: ProductCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> Product:
    return products_service.create_product(organization_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/products/{product_id}', response_model=Product)
async def get_product(
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> Product:
    return products_service.get_product(organization_id, product_id, current_user_id)


@router.put('/organizations/{organization_id}/products/{product_id}', response_model=Product)
async def update_product(
    organization_id: str,
    product_id: str,
    payload: ProductUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> Product:
    return products_service.update_product(organization_id, product_id, current_user_id, payload)


@router.post('/organizations/{organization_id}/products/{product_id}/archive', response_model=Product)
async def archive_product(
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> Product:
    return products_service.archive_product(organization_id, product_id, current_user_id)


@public_router.get('/organizations/{slug}/products', response_model=list[PublicProduct])
async def public_products(slug: str) -> list[PublicProduct]:
    return products_service.list_public_products_by_org_slug(slug)


@public_router.get('/products/{slug}', response_model=PublicProduct)
async def public_product(slug: str) -> PublicProduct:
    return products_service.get_public_product_by_slug(slug)

