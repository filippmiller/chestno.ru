"""
Service layer for Manufacturer Promotions.

Handles business logic for creating, managing, and distributing
promotional codes to organization subscribers.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app.core.supabase_client import get_supabase_client
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


# =============================================================================
# PROMOTIONS
# =============================================================================

def create_promotion(
    organization_id: str,
    user_id: str,
    payload: PromotionCreate,
) -> Promotion:
    """Create a new promotion for an organization."""
    supabase = get_supabase_client()

    data = {
        'organization_id': organization_id,
        'created_by': user_id,
        'title': payload.title,
        'description': payload.description,
        'discount_type': payload.discount_type.value,
        'discount_value': payload.discount_value,
        'discount_description': payload.discount_description,
        'min_purchase_amount': payload.min_purchase_amount,
        'platform': payload.platform.value,
        'platform_name': payload.platform_name,
        'platform_url': payload.platform_url,
        'code_prefix': payload.code_prefix.upper(),
        'starts_at': (payload.starts_at or datetime.now(timezone.utc)).isoformat(),
        'ends_at': payload.ends_at.isoformat() if payload.ends_at else None,
        'status': 'draft',
    }

    result = supabase.table('manufacturer_promotions').insert(data).execute()
    row = result.data[0]

    # Get subscriber count
    sub_count = get_subscriber_count(organization_id)

    return Promotion(
        **row,
        subscriber_count=sub_count.count,
        discount_display=_format_discount_display(
            row['discount_type'],
            row.get('discount_value'),
            row.get('discount_description'),
        ),
    )


def get_promotion(promotion_id: str, organization_id: str) -> Optional[Promotion]:
    """Get a single promotion by ID."""
    supabase = get_supabase_client()

    result = supabase.table('manufacturer_promotions') \
        .select('*') \
        .eq('id', promotion_id) \
        .eq('organization_id', organization_id) \
        .execute()

    if not result.data:
        return None

    row = result.data[0]
    sub_count = get_subscriber_count(organization_id)

    return Promotion(
        **row,
        subscriber_count=sub_count.count,
        discount_display=_format_discount_display(
            row['discount_type'],
            row.get('discount_value'),
            row.get('discount_description'),
        ),
    )


def list_promotions(
    organization_id: str,
    status: Optional[PromotionStatus] = None,
    limit: int = 20,
    offset: int = 0,
) -> PromotionListResponse:
    """List promotions for an organization."""
    supabase = get_supabase_client()

    query = supabase.table('manufacturer_promotions') \
        .select('*', count='exact') \
        .eq('organization_id', organization_id) \
        .order('created_at', desc=True)

    if status:
        query = query.eq('status', status.value)

    query = query.range(offset, offset + limit - 1)
    result = query.execute()

    sub_count = get_subscriber_count(organization_id)

    items = [
        Promotion(
            **row,
            subscriber_count=sub_count.count,
            discount_display=_format_discount_display(
                row['discount_type'],
                row.get('discount_value'),
                row.get('discount_description'),
            ),
        )
        for row in result.data
    ]

    return PromotionListResponse(
        items=items,
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


def update_promotion(
    promotion_id: str,
    organization_id: str,
    payload: PromotionUpdate,
) -> Optional[Promotion]:
    """Update an existing promotion."""
    supabase = get_supabase_client()

    # Build update data, excluding None values
    data = {}
    if payload.title is not None:
        data['title'] = payload.title
    if payload.description is not None:
        data['description'] = payload.description
    if payload.discount_type is not None:
        data['discount_type'] = payload.discount_type.value
    if payload.discount_value is not None:
        data['discount_value'] = payload.discount_value
    if payload.discount_description is not None:
        data['discount_description'] = payload.discount_description
    if payload.min_purchase_amount is not None:
        data['min_purchase_amount'] = payload.min_purchase_amount
    if payload.platform is not None:
        data['platform'] = payload.platform.value
    if payload.platform_name is not None:
        data['platform_name'] = payload.platform_name
    if payload.platform_url is not None:
        data['platform_url'] = payload.platform_url
    if payload.code_prefix is not None:
        data['code_prefix'] = payload.code_prefix.upper()
    if payload.starts_at is not None:
        data['starts_at'] = payload.starts_at.isoformat()
    if payload.ends_at is not None:
        data['ends_at'] = payload.ends_at.isoformat()
    if payload.status is not None:
        data['status'] = payload.status.value

    if not data:
        return get_promotion(promotion_id, organization_id)

    result = supabase.table('manufacturer_promotions') \
        .update(data) \
        .eq('id', promotion_id) \
        .eq('organization_id', organization_id) \
        .execute()

    if not result.data:
        return None

    row = result.data[0]
    sub_count = get_subscriber_count(organization_id)

    return Promotion(
        **row,
        subscriber_count=sub_count.count,
        discount_display=_format_discount_display(
            row['discount_type'],
            row.get('discount_value'),
            row.get('discount_description'),
        ),
    )


def delete_promotion(promotion_id: str, organization_id: str) -> bool:
    """Delete a promotion (soft delete by setting status to cancelled)."""
    supabase = get_supabase_client()

    # Check if promotion exists and has no distributed codes
    promo = get_promotion(promotion_id, organization_id)
    if not promo:
        return False

    if promo.total_codes_generated > 0:
        # Soft delete - mark as cancelled
        supabase.table('manufacturer_promotions') \
            .update({'status': 'cancelled'}) \
            .eq('id', promotion_id) \
            .eq('organization_id', organization_id) \
            .execute()
    else:
        # Hard delete if no codes generated
        supabase.table('manufacturer_promotions') \
            .delete() \
            .eq('id', promotion_id) \
            .eq('organization_id', organization_id) \
            .execute()

    return True


# =============================================================================
# DISTRIBUTION
# =============================================================================

def get_subscriber_count(organization_id: str) -> SubscriberCountResponse:
    """Get count of active subscribers for an organization."""
    supabase = get_supabase_client()

    result = supabase.table('consumer_subscriptions') \
        .select('id', count='exact') \
        .eq('target_type', 'organization') \
        .eq('target_id', organization_id) \
        .eq('is_active', True) \
        .execute()

    return SubscriberCountResponse(
        count=result.count or 0,
        organization_id=UUID(organization_id),
    )


def distribute_codes(
    promotion_id: str,
    organization_id: str,
    notify_email: bool = True,
    notify_in_app: bool = True,
) -> DistributeResponse:
    """Distribute promo codes to all subscribers."""
    supabase = get_supabase_client()

    # Call the database function to distribute codes
    result = supabase.rpc(
        'distribute_promotion_codes',
        {
            'p_promotion_id': promotion_id,
            'p_notify_email': notify_email,
            'p_notify_in_app': notify_in_app,
        }
    ).execute()

    data = result.data

    return DistributeResponse(
        success=data.get('success', False),
        codes_created=data.get('codes_created', 0),
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
    supabase = get_supabase_client()

    # Query with joins to get promotion and organization details
    query = supabase.table('subscriber_promo_codes') \
        .select('''
            *,
            manufacturer_promotions!inner (
                title,
                discount_type,
                discount_value,
                discount_description,
                platform,
                platform_name,
                platform_url,
                organization_id,
                organizations!inner (
                    name,
                    organization_profiles (logo_url)
                )
            )
        ''') \
        .eq('user_id', user_id) \
        .order('created_at', desc=True)

    if status:
        query = query.eq('status', status.value)

    query = query.limit(limit)
    result = query.execute()

    items = []
    active_count = 0
    used_count = 0
    expired_count = 0

    for row in result.data:
        promo = row.get('manufacturer_promotions', {})
        org = promo.get('organizations', {})
        org_profile = org.get('organization_profiles', [{}])
        logo_url = org_profile[0].get('logo_url') if org_profile else None

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
            promotion_title=promo.get('title'),
            organization_name=org.get('name'),
            organization_logo=logo_url,
            discount_type=promo.get('discount_type'),
            discount_value=promo.get('discount_value'),
            discount_description=promo.get('discount_description'),
            discount_display=_format_discount_display(
                promo.get('discount_type', ''),
                promo.get('discount_value'),
                promo.get('discount_description'),
            ),
            platform=promo.get('platform'),
            platform_name=_format_platform_name(
                promo.get('platform', ''),
                promo.get('platform_name'),
            ),
            platform_url=promo.get('platform_url'),
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
    supabase = get_supabase_client()

    result = supabase.table('subscriber_promo_codes') \
        .update({'viewed_at': datetime.now(timezone.utc).isoformat()}) \
        .eq('id', code_id) \
        .eq('user_id', user_id) \
        .is_('viewed_at', 'null') \
        .execute()

    if result.data:
        return list_user_promo_codes(user_id, limit=1).items[0]
    return None


def mark_code_used(code_id: str, user_id: str) -> Optional[PromoCode]:
    """Mark a promo code as used."""
    supabase = get_supabase_client()

    result = supabase.table('subscriber_promo_codes') \
        .update({
            'status': 'used',
            'used_at': datetime.now(timezone.utc).isoformat(),
        }) \
        .eq('id', code_id) \
        .eq('user_id', user_id) \
        .eq('status', 'active') \
        .execute()

    if result.data:
        # Update promotion stats using RPC to increment counter
        row = result.data[0]
        # Fetch current value and increment
        promo_result = supabase.table('manufacturer_promotions') \
            .select('total_codes_used') \
            .eq('id', row['promotion_id']) \
            .execute()

        if promo_result.data:
            current_count = promo_result.data[0].get('total_codes_used', 0)
            supabase.table('manufacturer_promotions') \
                .update({'total_codes_used': current_count + 1}) \
                .eq('id', row['promotion_id']) \
                .execute()

        # Re-fetch to get full data
        codes = list_user_promo_codes(user_id)
        for code in codes.items:
            if str(code.id) == code_id:
                return code

    return None


def get_promo_code_by_code(code: str) -> Optional[PromoCode]:
    """Look up a promo code by its code string."""
    supabase = get_supabase_client()

    result = supabase.table('subscriber_promo_codes') \
        .select('''
            *,
            manufacturer_promotions!inner (
                title,
                discount_type,
                discount_value,
                discount_description,
                platform,
                platform_name,
                platform_url,
                organizations!inner (
                    name,
                    organization_profiles (logo_url)
                )
            )
        ''') \
        .eq('code', code.upper()) \
        .execute()

    if not result.data:
        return None

    row = result.data[0]
    promo = row.get('manufacturer_promotions', {})
    org = promo.get('organizations', {})
    org_profile = org.get('organization_profiles', [{}])
    logo_url = org_profile[0].get('logo_url') if org_profile else None

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
        promotion_title=promo.get('title'),
        organization_name=org.get('name'),
        organization_logo=logo_url,
        discount_type=promo.get('discount_type'),
        discount_value=promo.get('discount_value'),
        discount_description=promo.get('discount_description'),
        discount_display=_format_discount_display(
            promo.get('discount_type', ''),
            promo.get('discount_value'),
            promo.get('discount_description'),
        ),
        platform=promo.get('platform'),
        platform_name=_format_platform_name(
            promo.get('platform', ''),
            promo.get('platform_name'),
        ),
        platform_url=promo.get('platform_url'),
    )
