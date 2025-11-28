from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GalleryItem(BaseModel):
    url: str
    alt: str | None = None
    sort_order: int | None = None


class OrganizationPostBase(BaseModel):
    slug: str
    title: str
    excerpt: str | None = None
    body: str
    status: Literal['draft', 'published', 'archived'] = 'draft'
    main_image_url: str | None = None
    gallery: list[GalleryItem] = Field(default_factory=list)
    video_url: str | None = None
    is_pinned: bool = False


class OrganizationPostCreate(OrganizationPostBase):
    pass


class OrganizationPostUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    excerpt: str | None = None
    body: str | None = None
    status: Literal['draft', 'published', 'archived'] | None = None
    main_image_url: str | None = None
    gallery: list[GalleryItem] | None = None
    video_url: str | None = None
    is_pinned: bool | None = None
    published_at: datetime | None = None


class OrganizationPost(OrganizationPostBase):
    id: str
    organization_id: str
    author_user_id: str
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicOrganizationPost(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: str | None = None
    body: str
    main_image_url: str | None = None
    gallery: list[GalleryItem] = Field(default_factory=list)
    video_url: str | None = None
    published_at: datetime
    is_pinned: bool = False


class OrganizationPostsResponse(BaseModel):
    items: list[OrganizationPost]
    total: int


class PublicOrganizationPostsResponse(BaseModel):
    items: list[PublicOrganizationPost]
    total: int

