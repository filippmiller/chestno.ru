"""
Service layer for Manufacturer Promotions.

Handles business logic for creating, managing, and distributing
promotional codes to organization subscribers.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.promotions import (
    DiscountType,
    DistributeResponse,
    Platform,
    PromoCode,
    PromoCodeListResponse,
    PromoCodeStatus,
    Promotion,
    PromotionCreate,
    PromotionListResponse,
    PromotionStatus,
    PromotionUpdate,
    SubscriberCountResponse,
)


def _format_discount_display(
    discount_type: str,
    discount_value: Optional[int],
    discount_description: Optional[str],
) -> str:
    """Format discount for display."""
    if discount_type == 'percent' and discount_value:
        return f'{discount_value}% скидка'
    elif discount_type == 'fixed' and discount_value:
        rubles = discount_value // 100
        return f'{rubles}₽ скидка'
    elif discount_type == 'free_shipping':
        return 'Бесплатная доставка'
    elif discount_type == 'custom' and discount_description:
        return discount_description
    return 'Специальное предложение'


def _format_platform_name(platform: str, platform_name: Optional[str]) -> str:
    """Format platform name for display."""
    platform_names = {
        'own_website': 'Сайт производителя',
        'ozon': 'Ozon',
        'wildberries': 'Wildberries',
        'yandex_market': 'Яндекс Маркет',
        'other': platform_name or 'Другая площадка',
    }
    return platform_names.get(platform, platform)


def _row_to_promotion(row: dict, subscriber_count: int) -> Promotion:
    """Convert database row to Promotion model."""
    return Promotion(
        id=row['id'],
        organization_id=row['organization_id'],
        title=row['title'],
        description=row.get('description'),
        discount_type=row['discount_type'],
        discount_value=row.get('discount_value'),
        discount_description=row.get('discount_description'),
        min_purchase_amount=row.get('min_purchase_amount'),
        platform=row['platform'],
        platform_name=row.get('platform_name'),
        platform_url=row.get('platform_url'),
        code_prefix=row['code_prefix'],
        starts_at=row['starts_at'],
        ends_at=row.get('ends_at'),
        status=row['status'],
        distributed_at=row.get('distributed_at'),
        total_codes_generated=row.get('total_codes_generated', 0),
        total_codes_used=row.get('total_codes_used', 0),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
        subscriber_count=subscriber_count,
        discount_display=_format_discount_display(
            row['discount_type'],
            row.get('discount_value'),
            row.get('discount_description'),
        ),
    )


# =============================================================================
# PROMOTIONS
# =============================================================================

def create_promotion(
    organization_id: str,
    user_id: str,
    payload: PromotionCreate,
) -> Promotion:
    """Create a new promotion for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO manufacturer_promotions (
                    organization_id, created_by, title, description,
                    discount_type, discount_value, discount_description,
                    min_purchase_amount, platform, platform_name, platform_url,
                    code_prefix, starts_at, ends_at, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
                RETURNING *
                ''',
                (
                    organization_id,
                    user_id,
                    payload.title,
                    payload.description,
                    payload.discount_type.value,
                    payload.discount_value,
                    payload.discount_description,
                    payload.min_purchase_amount,
                    payload.platform.value,
                    payload.platform_name,
                    payload.platform_url,
                    payload.code_prefix.upper(),
                    payload.starts_at or datetime.now(timezone.utc),
                    payload.ends_at,
                ),
            )
            row = cur.fetchone()
            conn.commit()

    sub_count = get_subscriber_count(organization_id)
    return _row_to_promotion(row, sub_count.count)


def get_promotion(promotion_id: str, organization_id: str) -> Optional[Promotion]:
    """Get a single promotion by ID."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT * FROM manufacturer_promotions
                WHERE id = %s AND organization_id = %s
                ''',
                (promotion_id, organization_id),
            )
            row = cur.fetchone()

    if not row:
        return None

    sub_count = get_subscriber_count(organization_id)
    return _row_to_promotion(row, sub_count.count)


def list_promotions(
    organization_id: str,
    status: Optional[PromotionStatus] = None,
    limit: int = 20,
    offset: int = 0,
) -> PromotionListResponse:
    """List promotions for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Count total
            count_query = '''
                SELECT COUNT(*) as total
                FROM manufacturer_promotions
                WHERE organization_id = %s
            '''
            count_params = [organization_id]

            if status:
                count_query += ' AND status = %s'
                count_params.append(status.value)

            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']

            # Get promotions
            query = '''
                SELECT * FROM manufacturer_promotions
                WHERE organization_id = %s
            '''
            params = [organization_id]

            if status:
                query += ' AND status = %s'
                params.append(status.value)

            query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

    sub_count = get_subscriber_count(organization_id)
    items = [_row_to_promotion(row, sub_count.count) for row in rows]

    return PromotionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


def update_promotion(
    promotion_id: str,
    organization_id: str,
    payload: PromotionUpdate,
) -> Optional[Promotion]:
    """Update an existing promotion."""
    # Build update fields
    updates = []
    params = []

    if payload.title is not None:
        updates.append('title = %s')
        params.append(payload.title)
    if payload.description is not None:
        updates.append('description = %s')
        params.append(payload.description)
    if payload.discount_type is not None:
        updates.append('discount_type = %s')
        params.append(payload.discount_type.value)
    if payload.discount_value is not None:
        updates.append('discount_value = %s')
        params.append(payload.discount_value)
    if payload.discount_description is not None:
        updates.append('discount_description = %s')
        params.append(payload.discount_description)
    if payload.min_purchase_amount is not None:
        updates.append('min_purchase_amount = %s')
        params.append(payload.min_purchase_amount)
    if payload.platform is not None:
        updates.append('platform = %s')
        params.append(payload.platform.value)
    if payload.platform_name is not None:
        updates.append('platform_name = %s')
        params.append(payload.platform_name)
    if payload.platform_url is not None:
        updates.append('platform_url = %s')
        params.append(payload.platform_url)
    if payload.code_prefix is not None:
        updates.append('code_prefix = %s')
        params.append(payload.code_prefix.upper())
    if payload.starts_at is not None:
        updates.append('starts_at = %s')
        params.append(payload.starts_at)
    if payload.ends_at is not None:
        updates.append('ends_at = %s')
        params.append(payload.ends_at)
    if payload.status is not None:
        updates.append('status = %s')
        params.append(payload.status.value)

    if not updates:
        return get_promotion(promotion_id, organization_id)

    updates.append('updated_at = %s')
    params.append(datetime.now(timezone.utc))

    params.extend([promotion_id, organization_id])

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f'''
                UPDATE manufacturer_promotions
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING *
                ''',
                params,
            )
            row = cur.fetchone()
            conn.commit()

    if not row:
        return None

    sub_count = get_subscriber_count(organization_id)
    return _row_to_promotion(row, sub_count.count)


def delete_promotion(promotion_id: str, organization_id: str) -> bool:
    """Delete a promotion (soft delete by setting status to cancelled)."""
    promo = get_promotion(promotion_id, organization_id)
    if not promo:
        return False

    with get_connection() as conn:
        with conn.cursor() as cur:
            if promo.total_codes_generated > 0:
                # Soft delete - mark as cancelled
                cur.execute(
                    '''
                    UPDATE manufacturer_promotions
                    SET status = 'cancelled', updated_at = %s
                    WHERE id = %s AND organization_id = %s
                    ''',
                    (datetime.now(timezone.utc), promotion_id, organization_id),
                )
            else:
                # Hard delete if no codes generated
                cur.execute(
                    '''
                    DELETE FROM manufacturer_promotions
                    WHERE id = %s AND organization_id = %s
                    ''',
                    (promotion_id, organization_id),
                )
            conn.commit()

    return True


# =============================================================================
# DISTRIBUTION
# =============================================================================

def get_subscriber_count(organization_id: str) -> SubscriberCountResponse:
    """Get count of active subscribers for an organization."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM consumer_subscriptions
                WHERE target_type = 'organization'
                  AND target_id = %s
                  AND is_active = true
                ''',
                (organization_id,),
            )
            result = cur.fetchone()

    return SubscriberCountResponse(
        count=result['count'] if result else 0,
        organization_id=UUID(organization_id),
    )


def distribute_codes(
    promotion_id: str,
    organization_id: str,
    notify_email: bool = True,
    notify_in_app: bool = True,
) -> DistributeResponse:
    """Distribute promo codes to all subscribers."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Call the database function to distribute codes
            cur.execute(
                '''
                SELECT * FROM distribute_promotion_codes(%s, %s, %s)
                ''',
                (promotion_id, notify_email, notify_in_app),
            )
            result = cur.fetchone()
            conn.commit()

    return DistributeResponse(
        success=result.get('success', False) if result else False,
        codes_created=result.get('codes_created', 0) if result else 0,
        distributed_at=datetime.now(timezone.utc),
    )


# =============================================================================
# USER PROMO CODES
# =============================================================================

def list_user_promo_codes(
    user_id: str,
    status: Optional[PromoCodeStatus] = None,
    limit: int = 50,
) -> PromoCodeListResponse:
    """List all promo codes for a user."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            query = '''
                SELECT
                    spc.*,
                    mp.title as promotion_title,
                    mp.discount_type,
                    mp.discount_value,
                    mp.discount_description,
                    mp.platform,
                    mp.platform_name,
                    mp.platform_url,
                    o.name as organization_name,
                    op.logo_url as organization_logo
                FROM subscriber_promo_codes spc
                JOIN manufacturer_promotions mp ON mp.id = spc.promotion_id
                JOIN organizations o ON o.id = mp.organization_id
                LEFT JOIN organization_profiles op ON op.organization_id = o.id
                WHERE spc.user_id = %s
            '''
            params = [user_id]

            if status:
                query += ' AND spc.status = %s'
                params.append(status.value)

            query += ' ORDER BY spc.created_at DESC LIMIT %s'
            params.append(limit)

            cur.execute(query, params)
            rows = cur.fetchall()

    items = []
    active_count = 0
    used_count = 0
    expired_count = 0

    for row in rows:
        code = PromoCode(
            id=row['id'],
            promotion_id=row['promotion_id'],
            code=row['code'],
            status=row['status'],
            sent_at=row.get('sent_at'),
            viewed_at=row.get('viewed_at'),
            used_at=row.get('used_at'),
            expires_at=row.get('expires_at'),
            created_at=row['created_at'],
            promotion_title=row.get('promotion_title'),
            organization_name=row.get('organization_name'),
            organization_logo=row.get('organization_logo'),
            discount_type=row.get('discount_type'),
            discount_value=row.get('discount_value'),
            discount_description=row.get('discount_description'),
            discount_display=_format_discount_display(
                row.get('discount_type', ''),
                row.get('discount_value'),
                row.get('discount_description'),
            ),
            platform=row.get('platform'),
            platform_name=_format_platform_name(
                row.get('platform', ''),
                row.get('platform_name'),
            ),
            platform_url=row.get('platform_url'),
        )
        items.append(code)

        # Count by status
        if row['status'] == 'active':
            active_count += 1
        elif row['status'] == 'used':
            used_count += 1
        elif row['status'] == 'expired':
            expired_count += 1

    return PromoCodeListResponse(
        items=items,
        total=len(items),
        active_count=active_count,
        used_count=used_count,
        expired_count=expired_count,
    )


def mark_code_viewed(code_id: str, user_id: str) -> Optional[PromoCode]:
    """Mark a promo code as viewed."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                UPDATE subscriber_promo_codes
                SET viewed_at = %s
                WHERE id = %s AND user_id = %s AND viewed_at IS NULL
                RETURNING id
                ''',
                (datetime.now(timezone.utc), code_id, user_id),
            )
            result = cur.fetchone()
            conn.commit()

    if result:
        codes = list_user_promo_codes(user_id, limit=100)
        for code in codes.items:
            if str(code.id) == code_id:
                return code
    return None


def mark_code_used(code_id: str, user_id: str) -> Optional[PromoCode]:
    """Mark a promo code as used."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                UPDATE subscriber_promo_codes
                SET status = 'used', used_at = %s
                WHERE id = %s AND user_id = %s AND status = 'active'
                RETURNING promotion_id
                ''',
                (datetime.now(timezone.utc), code_id, user_id),
            )
            result = cur.fetchone()

            if result:
                # Update promotion stats
                cur.execute(
                    '''
                    UPDATE manufacturer_promotions
                    SET total_codes_used = total_codes_used + 1,
                        updated_at = %s
                    WHERE id = %s
                    ''',
                    (datetime.now(timezone.utc), result['promotion_id']),
                )
            conn.commit()

    if result:
        codes = list_user_promo_codes(user_id, limit=100)
        for code in codes.items:
            if str(code.id) == code_id:
                return code
    return None


def get_promo_code_by_code(code: str) -> Optional[PromoCode]:
    """Look up a promo code by its code string."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    spc.*,
                    mp.title as promotion_title,
                    mp.discount_type,
                    mp.discount_value,
                    mp.discount_description,
                    mp.platform,
                    mp.platform_name,
                    mp.platform_url,
                    o.name as organization_name,
                    op.logo_url as organization_logo
                FROM subscriber_promo_codes spc
                JOIN manufacturer_promotions mp ON mp.id = spc.promotion_id
                JOIN organizations o ON o.id = mp.organization_id
                LEFT JOIN organization_profiles op ON op.organization_id = o.id
                WHERE spc.code = %s
                ''',
                (code.upper(),),
            )
            row = cur.fetchone()

    if not row:
        return None

    return PromoCode(
        id=row['id'],
        promotion_id=row['promotion_id'],
        code=row['code'],
        status=row['status'],
        sent_at=row.get('sent_at'),
        viewed_at=row.get('viewed_at'),
        used_at=row.get('used_at'),
        expires_at=row.get('expires_at'),
        created_at=row['created_at'],
        promotion_title=row.get('promotion_title'),
        organization_name=row.get('organization_name'),
        organization_logo=row.get('organization_logo'),
        discount_type=row.get('discount_type'),
        discount_value=row.get('discount_value'),
        discount_description=row.get('discount_description'),
        discount_display=_format_discount_display(
            row.get('discount_type', ''),
            row.get('discount_value'),
            row.get('discount_description'),
        ),
        platform=row.get('platform'),
        platform_name=_format_platform_name(
            row.get('platform', ''),
            row.get('platform_name'),
        ),
        platform_url=row.get('platform_url'),
    )
