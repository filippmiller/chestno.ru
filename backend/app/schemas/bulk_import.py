from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# Enums as literal types
ImportSourceType = Literal['wildberries', 'ozon', '1c', 'generic_csv', 'generic_xlsx']
ImportJobStatus = Literal[
    'pending', 'mapping', 'validating', 'preview',
    'processing', 'completed', 'failed', 'cancelled'
]
ImportItemStatus = Literal[
    'pending', 'valid', 'invalid', 'processing',
    'completed', 'failed', 'skipped'
]
ImageQueueStatus = Literal[
    'pending', 'downloading', 'uploading', 'completed', 'failed'
]


class ImportJobCreate(BaseModel):
    """Payload to create a new import job."""
    source_type: ImportSourceType
    source_filename: Optional[str] = None


class ImportJobSettings(BaseModel):
    """Settings for import job processing."""
    skip_duplicates: bool = True
    update_existing: bool = False
    download_images: bool = True


class FieldMapping(BaseModel):
    """Mapping from source columns to product fields."""
    mapping: dict[str, str] = Field(
        default_factory=dict,
        description="Maps source column names to target product fields"
    )


class ValidationError(BaseModel):
    """Validation error for a specific row."""
    row_number: int
    field: Optional[str] = None
    message: str
    value: Optional[Any] = None


class ImportJob(BaseModel):
    """Full import job response model."""
    id: str
    organization_id: str
    created_by: str
    source_type: ImportSourceType
    source_filename: Optional[str] = None
    status: ImportJobStatus
    field_mapping: dict[str, str] = Field(default_factory=dict)
    total_rows: int = 0
    processed_rows: int = 0
    successful_rows: int = 0
    failed_rows: int = 0
    validation_errors: list[dict] = Field(default_factory=list)
    error_message: Optional[str] = None
    skip_duplicates: bool = True
    update_existing: bool = False
    download_images: bool = True
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ImportJobSummary(BaseModel):
    """Compact import job for list view."""
    id: str
    source_type: ImportSourceType
    source_filename: Optional[str] = None
    status: ImportJobStatus
    total_rows: int = 0
    processed_rows: int = 0
    successful_rows: int = 0
    failed_rows: int = 0
    created_at: datetime


class ImportPreviewRow(BaseModel):
    """Single row preview with mapped data and validation."""
    row_number: int
    raw_data: dict[str, Any]
    mapped_data: dict[str, Any]
    errors: list[str] = Field(default_factory=list)
    is_valid: bool = True


class ImportPreviewResponse(BaseModel):
    """Preview response with sample rows."""
    job_id: str
    source_type: ImportSourceType
    total_rows: int
    rows: list[ImportPreviewRow]
    columns: list[str]
    suggested_mapping: dict[str, str]
    validation_summary: dict[str, int] = Field(
        default_factory=lambda: {'valid': 0, 'invalid': 0, 'warnings': 0}
    )


class ImportJobItem(BaseModel):
    """Individual import row item."""
    id: str
    job_id: str
    row_number: int
    raw_data: dict[str, Any]
    mapped_data: dict[str, Any]
    status: ImportItemStatus
    product_id: Optional[str] = None
    error_message: Optional[str] = None
    validation_errors: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ImportProgressResponse(BaseModel):
    """Real-time progress update."""
    job_id: str
    status: ImportJobStatus
    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int
    percentage: float = 0.0
    current_operation: Optional[str] = None
    eta_seconds: Optional[int] = None


class ImportResultResponse(BaseModel):
    """Final result after import completes."""
    job_id: str
    status: ImportJobStatus
    total_rows: int
    successful_rows: int
    failed_rows: int
    skipped_rows: int = 0
    created_products: list[str] = Field(default_factory=list)
    updated_products: list[str] = Field(default_factory=list)
    errors: list[ValidationError] = Field(default_factory=list)
    duration_seconds: Optional[float] = None
    images_queued: int = 0


class ImageQueueItem(BaseModel):
    """Image download queue item."""
    id: str
    job_id: str
    item_id: Optional[str] = None
    product_id: Optional[str] = None
    source_url: str
    target_type: Literal['main', 'gallery']
    display_order: int = 0
    status: ImageQueueStatus
    result_url: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime
    updated_at: datetime


class SourceColumnInfo(BaseModel):
    """Information about a source file column."""
    name: str
    sample_values: list[str] = Field(default_factory=list, max_length=5)
    data_type: str = 'string'
    non_empty_count: int = 0


class FieldMappingInfo(BaseModel):
    """Complete field mapping information."""
    source_columns: list[SourceColumnInfo]
    target_fields: list[dict[str, str]]  # name, label, required
    suggested_mapping: dict[str, str]
    current_mapping: dict[str, str]


# Target product fields for mapping
PRODUCT_TARGET_FIELDS = [
    {'name': 'name', 'label': 'Название', 'required': True},
    {'name': 'slug', 'label': 'Slug (URL)', 'required': False},
    {'name': 'sku', 'label': 'Артикул (SKU)', 'required': False},
    {'name': 'barcode', 'label': 'Штрихкод', 'required': False},
    {'name': 'short_description', 'label': 'Краткое описание', 'required': False},
    {'name': 'long_description', 'label': 'Полное описание', 'required': False},
    {'name': 'category', 'label': 'Категория', 'required': False},
    {'name': 'tags', 'label': 'Теги', 'required': False},
    {'name': 'price', 'label': 'Цена', 'required': False},
    {'name': 'currency', 'label': 'Валюта', 'required': False},
    {'name': 'stock_quantity', 'label': 'Остаток', 'required': False},
    {'name': 'main_image_url', 'label': 'Главное изображение', 'required': False},
    {'name': 'gallery_urls', 'label': 'Галерея (URLs)', 'required': False},
    {'name': 'external_url', 'label': 'Внешняя ссылка', 'required': False},
    {'name': 'status', 'label': 'Статус', 'required': False},
    # Variant-specific fields
    {'name': 'parent_sku', 'label': 'Артикул родителя', 'required': False},
    {'name': 'variant_attributes', 'label': 'Атрибуты вариации', 'required': False},
]
