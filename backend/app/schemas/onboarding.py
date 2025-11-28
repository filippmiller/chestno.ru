from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


OnboardingKey = Literal[
    'profile_basic', 'contacts', 'story_and_photos', 'video_presentation',
    'products', 'qr_codes', 'verification', 'invites', 'first_post'
]


class OnboardingStep(BaseModel):
    key: OnboardingKey
    label: str
    completed: bool
    description: str | None = None
    link: str | None = None


class OnboardingSummary(BaseModel):
    organization_id: str
    completion_percent: int = Field(ge=0, le=100)
    steps: list[OnboardingStep]

