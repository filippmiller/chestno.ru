"""
Service layer for product journey tracking.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.db import get_connection
from app.schemas.product_journey import (
    GeoLocation,
    JourneyStep,
    JourneyStepCreate,
    JourneyStepUpdate,
    ProductJourney,
    PublicProductPage,
)


PRODUCER_ROLES = ('owner', 'admin', 'manager', 'editor')


def _require_producer_role(cur, organization_id: str, user_id: str) -> str:
    """Verify user has producer role for the organization."""
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id)
    )
    row = cur.fetchone()
    if not row or row['role'] not in PRODUCER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Insufficient permissions to manage product journey'
        )
    return row['role']


def get_public_product_page(slug: str) -> PublicProductPage:
    """Get full public product page data by slug."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                p.*,
                o.name as organization_name,
                o.slug as organization_slug,
                o.logo_url as organization_logo_url,
                (SELECT COUNT(*) FROM product_journey_steps WHERE product_id = p.id) as journey_steps_count,
                (SELECT COUNT(*) FROM product_journey_steps WHERE product_id = p.id AND is_verified = true) as journey_verified_count,
                (SELECT COUNT(*) FROM consumer_subscriptions WHERE target_type = 'product' AND target_id = p.id AND is_active = true) as followers_count,
                (SELECT COUNT(*) FROM share_events WHERE shared_type = 'product' AND shared_id = p.id) as shares_count
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE p.slug = %s AND p.status = 'published'
            ''',
            (slug,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        return PublicProductPage(
            id=row['id'],
            organization_id=row['organization_id'],
            organization_name=row['organization_name'],
            organization_slug=row['organization_slug'],
            organization_logo_url=row['organization_logo_url'],
            slug=row['slug'],
            name=row['name'],
            short_description=row['short_description'],
            long_description=row['long_description'],
            category=row['category'],
            tags=row['tags'],
            price_cents=row['price_cents'],
            currency=row['currency'] or 'RUB',
            main_image_url=row['main_image_url'],
            gallery=row['gallery'],
            external_url=row['external_url'],
            sku=row['sku'],
            is_variant=row['is_variant'] or False,
            journey_steps_count=row['journey_steps_count'] or 0,
            journey_verified_count=row['journey_verified_count'] or 0,
            followers_count=row['followers_count'] or 0,
            shares_count=row['shares_count'] or 0,
            created_at=row['created_at'],
            updated_at=row['updated_at'],
        )


def get_product_journey(product_id: str) -> ProductJourney:
    """Get the complete journey for a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product info
        cur.execute(
            '''
            SELECT p.id, p.name, p.slug, o.name as organization_name
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE p.id = %s AND p.status = 'published'
            ''',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        # Get journey steps
        cur.execute(
            '''
            SELECT * FROM product_journey_steps
            WHERE product_id = %s
            ORDER BY step_order, created_at
            ''',
            (product_id,)
        )
        rows = cur.fetchall()

        steps = [_row_to_step(row) for row in rows]
        completed = len(steps)  # All steps are considered completed once added
        verified = sum(1 for s in steps if s.status == 'verified')

        return ProductJourney(
            product_id=product['id'],
            product_name=product['name'],
            product_slug=product['slug'],
            organization_name=product['organization_name'],
            steps=steps,
            total_steps=len(steps),
            completed_steps=completed,
            verified_steps=verified,
        )


def create_journey_step(
    product_id: str,
    user_id: str,
    payload: JourneyStepCreate
) -> JourneyStep:
    """Create a new journey step for a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product and verify permissions
        cur.execute(
            'SELECT organization_id FROM products WHERE id = %s',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        _require_producer_role(cur, product['organization_id'], user_id)

        # Determine step_order if not provided
        step_order = payload.order_index
        if step_order is None:
            cur.execute(
                'SELECT COALESCE(MAX(step_order), 0) + 1 as next_order FROM product_journey_steps WHERE product_id = %s',
                (product_id,)
            )
            step_order = cur.fetchone()['next_order']

        # Prepare location as JSON
        location_coords = None
        location_name = None
        if payload.location:
            location_coords = Jsonb({
                'lat': payload.location.latitude,
                'lng': payload.location.longitude
            })
            location_name = payload.location.address

        cur.execute(
            '''
            INSERT INTO product_journey_steps (
                id, product_id, step_type, title, description,
                location_name, location_coordinates, step_date,
                is_verified, media_urls, metadata, step_order, created_by
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            RETURNING *
            ''',
            (
                product_id,
                _map_step_type(payload.step_type.value),
                payload.title,
                payload.description,
                location_name,
                location_coords,
                payload.occurred_at.date() if payload.occurred_at else None,
                payload.status.value == 'verified',
                payload.media_urls or [],
                Jsonb(payload.metadata) if payload.metadata else None,
                step_order,
                user_id,
            )
        )
        row = cur.fetchone()
        conn.commit()

        return _row_to_step(row)


def update_journey_step(
    product_id: str,
    step_id: str,
    user_id: str,
    payload: JourneyStepUpdate
) -> JourneyStep:
    """Update a journey step."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product and verify permissions
        cur.execute(
            'SELECT organization_id FROM products WHERE id = %s',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        _require_producer_role(cur, product['organization_id'], user_id)

        # Build dynamic update
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            # Return existing step
            cur.execute(
                'SELECT * FROM product_journey_steps WHERE id = %s AND product_id = %s',
                (step_id, product_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Journey step not found'
                )
            return _row_to_step(row)

        set_clauses = []
        params = []

        for field, value in update_data.items():
            if field == 'location' and value:
                # Map location to location_coordinates and location_name
                if isinstance(value, dict):
                    set_clauses.append('location_coordinates = %s')
                    params.append(Jsonb({'lat': value.get('latitude', 0), 'lng': value.get('longitude', 0)}))
                    if value.get('address'):
                        set_clauses.append('location_name = %s')
                        params.append(value['address'])
            elif field == 'metadata' and value:
                set_clauses.append('metadata = %s')
                params.append(Jsonb(value))
            elif field == 'step_type':
                set_clauses.append('step_type = %s')
                step_val = value.value if hasattr(value, 'value') else value
                params.append(_map_step_type(step_val))
            elif field == 'status':
                # Map status to is_verified
                status_val = value.value if hasattr(value, 'value') else value
                set_clauses.append('is_verified = %s')
                params.append(status_val == 'verified')
            elif field == 'occurred_at' and value:
                set_clauses.append('step_date = %s')
                params.append(value.date() if hasattr(value, 'date') else value)
            elif field == 'order_index':
                set_clauses.append('step_order = %s')
                params.append(value)
            elif field == 'media_urls':
                set_clauses.append('media_urls = %s')
                params.append(value or [])
            elif field in ('title', 'description'):
                set_clauses.append(f'{field} = %s')
                params.append(value)

        set_clauses.append('updated_at = now()')
        params.extend([step_id, product_id])

        cur.execute(
            f'''
            UPDATE product_journey_steps
            SET {', '.join(set_clauses)}
            WHERE id = %s AND product_id = %s
            RETURNING *
            ''',
            params
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Journey step not found'
            )
        conn.commit()

        return _row_to_step(row)


def delete_journey_step(product_id: str, step_id: str, user_id: str) -> None:
    """Delete a journey step."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product and verify permissions
        cur.execute(
            'SELECT organization_id FROM products WHERE id = %s',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        _require_producer_role(cur, product['organization_id'], user_id)

        cur.execute(
            'DELETE FROM product_journey_steps WHERE id = %s AND product_id = %s',
            (step_id, product_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Journey step not found'
            )
        conn.commit()


def _map_step_type(step_type: str) -> str:
    """Map API step types to database step types."""
    mapping = {
        'origin': 'sourcing',
        'processing': 'processing',
        'quality_check': 'quality_check',
        'packaging': 'packaging',
        'storage': 'storage',
        'transport': 'distribution',
        'distribution': 'distribution',
        'retail': 'other',
        'custom': 'other',
    }
    return mapping.get(step_type, 'other')


def _map_step_type_to_api(db_type: str) -> str:
    """Map database step types to API step types."""
    mapping = {
        'sourcing': 'origin',
        'processing': 'processing',
        'quality_check': 'quality_check',
        'packaging': 'packaging',
        'storage': 'storage',
        'distribution': 'distribution',
        'certification': 'quality_check',
        'other': 'custom',
    }
    return mapping.get(db_type, 'custom')


def _row_to_step(row: dict) -> JourneyStep:
    """Convert database row to JourneyStep model."""
    location = None
    if row.get('location_coordinates'):
        coords = row['location_coordinates']
        location = GeoLocation(
            latitude=coords.get('lat', 0),
            longitude=coords.get('lng', 0),
            address=row.get('location_name')
        )

    # Map is_verified to status
    status = 'verified' if row.get('is_verified') else 'completed'

    return JourneyStep(
        id=str(row['id']),
        product_id=str(row['product_id']),
        step_type=_map_step_type_to_api(row['step_type']),
        title=row['title'],
        description=row.get('description'),
        location=location,
        occurred_at=row.get('step_date'),
        status=status,
        media_urls=row.get('media_urls') or [],
        metadata=row.get('metadata'),
        order_index=row['step_order'],
        created_by=str(row['created_by']) if row.get('created_by') else '',
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )
