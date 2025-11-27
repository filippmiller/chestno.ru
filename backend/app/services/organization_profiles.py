from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.auth import OrganizationProfile, OrganizationProfileUpdate, PublicOrganizationProfile, GalleryItem

EDIT_ROLES = {'owner', 'admin', 'manager', 'editor'}
VIEW_ROLES = EDIT_ROLES | {'analyst', 'viewer'}


def _require_role(cur, organization_id: str, user_id: str, allowed_roles: set[str]) -> str:
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


def _serialize_gallery(payload: Dict[str, Any]) -> Dict[str, Any]:
    gallery = payload.get('gallery')
    if gallery is not None:
        payload['gallery'] = json.dumps([item for item in gallery])
    return payload


def get_organization_profile(organization_id: str, user_id: str) -> OrganizationProfile | None:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, VIEW_ROLES)
            cur.execute(
                '''
                SELECT id, organization_id, short_description, long_description, production_description,
                       safety_and_quality, video_url, gallery, tags, language, created_at, updated_at
                FROM organization_profiles
                WHERE organization_id = %s
                ''',
                (organization_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            if row.get('gallery') is None:
                row['gallery'] = []
            return OrganizationProfile(**row)


def upsert_organization_profile(
    organization_id: str,
    user_id: str,
    payload: OrganizationProfileUpdate,
) -> OrganizationProfile:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _require_role(cur, organization_id, user_id, EDIT_ROLES)
            data = payload.model_dump(exclude_unset=True)
            data = _serialize_gallery(data)
            now = datetime.now(timezone.utc)
            columns = ['organization_id']
            values = [organization_id]
            placeholders = ['%s']
            for key, value in data.items():
                columns.append(key)
                values.append(value)
                placeholders.append('%s')
            insert_columns = ', '.join(columns)
            insert_placeholders = ', '.join(placeholders)
            set_clause = ', '.join([f'{col} = EXCLUDED.{col}' for col in columns if col != 'organization_id'])
            if set_clause:
                set_clause = f'{set_clause}, updated_at = %s'
                values.append(now)
            else:
                set_clause = 'updated_at = %s'
                values.append(now)
            cur.execute(
                f'''
                INSERT INTO organization_profiles ({insert_columns})
                VALUES ({insert_placeholders})
                ON CONFLICT (organization_id) DO UPDATE SET
                    {set_clause}
                RETURNING id, organization_id, short_description, long_description, production_description,
                          safety_and_quality, video_url, gallery, tags, language, created_at, updated_at
                ''',
                values,
            )
            row = cur.fetchone()
            if row.get('gallery') is None:
                row['gallery'] = []
            elif isinstance(row['gallery'], str):
                row['gallery'] = json.loads(row['gallery'])
            conn.commit()
            return OrganizationProfile(**row)


def get_public_profile_by_slug(slug: str) -> PublicOrganizationProfile:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT o.name, o.slug, o.country, o.city, o.website_url, o.is_verified, o.verification_status,
                       p.short_description, p.long_description, p.production_description,
                       p.safety_and_quality, p.video_url, p.gallery, p.tags
                FROM organizations o
                LEFT JOIN organization_profiles p ON p.organization_id = o.id
                WHERE o.slug = %s
                  AND o.public_visible = true
                  AND o.verification_status = 'verified'
                ''',
                (slug,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Производитель не найден или не опубликован')

            gallery_items: list[GalleryItem] = []
            gallery = row.get('gallery')
            if gallery:
                if isinstance(gallery, str):
                    gallery = json.loads(gallery)
                gallery_items = [GalleryItem(**item) for item in gallery]

            return PublicOrganizationProfile(
                name=row['name'],
                slug=row['slug'],
                country=row['country'],
                city=row['city'],
                website_url=row['website_url'],
                is_verified=row['is_verified'],
                verification_status=row['verification_status'],
                short_description=row.get('short_description'),
                long_description=row.get('long_description'),
                production_description=row.get('production_description'),
                safety_and_quality=row.get('safety_and_quality'),
                video_url=row.get('video_url'),
                gallery=gallery_items,
                tags=row.get('tags'),
            )

