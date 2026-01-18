"""
Bulk import API routes.
"""

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.bulk_import import (
    FieldMapping,
    FieldMappingInfo,
    ImportJob,
    ImportJobSettings,
    ImportJobSummary,
    ImportPreviewResponse,
    ImportProgressResponse,
)
from app.services import bulk_import as import_service

router = APIRouter(prefix='/api', tags=['bulk-import'])


@router.post('/organizations/{organization_id}/imports/upload', response_model=ImportJob)
async def upload_import_file(
    request: Request,
    organization_id: str,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportJob:
    """
    Upload a file for bulk import.
    Supported source types: wildberries, ozon, 1c, generic_csv, generic_xlsx
    """
    return import_service.create_import_job(
        organization_id=organization_id,
        user_id=current_user_id,
        file=file,
        source_type=source_type,
    )


@router.get('/organizations/{organization_id}/imports', response_model=list[ImportJobSummary])
async def list_import_jobs(
    request: Request,
    organization_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[ImportJobSummary]:
    """List import jobs for an organization."""
    return import_service.list_import_jobs(
        organization_id=organization_id,
        user_id=current_user_id,
        limit=limit,
        offset=offset,
    )


@router.get('/organizations/{organization_id}/imports/{job_id}', response_model=ImportJob)
async def get_import_job(
    request: Request,
    organization_id: str,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportJob:
    """Get import job details."""
    return import_service.get_import_job(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
    )


@router.get('/organizations/{organization_id}/imports/{job_id}/mapping', response_model=FieldMappingInfo)
async def get_field_mapping_info(
    request: Request,
    organization_id: str,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> FieldMappingInfo:
    """Get field mapping information for configuring the import."""
    return import_service.get_field_mapping_info(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
    )


@router.post('/organizations/{organization_id}/imports/{job_id}/mapping', response_model=ImportJob)
async def save_field_mapping(
    request: Request,
    organization_id: str,
    job_id: str,
    mapping: FieldMapping,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportJob:
    """Save field mapping configuration."""
    return import_service.save_field_mapping(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
        mapping=mapping,
    )


@router.post('/organizations/{organization_id}/imports/{job_id}/validate', response_model=ImportJob)
async def validate_import(
    request: Request,
    organization_id: str,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportJob:
    """Run validation on import data."""
    return import_service.validate_import(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
    )


@router.get('/organizations/{organization_id}/imports/{job_id}/preview', response_model=ImportPreviewResponse)
async def get_import_preview(
    request: Request,
    organization_id: str,
    job_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportPreviewResponse:
    """Get preview of mapped import data."""
    return import_service.get_import_preview(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
        limit=limit,
        offset=offset,
    )


@router.post('/organizations/{organization_id}/imports/{job_id}/execute', response_model=ImportProgressResponse)
async def execute_import(
    request: Request,
    organization_id: str,
    job_id: str,
    settings: ImportJobSettings | None = None,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportProgressResponse:
    """Start executing the import job."""
    if settings is None:
        settings = ImportJobSettings()

    return import_service.execute_import(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
        settings=settings,
    )


@router.post('/organizations/{organization_id}/imports/{job_id}/cancel', response_model=ImportJob)
async def cancel_import(
    request: Request,
    organization_id: str,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportJob:
    """Cancel an import job."""
    return import_service.cancel_import(
        organization_id=organization_id,
        job_id=job_id,
        user_id=current_user_id,
    )
