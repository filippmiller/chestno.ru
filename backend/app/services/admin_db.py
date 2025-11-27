from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Sequence

from fastapi import HTTPException, status
from psycopg import sql
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin

IDENTIFIER_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
ALLOWED_COLUMN_TYPES = {'text', 'integer', 'bigint', 'numeric', 'uuid', 'boolean', 'timestamptz', 'jsonb'}


def _validate_identifier(value: str) -> str:
    if not IDENTIFIER_RE.match(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid identifier')
    return value


def list_tables(user_id: str) -> List[Dict[str, Any]]:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                c.relname AS table_name,
                n.nspname AS schema_name,
                COALESCE(c.reltuples, 0)::bigint AS approx_rows,
                obj_description(c.oid) AS comment
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY c.relname
            '''
        )
        return cur.fetchall()


def get_table_columns(user_id: str, table_name: str) -> List[Dict[str, Any]]:
    assert_platform_admin(user_id)
    table_name = _validate_identifier(table_name)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                col.column_name,
                col.data_type,
                col.is_nullable = 'YES' AS is_nullable,
                col.column_default,
                col.udt_name,
                pgd.description AS comment,
                EXISTS (
                    SELECT 1
                    FROM pg_constraint pc
                    JOIN pg_attribute pa ON pa.attrelid = pc.conrelid AND pa.attnum = ANY(pc.conkey)
                    WHERE pc.contype = 'p'
                      AND pc.conrelid = format('public.%s', %s)::regclass
                      AND pa.attname = col.column_name
                ) AS is_primary_key,
                EXISTS (
                    SELECT 1
                    FROM pg_constraint pc
                    JOIN pg_attribute pa ON pa.attrelid = pc.conrelid AND pa.attnum = ANY(pc.conkey)
                    WHERE pc.contype = 'f'
                      AND pc.conrelid = format('public.%s', %s)::regclass
                      AND pa.attname = col.column_name
                ) AS is_foreign_key
            FROM information_schema.columns col
            LEFT JOIN pg_catalog.pg_description pgd
              ON pgd.objoid = format('public.%s', %s)::regclass
             AND pgd.objsubid = col.ordinal_position
            WHERE col.table_schema = 'public' AND col.table_name = %s
            ORDER BY col.ordinal_position
            ''',
            (table_name, table_name, table_name),
        )
        columns = cur.fetchall()
        if not columns:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Table not found')
        return columns


def get_table_rows(
    user_id: str,
    table_name: str,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    order_by: str | None = None,
) -> Dict[str, Any]:
    assert_platform_admin(user_id)
    table_name = _validate_identifier(table_name)
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            ''',
            (table_name,),
        )
        columns = cur.fetchall()
        if not columns:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Table not found')

        text_columns = [col['column_name'] for col in columns if col['data_type'] in ('text', 'character varying')]
        order_clause = sql.SQL('')
        if order_by:
            order_by = _validate_identifier(order_by)
            if order_by not in [col['column_name'] for col in columns]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown order column')
            order_clause = sql.SQL('ORDER BY {}').format(sql.Identifier(order_by))

        where_clause = sql.SQL('')
        params: List[Any] = []
        if search and text_columns:
            conditions = [
                sql.SQL('{}::text ILIKE %s').format(sql.Identifier(col_name)) for col_name in text_columns
            ]
            where_clause = sql.SQL('WHERE (') + sql.SQL(' OR ').join(conditions) + sql.SQL(')')
            params.append(f'%{search}%')

        query = (
            sql.SQL('SELECT * FROM {table} ').format(table=sql.Identifier('public', table_name))
            + where_clause
            + order_clause
            + sql.SQL(' LIMIT %s OFFSET %s')
        )
        with conn.cursor(row_factory=dict_row) as data_cur:
            data_cur.execute(query, (*params, limit, offset))
            rows = data_cur.fetchall()

        return {
            'columns': [col['column_name'] for col in columns],
            'rows': rows,
            'limit': limit,
            'offset': offset,
            'count': len(rows),
        }


def create_migration_draft(
    user_id: str,
    table_name: str,
    column_name: str,
    column_type: str,
    default_value: str | None,
    is_nullable: bool,
) -> Dict[str, Any]:
    assert_platform_admin(user_id)
    table_name = _validate_identifier(table_name)
    column_name = _validate_identifier(column_name)
    column_type = column_type.lower()
    if column_type not in ALLOWED_COLUMN_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unsupported column type')

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
            ''',
            (table_name,),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Table not found')

        sql_parts = [
            sql.SQL('ALTER TABLE public.{} ADD COLUMN {} {}').format(
                sql.Identifier(table_name),
                sql.Identifier(column_name),
                sql.SQL(column_type),
            )
        ]
        if default_value:
            sql_parts.append(sql.SQL(' DEFAULT ') + sql.SQL(default_value))
        if not is_nullable:
            sql_parts.append(sql.SQL(' NOT NULL'))
        sql_parts.append(sql.SQL(';'))
        draft_sql = sql.Composed(sql_parts).as_string(cur.connection)

        cur.execute(
            '''
            INSERT INTO migration_drafts (table_name, column_name, column_type, default_value, is_nullable, created_by, sql_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (table_name, column_name, column_type, default_value, is_nullable, user_id, draft_sql),
        )
        row = cur.fetchone()
        conn.commit()
        return row

