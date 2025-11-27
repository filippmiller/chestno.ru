from __future__ import annotations

from typing import Any, Dict, List

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin

ALLOWED_FILTERS = {'status', 'category', 'provider'}


def list_tasks(user_id: str, filters: Dict[str, str], limit: int, offset: int) -> List[Dict[str, Any]]:
    assert_platform_admin(user_id)
    clauses = []
    values = []
    for key, value in filters.items():
        if key in ALLOWED_FILTERS and value:
            column = 'related_provider' if key == 'provider' else key
            clauses.append(f'{column} = %s')
            values.append(value)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ''
    values.extend([limit, offset])
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f'''
            SELECT * FROM dev_tasks
            {where_sql}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            ''',
            values,
        )
        return cur.fetchall()


def create_task(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    assert_platform_admin(user_id)
    required = {'title'}
    if not required.issubset(payload):
        missing = required - payload.keys()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Missing fields: {", ".join(missing)}')
    columns = ['title']
    values = [payload['title']]
    placeholders = ['%s']
    optional_fields = [
        'description',
        'category',
        'related_provider',
        'related_env_vars',
        'status',
        'priority',
        'external_link',
        'notes_internal',
    ]
    for field in optional_fields:
        if field in payload:
            columns.append(field)
            values.append(payload[field])
            placeholders.append('%s')
    columns.extend(['created_by', 'updated_by'])
    values.extend([user_id, user_id])
    placeholders.extend(['%s', '%s'])
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f'''
            INSERT INTO dev_tasks ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING *
            ''',
            values,
        )
        row = cur.fetchone()
        conn.commit()
        return row


def update_task(user_id: str, task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    assert_platform_admin(user_id)
    fields = []
    values = []
    for field in [
        'title',
        'description',
        'category',
        'related_provider',
        'related_env_vars',
        'status',
        'priority',
        'external_link',
        'notes_internal',
    ]:
        if field in payload:
            fields.append(f'{field} = %s')
            values.append(payload[field])
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='No fields to update')
    fields.append('updated_by = %s')
    values.append(user_id)
    values.append(task_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f'''
            UPDATE dev_tasks
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING *
            ''',
            values,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found')
        conn.commit()
        return row


def delete_task(user_id: str, task_id: str) -> Dict[str, Any]:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('DELETE FROM dev_tasks WHERE id = %s RETURNING *', (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found')
        conn.commit()
        return row

