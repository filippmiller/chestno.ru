"""
Admin routes for managing bulk imports across all organizations.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, Request, status
from pydantic import BaseModel
from psycopg.rows import dict_row

from app.core.session_deps import get_current_user_id_from_session
from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin


def require_platform_role(user_id: str, allowed_roles: list[str]) -> None:
    """Check if user has one of the allowed platform roles."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check app_profiles.role (Auth V2)
            cur.execute(
                'SELECT 1 FROM app_profiles WHERE id = %s AND role = %s',
                (user_id, 'admin'),
            )
            if cur.fetchone() and 'platform_admin' in allowed_roles:
                return

            # Check platform_roles table (legacy)
            cur.execute(
                'SELECT 1 FROM platform_roles WHERE user_id = %s AND role = ANY(%s)',
                (user_id, allowed_roles),
            )
            if cur.fetchone():
                return

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Admin access required'
            )


router = APIRouter(prefix='/api/admin/imports', tags=['admin-imports'])


class ImportJobAdmin(BaseModel):
    """Import job with organization info for admin view."""
    id: str
    organization_id: str
    organization_name: str | None = None
    created_by: str
    creator_email: str | None = None
    source_type: str
    original_filename: str | None = None
    status: str
    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int
    created_at: str
    updated_at: str


class ImportJobItemAdmin(BaseModel):
    """Import job item for admin view."""
    id: str
    job_id: str
    row_number: int
    status: str
    raw_data: dict | None = None
    mapped_data: dict | None = None
    product_id: str | None = None
    error_message: str | None = None
    created_at: str


class ImportStatsResponse(BaseModel):
    """Import statistics for admin dashboard."""
    total_jobs: int
    pending_jobs: int
    processing_jobs: int
    completed_jobs: int
    failed_jobs: int
    total_rows_imported: int
    total_rows_failed: int
    success_rate: float
    jobs_by_source: list[dict]
    jobs_by_status: list[dict]
    recent_activity: list[dict]


class AdminImportsListResponse(BaseModel):
    """Paginated list of import jobs for admin."""
    items: list[ImportJobAdmin]
    total: int
    limit: int
    offset: int


class AdminImportDetailsResponse(BaseModel):
    """Detailed import job info for admin."""
    job: ImportJobAdmin
    items: list[ImportJobItemAdmin]
    items_total: int
    error_summary: list[dict]


@router.get('', response_model=AdminImportsListResponse)
async def list_all_imports(
    request: Request,
    status: str | None = Query(default=None, description="Filter by status"),
    source_type: str | None = Query(default=None, description="Filter by source type"),
    organization_id: str | None = Query(default=None, description="Filter by organization"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AdminImportsListResponse:
    """List all import jobs across organizations (admin only)."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner', 'support'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Build query with filters
            where_clauses = []
            params = []

            if status:
                where_clauses.append("j.status = %s")
                params.append(status)

            if source_type:
                where_clauses.append("j.source_type = %s")
                params.append(source_type)

            if organization_id:
                where_clauses.append("j.organization_id = %s")
                params.append(organization_id)

            where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

            # Get total count
            cur.execute(f"""
                SELECT COUNT(*) FROM import_jobs j WHERE {where_sql}
            """, params)
            total = cur.fetchone()[0]

            # Get jobs with organization and user info
            cur.execute(f"""
                SELECT
                    j.id, j.organization_id, o.name as org_name,
                    j.created_by, u.email as creator_email,
                    j.source_type, j.original_filename, j.status,
                    j.total_rows, j.processed_rows, j.successful_rows, j.failed_rows,
                    j.created_at, j.updated_at
                FROM import_jobs j
                LEFT JOIN organizations o ON o.id = j.organization_id
                LEFT JOIN app_users u ON u.id = j.created_by
                WHERE {where_sql}
                ORDER BY j.created_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])

            rows = cur.fetchall()
            items = [
                ImportJobAdmin(
                    id=str(r[0]),
                    organization_id=str(r[1]),
                    organization_name=r[2],
                    created_by=str(r[3]),
                    creator_email=r[4],
                    source_type=r[5],
                    original_filename=r[6],
                    status=r[7],
                    total_rows=r[8] or 0,
                    processed_rows=r[9] or 0,
                    successful_rows=r[10] or 0,
                    failed_rows=r[11] or 0,
                    created_at=r[12].isoformat() if r[12] else '',
                    updated_at=r[13].isoformat() if r[13] else '',
                )
                for r in rows
            ]

            return AdminImportsListResponse(
                items=items,
                total=total,
                limit=limit,
                offset=offset,
            )


@router.get('/stats', response_model=ImportStatsResponse)
async def get_import_stats(
    request: Request,
    days: int = Query(default=30, ge=1, le=365, description="Days to look back"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ImportStatsResponse:
    """Get import statistics for admin dashboard."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner', 'support'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Overall stats
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COALESCE(SUM(successful_rows), 0) as total_success,
                    COALESCE(SUM(failed_rows), 0) as total_failed
                FROM import_jobs
                WHERE created_at >= NOW() - INTERVAL '%s days'
            """, [days])
            stats = cur.fetchone()

            total_jobs = stats[0]
            total_rows = stats[5] + stats[6]
            success_rate = (stats[5] / total_rows * 100) if total_rows > 0 else 0

            # Jobs by source type
            cur.execute("""
                SELECT source_type, COUNT(*) as count
                FROM import_jobs
                WHERE created_at >= NOW() - INTERVAL '%s days'
                GROUP BY source_type
                ORDER BY count DESC
            """, [days])
            jobs_by_source = [{"source": r[0], "count": r[1]} for r in cur.fetchall()]

            # Jobs by status
            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM import_jobs
                WHERE created_at >= NOW() - INTERVAL '%s days'
                GROUP BY status
                ORDER BY count DESC
            """, [days])
            jobs_by_status = [{"status": r[0], "count": r[1]} for r in cur.fetchall()]

            # Recent activity (last 7 days, by day)
            cur.execute("""
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as jobs,
                    COALESCE(SUM(successful_rows), 0) as rows_imported
                FROM import_jobs
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            """)
            recent_activity = [
                {"date": r[0].isoformat(), "jobs": r[1], "rows": r[2]}
                for r in cur.fetchall()
            ]

            return ImportStatsResponse(
                total_jobs=total_jobs,
                pending_jobs=stats[1],
                processing_jobs=stats[2],
                completed_jobs=stats[3],
                failed_jobs=stats[4],
                total_rows_imported=stats[5],
                total_rows_failed=stats[6],
                success_rate=round(success_rate, 2),
                jobs_by_source=jobs_by_source,
                jobs_by_status=jobs_by_status,
                recent_activity=recent_activity,
            )


@router.get('/{job_id}', response_model=AdminImportDetailsResponse)
async def get_import_details(
    request: Request,
    job_id: str,
    items_limit: int = Query(default=100, ge=1, le=500),
    items_offset: int = Query(default=0, ge=0),
    items_status: str | None = Query(default=None, description="Filter items by status"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AdminImportDetailsResponse:
    """Get detailed import job info including items."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner', 'support'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Get job with organization info
            cur.execute("""
                SELECT
                    j.id, j.organization_id, o.name as org_name,
                    j.created_by, u.email as creator_email,
                    j.source_type, j.original_filename, j.status,
                    j.total_rows, j.processed_rows, j.successful_rows, j.failed_rows,
                    j.created_at, j.updated_at
                FROM import_jobs j
                LEFT JOIN organizations o ON o.id = j.organization_id
                LEFT JOIN app_users u ON u.id = j.created_by
                WHERE j.id = %s
            """, [job_id])
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Import job not found")

            job = ImportJobAdmin(
                id=str(row[0]),
                organization_id=str(row[1]),
                organization_name=row[2],
                created_by=str(row[3]),
                creator_email=row[4],
                source_type=row[5],
                original_filename=row[6],
                status=row[7],
                total_rows=row[8] or 0,
                processed_rows=row[9] or 0,
                successful_rows=row[10] or 0,
                failed_rows=row[11] or 0,
                created_at=row[12].isoformat() if row[12] else '',
                updated_at=row[13].isoformat() if row[13] else '',
            )

            # Get items count
            item_where = "job_id = %s"
            item_params = [job_id]
            if items_status:
                item_where += " AND status = %s"
                item_params.append(items_status)

            cur.execute(f"SELECT COUNT(*) FROM import_job_items WHERE {item_where}", item_params)
            items_total = cur.fetchone()[0]

            # Get items
            cur.execute(f"""
                SELECT id, job_id, row_number, status, raw_data, mapped_data,
                       product_id, error_message, created_at
                FROM import_job_items
                WHERE {item_where}
                ORDER BY row_number
                LIMIT %s OFFSET %s
            """, item_params + [items_limit, items_offset])

            items = [
                ImportJobItemAdmin(
                    id=str(r[0]),
                    job_id=str(r[1]),
                    row_number=r[2],
                    status=r[3],
                    raw_data=r[4],
                    mapped_data=r[5],
                    product_id=str(r[6]) if r[6] else None,
                    error_message=r[7],
                    created_at=r[8].isoformat() if r[8] else '',
                )
                for r in cur.fetchall()
            ]

            # Error summary - group common errors
            cur.execute("""
                SELECT error_message, COUNT(*) as count
                FROM import_job_items
                WHERE job_id = %s AND status = 'failed' AND error_message IS NOT NULL
                GROUP BY error_message
                ORDER BY count DESC
                LIMIT 10
            """, [job_id])
            error_summary = [
                {"error": r[0], "count": r[1]}
                for r in cur.fetchall()
            ]

            return AdminImportDetailsResponse(
                job=job,
                items=items,
                items_total=items_total,
                error_summary=error_summary,
            )


@router.post('/{job_id}/cancel')
async def admin_cancel_import(
    request: Request,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Cancel an import job (admin override)."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE import_jobs
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = %s AND status IN ('pending', 'processing', 'mapping', 'validating')
                RETURNING id
            """, [job_id])
            result = cur.fetchone()
            conn.commit()

            if not result:
                raise HTTPException(
                    status_code=400,
                    detail="Import job not found or cannot be cancelled"
                )

            return {"success": True, "message": "Import job cancelled"}


@router.post('/{job_id}/retry-failed')
async def retry_failed_items(
    request: Request,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Reset failed items to pending for retry (admin only)."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Check job exists and is completed
            cur.execute("""
                SELECT status FROM import_jobs WHERE id = %s
            """, [job_id])
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Import job not found")

            if row[0] not in ('completed', 'failed'):
                raise HTTPException(
                    status_code=400,
                    detail="Can only retry items from completed or failed jobs"
                )

            # Reset failed items to pending
            cur.execute("""
                UPDATE import_job_items
                SET status = 'pending', error_message = NULL, updated_at = NOW()
                WHERE job_id = %s AND status = 'failed'
                RETURNING id
            """, [job_id])
            updated = len(cur.fetchall())

            # Update job status and counters
            cur.execute("""
                UPDATE import_jobs
                SET
                    status = 'processing',
                    failed_rows = failed_rows - %s,
                    processed_rows = processed_rows - %s,
                    updated_at = NOW()
                WHERE id = %s
            """, [updated, updated, job_id])

            conn.commit()

            return {"success": True, "items_reset": updated}


@router.delete('/{job_id}')
async def delete_import_job(
    request: Request,
    job_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Delete an import job and all its items (admin only)."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Delete items first (cascade should handle this, but being explicit)
            cur.execute("DELETE FROM import_job_items WHERE job_id = %s", [job_id])
            items_deleted = cur.rowcount

            # Delete job
            cur.execute("DELETE FROM import_jobs WHERE id = %s RETURNING id", [job_id])
            result = cur.fetchone()
            conn.commit()

            if not result:
                raise HTTPException(status_code=404, detail="Import job not found")

            return {
                "success": True,
                "message": "Import job deleted",
                "items_deleted": items_deleted
            }


@router.get('/organizations/summary')
async def get_organizations_import_summary(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[dict]:
    """Get import summary per organization."""
    require_platform_role(current_user_id, ['platform_admin', 'platform_owner', 'support'])

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    o.id,
                    o.name,
                    COUNT(j.id) as total_imports,
                    COUNT(j.id) FILTER (WHERE j.status = 'completed') as completed,
                    COUNT(j.id) FILTER (WHERE j.status = 'failed') as failed,
                    COALESCE(SUM(j.successful_rows), 0) as total_products_imported,
                    MAX(j.created_at) as last_import_at
                FROM organizations o
                LEFT JOIN import_jobs j ON j.organization_id = o.id
                GROUP BY o.id, o.name
                HAVING COUNT(j.id) > 0
                ORDER BY MAX(j.created_at) DESC NULLS LAST
            """)

            return [
                {
                    "organization_id": str(r[0]),
                    "organization_name": r[1],
                    "total_imports": r[2],
                    "completed": r[3],
                    "failed": r[4],
                    "total_products_imported": r[5],
                    "last_import_at": r[6].isoformat() if r[6] else None,
                }
                for r in cur.fetchall()
            ]
