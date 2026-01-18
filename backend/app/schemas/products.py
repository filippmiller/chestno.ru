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
    # Variant fields
    parent_product_id: Optional[str] = None
    is_variant: bool = False
    sku: Optional[str] = None
    barcode: Optional[str] = None
    stock_quantity: Optional[int] = 0


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
    # Variant fields
    parent_product_id: Optional[str] = None
    is_variant: Optional[bool] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    stock_quantity: Optional[int] = None


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
    # Variant fields for public display
    sku: Optional[str] = None
    is_variant: bool = False


# Variant-specific schemas
class VariantAttribute(BaseModel):
    id: Optional[str] = None
    attribute_name: str
    attribute_value: str
    display_order: int = 0


class VariantAttributeCreate(BaseModel):
    attribute_name: str
    attribute_value: str
    display_order: int = 0


class ProductVariantCreate(BaseModel):
    """Create a variant of an existing product."""
    name: str
    slug: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price_cents: Optional[int] = None
    stock_quantity: Optional[int] = 0
    attributes: List[VariantAttributeCreate] = Field(default_factory=list)


class ProductWithVariants(Product):
    """Product with its variants and attributes."""
    variants: List['Product'] = Field(default_factory=list)
    attributes: List[VariantAttribute] = Field(default_factory=list)
    variant_count: int = 0


class AttributeTemplate(BaseModel):
    """Organization-level attribute template."""
    id: str
    organization_id: str
    attribute_name: str
    possible_values: List[str] = Field(default_factory=list)
    is_required: bool = False
    display_order: int = 0
    created_at: datetime
    updated_at: datetime


class AttributeTemplateCreate(BaseModel):
    attribute_name: str
    possible_values: List[str] = Field(default_factory=list)
    is_required: bool = False
    display_order: int = 0


class AttributeTemplateUpdate(BaseModel):
    attribute_name: Optional[str] = None
    possible_values: Optional[List[str]] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None


class BulkVariantCreate(BaseModel):
    """Create multiple variants at once (e.g., size × color matrix)."""
    attribute_combinations: List[List[VariantAttributeCreate]]
    base_price_cents: Optional[int] = None
    base_stock_quantity: Optional[int] = 0


