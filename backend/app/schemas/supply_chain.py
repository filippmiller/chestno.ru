"""
Pydantic schemas for supply chain visualization.
Tracks supply chain nodes and transitions between them.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SupplyChainNodeType(str, Enum):
    """Type of supply chain node."""
    PRODUCER = 'PRODUCER'
    PROCESSOR = 'PROCESSOR'
    WAREHOUSE = 'WAREHOUSE'
    DISTRIBUTOR = 'DISTRIBUTOR'
    RETAILER = 'RETAILER'
    CONSUMER = 'CONSUMER'


class GeoCoordinates(BaseModel):
    """Geographic coordinates for map display."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


# ============================================================
# NODE SCHEMAS
# ============================================================

class SupplyChainNodeCreate(BaseModel):
    """Request to create a supply chain node."""
    product_id: Optional[str] = None
    node_type: SupplyChainNodeType
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=500)
    coordinates: Optional[GeoCoordinates] = None
    order_index: Optional[int] = Field(None, ge=0)
    contact_name: Optional[str] = Field(None, max_length=200)
    contact_phone: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(None, max_length=255)
    external_id: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None
    certificate_urls: Optional[List[str]] = Field(default_factory=list)
    metadata: Optional[dict] = None


class SupplyChainNodeUpdate(BaseModel):
    """Request to update a supply chain node."""
    node_type: Optional[SupplyChainNodeType] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=500)
    coordinates: Optional[GeoCoordinates] = None
    order_index: Optional[int] = Field(None, ge=0)
    contact_name: Optional[str] = Field(None, max_length=200)
    contact_phone: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(None, max_length=255)
    external_id: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None
    certificate_urls: Optional[List[str]] = None
    is_verified: Optional[bool] = None
    metadata: Optional[dict] = None


class SupplyChainNode(BaseModel):
    """A node in the supply chain."""
    id: str
    organization_id: str
    product_id: Optional[str] = None
    node_type: SupplyChainNodeType
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    coordinates: Optional[GeoCoordinates] = None
    order_index: int
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    external_id: Optional[str] = None
    is_verified: bool
    verified_at: Optional[datetime] = None
    image_url: Optional[str] = None
    certificate_urls: List[str] = Field(default_factory=list)
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# STEP SCHEMAS
# ============================================================

class SupplyChainStepCreate(BaseModel):
    """Request to create a supply chain step (transition between nodes)."""
    from_node_id: str
    to_node_id: str
    description: Optional[str] = Field(None, max_length=2000)
    transport_method: Optional[str] = Field(None, max_length=100)
    distance_km: Optional[float] = Field(None, ge=0)
    duration_hours: Optional[float] = Field(None, ge=0)
    timestamp: Optional[datetime] = None
    expected_arrival: Optional[datetime] = None
    tracking_number: Optional[str] = Field(None, max_length=100)
    batch_id: Optional[str] = Field(None, max_length=100)
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = Field(None, ge=0, le=100)
    document_urls: Optional[List[str]] = Field(default_factory=list)
    metadata: Optional[dict] = None


class SupplyChainStepUpdate(BaseModel):
    """Request to update a supply chain step."""
    description: Optional[str] = Field(None, max_length=2000)
    transport_method: Optional[str] = Field(None, max_length=100)
    distance_km: Optional[float] = Field(None, ge=0)
    duration_hours: Optional[float] = Field(None, ge=0)
    timestamp: Optional[datetime] = None
    expected_arrival: Optional[datetime] = None
    verified: Optional[bool] = None
    verification_notes: Optional[str] = Field(None, max_length=2000)
    tracking_number: Optional[str] = Field(None, max_length=100)
    batch_id: Optional[str] = Field(None, max_length=100)
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = Field(None, ge=0, le=100)
    document_urls: Optional[List[str]] = None
    metadata: Optional[dict] = None


class SupplyChainStep(BaseModel):
    """A step/transition in the supply chain."""
    id: str
    product_id: str
    from_node_id: str
    to_node_id: str
    description: Optional[str] = None
    transport_method: Optional[str] = None
    distance_km: Optional[float] = None
    duration_hours: Optional[float] = None
    timestamp: Optional[datetime] = None
    expected_arrival: Optional[datetime] = None
    verified: bool
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    tracking_number: Optional[str] = None
    batch_id: Optional[str] = None
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None
    document_urls: List[str] = Field(default_factory=list)
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# JOURNEY SCHEMAS
# ============================================================

class SupplyChainJourneyNode(BaseModel):
    """Node with step information for journey view."""
    node: SupplyChainNode
    step_to_next: Optional[SupplyChainStep] = None


class SupplyChainJourney(BaseModel):
    """Complete supply chain journey for a product."""
    product_id: str
    product_name: str
    product_slug: str
    organization_id: str
    organization_name: str
    nodes: List[SupplyChainJourneyNode] = Field(default_factory=list)
    total_nodes: int = 0
    verified_nodes: int = 0
    total_steps: int = 0
    verified_steps: int = 0
    total_distance_km: float = 0.0
    total_duration_hours: float = 0.0


class SupplyChainStats(BaseModel):
    """Statistics about a supply chain."""
    total_nodes: int = 0
    verified_nodes: int = 0
    total_steps: int = 0
    verified_steps: int = 0
    total_distance_km: float = 0.0
    total_duration_hours: float = 0.0
    verification_percentage: float = 0.0
