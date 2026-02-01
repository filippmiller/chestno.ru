"""
Retail Kiosk API Routes.

Endpoints for kiosk device authentication, configuration, scanning, and heartbeat.
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.kiosk import (
    KioskAuthRequest,
    KioskAuthResponse,
    KioskConfig,
    KioskHeartbeatRequest,
    KioskHeartbeatResponse,
    KioskPrintRequest,
    KioskPrintResponse,
    KioskScanRequest,
    KioskScanResponse,
    KioskProductInfo,
    KioskPriceComparison,
    KioskReviews,
    KioskFeatures,
)

router = APIRouter(prefix='/api/kiosk', tags=['kiosk'])

# Session token validity period
KIOSK_SESSION_HOURS = 24


def _generate_session_token() -> str:
    """Generate a secure session token for kiosk."""
    return secrets.token_urlsafe(32)


def _validate_session(session_token: str) -> dict | None:
    """Validate kiosk session token and return session data."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT ks.*, rk.store_id, rk.device_code, rk.config
            FROM kiosk_sessions ks
            JOIN retail_kiosks rk ON rk.id = ks.kiosk_id
            WHERE ks.session_token = %s
              AND ks.ended_at IS NULL
              AND ks.started_at > NOW() - INTERVAL '%s hours'
            """,
            (session_token, KIOSK_SESSION_HOURS),
        )
        return cur.fetchone()


# ==================== Kiosk Authentication ====================

@router.post('/authenticate', response_model=KioskAuthResponse)
async def authenticate_kiosk(
    request: KioskAuthRequest,
) -> KioskAuthResponse:
    """
    Authenticate a kiosk device.

    Kiosk devices must be pre-registered in the system with a unique device_code.
    Returns a session token for subsequent API calls.
    """
    def _authenticate():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Find kiosk device
            cur.execute(
                """
                SELECT rk.*, rs.name as store_name
                FROM retail_kiosks rk
                JOIN retail_stores rs ON rs.id = rk.store_id
                WHERE rk.device_code = %s AND rk.store_id = %s
                """,
                (request.device_code, request.store_id),
            )
            kiosk = cur.fetchone()

            if not kiosk:
                return KioskAuthResponse(
                    success=False,
                    error="Invalid device code or store ID",
                )

            # End any existing sessions for this kiosk
            cur.execute(
                """
                UPDATE kiosk_sessions
                SET ended_at = NOW()
                WHERE kiosk_id = %s AND ended_at IS NULL
                """,
                (kiosk['id'],),
            )

            # Create new session
            session_token = _generate_session_token()
            cur.execute(
                """
                INSERT INTO kiosk_sessions (kiosk_id, session_token)
                VALUES (%s, %s)
                RETURNING id
                """,
                (kiosk['id'], session_token),
            )

            # Update kiosk online status
            cur.execute(
                """
                UPDATE retail_kiosks
                SET is_online = true, last_heartbeat = NOW()
                WHERE id = %s
                """,
                (kiosk['id'],),
            )

            conn.commit()

            return KioskAuthResponse(
                success=True,
                kiosk_id=str(kiosk['id']),
                session_token=session_token,
                store_name=kiosk['store_name'],
            )

    return await run_in_threadpool(_authenticate)


# ==================== Kiosk Configuration ====================

@router.get('/config', response_model=KioskConfig)
async def get_kiosk_config(
    session_token: str,
) -> KioskConfig:
    """
    Get kiosk configuration.

    Returns branding, features, and display settings for the kiosk.
    """
    def _get_config():
        session = _validate_session(session_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
            )

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT rk.*, rs.name as store_name
                FROM retail_kiosks rk
                JOIN retail_stores rs ON rs.id = rk.store_id
                WHERE rk.id = %s
                """,
                (session['kiosk_id'],),
            )
            kiosk = cur.fetchone()

            config_data = kiosk.get('config', {}) or {}
            features = KioskFeatures(
                price_comparison=config_data.get('price_comparison', True),
                reviews=config_data.get('reviews', True),
                loyalty_signup=config_data.get('loyalty_signup', True),
                print_receipt=config_data.get('print_receipt', False),
            )

            return KioskConfig(
                store_id=str(kiosk['store_id']),
                store_name=kiosk['store_name'],
                kiosk_id=str(kiosk['id']),
                location_in_store=kiosk.get('location_in_store'),
                branding_color=config_data.get('branding_color'),
                logo_url=config_data.get('logo_url'),
                idle_video_url=config_data.get('idle_video_url'),
                language=config_data.get('language', 'ru'),
                features=features,
                idle_timeout_seconds=config_data.get('idle_timeout_seconds', 30),
            )

    return await run_in_threadpool(_get_config)


# ==================== Product Scanning ====================

@router.post('/scan', response_model=KioskScanResponse)
async def process_kiosk_scan(
    request: KioskScanRequest,
) -> KioskScanResponse:
    """
    Process a product scan from the kiosk.

    Accepts either a barcode or QR code and returns product trust information.
    """
    def _process_scan():
        session = _validate_session(request.session_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
            )

        if not request.barcode and not request.qr_code:
            return KioskScanResponse(
                success=False,
                error="Either barcode or qr_code is required",
            )

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Find product by barcode or QR code
            if request.barcode:
                cur.execute(
                    """
                    SELECT p.*, o.name as org_name, sl.status_level
                    FROM products p
                    JOIN organizations o ON o.id = p.organization_id
                    LEFT JOIN status_levels sl ON sl.organization_id = o.id
                    WHERE p.barcode = %s OR p.sku = %s
                    LIMIT 1
                    """,
                    (request.barcode, request.barcode),
                )
            else:
                # Extract product ID from QR code URL
                # Assuming QR contains: https://chestno.ru/p/{product_id}
                product_id = request.qr_code.split('/')[-1] if request.qr_code else None
                cur.execute(
                    """
                    SELECT p.*, o.name as org_name, sl.status_level
                    FROM products p
                    JOIN organizations o ON o.id = p.organization_id
                    LEFT JOIN status_levels sl ON sl.organization_id = o.id
                    WHERE p.id::text = %s OR p.public_id = %s
                    LIMIT 1
                    """,
                    (product_id, product_id),
                )

            product = cur.fetchone()
            if not product:
                return KioskScanResponse(
                    success=False,
                    error="Product not found",
                )

            # Log scan event
            cur.execute(
                """
                INSERT INTO store_scan_events (
                    store_id, product_id, organization_id, scan_source
                )
                VALUES (%s, %s, %s, 'kiosk')
                RETURNING id
                """,
                (session['store_id'], product['id'], product['organization_id']),
            )

            # Update session scan count
            cur.execute(
                """
                UPDATE kiosk_sessions
                SET products_scanned = products_scanned + 1
                WHERE id = %s
                """,
                (session['id'],),
            )

            conn.commit()

            # Get certifications
            cur.execute(
                """
                SELECT c.name
                FROM product_certifications pc
                JOIN certifications c ON c.id = pc.certification_id
                WHERE pc.product_id = %s
                """,
                (product['id'],),
            )
            certs = [r['name'] for r in cur.fetchall()]

            # Get reviews summary
            cur.execute(
                """
                SELECT
                    AVG(rating)::float as avg_rating,
                    COUNT(*) as total
                FROM reviews
                WHERE product_id = %s AND status = 'approved'
                """,
                (product['id'],),
            )
            review_stats = cur.fetchone()

            # Recent reviews
            cur.execute(
                """
                SELECT r.text, r.rating, r.created_at
                FROM reviews r
                WHERE r.product_id = %s AND r.status = 'approved'
                ORDER BY r.created_at DESC
                LIMIT 3
                """,
                (product['id'],),
            )
            recent_reviews = [
                {
                    'text': r['text'][:200] if r['text'] else '',
                    'rating': r['rating'],
                    'date': r['created_at'].isoformat(),
                }
                for r in cur.fetchall()
            ]

            product_info = KioskProductInfo(
                product_id=str(product['id']),
                name=product['name'],
                brand=product.get('brand'),
                status_level=product.get('status_level'),
                trust_score=product.get('trust_score'),
                verification_date=product.get('verified_at'),
                certifications=certs,
                origin=product.get('origin_country'),
                ingredients=product.get('ingredients'),
                image_url=product.get('image_url'),
            )

            reviews = KioskReviews(
                average_rating=review_stats['avg_rating'],
                total_reviews=review_stats['total'] or 0,
                recent_reviews=recent_reviews,
            )

            return KioskScanResponse(
                success=True,
                product=product_info,
                reviews=reviews,
            )

    return await run_in_threadpool(_process_scan)


# ==================== Product Lookup ====================

@router.get('/product/{barcode}', response_model=KioskScanResponse)
async def lookup_product(
    barcode: str,
    session_token: str,
) -> KioskScanResponse:
    """
    Lookup product by barcode for POS display.

    Used when POS system needs to show trust badge during checkout.
    """
    # Reuse scan logic
    return await process_kiosk_scan(
        KioskScanRequest(barcode=barcode, session_token=session_token)
    )


# ==================== Heartbeat ====================

@router.post('/heartbeat', response_model=KioskHeartbeatResponse)
async def kiosk_heartbeat(
    request: KioskHeartbeatRequest,
) -> KioskHeartbeatResponse:
    """
    Kiosk device health ping.

    Should be called periodically (every 1-5 minutes) to maintain online status.
    """
    def _heartbeat():
        session = _validate_session(request.session_token)
        if not session:
            return KioskHeartbeatResponse(
                success=False,
                server_time=datetime.utcnow(),
                message="Session expired, please re-authenticate",
            )

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Update kiosk heartbeat
            cur.execute(
                """
                UPDATE retail_kiosks
                SET last_heartbeat = NOW(), is_online = true
                WHERE id = %s
                RETURNING config
                """,
                (session['kiosk_id'],),
            )
            kiosk = cur.fetchone()

            # Check if config was updated since session started
            cur.execute(
                """
                SELECT updated_at FROM retail_kiosks
                WHERE id = %s
                """,
                (session['kiosk_id'],),
            )
            updated = cur.fetchone()
            config_updated = updated['updated_at'] > session['started_at']

            conn.commit()

            return KioskHeartbeatResponse(
                success=True,
                server_time=datetime.utcnow(),
                config_updated=config_updated,
            )

    return await run_in_threadpool(_heartbeat)


# ==================== Print ====================

@router.post('/print', response_model=KioskPrintResponse)
async def generate_print(
    request: KioskPrintRequest,
) -> KioskPrintResponse:
    """
    Generate printable product summary.

    Creates a formatted text/HTML for thermal printer output.
    """
    def _generate_print():
        session = _validate_session(request.session_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
            )

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get product info
            cur.execute(
                """
                SELECT p.*, o.name as org_name, sl.status_level
                FROM products p
                JOIN organizations o ON o.id = p.organization_id
                LEFT JOIN status_levels sl ON sl.organization_id = o.id
                WHERE p.id = %s
                """,
                (request.product_id,),
            )
            product = cur.fetchone()

            if not product:
                return KioskPrintResponse(
                    success=False,
                    error="Product not found",
                )

            # Generate simple print format
            status_emoji = {
                'A': '[A]',
                'B': '[B]',
                'C': '[C]',
            }.get(product.get('status_level', ''), '[ ]')

            print_lines = [
                "=" * 32,
                "CHESTNO.RU",
                "=" * 32,
                "",
                product['name'][:30],
                f"Brand: {product.get('brand', '-')}",
                "",
                f"Trust Status: {status_emoji}",
                f"Verified: {product.get('verified_at', '-')}",
                "",
            ]

            if request.include_qr:
                qr_url = f"https://chestno.ru/p/{product['id']}"
                print_lines.append(f"Scan for details:")
                print_lines.append(qr_url)

            print_lines.extend([
                "",
                "=" * 32,
                datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            ])

            print_data = "\n".join(print_lines)

            return KioskPrintResponse(
                success=True,
                print_data=print_data,
            )

    return await run_in_threadpool(_generate_print)
