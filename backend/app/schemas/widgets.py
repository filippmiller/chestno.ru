"""
Widget Schemas

Pydantic schemas for embeddable trust widget configuration and responses.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class WidgetSize(str, Enum):
    """Widget display sizes"""
    SMALL = "small"      # Badge only
    MEDIUM = "medium"    # Badge + rating
    LARGE = "large"      # Badge + rating + reviews summary


class WidgetTheme(str, Enum):
    """Widget color themes"""
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"  # Follows system preference


class WidgetConfig(BaseModel):
    """Widget configuration options"""
    size: WidgetSize = WidgetSize.MEDIUM
    theme: WidgetTheme = WidgetTheme.LIGHT
    primary_color: Optional[str] = Field(
        default=None,
        description="Custom primary color (hex, e.g., #3B82F6)",
        pattern=r"^#[0-9A-Fa-f]{6}$"
    )
    show_logo: bool = True
    show_reviews_count: bool = True
    show_rating: bool = True
    language: Literal["ru", "en"] = "ru"
    border_radius: int = Field(default=8, ge=0, le=24)


class WidgetOrganizationData(BaseModel):
    """Organization data needed for widget rendering"""
    organization_id: str
    name: str
    slug: str
    status_level: Literal["0", "A", "B", "C"]
    star_rating: Optional[float] = None
    review_count: int = 0
    verified_since: Optional[str] = None


class WidgetEmbedCode(BaseModel):
    """Embed code response for widget configurator"""
    script_tag: str
    iframe_code: str
    preview_url: str


class WidgetPreviewRequest(BaseModel):
    """Request body for widget preview generation"""
    config: WidgetConfig


class WidgetConfigResponse(BaseModel):
    """Response with current widget configuration"""
    organization_id: str
    config: WidgetConfig
    embed_code: WidgetEmbedCode
    preview_html: str
