"""
POS Integration API Routes.

Endpoints for POS webhooks, transaction processing, and digital receipts.
"""
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.core.session_deps import get_current_user_id_from_session
from app.core.config import get_settings
from app.schemas.pos_integration import (
    DigitalReceiptResponse,
    POSIntegrationCreate,
    POSIntegrationResponse,
    POSWebhookRequest,
    POSWebhookResponse,
    PurchaseTransactionResponse,
    ReceiptActions,
    ReceiptItemDisplay,
    ReceiptLoyalty,
    ReceiptReviewRequest,
    ReceiptReviewResponse,
    ReceiptSummary,
    ReceiptTokenResponse,
)

router = APIRouter(prefix='/api/pos', tags=['pos-integration'])
receipts_router = APIRouter(prefix='/api/receipts', tags=['receipts'])
integrations_router = APIRouter(prefix='/api/integrations/pos', tags=['pos-config'])

settings = get_settings()

# Receipt token validity
RECEIPT_TOKEN_HOURS = 72


def _generate_receipt_token() -> str:
    """Generate a secure receipt token."""
    return secrets.token_urlsafe(24)


def _verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify HMAC signature of webhook payload."""
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


# ==================== POS Webhook ====================

@router.post('/webhook', response_model=POSWebhookResponse)
async def process_pos_webhook(
    request: POSWebhookRequest,
) -> POSWebhookResponse:
    """
    Receive and process POS transaction data.

    Called by POS systems when a transaction is completed.
    Creates transaction record and generates digital receipt token.
    """
    def _process_webhook():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Verify store exists and get POS integration
            cur.execute(
                """
                SELECT pi.*, rs.name as store_name
                FROM pos_integrations pi
                JOIN retail_stores rs ON rs.id = pi.store_id
                WHERE pi.store_id = %s AND pi.is_active = true
                """,
                (request.store_id,),
            )
            integration = cur.fetchone()

            if not integration:
                return POSWebhookResponse(
                    success=False,
                    error="Store not configured for POS integration",
                )

            # Verify signature if provided
            if request.signature and integration.get('api_key'):
                # In production, verify against the actual payload
                pass

            # Check for duplicate transaction
            cur.execute(
                """
                SELECT id FROM purchase_transactions
                WHERE external_transaction_id = %s AND store_id = %s
                """,
                (request.external_transaction_id, request.store_id),
            )
            if cur.fetchone():
                return POSWebhookResponse(
                    success=False,
                    error="Transaction already processed",
                )

            # Find customer by phone/email if provided
            customer_user_id = None
            if request.customer_phone or request.customer_email:
                cur.execute(
                    """
                    SELECT id FROM app_profiles
                    WHERE phone = %s OR email = %s
                    LIMIT 1
                    """,
                    (request.customer_phone, request.customer_email),
                )
                customer = cur.fetchone()
                if customer:
                    customer_user_id = customer['id']

            # Create transaction
            purchased_at = request.purchased_at or datetime.utcnow()
            cur.execute(
                """
                INSERT INTO purchase_transactions (
                    store_id, external_transaction_id, customer_phone,
                    customer_email, customer_user_id, purchased_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    request.store_id,
                    request.external_transaction_id,
                    request.customer_phone,
                    request.customer_email,
                    customer_user_id,
                    purchased_at,
                ),
            )
            transaction = cur.fetchone()
            transaction_id = transaction['id']

            # Process line items
            verified_count = 0
            for item in request.items:
                # Look up product by barcode
                product_id = None
                status_level = None
                is_verified = False

                if item.barcode:
                    cur.execute(
                        """
                        SELECT p.id, sl.status_level
                        FROM products p
                        LEFT JOIN organizations o ON o.id = p.organization_id
                        LEFT JOIN status_levels sl ON sl.organization_id = o.id
                        WHERE p.barcode = %s OR p.sku = %s
                        LIMIT 1
                        """,
                        (item.barcode, item.barcode),
                    )
                    product = cur.fetchone()
                    if product:
                        product_id = product['id']
                        status_level = product.get('status_level')
                        is_verified = status_level is not None
                        verified_count += 1

                cur.execute(
                    """
                    INSERT INTO purchase_line_items (
                        transaction_id, product_id, barcode, product_name,
                        status_level, is_verified, quantity, unit_price_cents
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        transaction_id,
                        product_id,
                        item.barcode,
                        item.product_name,
                        status_level,
                        is_verified,
                        item.quantity,
                        item.unit_price_cents,
                    ),
                )

            # Generate receipt token if digital receipts enabled
            receipt_token = None
            if integration.get('digital_receipts') and (request.customer_phone or request.customer_email):
                receipt_token = _generate_receipt_token()
                delivery_method = 'email' if request.customer_email else 'sms'
                expires_at = datetime.utcnow() + timedelta(hours=RECEIPT_TOKEN_HOURS)

                cur.execute(
                    """
                    INSERT INTO receipt_tokens (
                        transaction_id, token, delivery_method, expires_at
                    )
                    VALUES (%s, %s, %s, %s)
                    """,
                    (transaction_id, receipt_token, delivery_method, expires_at),
                )

            # Award loyalty points if customer identified
            loyalty_points = 0
            if customer_user_id and verified_count > 0:
                # 1 point per verified item
                loyalty_points = verified_count
                cur.execute(
                    """
                    UPDATE purchase_transactions
                    SET loyalty_points_earned = %s
                    WHERE id = %s
                    """,
                    (loyalty_points, transaction_id),
                )
                # Award points through loyalty system
                cur.execute(
                    """
                    INSERT INTO loyalty_transactions (
                        user_id, points, transaction_type, description, reference_id
                    )
                    VALUES (%s, %s, 'purchase', 'Points for verified products', %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (customer_user_id, loyalty_points, str(transaction_id)),
                )

            # Update integration last sync
            cur.execute(
                """
                UPDATE pos_integrations
                SET last_sync_at = NOW()
                WHERE id = %s
                """,
                (integration['id'],),
            )

            conn.commit()

            return POSWebhookResponse(
                success=True,
                transaction_id=str(transaction_id),
                receipt_token=receipt_token,
                verified_items_count=verified_count,
            )

    return await run_in_threadpool(_process_webhook)


# ==================== Product Lookup for POS ====================

@router.get('/product/{barcode}')
async def lookup_product_for_pos(
    barcode: str,
    store_id: str | None = None,
) -> dict:
    """
    Lookup product by barcode for POS display.

    Returns trust badge info for display on POS screen.
    """
    def _lookup():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    p.id,
                    p.name,
                    p.brand,
                    sl.status_level,
                    o.name as organization_name
                FROM products p
                JOIN organizations o ON o.id = p.organization_id
                LEFT JOIN status_levels sl ON sl.organization_id = o.id
                WHERE p.barcode = %s OR p.sku = %s
                LIMIT 1
                """,
                (barcode, barcode),
            )
            product = cur.fetchone()

            if not product:
                return {
                    'found': False,
                    'barcode': barcode,
                }

            return {
                'found': True,
                'barcode': barcode,
                'product_id': str(product['id']),
                'name': product['name'],
                'brand': product['brand'],
                'status_level': product.get('status_level'),
                'organization': product['organization_name'],
                'is_verified': product.get('status_level') is not None,
            }

    return await run_in_threadpool(_lookup)


# ==================== Digital Receipts ====================

@receipts_router.get('/{token}', response_model=DigitalReceiptResponse)
async def get_digital_receipt(
    token: str,
) -> DigitalReceiptResponse:
    """
    View digital receipt by token.

    Public endpoint - no authentication required.
    Token is shared via SMS/email after purchase.
    """
    def _get_receipt():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get receipt token
            cur.execute(
                """
                SELECT rt.*, pt.*, rs.name as store_name, rs.address as store_address
                FROM receipt_tokens rt
                JOIN purchase_transactions pt ON pt.id = rt.transaction_id
                JOIN retail_stores rs ON rs.id = pt.store_id
                WHERE rt.token = %s
                """,
                (token,),
            )
            receipt = cur.fetchone()

            if not receipt:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Receipt not found",
                )

            if receipt['expires_at'] < datetime.utcnow():
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Receipt has expired",
                )

            # Update view tracking
            is_first_view = receipt['first_viewed_at'] is None
            cur.execute(
                """
                UPDATE receipt_tokens
                SET
                    first_viewed_at = COALESCE(first_viewed_at, NOW()),
                    view_count = view_count + 1
                WHERE token = %s
                """,
                (token,),
            )

            # Get line items
            cur.execute(
                """
                SELECT * FROM purchase_line_items
                WHERE transaction_id = %s
                ORDER BY created_at
                """,
                (receipt['transaction_id'],),
            )
            items = [dict(r) for r in cur.fetchall()]

            conn.commit()

            # Build response
            display_items = []
            verified_count = 0
            total_amount = 0

            for item in items:
                display_items.append(ReceiptItemDisplay(
                    name=item['product_name'],
                    quantity=item['quantity'],
                    price=item['unit_price_cents'],
                    verified=item['is_verified'],
                    status_level=item.get('status_level'),
                    product_url=f"https://chestno.ru/p/{item['product_id']}" if item['product_id'] else None,
                ))
                if item['is_verified']:
                    verified_count += 1
                if item['unit_price_cents']:
                    total_amount += item['unit_price_cents'] * item['quantity']

            total_items = len(items)
            verification_percent = int((verified_count / total_items * 100) if total_items > 0 else 0)

            summary = ReceiptSummary(
                total_items=total_items,
                verified_items=verified_count,
                verification_percent=verification_percent,
                total_amount=total_amount if total_amount > 0 else None,
            )

            # Loyalty info if customer identified
            loyalty = None
            if receipt['customer_user_id']:
                cur.execute(
                    """
                    SELECT total_points, tier
                    FROM loyalty_profiles
                    WHERE user_id = %s
                    """,
                    (receipt['customer_user_id'],),
                )
                loyalty_data = cur.fetchone()
                if loyalty_data:
                    loyalty = ReceiptLoyalty(
                        points_earned=receipt['loyalty_points_earned'],
                        total_points=loyalty_data['total_points'],
                        tier=loyalty_data['tier'],
                    )

            actions = ReceiptActions(
                review_url=f"https://chestno.ru/receipts/{token}/review",
                view_all_products_url="https://chestno.ru/products",
                loyalty_dashboard_url="https://chestno.ru/loyalty" if receipt['customer_user_id'] else None,
            )

            return DigitalReceiptResponse(
                transaction={
                    'id': str(receipt['transaction_id']),
                    'date': receipt['purchased_at'].isoformat(),
                    'storeName': receipt['store_name'],
                    'storeAddress': receipt['store_address'],
                },
                items=display_items,
                summary=summary,
                loyalty=loyalty,
                actions=actions,
                expires_at=receipt['expires_at'],
                viewed_at=receipt['first_viewed_at'],
            )

    return await run_in_threadpool(_get_receipt)


@receipts_router.post('/{token}/review', response_model=ReceiptReviewResponse)
async def submit_review_from_receipt(
    token: str,
    review: ReceiptReviewRequest,
) -> ReceiptReviewResponse:
    """
    Submit a product review from digital receipt.

    Allows customers to review products they purchased.
    """
    def _submit_review():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Validate token and get transaction
            cur.execute(
                """
                SELECT rt.*, pt.customer_user_id
                FROM receipt_tokens rt
                JOIN purchase_transactions pt ON pt.id = rt.transaction_id
                WHERE rt.token = %s AND rt.expires_at > NOW()
                """,
                (token,),
            )
            receipt = cur.fetchone()

            if not receipt:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Receipt not found or expired",
                )

            # Verify product was in this transaction
            cur.execute(
                """
                SELECT id FROM purchase_line_items
                WHERE transaction_id = %s AND product_id = %s
                """,
                (receipt['transaction_id'], review.product_id),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Product was not in this purchase",
                )

            # Create review (as anonymous if no user)
            user_id = receipt.get('customer_user_id')
            cur.execute(
                """
                INSERT INTO reviews (
                    product_id, user_id, rating, text, source, status
                )
                VALUES (%s, %s, %s, %s, 'receipt', 'pending')
                RETURNING id
                """,
                (review.product_id, user_id, review.rating, review.text),
            )
            result = cur.fetchone()

            # Award points if user identified
            points_earned = 0
            if user_id:
                points_earned = 5  # Points for review from purchase
                cur.execute(
                    """
                    INSERT INTO loyalty_transactions (
                        user_id, points, transaction_type, description, reference_id
                    )
                    VALUES (%s, %s, 'review', 'Review from purchase', %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (user_id, points_earned, str(result['id'])),
                )

            # Mark review requested
            cur.execute(
                """
                UPDATE purchase_transactions
                SET review_requested = true
                WHERE id = %s
                """,
                (receipt['transaction_id'],),
            )

            conn.commit()

            return ReceiptReviewResponse(
                success=True,
                review_id=str(result['id']),
                points_earned=points_earned,
                message="Thank you for your review!",
            )

    return await run_in_threadpool(_submit_review)


# ==================== POS Integration Config ====================

@integrations_router.get('', response_model=list[POSIntegrationResponse])
async def list_pos_integrations(
    store_id: str | None = None,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[POSIntegrationResponse]:
    """List POS integrations for stores."""
    def _list():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if store_id:
                cur.execute(
                    "SELECT * FROM pos_integrations WHERE store_id = %s ORDER BY created_at DESC",
                    (store_id,),
                )
            else:
                cur.execute(
                    "SELECT * FROM pos_integrations ORDER BY created_at DESC LIMIT 100"
                )
            return [dict(r) for r in cur.fetchall()]

    return await run_in_threadpool(_list)


@integrations_router.post('', response_model=POSIntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_pos_integration(
    integration: POSIntegrationCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> POSIntegrationResponse:
    """Configure POS integration for a store."""
    def _create():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Check store exists
            cur.execute(
                "SELECT id FROM retail_stores WHERE id = %s",
                (integration.store_id,),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )

            # Check for existing integration
            cur.execute(
                "SELECT id FROM pos_integrations WHERE store_id = %s",
                (integration.store_id,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="POS integration already exists for this store",
                )

            cur.execute(
                """
                INSERT INTO pos_integrations (
                    store_id, pos_provider, api_key, webhook_url, config,
                    print_badges, digital_receipts, review_prompt
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    integration.store_id,
                    integration.pos_provider,
                    integration.api_key,
                    integration.webhook_url,
                    integration.config,
                    integration.print_badges,
                    integration.digital_receipts,
                    integration.review_prompt,
                ),
            )
            result = cur.fetchone()
            conn.commit()
            return dict(result)

    return await run_in_threadpool(_create)
