from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


OnboardingKey = Literal['profile', 'products', 'qr_codes', 'verification', 'invites']


class OnboardingStep(BaseModel):
    key: OnboardingKey
    label: str
    completed: bool


class OnboardingSummary(BaseModel):
    organization_id: str
    completion_percent: int = Field(ge=0, le=100)
    steps: list[OnboardingStep]

