"""
Widget API Routes

Public endpoints for embeddable trust widgets that businesses can add to their websites.
Supports multiple sizes, themes, and customization options with proper CORS and caching.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.schemas.widgets import (
    WidgetConfig,
    WidgetConfigResponse,
    WidgetEmbedCode,
    WidgetSize,
    WidgetTheme,
)
from app.services.widgets import (
    calculate_etag,
    generate_cache_headers,
    generate_embed_code,
    generate_widget_javascript,
    get_organization_for_widget,
    render_iframe_html,
    render_widget_html,
)

logger = logging.getLogger(__name__)

# Public widget routes (no auth required)
router = APIRouter(prefix='/api/v1/widgets', tags=['widgets'])

# Authenticated routes for widget configuration
config_router = APIRouter(prefix='/api/organizations', tags=['widget-config'])


def get_cors_headers() -> dict:
    """Get CORS headers for widget embedding."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "86400",  # 24 hours
    }


def parse_widget_config(
    size: str = "medium",
    theme: str = "light",
    color: Optional[str] = None,
    logo: bool = True,
    reviews: bool = True,
    rating: bool = True,
    lang: str = "ru",
    radius: int = 8
) -> WidgetConfig:
    """Parse query parameters into WidgetConfig."""
    # Validate size
    try:
        widget_size = WidgetSize(size.lower())
    except ValueError:
        widget_size = WidgetSize.MEDIUM

    # Validate theme
    try:
        widget_theme = WidgetTheme(theme.lower())
    except ValueError:
        widget_theme = WidgetTheme.LIGHT

    # Parse color (add # if missing)
    primary_color = None
    if color:
        color = color.strip()
        if not color.startswith('#'):
            color = f"#{color}"
        if len(color) == 7:  # #RRGGBB format
            primary_color = color.upper()

    # Validate language
    if lang not in ("ru", "en"):
        lang = "ru"

    # Validate border radius
    radius = max(0, min(24, radius))

    return WidgetConfig(
        size=widget_size,
        theme=widget_theme,
        primary_color=primary_color,
        show_logo=logo,
        show_reviews_count=reviews,
        show_rating=rating,
        language=lang,
        border_radius=radius
    )


# ==================== Public Widget Endpoints ====================

@router.options("/badge/{org_slug}")
@router.options("/iframe/{org_slug}")
async def widget_options(org_slug: str):
    """Handle CORS preflight requests."""
    return Response(
        status_code=204,
        headers=get_cors_headers()
    )


@router.get("/badge/{org_slug}")
async def get_widget_badge(
    org_slug: str,
    request: Request,
    size: str = Query(default="medium", description="Widget size: small, medium, large"),
    theme: str = Query(default="light", description="Color theme: light, dark, auto"),
    color: Optional[str] = Query(default=None, description="Custom primary color (hex without #)"),
    logo: bool = Query(default=True, description="Show Chestno.ru logo"),
    reviews: bool = Query(default=True, description="Show review count"),
    rating: bool = Query(default=True, description="Show star rating"),
    lang: str = Query(default="ru", description="Language: ru, en"),
    radius: int = Query(default=8, ge=0, le=24, description="Border radius in pixels")
) -> Response:
    """
    Get embeddable JavaScript widget for an organization.

    This endpoint returns JavaScript code that can be embedded on any website
    to display the organization's trust badge.

    **Usage:**
    ```html
    <div data-chestno-widget="your-org-slug"></div>
    <script src="https://chestno.ru/api/v1/widgets/badge/your-org-slug" async></script>
    ```

    **Parameters:**
    - `size`: Widget size (small=badge only, medium=badge+rating, large=full)
    - `theme`: Color theme (light, dark, auto)
    - `color`: Custom primary color (hex without #, e.g., "3B82F6")
    - `logo`: Show "Verified by Chestno.ru" footer
    - `reviews`: Show review count
    - `rating`: Show star rating
    - `lang`: Language (ru, en)
    - `radius`: Border radius in pixels (0-24)

    **Caching:**
    Response includes ETag header. Widget is cached for 5 minutes.

    **CORS:**
    Full CORS support for cross-origin embedding.
    """
    try:
        # Parse configuration
        config = parse_widget_config(size, theme, color, logo, reviews, rating, lang, radius)

        # Fetch organization data
        org_data = await run_in_threadpool(get_organization_for_widget, org_slug)

        # Generate JavaScript
        js_content = await run_in_threadpool(
            generate_widget_javascript,
            org_slug,
            org_data,
            config
        )

        # Calculate ETag for caching
        etag = calculate_etag(js_content)

        # Check If-None-Match header for caching
        if_none_match = request.headers.get("If-None-Match")
        if if_none_match and if_none_match.strip('"') == etag:
            return Response(
                status_code=304,
                headers={**get_cors_headers(), **generate_cache_headers(etag)}
            )

        # Return JavaScript response
        return Response(
            content=js_content,
            media_type="application/javascript; charset=utf-8",
            headers={**get_cors_headers(), **generate_cache_headers(etag)}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[widgets] Error generating badge for {org_slug}: {e}", exc_info=True)
        # Return minimal error JS that doesn't break the page
        error_js = f'''
console.warn("Chestno.ru widget error: Unable to load widget for {org_slug}");
'''
        return Response(
            content=error_js,
            media_type="application/javascript; charset=utf-8",
            status_code=200,  # Don't break the page with 500
            headers=get_cors_headers()
        )


@router.get("/iframe/{org_slug}", response_class=HTMLResponse)
async def get_widget_iframe(
    org_slug: str,
    request: Request,
    size: str = Query(default="medium", description="Widget size: small, medium, large"),
    theme: str = Query(default="light", description="Color theme: light, dark, auto"),
    color: Optional[str] = Query(default=None, description="Custom primary color (hex without #)"),
    logo: bool = Query(default=True, description="Show Chestno.ru logo"),
    reviews: bool = Query(default=True, description="Show review count"),
    rating: bool = Query(default=True, description="Show star rating"),
    lang: str = Query(default="ru", description="Language: ru, en"),
    radius: int = Query(default=8, ge=0, le=24, description="Border radius in pixels")
) -> Response:
    """
    Get iframe-embeddable HTML widget for an organization.

    Alternative to JavaScript embedding. Returns a complete HTML page
    suitable for iframe embedding.

    **Usage:**
    ```html
    <iframe
        src="https://chestno.ru/api/v1/widgets/iframe/your-org-slug"
        width="280"
        height="70"
        frameborder="0">
    </iframe>
    ```

    Same parameters as the badge endpoint.
    """
    try:
        # Parse configuration
        config = parse_widget_config(size, theme, color, logo, reviews, rating, lang, radius)

        # Fetch organization data
        org_data = await run_in_threadpool(get_organization_for_widget, org_slug)

        # Generate HTML
        html_content = await run_in_threadpool(render_iframe_html, org_data, config)

        # Calculate ETag
        etag = calculate_etag(html_content)

        # Check If-None-Match
        if_none_match = request.headers.get("If-None-Match")
        if if_none_match and if_none_match.strip('"') == etag:
            return Response(
                status_code=304,
                headers={**get_cors_headers(), **generate_cache_headers(etag)}
            )

        return HTMLResponse(
            content=html_content,
            headers={**get_cors_headers(), **generate_cache_headers(etag)}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[widgets] Error generating iframe for {org_slug}: {e}", exc_info=True)
        error_html = f'''<!DOCTYPE html>
<html><body style="font-family: sans-serif; padding: 10px; color: #666;">
Widget unavailable
</body></html>'''
        return HTMLResponse(
            content=error_html,
            status_code=200,
            headers=get_cors_headers()
        )


@router.get("/preview/{org_slug}", response_class=HTMLResponse)
async def get_widget_preview(
    org_slug: str,
    size: str = Query(default="medium"),
    theme: str = Query(default="light"),
    color: Optional[str] = Query(default=None),
    logo: bool = Query(default=True),
    reviews: bool = Query(default=True),
    rating: bool = Query(default=True),
    lang: str = Query(default="ru"),
    radius: int = Query(default=8, ge=0, le=24)
) -> HTMLResponse:
    """
    Get a standalone HTML preview of the widget.

    Used by the widget configurator to show live previews.
    Returns a minimal HTML page with just the widget.
    """
    try:
        config = parse_widget_config(size, theme, color, logo, reviews, rating, lang, radius)
        org_data = await run_in_threadpool(get_organization_for_widget, org_slug)
        html_content = await run_in_threadpool(render_iframe_html, org_data, config)

        return HTMLResponse(
            content=html_content,
            headers={
                **get_cors_headers(),
                "X-Frame-Options": "SAMEORIGIN"  # Preview should work in same-origin iframes
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[widgets] Error generating preview for {org_slug}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating widget preview: {str(e)}"
        )


# ==================== Configuration Endpoints ====================

@config_router.get("/{organization_id}/widget/embed-code", response_model=WidgetEmbedCode)
async def get_widget_embed_code(
    organization_id: str,
    size: str = Query(default="medium"),
    theme: str = Query(default="light"),
    color: Optional[str] = Query(default=None),
    logo: bool = Query(default=True),
    reviews: bool = Query(default=True),
    rating: bool = Query(default=True),
    lang: str = Query(default="ru"),
    radius: int = Query(default=8, ge=0, le=24)
) -> WidgetEmbedCode:
    """
    Get embed code for widget with current configuration.

    Returns script tag and iframe code that can be copied to embed the widget.
    No authentication required - anyone can generate embed code for a public organization.
    """
    try:
        # Get organization slug from ID
        from psycopg.rows import dict_row
        from app.core.db import get_connection

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT slug FROM organizations WHERE id = %s',
                (organization_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization not found"
                )
            org_slug = row['slug']

        config = parse_widget_config(size, theme, color, logo, reviews, rating, lang, radius)
        return generate_embed_code(org_slug, config)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[widgets] Error generating embed code: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating embed code: {str(e)}"
        )
