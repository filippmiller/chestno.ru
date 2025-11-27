from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.products import Product, ProductCreate, ProductUpdate, PublicProduct
from app.services import subscriptions as subscription_service

EDITOR_ROLES = ('owner', 'admin', 'manager', 'editor')
VIEWER_ROLES = EDITOR_ROLES + ('analyst', 'viewer')


def _require_role(cur, organization_id: str, user_id: str, allowed_roles) -> str:
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав для управления товарами')
    return row['role']


def list_products(
    organization_id: str,
    user_id: str,
    status_filter: Optional[str],
    limit: int,
    offset: int,
) -> list[Product]:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)
        params = [organization_id]
        where = 'organization_id = %s'
        if status_filter:
            where += ' AND status = %s'
            params.append(status_filter)
        query = f'''
            SELECT * FROM products
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        '''
        params.extend([limit, offset])
        cur.execute(query, params)
        rows = cur.fetchall()
        return [Product(**row) for row in rows]


def create_product(organization_id: str, user_id: str, payload: ProductCreate) -> Product:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        subscription_service.check_org_limit(organization_id, 'products')
        cur.execute(
            '''
            INSERT INTO products (
                id, organization_id, slug, name, short_description, long_description,
                category, tags, price_cents, currency, status, is_featured,
                main_image_url, gallery, external_url, created_by, updated_by
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s,
                %s, %s, %s, COALESCE(%s,'RUB'), COALESCE(%s,'draft'), COALESCE(%s,false),
                %s, %s, %s, %s, %s
            )
            RETURNING *
            ''',
            (
                organization_id,
                payload.slug,
                payload.name,
                payload.short_description,
                payload.long_description,
                payload.category,
                payload.tags,
                payload.price_cents,
                payload.currency,
                payload.status,
                payload.is_featured,
                payload.main_image_url,
                payload.gallery,
                payload.external_url,
                user_id,
                user_id,
            ),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Не удалось создать товар')
        conn.commit()
        return Product(**row)


def get_product(organization_id: str, product_id: str, user_id: str) -> Product:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)
        cur.execute(
            'SELECT * FROM products WHERE organization_id = %s AND id = %s',
            (organization_id, product_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Товар не найден')
        return Product(**row)


def update_product(organization_id: str, product_id: str, user_id: str, payload: ProductUpdate) -> Product:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return get_product(organization_id, product_id, user_id)
        set_clauses = []
        params = []
        for field, value in update_data.items():
            set_clauses.append(f'{field} = %s')
            params.append(value)
        set_clauses.append('updated_by = %s')
        params.append(user_id)
        set_clauses.append('updated_at = now()')
        query = f'''
            UPDATE products
            SET {', '.join(set_clauses)}
            WHERE id = %s AND organization_id = %s
            RETURNING *
        '''
        params.extend([product_id, organization_id])
        cur.execute(query, params)
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Товар не найден')
        conn.commit()
        return Product(**row)


def archive_product(organization_id: str, product_id: str, user_id: str) -> Product:
    return update_product(
        organization_id,
        product_id,
        user_id,
        ProductUpdate(status='archived'),
    )


def list_public_products_by_org_slug(slug: str) -> list[PublicProduct]:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT p.*
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE o.slug = %s AND p.status = 'published'
            ORDER BY p.is_featured DESC, p.created_at DESC
            ''',
            (slug,),
        )
        rows = cur.fetchall()
        return [PublicProduct(**row) for row in rows]


def get_public_product_by_slug(product_slug: str) -> PublicProduct:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM products
            WHERE slug = %s AND status = 'published'
            ''',
            (product_slug,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Товар не найден')
        return PublicProduct(**row)

