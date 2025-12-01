from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.auth import OrganizationProfile, OrganizationProfileUpdate, PublicOrganizationProfile, GalleryItem
from app.schemas.public import (
    PublicOrganizationSummary,
    PublicOrganizationDetails,
    CertificationItem,
    BuyLinkItem,
)
from app.schemas.products import PublicProduct

EDIT_ROLES = {'owner', 'admin', 'manager', 'editor'}
VIEW_ROLES = EDIT_ROLES | {'analyst', 'viewer'}


def _deserialize_list(raw):
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    return json.loads(raw)


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
                       safety_and_quality, video_url, gallery, tags, language,
                       contact_email, contact_phone, contact_website, contact_address,
                       contact_telegram, contact_whatsapp, social_links,
                       created_at, updated_at
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
            # Сериализация social_links если есть
            if 'social_links' in data and data['social_links'] is not None:
                data['social_links'] = json.dumps([item.model_dump() if hasattr(item, 'model_dump') else item for item in data['social_links']])
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
                          safety_and_quality, video_url, gallery, tags, language,
                          contact_email, contact_phone, contact_website, contact_address,
                          contact_telegram, contact_whatsapp, social_links,
                          created_at, updated_at
                ''',
                values,
            )
            row = cur.fetchone()
            if row.get('gallery') is None:
                row['gallery'] = []
            elif isinstance(row['gallery'], str):
                row['gallery'] = json.loads(row['gallery'])
            # Десериализация social_links
            if row.get('social_links'):
                if isinstance(row['social_links'], str):
                    row['social_links'] = json.loads(row['social_links'])
            else:
                row['social_links'] = []
            conn.commit()
            return OrganizationProfile(**row)


def get_public_profile_by_slug(slug: str) -> PublicOrganizationProfile:
    details = get_public_organization_details_by_slug(slug)
    return PublicOrganizationProfile(
        name=details.name,
        slug=details.slug,
        country=details.country,
        city=details.city,
        website_url=details.website_url,
        is_verified=details.is_verified,
        verification_status=details.verification_status or '',
        short_description=details.short_description,
        long_description=details.long_description,
        production_description=details.production_description,
        safety_and_quality=details.quality_standards,
        video_url=details.video_url,
        gallery=details.gallery,
        tags=details.tags,
    )


def search_public_organizations(
    q: str | None,
    country: str | None,
    category: str | None,
    verified_only: bool,
    limit: int,
    offset: int,
    include_non_public: bool = False,  # For admin use
) -> Tuple[List[PublicOrganizationSummary], int]:
    # Only filter by public_visible if not admin override
    where_clauses = [] if include_non_public else ['o.public_visible = true']
    params: list[Any] = []
    if verified_only:
        where_clauses.append("o.verification_status = 'verified'")
    if country:
        where_clauses.append('o.country = %s')
        params.append(country)
    if category:
        where_clauses.append('o.primary_category = %s')
        params.append(category)
    if q:
        like = f'%{q}%'
        where_clauses.append(
            '(o.name ILIKE %s OR o.city ILIKE %s OR COALESCE(p.tags, \'\') ILIKE %s)'
        )
        params.extend([like, like, like])
    where_sql = ' AND '.join(where_clauses) if where_clauses else '1=1'
    base_query = '''
        FROM organizations o
        LEFT JOIN organization_profiles p ON p.organization_id = o.id
    '''
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f'SELECT COUNT(*) {base_query} WHERE {where_sql}', params)
        total = cur.fetchone()['count']

        cur.execute(
            f'''
            SELECT o.id, o.name, o.slug, o.country, o.city, o.primary_category,
                   o.is_verified, o.verification_status, p.short_description, p.gallery
            {base_query}
            WHERE {where_sql}
            ORDER BY o.is_verified DESC, o.created_at DESC
            LIMIT %s OFFSET %s
            ''',
            params + [limit, offset],
        )
        rows = cur.fetchall()

    summaries: List[PublicOrganizationSummary] = []
    for row in rows:
        gallery_items = _deserialize_list(row.get('gallery'))
        main_image = None
        if gallery_items:
            item = gallery_items[0]
            if isinstance(item, dict):
                main_image = item.get('url')
        summaries.append(
            PublicOrganizationSummary(
                id=str(row['id']),
                name=row['name'],
                slug=row['slug'],
                country=row['country'],
                city=row['city'],
                primary_category=row.get('primary_category'),
                is_verified=row['is_verified'],
                verification_status=row.get('verification_status'),
                short_description=row.get('short_description'),
                main_image_url=main_image,
            )
        )
    return summaries, total


def get_public_organization_details_by_id(organization_id: str) -> PublicOrganizationDetails:
    """Получить детали организации по ID (публичный API)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT o.id, o.name, o.slug, o.country, o.city, o.website_url, o.is_verified,
                   o.verification_status, p.tags,
                   p.short_description, p.long_description, p.production_description,
                   p.safety_and_quality, p.video_url, p.gallery, p.category, p.founded_year,
                   p.employee_count, p.factory_size, p.certifications, p.sustainability_practices,
                   p.quality_standards, p.buy_links,
                   p.contact_email, p.contact_phone, p.contact_website, p.contact_address,
                   p.contact_telegram, p.contact_whatsapp, p.social_links
            FROM organizations o
            LEFT JOIN organization_profiles p ON p.organization_id = o.id
            WHERE o.id = %s
              AND o.public_visible = true
            ''',
            (organization_id,),
        )
        org = cur.fetchone()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Производитель не найден или не опубликован')

        org_id = org['id']
        gallery = [GalleryItem(**item) for item in _deserialize_list(org.get('gallery'))]
        certifications = [CertificationItem(**item) for item in _deserialize_list(org.get('certifications'))]
        buy_links = [BuyLinkItem(**item) for item in _deserialize_list(org.get('buy_links'))]
        social_links = _deserialize_list(org.get('social_links'))

        cur.execute(
            '''
            SELECT id, organization_id, slug, name, short_description, price_cents, currency,
                   main_image_url, external_url
            FROM products
            WHERE organization_id = %s AND status = 'published'
            ORDER BY is_featured DESC, created_at DESC
            ''',
            (org_id,),
        )
        products = [PublicProduct(**row) for row in cur.fetchall()]

    return PublicOrganizationDetails(
        name=org['name'],
        slug=org['slug'],
        country=org['country'],
        city=org['city'],
        website_url=org['website_url'],
        is_verified=org['is_verified'],
        verification_status=org['verification_status'],
        short_description=org.get('short_description'),
        long_description=org.get('long_description'),
        production_description=org.get('production_description'),
        safety_and_quality=org.get('safety_and_quality'),
        video_url=org.get('video_url'),
        gallery=gallery,
        tags=org.get('tags'),
        primary_category=org.get('primary_category') or org.get('category'),  # Используем primary_category из organizations или category из профиля
        founded_year=org.get('founded_year'),
        employee_count=org.get('employee_count'),
        factory_size=org.get('factory_size'),
        category=org.get('category'),
        certifications=certifications,
        sustainability_practices=org.get('sustainability_practices'),
        quality_standards=org.get('quality_standards'),
        buy_links=buy_links,
        products=products,
        contact_email=org.get('contact_email'),
        contact_phone=org.get('contact_phone'),
        contact_website=org.get('contact_website'),
        contact_address=org.get('contact_address'),
        contact_telegram=org.get('contact_telegram'),
        contact_whatsapp=org.get('contact_whatsapp'),
        social_links=social_links,
    )


def get_public_organization_details_by_slug(slug: str) -> PublicOrganizationDetails:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT o.id, o.name, o.slug, o.country, o.city, o.website_url, o.is_verified,
                   o.verification_status, p.tags,
                   p.short_description, p.long_description, p.production_description,
                   p.safety_and_quality, p.video_url, p.gallery, p.category, p.founded_year,
                   p.employee_count, p.factory_size, p.certifications, p.sustainability_practices,
                   p.quality_standards, p.buy_links,
                   p.contact_email, p.contact_phone, p.contact_website, p.contact_address,
                   p.contact_telegram, p.contact_whatsapp, p.social_links
            FROM organizations o
            LEFT JOIN organization_profiles p ON p.organization_id = o.id
            WHERE o.slug = %s
              AND o.public_visible = true
              AND o.verification_status = 'verified'
            ''',
            (slug,),
        )
        org = cur.fetchone()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Производитель не найден или не опубликован')

        org_id = org['id']
        gallery = [GalleryItem(**item) for item in _deserialize_list(org.get('gallery'))]
        certifications = [CertificationItem(**item) for item in _deserialize_list(org.get('certifications'))]
        buy_links = [BuyLinkItem(**item) for item in _deserialize_list(org.get('buy_links'))]
        social_links = _deserialize_list(org.get('social_links'))

        cur.execute(
            '''
            SELECT id, organization_id, slug, name, short_description, price_cents, currency,
                   main_image_url, external_url
            FROM products
            WHERE organization_id = %s AND status = 'published'
            ORDER BY is_featured DESC, created_at DESC
            ''',
            (org_id,),
        )
        products = [PublicProduct(**row) for row in cur.fetchall()]

    return PublicOrganizationDetails(
        name=org['name'],
        slug=org['slug'],
        country=org['country'],
        city=org['city'],
        website_url=org['website_url'],
        is_verified=org['is_verified'],
        verification_status=org['verification_status'],
        short_description=org.get('short_description'),
        long_description=org.get('long_description'),
        production_description=org.get('production_description'),
        safety_and_quality=org.get('safety_and_quality'),
        video_url=org.get('video_url'),
        gallery=gallery,
        tags=org.get('tags'),
        primary_category=org.get('category'),  # Используем category из профиля
        founded_year=org.get('founded_year'),
        employee_count=org.get('employee_count'),
        factory_size=org.get('factory_size'),
        category=org.get('category'),
        certifications=certifications,
        sustainability_practices=org.get('sustainability_practices'),
        quality_standards=org.get('quality_standards'),
        buy_links=buy_links,
        products=products,
        contact_email=org.get('contact_email'),
        contact_phone=org.get('contact_phone'),
        contact_website=org.get('contact_website'),
        contact_address=org.get('contact_address'),
        contact_telegram=org.get('contact_telegram'),
        contact_whatsapp=org.get('contact_whatsapp'),
        social_links=social_links,
    )

