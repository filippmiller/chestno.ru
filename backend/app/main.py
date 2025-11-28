from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.admin_ai import router as admin_ai_router
from app.api.routes.admin_database import router as admin_db_router
from app.api.routes.admin_notifications import router as admin_notifications_router
from app.api.routes.admin_dashboard import router as admin_dashboard_router
from app.api.routes.dev_tasks import router as dev_tasks_router
from app.api.routes.invites import router as invites_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.organizations import public_router as public_org_router, router as organizations_router
from app.api.routes.products import public_router as public_products_router, router as products_router
from app.api.routes.qr import redirect_router as qr_redirect_router, router as qr_router
from app.api.routes.social import router as social_router
from app.api.routes.subscriptions import admin_router as admin_subscriptions_router, router as subscriptions_router
from app.api.routes.posts import router as posts_router, public_router as public_posts_router
from app.api.routes.reviews import router as reviews_router, public_router as public_reviews_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title='Работаем Честно! Backend',
        version='0.1.0',
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
    app.include_router(auth_router)
    app.include_router(invites_router)
    app.include_router(moderation_router)
    app.include_router(admin_ai_router)
    app.include_router(dev_tasks_router)
    app.include_router(admin_db_router)
    app.include_router(admin_notifications_router)
    app.include_router(admin_dashboard_router)
    app.include_router(admin_subscriptions_router)
    app.include_router(organizations_router)
    app.include_router(public_org_router)
    app.include_router(products_router)
    app.include_router(public_products_router)
    app.include_router(qr_router)
    app.include_router(notifications_router)
    app.include_router(analytics_router)
    app.include_router(subscriptions_router)
    app.include_router(qr_redirect_router)
    app.include_router(social_router)
    app.include_router(posts_router)
    app.include_router(public_posts_router)
    app.include_router(reviews_router)
    app.include_router(public_reviews_router)
    return app


app = create_app()

