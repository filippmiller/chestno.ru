from __future__ import annotations

from typing import Literal, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.subscriptions import (
    OrganizationSubscription,
    OrganizationSubscriptionSummary,
    OrganizationUsage,
    SubscriptionPlan,
    SubscriptionPlanCreate,
    SubscriptionPlanUpdate,
)
from app.services.admin_guard import assert_platform_admin


def _plan_from_row(row) -> SubscriptionPlan:
    # Convert UUID to string for Pydantic model
    data = dict(row)
    data['id'] = str(data['id'])
    return SubscriptionPlan(**data)


def list_plans(include_inactive: bool = False) -> list[SubscriptionPlan]:
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if include_inactive:
                cur.execute('SELECT * FROM subscription_plans ORDER BY price_monthly_cents ASC NULLS LAST')
            else:
                cur.execute(
                    'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly_cents ASC NULLS LAST'
                )
            rows = cur.fetchall()
            return [_plan_from_row(row) for row in rows]
    except Exception as e:
        print(f'[subscriptions.list_plans] Error: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f'Database error: {str(e)}')


def create_plan(payload: SubscriptionPlanCreate, actor_user_id: str) -> SubscriptionPlan:
    assert_platform_admin(actor_user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO subscription_plans (
                code, name, description, price_monthly_cents, price_yearly_cents, currency,
                max_products, max_qr_codes, max_members, analytics_level, is_default, is_active
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *
            ''',
            (
                payload.code,
                payload.name,
                payload.description,
                payload.price_monthly_cents,
                payload.price_yearly_cents,
                payload.currency,
                payload.max_products,
                payload.max_qr_codes,
                payload.max_members,
                payload.analytics_level,
                payload.is_default,
                payload.is_active,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return _plan_from_row(row)


def update_plan(plan_id: str, payload: SubscriptionPlanUpdate, actor_user_id: str) -> SubscriptionPlan:
    assert_platform_admin(actor_user_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нет данных для обновления')
    set_clauses = []
    params = []
    for field, value in data.items():
        set_clauses.append(f'{field} = %s')
        params.append(value)
    set_clauses.append('updated_at = now()')
    query = f'UPDATE subscription_plans SET {", ".join(set_clauses)} WHERE id = %s RETURNING *'
    params.append(plan_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='План не найден')
        conn.commit()
        return _plan_from_row(row)


def get_org_subscription_summary(org_id: str) -> OrganizationSubscriptionSummary:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT sp.*
            FROM organization_subscriptions os
            JOIN subscription_plans sp ON sp.id = os.plan_id
            WHERE os.organization_id = %s AND os.status = 'active'
            ORDER BY os.created_at DESC
            LIMIT 1
            ''',
            (org_id,),
        )
        plan_row = cur.fetchone()
        if not plan_row:
            cur.execute('SELECT * FROM subscription_plans WHERE is_default = true LIMIT 1')
            plan_row = cur.fetchone()
            if not plan_row:
                raise HTTPException(status_code=500, detail='Не найден план по умолчанию')
    usage = get_org_usage(org_id)
    plan = _plan_from_row(plan_row)
    return OrganizationSubscriptionSummary(plan=plan, usage=usage)


def set_org_subscription(organization_id: str, plan_id: str, actor_user_id: str) -> OrganizationSubscription:
    assert_platform_admin(actor_user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM subscription_plans WHERE id = %s', (plan_id,))
        plan = cur.fetchone()
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='План не найден')
        cur.execute(
            '''
            INSERT INTO organization_subscriptions (organization_id, plan_id, status)
            VALUES (%s, %s, 'active')
            ON CONFLICT (organization_id) WHERE status = 'active'
            DO UPDATE SET plan_id = EXCLUDED.plan_id, updated_at = now()
            RETURNING *
            ''',
            (organization_id, plan_id),
        )
        row = cur.fetchone()
        conn.commit()
        plan_model = _plan_from_row(plan)
        return OrganizationSubscription(
            id=row['id'],
            organization_id=row['organization_id'],
            plan_id=row['plan_id'],
            status=row['status'],
            current_period_start=row['current_period_start'],
            current_period_end=row['current_period_end'],
            cancel_at=row['cancel_at'],
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            plan=plan_model,
        )


def get_org_usage(organization_id: str) -> OrganizationUsage:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT count(*) AS cnt FROM products WHERE organization_id = %s AND status != %s', (organization_id, 'archived'))
        products_used = cur.fetchone()['cnt']
        cur.execute('SELECT count(*) AS cnt FROM qr_codes WHERE organization_id = %s AND is_active = true', (organization_id,))
        qr_used = cur.fetchone()['cnt']
        cur.execute('SELECT count(*) AS cnt FROM organization_members WHERE organization_id = %s', (organization_id,))
        members_used = cur.fetchone()['cnt']
    return OrganizationUsage(products_used=products_used, qr_codes_used=qr_used, members_used=members_used)


def check_org_limit(organization_id: str, metric: Literal['products', 'qr_codes', 'members']) -> None:
    summary = get_org_subscription_summary(organization_id)
    plan = summary.plan
    usage = summary.usage
    limit_value = None
    current_value = None
    if metric == 'products':
        limit_value = plan.max_products
        current_value = usage.products_used
    elif metric == 'qr_codes':
        limit_value = plan.max_qr_codes
        current_value = usage.qr_codes_used
    elif metric == 'members':
        limit_value = plan.max_members
        current_value = usage.members_used
    if limit_value is not None and current_value >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={'code': 'limit_reached', 'metric': metric, 'limit': limit_value},
        )


def ensure_org_member(user_id: str, organization_id: str) -> None:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT 1 FROM organization_members WHERE organization_id = %s AND user_id = %s',
            (organization_id, user_id),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав для просмотра подписки')

