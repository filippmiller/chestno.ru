"""
Marketing Materials Service

Handles CRUD operations for marketing templates and materials.
Supports binding resolution for dynamic content (business name, QR URLs, etc.)
"""
import copy
import json
from typing import Any

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.marketing import (
    MarketingMaterial,
    MarketingMaterialCreate,
    MarketingMaterialUpdate,
    MarketingMaterialAdminUpdate,
    MarketingTemplate,
)


# Roles that can view materials
VIEWER_ROLES = {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'}
# Roles that can create/edit materials
EDITOR_ROLES = {'owner', 'admin', 'manager', 'editor'}


def _require_role(cur, organization_id: str, user_id: str, allowed_roles: set[str]) -> str:
    """Check that user has required role in organization."""
    cur.execute(
        'SELECT role FROM organization_members WHERE organization_id = %s AND user_id = %s',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Нет доступа к организации')
    role = row['role']
    if role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав для выполнения действия')
    return role


def _is_support_user(cur, user_id: str) -> bool:
    """Check if user has support/admin platform role."""
    # Check app_profiles.role (Auth V2)
    cur.execute(
        "SELECT 1 FROM app_profiles WHERE id = %s AND role = 'admin'",
        (user_id,),
    )
    if cur.fetchone():
        return True

    # Check platform_roles table (legacy)
    cur.execute(
        "SELECT 1 FROM platform_roles WHERE user_id = %s AND role IN ('platform_owner', 'platform_admin', 'support')",
        (user_id,),
    )
    return cur.fetchone() is not None


def _get_business_data(cur, organization_id: str) -> dict[str, Any]:
    """Get business data for binding resolution."""
    cur.execute(
        '''
        SELECT
            o.id, o.name, o.slug,
            op.short_description
        FROM organizations o
        LEFT JOIN organization_profiles op ON op.organization_id = o.id
        WHERE o.id = %s
        ''',
        (organization_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Организация не найдена')

    settings = get_settings()
    base_url = settings.frontend_base

    return {
        'name': row['name'],
        'slug': row['slug'],
        'short_description': row['short_description'] or '',
        'qr': {
            'profile': f"{base_url}/org/{row['id']}",
        },
    }


def _resolve_bindings(layout_json: dict[str, Any], business_data: dict[str, Any]) -> dict[str, Any]:
    """Resolve bindings in layout_json with actual business data."""
    resolved = copy.deepcopy(layout_json)

    if 'blocks' not in resolved:
        return resolved

    for block in resolved['blocks']:
        binding = block.get('binding')
        if not binding:
            continue

        # Parse binding path: business.name, business.qr.profile, etc.
        parts = binding.split('.')
        if len(parts) < 2 or parts[0] != 'business':
            continue

        # Navigate to the value
        value = business_data
        try:
            for part in parts[1:]:
                value = value[part]
        except (KeyError, TypeError):
            continue

        # Apply value based on block type
        if block['type'] == 'text':
            block['text'] = str(value) if value else ''
        elif block['type'] == 'qr':
            block['qr_url'] = str(value) if value else ''

    return resolved


def _row_to_template(row: dict) -> MarketingTemplate:
    """Convert database row to MarketingTemplate."""
    return MarketingTemplate(
        id=str(row['id']),
        template_key=row['template_key'],
        name=row['name'],
        description=row['description'],
        paper_size=row['paper_size'],
        orientation=row['orientation'],
        layout_schema_version=row['layout_schema_version'],
        layout_json=row['layout_json'] if isinstance(row['layout_json'], dict) else {},
        thumbnail_url=row['thumbnail_url'],
        is_active=row['is_active'],
        sort_order=row['sort_order'],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_material(row: dict) -> MarketingMaterial:
    """Convert database row to MarketingMaterial."""
    return MarketingMaterial(
        id=str(row['id']),
        business_id=str(row['business_id']),
        template_id=str(row['template_id']) if row['template_id'] else None,
        name=row['name'],
        paper_size=row['paper_size'],
        orientation=row['orientation'],
        layout_schema_version=row['layout_schema_version'],
        layout_json=row['layout_json'] if isinstance(row['layout_json'], dict) else {},
        is_default_for_business=row['is_default_for_business'],
        support_notes=row['support_notes'],
        created_by_user_id=str(row['created_by_user_id']) if row['created_by_user_id'] else None,
        updated_by_user_id=str(row['updated_by_user_id']) if row['updated_by_user_id'] else None,
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


# ============================================
# Templates (public read)
# ============================================

def list_templates() -> tuple[list[MarketingTemplate], int]:
    """List all active marketing templates."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, template_key, name, description, paper_size, orientation,
                       layout_schema_version, layout_json, thumbnail_url, is_active,
                       sort_order, created_at, updated_at
                FROM marketing_templates
                WHERE is_active = true
                ORDER BY sort_order, name
                '''
            )
            rows = cur.fetchall()
            templates = [_row_to_template(row) for row in rows]
            return templates, len(templates)


def get_template(template_id: str) -> MarketingTemplate | None:
    """Get a specific template by ID."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, template_key, name, description, paper_size, orientation,
                       layout_schema_version, layout_json, thumbnail_url, is_active,
                       sort_order, created_at, updated_at
                FROM marketing_templates
                WHERE id = %s AND is_active = true
                ''',
                (template_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return _row_to_template(row)


# ============================================
# Materials (organization-scoped)
# ============================================

def list_materials(organization_id: str, user_id: str) -> tuple[list[MarketingMaterial], int]:
    """List all marketing materials for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, VIEWER_ROLES)

            cur.execute(
                '''
                SELECT id, business_id, template_id, name, paper_size, orientation,
                       layout_schema_version, layout_json, is_default_for_business,
                       support_notes, created_by_user_id, updated_by_user_id,
                       created_at, updated_at
                FROM marketing_materials
                WHERE business_id = %s
                ORDER BY created_at DESC
                ''',
                (organization_id,),
            )
            rows = cur.fetchall()
            materials = [_row_to_material(row) for row in rows]
            return materials, len(materials)


def get_material(organization_id: str, material_id: str, user_id: str) -> MarketingMaterial | None:
    """Get a specific material."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, VIEWER_ROLES)

            cur.execute(
                '''
                SELECT id, business_id, template_id, name, paper_size, orientation,
                       layout_schema_version, layout_json, is_default_for_business,
                       support_notes, created_by_user_id, updated_by_user_id,
                       created_at, updated_at
                FROM marketing_materials
                WHERE id = %s AND business_id = %s
                ''',
                (material_id, organization_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return _row_to_material(row)


def create_material(
    organization_id: str,
    user_id: str,
    payload: MarketingMaterialCreate,
) -> MarketingMaterial:
    """Create a new marketing material from a template."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, EDITOR_ROLES)

            # Get template
            cur.execute(
                '''
                SELECT id, template_key, name, paper_size, orientation,
                       layout_schema_version, layout_json
                FROM marketing_templates
                WHERE id = %s AND is_active = true
                ''',
                (payload.template_id,),
            )
            template = cur.fetchone()
            if not template:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')

            # Get business data for binding resolution
            business_data = _get_business_data(cur, organization_id)

            # Resolve bindings in layout
            resolved_layout = _resolve_bindings(
                template['layout_json'] if isinstance(template['layout_json'], dict) else {},
                business_data,
            )

            # Create material
            material_name = payload.name or template['name']

            cur.execute(
                '''
                INSERT INTO marketing_materials
                    (business_id, template_id, name, paper_size, orientation,
                     layout_schema_version, layout_json, created_by_user_id, updated_by_user_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, business_id, template_id, name, paper_size, orientation,
                          layout_schema_version, layout_json, is_default_for_business,
                          support_notes, created_by_user_id, updated_by_user_id,
                          created_at, updated_at
                ''',
                (
                    organization_id,
                    payload.template_id,
                    material_name,
                    template['paper_size'],
                    template['orientation'],
                    template['layout_schema_version'],
                    json.dumps(resolved_layout),
                    user_id,
                    user_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return _row_to_material(row)


def update_material(
    organization_id: str,
    material_id: str,
    user_id: str,
    payload: MarketingMaterialUpdate,
) -> MarketingMaterial:
    """Update a marketing material (business user - can only edit editable blocks)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, EDITOR_ROLES)

            # Get existing material
            cur.execute(
                '''
                SELECT id, layout_json
                FROM marketing_materials
                WHERE id = %s AND business_id = %s
                ''',
                (material_id, organization_id),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Материал не найден')

            updates = []
            params = []

            if payload.name is not None:
                updates.append('name = %s')
                params.append(payload.name)

            if payload.layout_json is not None:
                # Validate that business user only edits editable_by_business blocks
                existing_layout = existing['layout_json'] if isinstance(existing['layout_json'], dict) else {}
                new_layout = payload.layout_json

                # Check each block
                existing_blocks = {b['id']: b for b in existing_layout.get('blocks', [])}
                new_blocks = {b['id']: b for b in new_layout.get('blocks', [])}

                for block_id, new_block in new_blocks.items():
                    old_block = existing_blocks.get(block_id)
                    if old_block and not old_block.get('editable_by_business', True):
                        # Block is not editable by business - check if it was modified
                        # Compare relevant fields
                        for field in ['text', 'qr_url', 'fontSizePt', 'color', 'fontFamily']:
                            if new_block.get(field) != old_block.get(field):
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail=f'Блок "{block_id}" недоступен для редактирования',
                                )

                updates.append('layout_json = %s')
                params.append(json.dumps(new_layout))

            if not updates:
                # Nothing to update
                return get_material(organization_id, material_id, user_id)

            updates.append('updated_by_user_id = %s')
            params.append(user_id)
            updates.append('updated_at = now()')

            params.extend([material_id, organization_id])

            query = f'''
                UPDATE marketing_materials
                SET {', '.join(updates)}
                WHERE id = %s AND business_id = %s
                RETURNING id, business_id, template_id, name, paper_size, orientation,
                          layout_schema_version, layout_json, is_default_for_business,
                          support_notes, created_by_user_id, updated_by_user_id,
                          created_at, updated_at
            '''

            cur.execute(query, params)
            row = cur.fetchone()
            conn.commit()

            return _row_to_material(row)


def delete_material(organization_id: str, material_id: str, user_id: str) -> bool:
    """Delete a marketing material."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, EDITOR_ROLES)

            cur.execute(
                'SELECT id FROM marketing_materials WHERE id = %s AND business_id = %s',
                (material_id, organization_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Материал не найден')

            cur.execute(
                'DELETE FROM marketing_materials WHERE id = %s AND business_id = %s',
                (material_id, organization_id),
            )
            conn.commit()

            return True


# ============================================
# Admin/Support functions
# ============================================

def admin_list_materials(user_id: str, limit: int = 50, offset: int = 0) -> tuple[list[MarketingMaterial], int]:
    """List all marketing materials (admin/support only)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if not _is_support_user(cur, user_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Требуются права администратора')

            # Get total count
            cur.execute('SELECT COUNT(*) as total FROM marketing_materials')
            total = cur.fetchone()['total']

            cur.execute(
                '''
                SELECT m.id, m.business_id, m.template_id, m.name, m.paper_size, m.orientation,
                       m.layout_schema_version, m.layout_json, m.is_default_for_business,
                       m.support_notes, m.created_by_user_id, m.updated_by_user_id,
                       m.created_at, m.updated_at
                FROM marketing_materials m
                ORDER BY m.created_at DESC
                LIMIT %s OFFSET %s
                ''',
                (limit, offset),
            )
            rows = cur.fetchall()
            materials = [_row_to_material(row) for row in rows]
            return materials, total


def admin_update_material(
    material_id: str,
    user_id: str,
    payload: MarketingMaterialAdminUpdate,
) -> MarketingMaterial:
    """Update any marketing material (admin/support - can edit all blocks)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if not _is_support_user(cur, user_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Требуются права администратора')

            # Get existing material
            cur.execute(
                'SELECT id, business_id FROM marketing_materials WHERE id = %s',
                (material_id,),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Материал не найден')

            updates = []
            params = []

            if payload.name is not None:
                updates.append('name = %s')
                params.append(payload.name)

            if payload.layout_json is not None:
                updates.append('layout_json = %s')
                params.append(json.dumps(payload.layout_json))

            if payload.support_notes is not None:
                updates.append('support_notes = %s')
                params.append(payload.support_notes)

            if not updates:
                # Nothing to update, return current state
                cur.execute(
                    '''
                    SELECT id, business_id, template_id, name, paper_size, orientation,
                           layout_schema_version, layout_json, is_default_for_business,
                           support_notes, created_by_user_id, updated_by_user_id,
                           created_at, updated_at
                    FROM marketing_materials WHERE id = %s
                    ''',
                    (material_id,),
                )
                return _row_to_material(cur.fetchone())

            updates.append('updated_by_user_id = %s')
            params.append(user_id)
            updates.append('updated_at = now()')

            params.append(material_id)

            query = f'''
                UPDATE marketing_materials
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING id, business_id, template_id, name, paper_size, orientation,
                          layout_schema_version, layout_json, is_default_for_business,
                          support_notes, created_by_user_id, updated_by_user_id,
                          created_at, updated_at
            '''

            cur.execute(query, params)
            row = cur.fetchone()
            conn.commit()

            return _row_to_material(row)
