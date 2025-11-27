from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ModerationOrganization(BaseModel):
    id: str
    name: str
    slug: str
    country: str | None = None
    city: str | None = None
    website_url: str | None = None
    verification_status: str
    verification_comment: str | None = None
    is_verified: bool
    created_at: datetime


class ModerationAction(BaseModel):
    action: Literal['verify', 'reject']
    comment: str | None = None

