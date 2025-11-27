from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class QRCode(BaseModel):
    id: str
    organization_id: str
    code: str
    label: str | None = None
    target_type: str
    target_slug: str | None = None
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class QRCodeCreate(BaseModel):
    label: str | None = None
    target_type: Literal['organization'] = 'organization'


class QRCodeStats(BaseModel):
    total: int
    last_7_days: int
    last_30_days: int

