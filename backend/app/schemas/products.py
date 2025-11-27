from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str
    slug: str
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = 'RUB'
    status: Optional[str] = 'draft'
    is_featured: bool = False
    main_image_url: Optional[str] = None
    gallery: Optional[List[dict]] = None
    external_url: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    is_featured: Optional[bool] = None
    main_image_url: Optional[str] = None
    gallery: Optional[List[dict]] = None
    external_url: Optional[str] = None


class Product(ProductBase):
    id: str
    organization_id: str
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PublicProduct(BaseModel):
    id: str
    organization_id: str
    slug: str
    name: str
    short_description: Optional[str] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = 'RUB'
    main_image_url: Optional[str] = None
    external_url: Optional[str] = None


