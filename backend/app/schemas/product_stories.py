"""
Product Stories Schemas

Pydantic models for the product stories feature.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# CONTENT TYPE ENUM
# ============================================================

ContentType = Literal['TEXT', 'IMAGE', 'VIDEO', 'GALLERY', 'QUIZ']
StoryStatus = Literal['draft', 'published', 'archived']


# ============================================================
# QUIZ SCHEMAS
# ============================================================

class QuizOption(BaseModel):
    """Single quiz option"""
    id: str
    text: str
    is_correct: bool = False


class QuizAnswer(BaseModel):
    """User's answer to a quiz"""
    chapter_id: str
    selected_option_id: str


# ============================================================
# CHAPTER SCHEMAS
# ============================================================

class StoryChapterBase(BaseModel):
    """Base schema for story chapters"""
    order_index: int = 0
    title: Optional[str] = None
    content_type: ContentType = 'TEXT'
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_urls: Optional[list[str]] = None
    duration_seconds: int = 5
    quiz_question: Optional[str] = None
    quiz_options: Optional[list[QuizOption]] = None
    quiz_explanation: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None


class StoryChapterCreate(StoryChapterBase):
    """Schema for creating a story chapter"""
    pass


class StoryChapterUpdate(BaseModel):
    """Schema for updating a story chapter"""
    order_index: Optional[int] = None
    title: Optional[str] = None
    content_type: Optional[ContentType] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_urls: Optional[list[str]] = None
    duration_seconds: Optional[int] = None
    quiz_question: Optional[str] = None
    quiz_options: Optional[list[QuizOption]] = None
    quiz_explanation: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None


class StoryChapter(StoryChapterBase):
    """Full story chapter record"""
    id: str
    story_id: str
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# STORY SCHEMAS
# ============================================================

class ProductStoryBase(BaseModel):
    """Base schema for product stories"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    cover_image: Optional[str] = None


class ProductStoryCreate(ProductStoryBase):
    """Schema for creating a product story"""
    product_id: str
    organization_id: str
    chapters: Optional[list[StoryChapterCreate]] = None


class ProductStoryUpdate(BaseModel):
    """Schema for updating a product story"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    cover_image: Optional[str] = None
    status: Optional[StoryStatus] = None


class ProductStory(ProductStoryBase):
    """Full product story record"""
    id: str
    product_id: str
    organization_id: str
    created_by: Optional[str] = None
    status: StoryStatus
    published_at: Optional[datetime] = None
    view_count: int = 0
    completion_count: int = 0
    avg_time_spent_seconds: int = 0
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    # Nested chapters (optional, populated when requested)
    chapters: Optional[list[StoryChapter]] = None


class ProductStoryWithProduct(ProductStory):
    """Story with product details"""
    product_name: Optional[str] = None
    product_slug: Optional[str] = None
    product_image: Optional[str] = None


# ============================================================
# INTERACTION SCHEMAS
# ============================================================

class StoryInteractionBase(BaseModel):
    """Base schema for story interactions"""
    completed_chapters: list[int] = Field(default_factory=list)
    last_chapter_index: int = 0
    total_time_spent: int = 0


class StoryInteractionCreate(BaseModel):
    """Schema for creating/updating a story interaction"""
    story_id: str
    session_id: Optional[str] = None
    chapter_index: Optional[int] = None
    time_spent: Optional[int] = None  # Seconds spent on current chapter
    quiz_answer: Optional[QuizAnswer] = None
    completed: bool = False
    device_type: Optional[str] = None
    referrer: Optional[str] = None


class StoryInteraction(StoryInteractionBase):
    """Full story interaction record"""
    id: str
    story_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    completed_at: Optional[datetime] = None
    quiz_answers: Optional[dict] = None
    quiz_score: int = 0
    device_type: Optional[str] = None
    referrer: Optional[str] = None
    started_at: datetime
    last_activity_at: datetime


# ============================================================
# ANALYTICS SCHEMAS
# ============================================================

class StoryAnalytics(BaseModel):
    """Analytics for a single story"""
    story_id: str
    story_title: str
    view_count: int = 0
    completion_count: int = 0
    completion_rate: float = 0.0
    avg_time_spent_seconds: int = 0
    chapter_drop_off: list[dict] = Field(default_factory=list)  # [{chapter_index, view_count}]
    quiz_performance: Optional[dict] = None  # {avg_score, completion_rate}
    top_referrers: list[dict] = Field(default_factory=list)
    device_breakdown: dict = Field(default_factory=dict)


class OrganizationStoriesAnalytics(BaseModel):
    """Aggregate analytics for all organization stories"""
    organization_id: str
    total_stories: int = 0
    published_stories: int = 0
    total_views: int = 0
    total_completions: int = 0
    avg_completion_rate: float = 0.0
    avg_time_spent_seconds: int = 0
    top_stories: list[StoryAnalytics] = Field(default_factory=list)
    views_over_time: list[dict] = Field(default_factory=list)  # [{date, views}]


# ============================================================
# API RESPONSE SCHEMAS
# ============================================================

class StoryListResponse(BaseModel):
    """Response for listing stories"""
    stories: list[ProductStoryWithProduct]
    total: int
    page: int
    per_page: int


class StoryDetailResponse(BaseModel):
    """Response for story detail"""
    story: ProductStory
    chapters: list[StoryChapter]
    interaction: Optional[StoryInteraction] = None  # User's progress
