from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class AppUser(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None = None
    locale: str | None = Field(default='ru')


class Organization(BaseModel):
    id: str
    name: str
    slug: str
    city: str | None = None
    country: str | None = None
    website_url: str | None = None
    phone: str | None = None
    verification_status: str | None = None


OrganizationRole = Literal['owner', 'admin', 'manager', 'editor', 'analyst', 'viewer']


class OrganizationMembership(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: OrganizationRole


class AfterSignupRequest(BaseModel):
    auth_user_id: str = Field(..., description='Supabase auth.users id')
    email: EmailStr
    contact_name: str
    account_type: Literal['producer', 'user']
    company_name: str | None = None
    country: str | None = None
    city: str | None = None
    website_url: str | None = None
    phone: str | None = None
    invite_code: str | None = None

    @model_validator(mode='after')
    def validate_producer(self) -> 'AfterSignupRequest':
        if self.account_type == 'producer':
            required_fields = {
                'company_name': self.company_name,
                'country': self.country,
                'city': self.city,
            }
            missing = [field for field, value in required_fields.items() if not value]
            if missing:
                raise ValueError(f'Missing required organization fields: {", ".join(missing)}')
        return self


class GalleryItem(BaseModel):
    url: str
    caption: str | None = None


class SocialLink(BaseModel):
    type: Literal['instagram', 'vk', 'youtube', 'ok', 'tiktok', 'facebook', 'other']
    label: str
    url: str


class OrganizationProfile(BaseModel):
    id: str
    organization_id: str
    short_description: str | None = None
    long_description: str | None = None
    production_description: str | None = None
    safety_and_quality: str | None = None
    video_url: str | None = None
    gallery: list[GalleryItem] = Field(default_factory=list)
    tags: str | None = None
    language: str = 'ru'
    # Contacts
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_website: str | None = None
    contact_address: str | None = None
    contact_telegram: str | None = None
    contact_whatsapp: str | None = None
    social_links: list[SocialLink] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class OrganizationProfileUpdate(BaseModel):
    short_description: str | None = None
    long_description: str | None = None
    production_description: str | None = None
    safety_and_quality: str | None = None
    video_url: str | None = None
    gallery: list[GalleryItem] | None = None
    tags: str | None = None
    language: str | None = None
    # Contacts
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_website: str | None = None
    contact_address: str | None = None
    contact_telegram: str | None = None
    contact_whatsapp: str | None = None
    social_links: list[SocialLink] | None = None


class SessionResponse(BaseModel):
    user: AppUser
    organizations: list[Organization]
    memberships: list[OrganizationMembership]
    platform_roles: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(SessionResponse):
    access_token: str
    refresh_token: str
    expires_in: int | None = None
    token_type: str = 'bearer'


class OrganizationInvite(BaseModel):
    id: str
    organization_id: str
    email: EmailStr
    role: OrganizationRole
    code: str
    status: Literal['pending', 'accepted', 'revoked', 'expired']
    expires_at: datetime | None = None
    created_by: str
    created_at: datetime
    accepted_by: str | None = None
    accepted_at: datetime | None = None


class OrganizationInviteCreate(BaseModel):
    email: EmailStr
    role: OrganizationRole
    expires_at: datetime | None = None


class OrganizationInvitePreview(BaseModel):
    organization_name: str
    organization_slug: str
    role: OrganizationRole
    status: Literal['pending', 'accepted', 'revoked', 'expired']
    requires_auth: bool = True


class PublicOrganizationProfile(BaseModel):
    name: str
    slug: str
    country: str | None = None
    city: str | None = None
    website_url: str | None = None
    is_verified: bool
    verification_status: str
    short_description: str | None = None
    long_description: str | None = None
    production_description: str | None = None
    safety_and_quality: str | None = None
    video_url: str | None = None
    gallery: list[GalleryItem] = Field(default_factory=list)
    tags: str | None = None

