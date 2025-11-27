from fastapi import APIRouter, Depends, Query

from app.api.routes.auth import get_current_user_id
from app.services import admin_db

router = APIRouter(prefix='/api/admin/db', tags=['admin-db'])


@router.get('/tables')
async def list_tables(current_user_id: str = Depends(get_current_user_id)):
    return admin_db.list_tables(current_user_id)


@router.get('/tables/{table_name}/columns')
async def table_columns(table_name: str, current_user_id: str = Depends(get_current_user_id)):
    return admin_db.get_table_columns(current_user_id, table_name)


@router.get('/tables/{table_name}/rows')
async def table_rows(
    table_name: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = None,
    order_by: str | None = None,
    current_user_id: str = Depends(get_current_user_id),
):
    return admin_db.get_table_rows(current_user_id, table_name, limit, offset, search, order_by)


@router.post('/migration-draft')
async def migration_draft(payload: dict, current_user_id: str = Depends(get_current_user_id)):
    required = {'table_name', 'column_name', 'column_type'}
    if not required.issubset(payload):
        missing = ', '.join(required - payload.keys())
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Missing fields: {missing}')
    return admin_db.create_migration_draft(
        current_user_id,
        table_name=payload['table_name'],
        column_name=payload['column_name'],
        column_type=payload['column_type'],
        default_value=payload.get('default_value'),
        is_nullable=payload.get('is_nullable', True),
    )

