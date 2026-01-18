from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class LayoutBlock(BaseModel):
    """Individual block in layout JSON."""
    id: str
    type: Literal['logo', 'text', 'qr', 'image', 'shape']
    binding: str | None = None  # e.g., business.name, business.qr.profile
    x: float
    y: float
    width: float | None = None
    height: float | None = None
    size: float | None = None  # For QR codes
    unit: str = 'mm'
    editable_by_business: bool = True
    editable_by_support: bool = True
    # Text-specific
    text: str | None = None
    fontFamily: str | None = None
    fontSizePt: float | None = None
    fontWeight: str | None = None
    align: str | None = None
    color: str | None = None
    # QR-specific
    qr_url: str | None = None


class LayoutPaper(BaseModel):
    """Paper settings in layout."""
    size: str = 'A4'
    orientation: str = 'portrait'
    width_mm: float
    height_mm: float


class LayoutTheme(BaseModel):
    """Theme settings in layout."""
    background: str = '#FFFFFF'
    primaryColor: str = '#1a1a1a'
    accentColor: str = '#2563eb'


class LayoutJson(BaseModel):
    """Full layout JSON structure."""
    version: int = 1
    paper: LayoutPaper
    theme: LayoutTheme
    blocks: list[LayoutBlock] = Field(default_factory=list)


# ============================================
# Marketing Templates (global)
# ============================================

class MarketingTemplateBase(BaseModel):
    template_key: str
    name: str
    description: str | None = None
    paper_size: Literal['A3', 'A4', 'A5'] = 'A4'
    orientation: Literal['portrait', 'landscape'] = 'portrait'


class MarketingTemplate(MarketingTemplateBase):
    id: str
    layout_schema_version: int = 1
    layout_json: dict[str, Any]
    thumbnail_url: str | None = None
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarketingTemplatesResponse(BaseModel):
    items: list[MarketingTemplate]
    total: int


# ============================================
# Marketing Materials (business instances)
# ============================================

class MarketingMaterialBase(BaseModel):
    name: str
    paper_size: Literal['A3', 'A4', 'A5'] = 'A4'
    orientation: Literal['portrait', 'landscape'] = 'portrait'


class MarketingMaterialCreate(BaseModel):
    template_id: str
    name: str | None = None  # Optional, defaults to template name


class MarketingMaterialUpdate(BaseModel):
    name: str | None = None
    layout_json: dict[str, Any] | None = None


class MarketingMaterialAdminUpdate(MarketingMaterialUpdate):
    """Admin/support can also update support_notes."""
    support_notes: str | None = None


class MarketingMaterial(MarketingMaterialBase):
    id: str
    business_id: str
    template_id: str | None = None
    layout_schema_version: int = 1
    layout_json: dict[str, Any]
    is_default_for_business: bool = False
    support_notes: str | None = None
    created_by_user_id: str | None = None
    updated_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarketingMaterialWithTemplate(MarketingMaterial):
    """Material with template info for display."""
    template: MarketingTemplate | None = None


class MarketingMaterialsResponse(BaseModel):
    items: list[MarketingMaterial]
    total: int
