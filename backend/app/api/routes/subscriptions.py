from fastapi import APIRouter, Depends, Query

from app.api.routes.auth import get_current_user_id
from app.schemas.subscriptions import (
    OrganizationSubscription,
    OrganizationSubscriptionSummary,
    SubscriptionPlan,
    SubscriptionPlanCreate,
    SubscriptionPlanUpdate,
)
from app.services import subscriptions as subscriptions_service
from app.services.admin_guard import assert_platform_admin

router = APIRouter(prefix='/api', tags=['subscriptions'])
admin_router = APIRouter(prefix='/api/admin/subscriptions', tags=['subscriptions'])


@router.get('/organizations/{organization_id}/subscription', response_model=OrganizationSubscriptionSummary)
async def org_subscription_summary(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationSubscriptionSummary:
    subscriptions_service.ensure_org_member(current_user_id, organization_id)
    return subscriptions_service.get_org_subscription_summary(organization_id)


@admin_router.get('/plans', response_model=list[SubscriptionPlan])
async def admin_list_plans(
    include_inactive: bool = False,
    current_user_id: str = Depends(get_current_user_id),
) -> list[SubscriptionPlan]:
    assert_platform_admin(current_user_id)
    return subscriptions_service.list_plans(include_inactive=include_inactive)


@admin_router.post('/plans', response_model=SubscriptionPlan)
async def admin_create_plan(
    payload: SubscriptionPlanCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> SubscriptionPlan:
    return subscriptions_service.create_plan(payload, actor_user_id=current_user_id)


@admin_router.patch('/plans/{plan_id}', response_model=SubscriptionPlan)
async def admin_update_plan(
    plan_id: str,
    payload: SubscriptionPlanUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> SubscriptionPlan:
    return subscriptions_service.update_plan(plan_id, payload, actor_user_id=current_user_id)


@admin_router.post('/organizations/{organization_id}/subscription', response_model=OrganizationSubscription)
async def admin_set_org_subscription(
    organization_id: str,
    plan_id: str = Query(..., description='ID тарифного плана'),
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationSubscription:
    assert_platform_admin(current_user_id)
    return subscriptions_service.set_org_subscription(organization_id, plan_id, actor_user_id=current_user_id)