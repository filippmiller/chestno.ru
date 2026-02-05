"""
Counterfeit Detection Schemas
Pydantic models for AI photo counterfeit detection feature.
"""
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReferenceImageCreate(BaseModel):
    """Schema for uploading a reference image."""
    product_id: str
    image_url: str
    image_type: str = "packaging"  # packaging, logo, label, barcode, hologram
    description: Optional[str] = None
    display_order: int = 0


class ReferenceImageUpdate(BaseModel):
    """Schema for updating a reference image."""
    image_type: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class ReferenceImage(BaseModel):
    """Schema for a reference image."""
    id: str
    product_id: str
    organization_id: str
    image_url: str
    image_type: str
    description: Optional[str] = None
    display_order: int
    is_active: bool
    uploaded_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CounterfeitCheckCreate(BaseModel):
    """Schema for submitting a counterfeit check."""
    product_id: Optional[str] = None
    submitted_image_url: str
    location_country: Optional[str] = None
    location_city: Optional[str] = None


class CounterfeitCheck(BaseModel):
    """Schema for a counterfeit check result."""
    id: str
    product_id: Optional[str] = None
    organization_id: Optional[str] = None
    user_id: Optional[str] = None
    submitted_image_url: str
    overall_confidence: Optional[float] = None
    is_likely_authentic: Optional[bool] = None
    analysis_details: Dict[str, Any] = {}
    matched_reference_id: Optional[str] = None
    matched_confidence: Optional[float] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None
    status: str  # pending, processing, completed, failed
    error_message: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CounterfeitReportCreate(BaseModel):
    """Schema for submitting a counterfeit report."""
    check_id: Optional[str] = None
    reporter_email: Optional[str] = None
    purchase_location: Optional[str] = None
    purchase_date: Optional[date] = None
    report_notes: Optional[str] = None


class CounterfeitReport(BaseModel):
    """Schema for a counterfeit report."""
    id: str
    check_id: Optional[str] = None
    reporter_user_id: Optional[str] = None
    reporter_email: Optional[str] = None
    purchase_location: Optional[str] = None
    purchase_date: Optional[date] = None
    report_notes: Optional[str] = None
    status: str  # submitted, investigating, confirmed_fake, false_positive, resolved
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CounterfeitStats(BaseModel):
    """Statistics about counterfeit checks."""
    total_checks: int
    authentic_count: int
    suspicious_count: int
    avg_confidence: Optional[float] = None
    reports_count: int
