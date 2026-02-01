import os
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from app.core.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)

from app.api.routes.auth_new import router as auth_router
from app.api.routes.auth_v2 import router as auth_v2_router
from app.api.routes.admin_ai import router as admin_ai_router
from app.api.routes.admin_database import router as admin_db_router
from app.api.routes.admin_notifications import router as admin_notifications_router
from app.api.routes.admin_dashboard import router as admin_dashboard_router
from app.api.routes.admin_reviews import router as admin_reviews_router
from app.api.routes.admin_users import router as admin_users_router
from app.api.routes.admin_organizations import router as admin_organizations_router
from app.api.routes.dev_tasks import router as dev_tasks_router
from app.api.routes.health import router as health_router
from app.api.routes.invites import router as invites_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.organizations import public_router as public_org_router, router as organizations_router
from app.api.routes.products import public_router as public_products_router, router as products_router
from app.api.routes.qr import redirect_router as qr_redirect_router, router as qr_router
from app.api.routes.qr_business import router as qr_business_router, public_router as qr_business_public_router
from app.api.routes.social import router as social_router
from app.api.routes.social_v2 import router as social_v2_router
from app.api.routes.subscriptions import admin_router as admin_subscriptions_router, router as subscriptions_router
from app.api.routes.posts import router as posts_router, public_router as public_posts_router
from app.api.routes.reviews import router as reviews_router, public_router as public_reviews_router
from app.api.routes.review_votes import router as review_votes_router
from app.api.routes.marketing import router as marketing_router, org_router as marketing_org_router, admin_router as marketing_admin_router
from app.api.routes.bulk_import import router as bulk_import_router
from app.api.routes.admin_imports import router as admin_imports_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.payments import router as payments_router
from app.api.routes.status_levels import router as status_levels_router
from app.api.routes.widgets import router as widgets_router, config_router as widgets_config_router
from app.api.routes.benchmarks import router as benchmarks_router
from app.api.routes.loyalty import router as loyalty_router, public_router as loyalty_public_router, admin_router as loyalty_admin_router
from app.api.routes.yandex_business import router as yandex_router, admin_router as yandex_admin_router
from app.api.routes.consumer_follows import router as consumer_follows_router
from app.api.routes.product_pages import public_router as product_pages_public_router, journey_router as product_journey_router
from app.api.routes.social_sharing import router as social_sharing_router
from app.api.routes.qr_dynamic import router as qr_dynamic_router
from app.api.routes.gamification import router as gamification_router
from app.api.routes.rewards import router as rewards_router
from app.api.routes.business_responses import router as business_responses_router, public_router as business_responses_public_router, admin_router as business_responses_admin_router
from app.api.anti_counterfeit import router as anti_counterfeit_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager for startup/shutdown events."""
    logger = logging.getLogger(__name__)
    logger.info("Starting background scheduler...")
    start_scheduler()
    yield
    logger.info("Stopping background scheduler...")
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title='Работаем Честно! Backend',
        version='0.1.0',
        lifespan=lifespan,
    )
    request_logger = logging.getLogger("app.request")
    security_headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            request_logger.exception(
                "request.failed method=%s path=%s duration_ms=%.2f request_id=%s",
                request.method,
                request.url.path,
                duration_ms,
                request_id,
            )
            raise
        duration_ms = (time.perf_counter() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        request_logger.info(
            "request.completed method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)
        for header, value in security_headers.items():
            if header not in response.headers:
                response.headers[header] = value
        return response
    # Регистрируем все API роутеры ПЕРЕД фронтендом
    app.include_router(health_router)  # Health check should be first for monitoring
    app.include_router(auth_router)  # Legacy auth (will be deprecated)
    app.include_router(auth_v2_router)  # New cookie-based auth
    app.include_router(invites_router)
    app.include_router(moderation_router)
    app.include_router(admin_ai_router)
    app.include_router(dev_tasks_router)
    app.include_router(admin_db_router)
    app.include_router(admin_notifications_router)
    app.include_router(admin_dashboard_router)
    app.include_router(admin_subscriptions_router)
    app.include_router(admin_reviews_router)
    app.include_router(admin_users_router)
    app.include_router(admin_organizations_router)
    app.include_router(organizations_router)
    app.include_router(public_org_router)
    app.include_router(products_router)
    app.include_router(public_products_router)
    app.include_router(qr_router)
    app.include_router(qr_business_router)
    app.include_router(qr_business_public_router)
    app.include_router(notifications_router)
    app.include_router(analytics_router)
    app.include_router(subscriptions_router)
    app.include_router(qr_redirect_router)
    app.include_router(social_router)  # Legacy
    app.include_router(social_v2_router)  # New cookie-based
    app.include_router(posts_router)
    app.include_router(public_posts_router)
    app.include_router(reviews_router)
    app.include_router(public_reviews_router)
    app.include_router(marketing_router)
    app.include_router(marketing_org_router)
    app.include_router(marketing_admin_router)
    app.include_router(bulk_import_router)
    app.include_router(admin_imports_router)
    app.include_router(webhooks_router)
    app.include_router(payments_router)
    app.include_router(status_levels_router)
    app.include_router(widgets_router)
    app.include_router(widgets_config_router)
    app.include_router(benchmarks_router)
    app.include_router(loyalty_router)
    app.include_router(loyalty_public_router)
    app.include_router(loyalty_admin_router)
    app.include_router(yandex_router)
    app.include_router(yandex_admin_router)
    # New v1 API endpoints
    app.include_router(consumer_follows_router)
    app.include_router(product_pages_public_router)
    app.include_router(product_journey_router)
    app.include_router(social_sharing_router)

    # New feature routers (Iteration 2)
    app.include_router(qr_dynamic_router)
    app.include_router(review_votes_router)
    app.include_router(gamification_router)
    app.include_router(rewards_router)
    app.include_router(business_responses_router)
    app.include_router(business_responses_public_router)
    app.include_router(business_responses_admin_router)
    app.include_router(anti_counterfeit_router)

    # Настройка раздачи статики фронтенда (после всех API роутеров)
    # Проверяем несколько возможных путей
    backend_path = Path(__file__).parent.parent.parent  # /app/backend или /app
    # Убираем дубликаты и проверяем реальные пути
    possible_paths = [
        Path('/app/frontend/dist'),  # /app/frontend/dist (стандартный путь Railway)
        backend_path.parent / 'frontend' / 'dist',  # ../frontend/dist (если backend_path = /app/backend)
        Path('/frontend/dist'),  # /frontend/dist
    ]
    # Убираем дубликаты, сохраняя порядок
    seen = set()
    unique_paths = []
    for p in possible_paths:
        p_str = str(p)
        if p_str not in seen:
            seen.add(p_str)
            unique_paths.append(p)
    possible_paths = unique_paths
    
    frontend_dist_path = None
    for path in possible_paths:
        if path.exists() and (path / 'index.html').exists():
            frontend_dist_path = path
            break
    
    # Отладочное логирование
    logger = logging.getLogger(__name__)
    logger.info(f"Backend path: {backend_path}")
    logger.info(f"Checking paths: {[str(p) for p in possible_paths]}")
    if frontend_dist_path:
        logger.info(f"✅ Found frontend at: {frontend_dist_path}")
    else:
        logger.warning(f"❌ Frontend not found. Checked: {[str(p) for p in possible_paths]}")
        # Проверяем что есть в /app
        app_path = Path('/app')
        if app_path.exists():
            logger.info(f"/app contents: {[p.name for p in app_path.iterdir() if p.is_dir()][:10]}")
        # Проверяем что есть в корне
        root = Path('/')
        if root.exists():
            logger.info(f"Root contents: {[p.name for p in root.iterdir() if p.is_dir()][:10]}")
    
    if frontend_dist_path:
        # Раздаем статические файлы (JS, CSS, изображения и т.д.)
        static_assets_path = frontend_dist_path / 'assets'
        if static_assets_path.exists():
            app.mount('/assets', StaticFiles(directory=str(static_assets_path)), name='assets')

    # Serve service worker with correct MIME type
        @app.get('/sw.js', include_in_schema=False)
        async def serve_service_worker():
            sw_path = frontend_dist_path / 'sw.js'
            if sw_path.exists():
                with open(sw_path, 'r', encoding='utf-8') as f:
                    return Response(content=f.read(), media_type='application/javascript')
            return HTMLResponse(status_code=404, content='Service worker not found')

    # Для всех остальных путей (кроме API) отдаем index.html (SPA routing)
        @app.get('/{full_path:path}', include_in_schema=False)
        async def serve_frontend(full_path: str):
            # Если путь начинается с api/, но не был обработан другими роутерами -> 404
            if full_path.startswith('api/') or full_path in ['docs', 'redoc', 'openapi.json']:
                return HTMLResponse(status_code=404, content='{"detail": "Not Found"}', media_type='application/json')
            
            index_path = frontend_dist_path / 'index.html'
            if index_path.exists():
                with open(index_path, 'r', encoding='utf-8') as f:
                    return HTMLResponse(content=f.read())

    is_production = settings.environment.lower() in {"production", "prod"}
    if not is_production:
        @app.get('/api/health-check-direct')
        async def health_check_direct():
            return {"status": "ok", "message": "Direct health check working"}

        @app.get('/api/debug-token-direct')
        async def debug_token_direct(token: str):
            from jose import jwt
            from app.core.config import get_settings
            settings = get_settings()

            results = {
                "token_snippet": token[:10] + "...",
                "settings_jwt_secret_len": len(settings.supabase_jwt_secret),
                "settings_service_role_key_len": len(settings.supabase_service_role_key),
                "attempts": []
            }

            # Attempt 1: Using configured JWT Secret
            try:
                jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
                results["attempts"].append({"key": "supabase_jwt_secret", "success": True})
            except Exception as e:
                results["attempts"].append({"key": "supabase_jwt_secret", "success": False, "error": str(e)})

            # Attempt 2: Using Service Role Key
            try:
                jwt.decode(token, settings.supabase_service_role_key, algorithms=["HS256"], audience="authenticated")
                results["attempts"].append({"key": "supabase_service_role_key", "success": True})
            except Exception as e:
                results["attempts"].append({"key": "supabase_service_role_key", "success": False, "error": str(e)})

            return results

        @app.get('/api/echo')
        async def echo(msg: str):
            return {"message": msg}
    @app.get('/', response_class=HTMLResponse, include_in_schema=False)
    async def root():
        # Используем тот же поиск путей
        backend_path = Path(__file__).parent.parent.parent  # /app/backend или /app
        possible_paths = [
            Path('/app/frontend/dist'),  # /app/frontend/dist (стандартный путь Railway)
            backend_path.parent / 'frontend' / 'dist' if backend_path != Path('/') else Path('/frontend/dist'),  # ../frontend/dist
            Path('/frontend/dist'),  # /frontend/dist
        ]
        # Убираем дубликаты
        possible_paths = list(dict.fromkeys(possible_paths))
        
        frontend_dist_path = None
        for path in possible_paths:
            if path.exists() and (path / 'index.html').exists():
                frontend_dist_path = path
                break
        
        if frontend_dist_path:
            index_path = frontend_dist_path / 'index.html'
            if index_path.exists():
                with open(index_path, 'r', encoding='utf-8') as f:
                    return HTMLResponse(content=f.read())

    # Fallback заглушка
        logger.warning("Frontend not found, showing fallback")

    # Fallback заглушка
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Работаем Честно! Backend API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                h1 { color: #333; }
                .info { background: #e8f4f8; padding: 15px; border-radius: 4px; margin: 20px 0; }
                a { color: #0066cc; text-decoration: none; }
                a:hover { text-decoration: underline; }
                .links { margin-top: 20px; }
                .links a { display: inline-block; margin-right: 15px; padding: 8px 15px; background: #0066cc; color: white; border-radius: 4px; }
                .links a:hover { background: #0052a3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Работаем Честно! Backend API</h1>
                <div class="info">
                    <p><strong>Версия:</strong> 0.1.0</p>
                    <p><strong>Статус:</strong> ✅ Работает</p>
                    <p><strong>Фронтенд:</strong> ⚠️ Не собран (запустите: cd frontend && npm run build)</p>
                </div>
                <div class="links">
                    <a href="/docs">📚 Swagger UI</a>
                    <a href="/redoc">📖 ReDoc</a>
                </div>
            </div>
        </body>
        </html>
        """)
    
    return app


app = create_app()












