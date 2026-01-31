"""
Widget Service

Service for generating embeddable trust widgets that businesses can add to their websites.
Supports multiple sizes, themes, and customization options.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Literal, Optional, Tuple

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.widgets import (
    WidgetConfig,
    WidgetEmbedCode,
    WidgetOrganizationData,
    WidgetSize,
    WidgetTheme,
)

logger = logging.getLogger(__name__)


# ============================================================
# DATA FETCHING
# ============================================================

def get_organization_for_widget(org_slug: str) -> WidgetOrganizationData:
    """
    Fetch organization data needed for widget rendering.

    Args:
        org_slug: Organization slug

    Returns:
        WidgetOrganizationData with organization info

    Raises:
        HTTPException: If organization not found
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get organization basic info
            cur.execute(
                '''
                SELECT
                    o.id::text as organization_id,
                    o.name,
                    o.slug,
                    o.verified_at
                FROM organizations o
                WHERE o.slug = %s
                  AND o.deleted_at IS NULL
                ''',
                (org_slug,)
            )
            org_row = cur.fetchone()

            if not org_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Organization with slug '{org_slug}' not found"
                )

            organization_id = org_row['organization_id']

            # Get current status level
            cur.execute(
                'SELECT public.get_current_status_level(%s::uuid) as current_level',
                (organization_id,)
            )
            level_row = cur.fetchone()
            current_level = level_row['current_level'] if level_row else '0'

            # Get review statistics
            cur.execute(
                '''
                SELECT
                    COALESCE(AVG(rating), 0) as avg_rating,
                    COUNT(*) as review_count
                FROM reviews
                WHERE organization_id = %s
                  AND status = 'approved'
                ''',
                (organization_id,)
            )
            review_row = cur.fetchone()
            star_rating = float(review_row['avg_rating']) if review_row and review_row['avg_rating'] else None
            review_count = int(review_row['review_count']) if review_row else 0

            # Format verified_since date
            verified_since = None
            if org_row['verified_at']:
                verified_since = org_row['verified_at'].strftime('%Y-%m-%d')

            return WidgetOrganizationData(
                organization_id=organization_id,
                name=org_row['name'],
                slug=org_row['slug'],
                status_level=current_level,
                star_rating=round(star_rating, 1) if star_rating else None,
                review_count=review_count,
                verified_since=verified_since
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[widgets] Error fetching organization data for {org_slug}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching organization data: {str(e)}"
        )


# ============================================================
# WIDGET RENDERING
# ============================================================

def get_badge_info(level: Literal["0", "A", "B", "C"]) -> dict:
    """Get badge display information for a status level."""
    badges = {
        "0": {
            "label": "Новая организация",
            "label_en": "New Organization",
            "color": "#6B7280",  # gray
            "bg_color": "#F3F4F6",
            "icon": "circle"
        },
        "A": {
            "label": "Уровень A",
            "label_en": "Level A",
            "color": "#3B82F6",  # blue
            "bg_color": "#EFF6FF",
            "icon": "shield-check"
        },
        "B": {
            "label": "Проверено",
            "label_en": "Verified",
            "color": "#10B981",  # green
            "bg_color": "#ECFDF5",
            "icon": "badge-check"
        },
        "C": {
            "label": "Высшая репутация",
            "label_en": "Top Rated",
            "color": "#F59E0B",  # amber/gold
            "bg_color": "#FFFBEB",
            "icon": "star"
        }
    }
    return badges.get(level, badges["0"])


def generate_widget_css(config: WidgetConfig, badge_info: dict) -> str:
    """Generate CSS styles for the widget."""
    primary_color = config.primary_color or badge_info['color']
    bg_color = badge_info['bg_color']

    # Theme-based colors
    if config.theme == WidgetTheme.DARK:
        text_color = "#FFFFFF"
        text_muted = "#9CA3AF"
        card_bg = "#1F2937"
        border_color = "#374151"
    else:
        text_color = "#111827"
        text_muted = "#6B7280"
        card_bg = "#FFFFFF"
        border_color = "#E5E7EB"

    return f'''
    .chestno-widget {{
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: {text_color};
        background: {card_bg};
        border: 1px solid {border_color};
        border-radius: {config.border_radius}px;
        padding: 12px 16px;
        display: inline-flex;
        flex-direction: column;
        gap: 8px;
        text-decoration: none;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
        box-sizing: border-box;
    }}
    .chestno-widget:hover {{
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transform: translateY(-1px);
    }}
    .chestno-widget * {{
        box-sizing: border-box;
    }}
    .chestno-widget-header {{
        display: flex;
        align-items: center;
        gap: 10px;
    }}
    .chestno-widget-badge {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: {bg_color};
        color: {primary_color};
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
    }}
    .chestno-widget-badge svg {{
        width: 14px;
        height: 14px;
        flex-shrink: 0;
    }}
    .chestno-widget-rating {{
        display: flex;
        align-items: center;
        gap: 4px;
    }}
    .chestno-widget-stars {{
        display: flex;
        gap: 1px;
    }}
    .chestno-widget-star {{
        width: 16px;
        height: 16px;
        color: #FCD34D;
    }}
    .chestno-widget-star-empty {{
        color: {border_color};
    }}
    .chestno-widget-rating-text {{
        font-size: 13px;
        color: {text_muted};
        margin-left: 4px;
    }}
    .chestno-widget-reviews {{
        font-size: 12px;
        color: {text_muted};
    }}
    .chestno-widget-footer {{
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: {text_muted};
        padding-top: 4px;
        border-top: 1px solid {border_color};
    }}
    .chestno-widget-footer svg {{
        width: 14px;
        height: 14px;
        opacity: 0.7;
    }}
    .chestno-widget-small {{
        padding: 8px 12px;
    }}
    .chestno-widget-small .chestno-widget-header {{
        gap: 8px;
    }}
    '''


def generate_star_svg(filled: bool = True) -> str:
    """Generate SVG for a star icon."""
    fill = "currentColor" if filled else "none"
    stroke = "currentColor"
    return f'''<svg viewBox="0 0 20 20" fill="{fill}" stroke="{stroke}" stroke-width="1" class="chestno-widget-star {'chestno-widget-star-empty' if not filled else ''}">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>'''


def generate_badge_icon_svg(icon_type: str, color: str) -> str:
    """Generate SVG for badge icons."""
    if icon_type == "shield-check":
        return f'''<svg viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>'''
    elif icon_type == "badge-check":
        return f'''<svg viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>'''
    elif icon_type == "star":
        return f'''<svg viewBox="0 0 24 24" fill="{color}" stroke="{color}" stroke-width="1">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>'''
    else:  # circle
        return f'''<svg viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
        </svg>'''


def generate_logo_svg() -> str:
    """Generate the Chestno.ru logo SVG."""
    return '''<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>'''


def render_widget_html(
    org_data: WidgetOrganizationData,
    config: WidgetConfig
) -> str:
    """
    Render the widget HTML content.

    Args:
        org_data: Organization data
        config: Widget configuration

    Returns:
        HTML string for the widget
    """
    settings = get_settings()
    frontend_url = settings.frontend_url.rstrip('/')
    badge_info = get_badge_info(org_data.status_level)

    # Determine label based on language
    badge_label = badge_info['label'] if config.language == 'ru' else badge_info['label_en']

    # Generate stars HTML
    stars_html = ""
    if config.show_rating and org_data.star_rating:
        full_stars = int(org_data.star_rating)
        for i in range(5):
            stars_html += generate_star_svg(filled=i < full_stars)

    # Rating text
    rating_text = ""
    if config.show_rating and org_data.star_rating:
        rating_text = f"{org_data.star_rating}"

    # Reviews text
    reviews_text = ""
    if config.show_reviews_count and org_data.review_count > 0:
        if config.language == 'ru':
            # Russian pluralization
            count = org_data.review_count
            if count % 10 == 1 and count % 100 != 11:
                reviews_text = f"{count} отзыв"
            elif 2 <= count % 10 <= 4 and (count % 100 < 10 or count % 100 >= 20):
                reviews_text = f"{count} отзыва"
            else:
                reviews_text = f"{count} отзывов"
        else:
            reviews_text = f"{org_data.review_count} review{'s' if org_data.review_count != 1 else ''}"

    # Footer text
    footer_text = "Проверено Честно.ru" if config.language == 'ru' else "Verified by Chestno.ru"

    # Size-specific class
    size_class = f"chestno-widget-{config.size.value}"

    # Build HTML based on size
    org_url = f"{frontend_url}/org/{org_data.slug}"

    badge_icon = generate_badge_icon_svg(badge_info['icon'], badge_info['color'])

    if config.size == WidgetSize.SMALL:
        # Small: Just badge and logo
        html = f'''
        <a href="{org_url}" target="_blank" rel="noopener noreferrer" class="chestno-widget {size_class}">
            <div class="chestno-widget-header">
                <span class="chestno-widget-badge">{badge_icon}{badge_label}</span>
                {'<span class="chestno-widget-footer">' + generate_logo_svg() + '</span>' if config.show_logo else ''}
            </div>
        </a>
        '''
    elif config.size == WidgetSize.MEDIUM:
        # Medium: Badge + rating
        html = f'''
        <a href="{org_url}" target="_blank" rel="noopener noreferrer" class="chestno-widget {size_class}">
            <div class="chestno-widget-header">
                <span class="chestno-widget-badge">{badge_icon}{badge_label}</span>
                {f'<div class="chestno-widget-rating"><div class="chestno-widget-stars">{stars_html}</div><span class="chestno-widget-rating-text">{rating_text}</span></div>' if stars_html else ''}
            </div>
            {f'<div class="chestno-widget-footer">{generate_logo_svg()}<span>{footer_text}</span></div>' if config.show_logo else ''}
        </a>
        '''
    else:
        # Large: Badge + rating + reviews summary
        html = f'''
        <a href="{org_url}" target="_blank" rel="noopener noreferrer" class="chestno-widget {size_class}">
            <div class="chestno-widget-header">
                <span class="chestno-widget-badge">{badge_icon}{badge_label}</span>
                {f'<div class="chestno-widget-rating"><div class="chestno-widget-stars">{stars_html}</div><span class="chestno-widget-rating-text">{rating_text}</span></div>' if stars_html else ''}
            </div>
            {f'<div class="chestno-widget-reviews">{reviews_text}</div>' if reviews_text else ''}
            {f'<div class="chestno-widget-footer">{generate_logo_svg()}<span>{footer_text}</span></div>' if config.show_logo else ''}
        </a>
        '''

    return html.strip()


def generate_widget_javascript(
    org_slug: str,
    org_data: WidgetOrganizationData,
    config: WidgetConfig
) -> str:
    """
    Generate embeddable JavaScript that renders the widget.

    Args:
        org_slug: Organization slug
        org_data: Organization data
        config: Widget configuration

    Returns:
        JavaScript code as string
    """
    badge_info = get_badge_info(org_data.status_level)
    css = generate_widget_css(config, badge_info)
    html = render_widget_html(org_data, config)

    # Escape for JavaScript string
    css_escaped = css.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    html_escaped = html.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

    js = f'''
(function() {{
    // Chestno.ru Trust Widget
    // Organization: {org_data.name}

    // Prevent multiple initializations
    if (window.__chestnoWidgetLoaded_{org_slug.replace('-', '_')}) return;
    window.__chestnoWidgetLoaded_{org_slug.replace('-', '_')} = true;

    // Create style element
    var style = document.createElement('style');
    style.textContent = `{css_escaped}`;
    document.head.appendChild(style);

    // Find all widget containers
    var containers = document.querySelectorAll('[data-chestno-widget="{org_slug}"]');

    containers.forEach(function(container) {{
        container.innerHTML = `{html_escaped}`;
    }});

    // Also check for script tag insertion point
    var scripts = document.querySelectorAll('script[src*="widgets/badge/{org_slug}"]');
    scripts.forEach(function(script) {{
        if (!script.nextElementSibling || !script.nextElementSibling.classList.contains('chestno-widget')) {{
            var wrapper = document.createElement('div');
            wrapper.innerHTML = `{html_escaped}`;
            script.parentNode.insertBefore(wrapper.firstElementChild, script.nextSibling);
        }}
    }});
}})();
'''
    return js.strip()


# ============================================================
# CACHING & ETAG
# ============================================================

def calculate_etag(content: str) -> str:
    """Calculate ETag hash for content."""
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def generate_cache_headers(etag: str) -> dict:
    """Generate cache control headers."""
    return {
        "ETag": f'"{etag}"',
        "Cache-Control": "public, max-age=300",  # 5 minutes
        "Vary": "Accept-Encoding"
    }


# ============================================================
# EMBED CODE GENERATION
# ============================================================

def generate_embed_code(org_slug: str, config: WidgetConfig) -> WidgetEmbedCode:
    """
    Generate embed code snippets for the widget.

    Args:
        org_slug: Organization slug
        config: Widget configuration

    Returns:
        WidgetEmbedCode with script tag, iframe code, and preview URL
    """
    settings = get_settings()
    backend_url = settings.backend_url.rstrip('/')
    frontend_url = settings.frontend_url.rstrip('/')

    # Build query params
    params = []
    if config.size != WidgetSize.MEDIUM:
        params.append(f"size={config.size.value}")
    if config.theme != WidgetTheme.LIGHT:
        params.append(f"theme={config.theme.value}")
    if config.primary_color:
        params.append(f"color={config.primary_color.replace('#', '')}")
    if not config.show_logo:
        params.append("logo=false")
    if not config.show_reviews_count:
        params.append("reviews=false")
    if not config.show_rating:
        params.append("rating=false")
    if config.language != "ru":
        params.append(f"lang={config.language}")
    if config.border_radius != 8:
        params.append(f"radius={config.border_radius}")

    query_string = "&".join(params)
    widget_url = f"{backend_url}/api/v1/widgets/badge/{org_slug}"
    if query_string:
        widget_url += f"?{query_string}"

    # Script tag embed
    script_tag = f'''<!-- Chestno.ru Trust Badge -->
<div data-chestno-widget="{org_slug}"></div>
<script src="{widget_url}" async></script>'''

    # Iframe embed (alternative)
    iframe_url = f"{backend_url}/api/v1/widgets/iframe/{org_slug}"
    if query_string:
        iframe_url += f"?{query_string}"

    # Determine iframe dimensions based on size
    if config.size == WidgetSize.SMALL:
        width, height = 180, 50
    elif config.size == WidgetSize.MEDIUM:
        width, height = 280, 70
    else:
        width, height = 300, 100

    iframe_code = f'''<!-- Chestno.ru Trust Badge (iframe) -->
<iframe src="{iframe_url}" width="{width}" height="{height}" frameborder="0" scrolling="no" style="border: none; overflow: hidden;"></iframe>'''

    # Preview URL
    preview_url = f"{frontend_url}/dashboard/organization/widget"

    return WidgetEmbedCode(
        script_tag=script_tag,
        iframe_code=iframe_code,
        preview_url=preview_url
    )


def render_iframe_html(org_data: WidgetOrganizationData, config: WidgetConfig) -> str:
    """
    Render complete HTML page for iframe embedding.

    Args:
        org_data: Organization data
        config: Widget configuration

    Returns:
        Complete HTML page
    """
    badge_info = get_badge_info(org_data.status_level)
    css = generate_widget_css(config, badge_info)
    widget_html = render_widget_html(org_data, config)

    # Dark mode CSS for auto theme
    auto_theme_css = ""
    if config.theme == WidgetTheme.AUTO:
        dark_config = WidgetConfig(
            size=config.size,
            theme=WidgetTheme.DARK,
            primary_color=config.primary_color,
            show_logo=config.show_logo,
            show_reviews_count=config.show_reviews_count,
            show_rating=config.show_rating,
            language=config.language,
            border_radius=config.border_radius
        )
        dark_css = generate_widget_css(dark_config, badge_info)
        auto_theme_css = f'''
        @media (prefers-color-scheme: dark) {{
            {dark_css}
        }}
        '''

    html = f'''<!DOCTYPE html>
<html lang="{config.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chestno.ru Widget - {org_data.name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            background: transparent;
            display: inline-block;
        }}
        {css}
        {auto_theme_css}
    </style>
</head>
<body>
    {widget_html}
</body>
</html>'''

    return html
