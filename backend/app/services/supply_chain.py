"""
Supply Chain Visualization Service

Manages supply chain nodes and steps for product traceability.
Provides CRUD operations and journey building functionality.

Database tables:
- supply_chain_nodes: Locations in the supply chain
- supply_chain_steps: Transitions between nodes

SQL functions:
- get_supply_chain_journey(product_id): Get complete journey
- get_supply_chain_stats(product_id): Get statistics
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.db import get_connection
from app.schemas.supply_chain import (
    GeoCoordinates,
    SupplyChainJourney,
    SupplyChainJourneyNode,
    SupplyChainNode,
    SupplyChainNodeCreate,
    SupplyChainNodeType,
    SupplyChainNodeUpdate,
    SupplyChainStats,
    SupplyChainStep,
    SupplyChainStepCreate,
    SupplyChainStepUpdate,
)

logger = logging.getLogger(__name__)

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
            detail='Insufficient permissions to manage supply chain'
        )
    return row['role']


def _get_product_org_id(cur, product_id: str) -> str:
    """Get organization ID for a product."""
    cur.execute(
        'SELECT organization_id FROM products WHERE id = %s',
        (product_id,)
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Product not found'
        )
    return row['organization_id']


def _row_to_node(row: dict) -> SupplyChainNode:
    """Convert database row to SupplyChainNode model."""
    coordinates = None
    if row.get('coordinates'):
        coords = row['coordinates']
        if isinstance(coords, dict):
            coordinates = GeoCoordinates(
                lat=coords.get('lat', 0),
                lng=coords.get('lng', 0)
            )

    return SupplyChainNode(
        id=str(row['id']),
        organization_id=str(row['organization_id']),
        product_id=str(row['product_id']) if row.get('product_id') else None,
        node_type=SupplyChainNodeType(row['node_type']),
        name=row['name'],
        description=row.get('description'),
        location=row.get('location'),
        coordinates=coordinates,
        order_index=row['order_index'],
        contact_name=row.get('contact_name'),
        contact_phone=row.get('contact_phone'),
        contact_email=row.get('contact_email'),
        external_id=row.get('external_id'),
        is_verified=row.get('is_verified', False),
        verified_at=row.get('verified_at'),
        image_url=row.get('image_url'),
        certificate_urls=row.get('certificate_urls') or [],
        metadata=row.get('metadata'),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_step(row: dict) -> SupplyChainStep:
    """Convert database row to SupplyChainStep model."""
    return SupplyChainStep(
        id=str(row['id']),
        product_id=str(row['product_id']),
        from_node_id=str(row['from_node_id']),
        to_node_id=str(row['to_node_id']),
        description=row.get('description'),
        transport_method=row.get('transport_method'),
        distance_km=float(row['distance_km']) if row.get('distance_km') else None,
        duration_hours=float(row['duration_hours']) if row.get('duration_hours') else None,
        timestamp=row.get('timestamp'),
        expected_arrival=row.get('expected_arrival'),
        verified=row.get('verified', False),
        verified_at=row.get('verified_at'),
        verification_notes=row.get('verification_notes'),
        tracking_number=row.get('tracking_number'),
        batch_id=row.get('batch_id'),
        temperature_celsius=float(row['temperature_celsius']) if row.get('temperature_celsius') else None,
        humidity_percent=float(row['humidity_percent']) if row.get('humidity_percent') else None,
        document_urls=row.get('document_urls') or [],
        metadata=row.get('metadata'),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


# ============================================================
# NODE CRUD
# ============================================================

def get_nodes_for_product(product_id: str) -> List[SupplyChainNode]:
    """Get all supply chain nodes for a product, ordered by index."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM supply_chain_nodes
            WHERE product_id = %s
            ORDER BY order_index ASC, created_at ASC
            ''',
            (product_id,)
        )
        rows = cur.fetchall()
        return [_row_to_node(row) for row in rows]


def get_nodes_for_organization(
    organization_id: str,
    product_id: Optional[str] = None
) -> List[SupplyChainNode]:
    """Get all supply chain nodes for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        if product_id:
            cur.execute(
                '''
                SELECT * FROM supply_chain_nodes
                WHERE organization_id = %s AND product_id = %s
                ORDER BY order_index ASC, created_at ASC
                ''',
                (organization_id, product_id)
            )
        else:
            cur.execute(
                '''
                SELECT * FROM supply_chain_nodes
                WHERE organization_id = %s
                ORDER BY order_index ASC, created_at ASC
                ''',
                (organization_id,)
            )
        rows = cur.fetchall()
        return [_row_to_node(row) for row in rows]


def get_node_by_id(node_id: str) -> SupplyChainNode:
    """Get a single supply chain node by ID."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT * FROM supply_chain_nodes WHERE id = %s',
            (node_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain node not found'
            )
        return _row_to_node(row)


def create_node(
    organization_id: str,
    user_id: str,
    payload: SupplyChainNodeCreate
) -> SupplyChainNode:
    """Create a new supply chain node."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _require_producer_role(cur, organization_id, user_id)

        # Determine order_index if not provided
        order_index = payload.order_index
        if order_index is None:
            cur.execute(
                '''
                SELECT COALESCE(MAX(order_index), -1) + 1 as next_order
                FROM supply_chain_nodes
                WHERE organization_id = %s AND (product_id = %s OR (%s IS NULL AND product_id IS NULL))
                ''',
                (organization_id, payload.product_id, payload.product_id)
            )
            order_index = cur.fetchone()['next_order']

        # Prepare coordinates as JSON
        coordinates = None
        if payload.coordinates:
            coordinates = Jsonb({
                'lat': payload.coordinates.lat,
                'lng': payload.coordinates.lng
            })

        cur.execute(
            '''
            INSERT INTO supply_chain_nodes (
                organization_id, product_id, node_type, name, description,
                location, coordinates, order_index, contact_name, contact_phone,
                contact_email, external_id, image_url, certificate_urls,
                metadata, created_by
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
            RETURNING *
            ''',
            (
                organization_id,
                payload.product_id,
                payload.node_type.value,
                payload.name,
                payload.description,
                payload.location,
                coordinates,
                order_index,
                payload.contact_name,
                payload.contact_phone,
                payload.contact_email,
                payload.external_id,
                payload.image_url,
                payload.certificate_urls or [],
                Jsonb(payload.metadata) if payload.metadata else None,
                user_id,
            )
        )
        row = cur.fetchone()
        conn.commit()

        logger.info(f"[supply_chain] Created node {row['id']} for org {organization_id}")
        return _row_to_node(row)


def update_node(
    node_id: str,
    user_id: str,
    payload: SupplyChainNodeUpdate
) -> SupplyChainNode:
    """Update a supply chain node."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get node and verify permissions
        cur.execute(
            'SELECT organization_id FROM supply_chain_nodes WHERE id = %s',
            (node_id,)
        )
        node = cur.fetchone()
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain node not found'
            )

        _require_producer_role(cur, node['organization_id'], user_id)

        # Build dynamic update
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            cur.execute('SELECT * FROM supply_chain_nodes WHERE id = %s', (node_id,))
            return _row_to_node(cur.fetchone())

        set_clauses = []
        params = []

        for field, value in update_data.items():
            if field == 'coordinates' and value:
                set_clauses.append('coordinates = %s')
                params.append(Jsonb({'lat': value.get('lat', 0), 'lng': value.get('lng', 0)}))
            elif field == 'metadata' and value:
                set_clauses.append('metadata = %s')
                params.append(Jsonb(value))
            elif field == 'node_type':
                set_clauses.append('node_type = %s')
                node_type_val = value.value if hasattr(value, 'value') else value
                params.append(node_type_val)
            elif field == 'certificate_urls':
                set_clauses.append('certificate_urls = %s')
                params.append(value or [])
            elif field == 'is_verified':
                set_clauses.append('is_verified = %s')
                params.append(value)
                if value:
                    set_clauses.append('verified_at = now()')
                    set_clauses.append('verified_by = %s')
                    params.append(user_id)
            elif field in ('name', 'description', 'location', 'order_index',
                          'contact_name', 'contact_phone', 'contact_email',
                          'external_id', 'image_url'):
                set_clauses.append(f'{field} = %s')
                params.append(value)

        set_clauses.append('updated_at = now()')
        params.append(node_id)

        cur.execute(
            f'''
            UPDATE supply_chain_nodes
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING *
            ''',
            params
        )
        row = cur.fetchone()
        conn.commit()

        logger.info(f"[supply_chain] Updated node {node_id}")
        return _row_to_node(row)


def delete_node(node_id: str, user_id: str) -> None:
    """Delete a supply chain node."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get node and verify permissions
        cur.execute(
            'SELECT organization_id FROM supply_chain_nodes WHERE id = %s',
            (node_id,)
        )
        node = cur.fetchone()
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain node not found'
            )

        _require_producer_role(cur, node['organization_id'], user_id)

        cur.execute('DELETE FROM supply_chain_nodes WHERE id = %s', (node_id,))
        conn.commit()

        logger.info(f"[supply_chain] Deleted node {node_id}")


# ============================================================
# STEP CRUD
# ============================================================

def get_steps_for_product(product_id: str) -> List[SupplyChainStep]:
    """Get all supply chain steps for a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM supply_chain_steps
            WHERE product_id = %s
            ORDER BY timestamp ASC NULLS LAST, created_at ASC
            ''',
            (product_id,)
        )
        rows = cur.fetchall()
        return [_row_to_step(row) for row in rows]


def get_step_by_id(step_id: str) -> SupplyChainStep:
    """Get a single supply chain step by ID."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT * FROM supply_chain_steps WHERE id = %s',
            (step_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain step not found'
            )
        return _row_to_step(row)


def create_step(
    product_id: str,
    user_id: str,
    payload: SupplyChainStepCreate
) -> SupplyChainStep:
    """Create a new supply chain step."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        org_id = _get_product_org_id(cur, product_id)
        _require_producer_role(cur, org_id, user_id)

        # Verify both nodes exist
        cur.execute(
            'SELECT id FROM supply_chain_nodes WHERE id IN (%s, %s)',
            (payload.from_node_id, payload.to_node_id)
        )
        if len(cur.fetchall()) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='One or both supply chain nodes not found'
            )

        cur.execute(
            '''
            INSERT INTO supply_chain_steps (
                product_id, from_node_id, to_node_id, description,
                transport_method, distance_km, duration_hours, timestamp,
                expected_arrival, tracking_number, batch_id,
                temperature_celsius, humidity_percent, document_urls,
                metadata, created_by
            )
            VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            RETURNING *
            ''',
            (
                product_id,
                payload.from_node_id,
                payload.to_node_id,
                payload.description,
                payload.transport_method,
                payload.distance_km,
                payload.duration_hours,
                payload.timestamp,
                payload.expected_arrival,
                payload.tracking_number,
                payload.batch_id,
                payload.temperature_celsius,
                payload.humidity_percent,
                payload.document_urls or [],
                Jsonb(payload.metadata) if payload.metadata else None,
                user_id,
            )
        )
        row = cur.fetchone()
        conn.commit()

        logger.info(f"[supply_chain] Created step {row['id']} for product {product_id}")
        return _row_to_step(row)


def update_step(
    step_id: str,
    user_id: str,
    payload: SupplyChainStepUpdate
) -> SupplyChainStep:
    """Update a supply chain step."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get step and verify permissions
        cur.execute(
            'SELECT product_id FROM supply_chain_steps WHERE id = %s',
            (step_id,)
        )
        step = cur.fetchone()
        if not step:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain step not found'
            )

        org_id = _get_product_org_id(cur, step['product_id'])
        _require_producer_role(cur, org_id, user_id)

        # Build dynamic update
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            cur.execute('SELECT * FROM supply_chain_steps WHERE id = %s', (step_id,))
            return _row_to_step(cur.fetchone())

        set_clauses = []
        params = []

        for field, value in update_data.items():
            if field == 'metadata' and value:
                set_clauses.append('metadata = %s')
                params.append(Jsonb(value))
            elif field == 'document_urls':
                set_clauses.append('document_urls = %s')
                params.append(value or [])
            elif field == 'verified':
                set_clauses.append('verified = %s')
                params.append(value)
                if value:
                    set_clauses.append('verified_at = now()')
                    set_clauses.append('verified_by = %s')
                    params.append(user_id)
            elif field in ('description', 'transport_method', 'distance_km',
                          'duration_hours', 'timestamp', 'expected_arrival',
                          'verification_notes', 'tracking_number', 'batch_id',
                          'temperature_celsius', 'humidity_percent'):
                set_clauses.append(f'{field} = %s')
                params.append(value)

        set_clauses.append('updated_at = now()')
        params.append(step_id)

        cur.execute(
            f'''
            UPDATE supply_chain_steps
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING *
            ''',
            params
        )
        row = cur.fetchone()
        conn.commit()

        logger.info(f"[supply_chain] Updated step {step_id}")
        return _row_to_step(row)


def delete_step(step_id: str, user_id: str) -> None:
    """Delete a supply chain step."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get step and verify permissions
        cur.execute(
            'SELECT product_id FROM supply_chain_steps WHERE id = %s',
            (step_id,)
        )
        step = cur.fetchone()
        if not step:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain step not found'
            )

        org_id = _get_product_org_id(cur, step['product_id'])
        _require_producer_role(cur, org_id, user_id)

        cur.execute('DELETE FROM supply_chain_steps WHERE id = %s', (step_id,))
        conn.commit()

        logger.info(f"[supply_chain] Deleted step {step_id}")


# ============================================================
# JOURNEY BUILDING
# ============================================================

def get_product_journey(product_id: str) -> SupplyChainJourney:
    """Get the complete supply chain journey for a product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product info
        cur.execute(
            '''
            SELECT p.id, p.name, p.slug, p.organization_id, o.name as organization_name
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE p.id = %s
            ''',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Product not found'
            )

        # Get nodes ordered by index
        cur.execute(
            '''
            SELECT * FROM supply_chain_nodes
            WHERE product_id = %s
            ORDER BY order_index ASC
            ''',
            (product_id,)
        )
        node_rows = cur.fetchall()
        nodes = [_row_to_node(row) for row in node_rows]

        # Get steps
        cur.execute(
            '''
            SELECT * FROM supply_chain_steps
            WHERE product_id = %s
            ''',
            (product_id,)
        )
        step_rows = cur.fetchall()
        steps = [_row_to_step(row) for row in step_rows]

        # Build step lookup by from_node_id
        step_by_from_node = {s.from_node_id: s for s in steps}

        # Build journey nodes
        journey_nodes = []
        for node in nodes:
            step_to_next = step_by_from_node.get(node.id)
            journey_nodes.append(SupplyChainJourneyNode(
                node=node,
                step_to_next=step_to_next
            ))

        # Calculate stats
        total_nodes = len(nodes)
        verified_nodes = sum(1 for n in nodes if n.is_verified)
        total_steps = len(steps)
        verified_steps = sum(1 for s in steps if s.verified)
        total_distance = sum(s.distance_km or 0 for s in steps)
        total_duration = sum(s.duration_hours or 0 for s in steps)

        return SupplyChainJourney(
            product_id=str(product['id']),
            product_name=product['name'],
            product_slug=product['slug'],
            organization_id=str(product['organization_id']),
            organization_name=product['organization_name'],
            nodes=journey_nodes,
            total_nodes=total_nodes,
            verified_nodes=verified_nodes,
            total_steps=total_steps,
            verified_steps=verified_steps,
            total_distance_km=total_distance,
            total_duration_hours=total_duration,
        )


def get_supply_chain_stats(product_id: str) -> SupplyChainStats:
    """Get statistics about a product's supply chain."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT public.get_supply_chain_stats(%s::uuid) as stats',
            (product_id,)
        )
        row = cur.fetchone()
        if not row or not row['stats']:
            return SupplyChainStats()

        stats = row['stats']
        total = stats.get('total_nodes', 0) + stats.get('total_steps', 0)
        verified = stats.get('verified_nodes', 0) + stats.get('verified_steps', 0)

        return SupplyChainStats(
            total_nodes=stats.get('total_nodes', 0),
            verified_nodes=stats.get('verified_nodes', 0),
            total_steps=stats.get('total_steps', 0),
            verified_steps=stats.get('verified_steps', 0),
            total_distance_km=float(stats.get('total_distance_km', 0)),
            total_duration_hours=float(stats.get('total_duration_hours', 0)),
            verification_percentage=round(verified / total * 100, 1) if total > 0 else 0.0,
        )


# ============================================================
# VERIFICATION
# ============================================================

def verify_node(node_id: str, user_id: str, notes: Optional[str] = None) -> SupplyChainNode:
    """Mark a supply chain node as verified."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE supply_chain_nodes
            SET is_verified = true, verified_at = now(), verified_by = %s
            WHERE id = %s
            RETURNING *
            ''',
            (user_id, node_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain node not found'
            )
        conn.commit()

        logger.info(f"[supply_chain] Verified node {node_id} by user {user_id}")
        return _row_to_node(row)


def verify_step(step_id: str, user_id: str, notes: Optional[str] = None) -> SupplyChainStep:
    """Mark a supply chain step as verified."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE supply_chain_steps
            SET verified = true, verified_at = now(), verified_by = %s, verification_notes = %s
            WHERE id = %s
            RETURNING *
            ''',
            (user_id, notes, step_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Supply chain step not found'
            )
        conn.commit()

        logger.info(f"[supply_chain] Verified step {step_id} by user {user_id}")
        return _row_to_step(row)


# ============================================================
# CARBON FOOTPRINT CALCULATION (Feature #7 Enhancement)
# ============================================================

# CO2 emissions per km by transport method (kg CO2 per ton-km)
CARBON_EMISSIONS = {
    'truck': 0.062,       # Average truck
    'rail': 0.022,        # Train/rail
    'sea': 0.008,         # Container ship
    'air': 0.602,         # Cargo plane
    'pipeline': 0.003,    # Oil/gas pipeline
    'local': 0.05,        # Local delivery van
    'unknown': 0.05,      # Default estimate
}


def calculate_carbon_footprint(product_id: str, weight_kg: float = 1.0) -> dict:
    """
    Calculate estimated carbon footprint for a product's supply chain journey.

    Args:
        product_id: Product to calculate for
        weight_kg: Product weight in kg (for more accurate calculation)

    Returns:
        Detailed carbon footprint breakdown
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT transport_method, distance_km
            FROM supply_chain_steps
            WHERE product_id = %s AND distance_km > 0
            ''',
            (product_id,)
        )
        steps = cur.fetchall()

        if not steps:
            return {
                'total_co2_kg': 0,
                'breakdown': [],
                'comparison': None,
                'rating': 'unknown'
            }

        breakdown = []
        total_co2 = 0
        total_distance = 0

        for step in steps:
            method = step['transport_method'] or 'unknown'
            distance = step['distance_km'] or 0
            emission_factor = CARBON_EMISSIONS.get(method.lower(), CARBON_EMISSIONS['unknown'])

            # CO2 = distance * emission factor * weight (in tons)
            co2_kg = distance * emission_factor * (weight_kg / 1000)
            total_co2 += co2_kg
            total_distance += distance

            breakdown.append({
                'transport_method': method,
                'distance_km': distance,
                'emission_factor': emission_factor,
                'co2_kg': round(co2_kg, 3)
            })

        # Compare to common products
        comparison = _get_carbon_comparison(total_co2)

        # Rating based on distance-adjusted CO2
        if total_distance > 0:
            co2_per_km = total_co2 / total_distance
            if co2_per_km < 0.02:
                rating = 'excellent'
            elif co2_per_km < 0.04:
                rating = 'good'
            elif co2_per_km < 0.06:
                rating = 'average'
            else:
                rating = 'high'
        else:
            rating = 'unknown'

        return {
            'total_co2_kg': round(total_co2, 3),
            'total_distance_km': total_distance,
            'weight_kg': weight_kg,
            'breakdown': breakdown,
            'comparison': comparison,
            'rating': rating
        }


def _get_carbon_comparison(co2_kg: float) -> dict:
    """Get relatable comparisons for the carbon footprint."""
    # Average car emits 0.21 kg CO2 per km
    car_km = round(co2_kg / 0.21, 1)

    # Average tree absorbs 21 kg CO2 per year
    tree_days = round((co2_kg / 21) * 365, 1)

    # Average smartphone charge = 0.008 kg CO2
    phone_charges = round(co2_kg / 0.008)

    return {
        'equivalent_car_km': car_km,
        'tree_absorption_days': tree_days,
        'phone_charges': phone_charges,
        'description_ru': f'Эквивалентно {car_km} км на автомобиле или {tree_days} дней поглощения дерева'
    }


def get_journey_with_carbon(product_id: str, weight_kg: float = 1.0) -> dict:
    """
    Get the complete supply chain journey with carbon footprint data.

    This is an enhanced version of get_product_journey() that includes
    environmental impact information.
    """
    journey = get_product_journey(product_id)
    carbon = calculate_carbon_footprint(product_id, weight_kg)

    return {
        'journey': journey,
        'carbon_footprint': carbon,
        'environmental_score': _calculate_environmental_score(journey, carbon)
    }


def _calculate_environmental_score(journey, carbon: dict) -> dict:
    """Calculate an overall environmental score for the supply chain."""
    # Factors: verification %, carbon rating, local sourcing
    verification_pct = 0
    if journey.total_nodes > 0:
        verification_pct = (journey.verified_nodes / journey.total_nodes) * 100

    # Carbon rating to score
    carbon_scores = {
        'excellent': 100,
        'good': 80,
        'average': 60,
        'high': 40,
        'unknown': 50
    }
    carbon_score = carbon_scores.get(carbon.get('rating', 'unknown'), 50)

    # Distance penalty (more local = better)
    distance = carbon.get('total_distance_km', 0)
    if distance < 100:
        distance_score = 100
    elif distance < 500:
        distance_score = 80
    elif distance < 2000:
        distance_score = 60
    elif distance < 10000:
        distance_score = 40
    else:
        distance_score = 20

    # Weighted average
    total_score = (verification_pct * 0.3) + (carbon_score * 0.4) + (distance_score * 0.3)

    return {
        'total_score': round(total_score, 1),
        'verification_score': round(verification_pct, 1),
        'carbon_score': carbon_score,
        'distance_score': distance_score,
        'grade': 'A' if total_score >= 80 else 'B' if total_score >= 60 else 'C' if total_score >= 40 else 'D'
    }
