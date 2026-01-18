from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from slugify import slugify

from app.core.db import get_connection
from app.schemas.products import (
    Product,
    ProductCreate,
    ProductUpdate,
    PublicProduct,
    ProductWithVariants,
    ProductVariantCreate,
    VariantAttribute,
    AttributeTemplate,
    AttributeTemplateCreate,
    AttributeTemplateUpdate,
    BulkVariantCreate,
)
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


# =====================
# Variant Functions
# =====================

def get_product_with_variants(
    organization_id: str,
    product_id: str,
    user_id: str,
) -> ProductWithVariants:
    """Get a product with all its variants and attributes."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)

        # Get parent product
        cur.execute(
            'SELECT * FROM products WHERE organization_id = %s AND id = %s',
            (organization_id, product_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Товар не найден')

        product = ProductWithVariants(**row)

        # Get variants
        cur.execute(
            '''
            SELECT * FROM products
            WHERE organization_id = %s AND parent_product_id = %s
            ORDER BY created_at
            ''',
            (organization_id, product_id),
        )
        variants = cur.fetchall()
        product.variants = [Product(**v) for v in variants]
        product.variant_count = len(variants)

        # Get attributes for parent product (if it's also a variant itself)
        cur.execute(
            '''
            SELECT id, attribute_name, attribute_value, display_order
            FROM product_variant_attributes
            WHERE product_id = %s
            ORDER BY display_order
            ''',
            (product_id,),
        )
        attrs = cur.fetchall()
        product.attributes = [VariantAttribute(**a) for a in attrs]

        return product


def create_variant(
    organization_id: str,
    parent_product_id: str,
    user_id: str,
    payload: ProductVariantCreate,
) -> Product:
    """Create a variant of an existing product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)
        subscription_service.check_org_limit(organization_id, 'products')

        # Verify parent exists
        cur.execute(
            'SELECT * FROM products WHERE organization_id = %s AND id = %s',
            (organization_id, parent_product_id),
        )
        parent = cur.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Родительский товар не найден')

        # Generate slug
        base_slug = payload.slug or slugify(payload.name, lowercase=True)
        slug = f"{parent['slug']}-{base_slug}"

        # Create variant product
        cur.execute(
            '''
            INSERT INTO products (
                id, organization_id, slug, name, short_description, long_description,
                category, tags, price_cents, currency, status, is_featured,
                main_image_url, gallery, external_url, parent_product_id, is_variant,
                sku, barcode, stock_quantity, created_by, updated_by
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s,
                %s, %s, COALESCE(%s, %s), %s, %s, false,
                %s, %s, %s, %s, true,
                %s, %s, COALESCE(%s, 0), %s, %s
            )
            RETURNING *
            ''',
            (
                organization_id,
                slug,
                payload.name,
                parent['short_description'],
                parent['long_description'],
                parent['category'],
                parent['tags'],
                payload.price_cents,
                parent['price_cents'],
                parent['currency'],
                parent['status'],
                parent['main_image_url'],
                parent['gallery'],
                parent['external_url'],
                parent_product_id,
                payload.sku,
                payload.barcode,
                payload.stock_quantity,
                user_id,
                user_id,
            ),
        )
        variant = cur.fetchone()
        variant_id = variant['id']

        # Add attributes
        for attr in payload.attributes:
            cur.execute(
                '''
                INSERT INTO product_variant_attributes (product_id, attribute_name, attribute_value, display_order)
                VALUES (%s, %s, %s, %s)
                ''',
                (variant_id, attr.attribute_name, attr.attribute_value, attr.display_order),
            )

        conn.commit()
        return Product(**variant)


def create_bulk_variants(
    organization_id: str,
    parent_product_id: str,
    user_id: str,
    payload: BulkVariantCreate,
) -> list[Product]:
    """Create multiple variants at once (e.g., size × color matrix)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        # Get parent product
        cur.execute(
            'SELECT * FROM products WHERE organization_id = %s AND id = %s',
            (organization_id, parent_product_id),
        )
        parent = cur.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Родительский товар не найден')

        created_variants = []

        for attrs in payload.attribute_combinations:
            # Generate name from attributes
            attr_parts = [a.attribute_value for a in attrs]
            variant_name = f"{parent['name']} ({', '.join(attr_parts)})"

            # Generate slug
            slug_parts = [slugify(a.attribute_value, lowercase=True) for a in attrs]
            slug = f"{parent['slug']}-{'-'.join(slug_parts)}"

            # Check subscription limit
            subscription_service.check_org_limit(organization_id, 'products')

            # Create variant
            cur.execute(
                '''
                INSERT INTO products (
                    id, organization_id, slug, name, short_description, long_description,
                    category, tags, price_cents, currency, status, is_featured,
                    main_image_url, gallery, external_url, parent_product_id, is_variant,
                    stock_quantity, created_by, updated_by
                )
                VALUES (
                    gen_random_uuid(), %s, %s, %s, %s, %s,
                    %s, %s, COALESCE(%s, %s), %s, %s, false,
                    %s, %s, %s, %s, true,
                    COALESCE(%s, 0), %s, %s
                )
                RETURNING *
                ''',
                (
                    organization_id,
                    slug,
                    variant_name,
                    parent['short_description'],
                    parent['long_description'],
                    parent['category'],
                    parent['tags'],
                    payload.base_price_cents,
                    parent['price_cents'],
                    parent['currency'],
                    parent['status'],
                    parent['main_image_url'],
                    parent['gallery'],
                    parent['external_url'],
                    parent_product_id,
                    payload.base_stock_quantity,
                    user_id,
                    user_id,
                ),
            )
            variant = cur.fetchone()
            variant_id = variant['id']

            # Add attributes
            for attr in attrs:
                cur.execute(
                    '''
                    INSERT INTO product_variant_attributes (product_id, attribute_name, attribute_value, display_order)
                    VALUES (%s, %s, %s, %s)
                    ''',
                    (variant_id, attr.attribute_name, attr.attribute_value, attr.display_order),
                )

            created_variants.append(Product(**variant))

        conn.commit()
        return created_variants


def list_variants(
    organization_id: str,
    parent_product_id: str,
    user_id: str,
) -> list[Product]:
    """List all variants of a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)

        cur.execute(
            '''
            SELECT * FROM products
            WHERE organization_id = %s AND parent_product_id = %s
            ORDER BY created_at
            ''',
            (organization_id, parent_product_id),
        )
        rows = cur.fetchall()
        return [Product(**row) for row in rows]


def get_variant_attributes(
    organization_id: str,
    product_id: str,
    user_id: str,
) -> list[VariantAttribute]:
    """Get attributes for a variant product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)

        cur.execute(
            '''
            SELECT a.id, a.attribute_name, a.attribute_value, a.display_order
            FROM product_variant_attributes a
            JOIN products p ON p.id = a.product_id
            WHERE p.organization_id = %s AND a.product_id = %s
            ORDER BY a.display_order
            ''',
            (organization_id, product_id),
        )
        rows = cur.fetchall()
        return [VariantAttribute(**row) for row in rows]


def delete_variant(
    organization_id: str,
    variant_id: str,
    user_id: str,
) -> None:
    """Delete a variant product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        cur.execute(
            '''
            DELETE FROM products
            WHERE organization_id = %s AND id = %s AND is_variant = true
            ''',
            (organization_id, variant_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Вариант не найден')

        conn.commit()


# =====================
# Attribute Templates
# =====================

def list_attribute_templates(
    organization_id: str,
    user_id: str,
) -> list[AttributeTemplate]:
    """List all attribute templates for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, VIEWER_ROLES)

        cur.execute(
            '''
            SELECT * FROM product_attribute_templates
            WHERE organization_id = %s
            ORDER BY display_order, attribute_name
            ''',
            (organization_id,),
        )
        rows = cur.fetchall()
        return [AttributeTemplate(**row) for row in rows]


def create_attribute_template(
    organization_id: str,
    user_id: str,
    payload: AttributeTemplateCreate,
) -> AttributeTemplate:
    """Create a new attribute template."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        cur.execute(
            '''
            INSERT INTO product_attribute_templates (
                organization_id, attribute_name, possible_values, is_required, display_order
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (
                organization_id,
                payload.attribute_name,
                payload.possible_values,
                payload.is_required,
                payload.display_order,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return AttributeTemplate(**row)


def update_attribute_template(
    organization_id: str,
    template_id: str,
    user_id: str,
    payload: AttributeTemplateUpdate,
) -> AttributeTemplate:
    """Update an attribute template."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            cur.execute(
                'SELECT * FROM product_attribute_templates WHERE organization_id = %s AND id = %s',
                (organization_id, template_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')
            return AttributeTemplate(**row)

        set_clauses = []
        params = []
        for field, value in update_data.items():
            set_clauses.append(f'{field} = %s')
            params.append(value)

        set_clauses.append('updated_at = now()')
        params.extend([template_id, organization_id])

        cur.execute(
            f'''
            UPDATE product_attribute_templates
            SET {', '.join(set_clauses)}
            WHERE id = %s AND organization_id = %s
            RETURNING *
            ''',
            params,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')
        conn.commit()
        return AttributeTemplate(**row)


def delete_attribute_template(
    organization_id: str,
    template_id: str,
    user_id: str,
) -> None:
    """Delete an attribute template."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_role(cur, organization_id, user_id, EDITOR_ROLES)

        cur.execute(
            '''
            DELETE FROM product_attribute_templates
            WHERE organization_id = %s AND id = %s
            ''',
            (organization_id, template_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')
        conn.commit()

