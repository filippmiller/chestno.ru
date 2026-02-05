"""
Trust Circles Schemas
Pydantic models for private product recommendation groups feature.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TrustCircleCreate(BaseModel):
    """Schema for creating a trust circle."""
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    is_private: bool = True


class TrustCircleUpdate(BaseModel):
    """Schema for updating a trust circle."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    is_private: Optional[bool] = None


class TrustCircle(BaseModel):
    """Schema for a trust circle."""
    id: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    is_private: bool
    invite_code: str
    owner_id: str
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CircleMember(BaseModel):
    """Schema for a circle member."""
    id: str
    circle_id: str
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    role: str  # owner, admin, member
    joined_at: datetime

    class Config:
        from_attributes = True


class SharedProductCreate(BaseModel):
    """Schema for sharing a product to a circle."""
    product_id: str
    note: Optional[str] = Field(None, max_length=500)
    rating: Optional[int] = Field(None, ge=1, le=5)


class SharedProduct(BaseModel):
    """Schema for a shared product in a circle."""
    id: str
    circle_id: str
    product_id: str
    shared_by_id: str
    shared_by_name: Optional[str] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    organization_name: Optional[str] = None
    note: Optional[str] = None
    rating: Optional[int] = None
    likes_count: int = 0
    comments_count: int = 0
    shared_at: datetime

    class Config:
        from_attributes = True


class ProductCommentCreate(BaseModel):
    """Schema for adding a comment to a shared product."""
    content: str = Field(..., min_length=1, max_length=1000)


class ProductComment(BaseModel):
    """Schema for a comment on a shared product."""
    id: str
    shared_product_id: str
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class CircleInvite(BaseModel):
    """Schema for a circle invite."""
    circle_id: str
    circle_name: str
    invite_code: str
    invited_by: Optional[str] = None
    member_count: int


class CircleStats(BaseModel):
    """Statistics about a trust circle."""
    member_count: int
    shared_products_count: int
    total_likes: int
    total_comments: int
    most_active_members: List[Dict[str, Any]] = []
    top_shared_products: List[Dict[str, Any]] = []
