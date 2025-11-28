import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)

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
    
    # Регистрируем все API роутеры ПЕРЕД фронтендом
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
    
    # Настройка раздачи статики фронтенда (после всех API роутеров)
    # Проверяем несколько возможных путей
    backend_path = Path(__file__).parent.parent.parent  # /app/backend или /app
    # Убираем дубликаты и проверяем реальные пути
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
        
        # Для всех остальных путей (кроме API) отдаем index.html (SPA routing)
        @app.get('/{full_path:path}', include_in_schema=False)
        async def serve_frontend(full_path: str):
            # Игнорируем API пути и системные пути
            if full_path.startswith('api/') or full_path in ['docs', 'redoc', 'openapi.json']:
                return None
            
            index_path = frontend_dist_path / 'index.html'
            if index_path.exists():
                with open(index_path, 'r', encoding='utf-8') as f:
                    return HTMLResponse(content=f.read())
    
    # Если нет собранного фронтенда, показываем заглушку на корневом пути
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
