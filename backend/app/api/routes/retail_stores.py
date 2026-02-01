"""
Retail Stores API Routes.

Endpoints for retail store registry, store products, and store analytics.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.core.session_deps import get_current_user_id_from_session
from app.schemas.retail import (
    RetailStoreCreate,
    RetailStoreListResponse,
    RetailStoreResponse,
    RetailStoreUpdate,
    StoreAnalyticsResponse,
    StoreDetailedAnalytics,
    StoreProductCreate,
    StoreProductListResponse,
    StoreProductResponse,
    StoreProductUpdate,
)

router = APIRouter(prefix='/api/retail', tags=['retail-stores'])
analytics_router = APIRouter(prefix='/api/retail/analytics', tags=['retail-analytics'])


# ==================== Store CRUD ====================

@router.get('/stores', response_model=RetailStoreListResponse)
async def list_stores(
    city: str | None = None,
    chain_name: str | None = None,
    is_active: bool = True,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> RetailStoreListResponse:
    """
    List retail stores with filtering.

    Supports filtering by city, chain name, and active status.
    """
    def _list_stores():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build dynamic query
            conditions = ["is_active = %s"]
            params = [is_active]

            if city:
                conditions.append("city ILIKE %s")
                params.append(f"%{city}%")
            if chain_name:
                conditions.append("chain_name ILIKE %s")
                params.append(f"%{chain_name}%")

            where_clause = " AND ".join(conditions)

            # Get total count
            cur.execute(
                f"SELECT COUNT(*) FROM retail_stores WHERE {where_clause}",
                params,
            )
            total = cur.fetchone()['count']

            # Get stores
            cur.execute(
                f"""
                SELECT *
                FROM retail_stores
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            stores = [dict(r) for r in cur.fetchall()]

            return RetailStoreListResponse(
                stores=stores,
                total=total,
                has_more=(offset + limit) < total,
            )

    return await run_in_threadpool(_list_stores)


@router.post('/stores', response_model=RetailStoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    store: RetailStoreCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> RetailStoreResponse:
    """
    Register a new retail store.

    Store codes must be unique and follow the pattern: CHAIN-CITY-NUMBER
    (e.g., METRO-MSK-001).
    """
    def _create_store():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Check if store_code already exists
            cur.execute(
                "SELECT id FROM retail_stores WHERE store_code = %s",
                (store.store_code,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Store code '{store.store_code}' already exists",
                )

            cur.execute(
                """
                INSERT INTO retail_stores (
                    store_code, name, chain_name, address, city, region,
                    postal_code, latitude, longitude, manager_name,
                    manager_email, manager_phone
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    store.store_code,
                    store.name,
                    store.chain_name,
                    store.address,
                    store.city,
                    store.region,
                    store.postal_code,
                    store.latitude,
                    store.longitude,
                    store.manager_name,
                    store.manager_email,
                    store.manager_phone,
                ),
            )
            created = cur.fetchone()
            conn.commit()
            return dict(created)

    return await run_in_threadpool(_create_store)


@router.get('/stores/{store_id}', response_model=RetailStoreResponse)
async def get_store(
    store_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> RetailStoreResponse:
    """Get details of a specific retail store."""
    def _get_store():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM retail_stores WHERE id = %s", (store_id,))
            store = cur.fetchone()
            if not store:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )
            return dict(store)

    return await run_in_threadpool(_get_store)


@router.put('/stores/{store_id}', response_model=RetailStoreResponse)
async def update_store(
    store_id: str,
    update: RetailStoreUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> RetailStoreResponse:
    """Update a retail store."""
    def _update_store():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build dynamic update
            updates = []
            params = []
            update_data = update.model_dump(exclude_unset=True)

            if not update_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update",
                )

            for field, value in update_data.items():
                updates.append(f"{field} = %s")
                params.append(value)

            updates.append("updated_at = now()")
            params.append(store_id)

            cur.execute(
                f"""
                UPDATE retail_stores
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING *
                """,
                params,
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )
            conn.commit()
            return dict(updated)

    return await run_in_threadpool(_update_store)


@router.delete('/stores/{store_id}')
async def deactivate_store(
    store_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Deactivate a retail store.

    This soft-deletes the store by setting is_active to false.
    """
    def _deactivate_store():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE retail_stores
                SET is_active = false, updated_at = now()
                WHERE id = %s
                RETURNING id
                """,
                (store_id,),
            )
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )
            conn.commit()
            return {"success": True, "message": "Store deactivated"}

    return await run_in_threadpool(_deactivate_store)


# ==================== Store Products ====================

@router.get('/stores/{store_id}/products', response_model=StoreProductListResponse)
async def list_store_products(
    store_id: str,
    in_stock: bool | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoreProductListResponse:
    """List products available in a specific store."""
    def _list_products():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            conditions = ["sp.store_id = %s"]
            params = [store_id]

            if in_stock is not None:
                conditions.append("sp.in_stock = %s")
                params.append(in_stock)

            where_clause = " AND ".join(conditions)

            # Count total
            cur.execute(
                f"SELECT COUNT(*) FROM store_products sp WHERE {where_clause}",
                params,
            )
            total = cur.fetchone()['count']

            # Get products with product info
            cur.execute(
                f"""
                SELECT sp.*, p.name as product_name, p.brand as product_brand
                FROM store_products sp
                LEFT JOIN products p ON p.id = sp.product_id
                WHERE {where_clause}
                ORDER BY sp.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            products = [dict(r) for r in cur.fetchall()]

            return StoreProductListResponse(
                products=products,
                total=total,
                has_more=(offset + limit) < total,
            )

    return await run_in_threadpool(_list_products)


@router.post('/stores/{store_id}/products', response_model=StoreProductResponse, status_code=status.HTTP_201_CREATED)
async def add_store_product(
    store_id: str,
    product: StoreProductCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoreProductResponse:
    """Add a product to a store's inventory."""
    def _add_product():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Verify store exists
            cur.execute("SELECT id FROM retail_stores WHERE id = %s", (store_id,))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )

            # Get product's organization_id
            cur.execute(
                "SELECT id, organization_id, name, brand FROM products WHERE id = %s",
                (product.product_id,),
            )
            prod = cur.fetchone()
            if not prod:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Product not found",
                )

            # Check for duplicate
            cur.execute(
                """
                SELECT id FROM store_products
                WHERE store_id = %s AND product_id = %s
                """,
                (store_id, product.product_id),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Product already added to this store",
                )

            cur.execute(
                """
                INSERT INTO store_products (
                    store_id, product_id, organization_id, aisle,
                    shelf_position, store_price_cents, in_stock
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    store_id,
                    product.product_id,
                    prod['organization_id'],
                    product.aisle,
                    product.shelf_position,
                    product.store_price_cents,
                    product.in_stock,
                ),
            )
            created = cur.fetchone()
            conn.commit()

            result = dict(created)
            result['product_name'] = prod['name']
            result['product_brand'] = prod['brand']
            return result

    return await run_in_threadpool(_add_product)


@router.put('/stores/{store_id}/products/{product_id}', response_model=StoreProductResponse)
async def update_store_product(
    store_id: str,
    product_id: str,
    update: StoreProductUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoreProductResponse:
    """Update a store product (price, stock status, location)."""
    def _update_product():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            updates = []
            params = []
            update_data = update.model_dump(exclude_unset=True)

            if not update_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update",
                )

            for field, value in update_data.items():
                updates.append(f"{field} = %s")
                params.append(value)

            updates.append("updated_at = now()")
            if 'in_stock' in update_data:
                updates.append("last_stock_check = now()")

            params.extend([store_id, product_id])

            cur.execute(
                f"""
                UPDATE store_products
                SET {', '.join(updates)}
                WHERE store_id = %s AND id = %s
                RETURNING *
                """,
                params,
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store product not found",
                )
            conn.commit()

            # Get product name
            cur.execute(
                "SELECT name, brand FROM products WHERE id = %s",
                (updated['product_id'],),
            )
            prod = cur.fetchone()
            result = dict(updated)
            if prod:
                result['product_name'] = prod['name']
                result['product_brand'] = prod['brand']
            return result

    return await run_in_threadpool(_update_product)


@router.delete('/stores/{store_id}/products/{product_id}')
async def remove_store_product(
    store_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """Remove a product from a store's inventory."""
    def _remove_product():
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                DELETE FROM store_products
                WHERE store_id = %s AND id = %s
                RETURNING id
                """,
                (store_id, product_id),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store product not found",
                )
            conn.commit()
            return {"success": True, "message": "Product removed from store"}

    return await run_in_threadpool(_remove_product)


# ==================== Store Analytics ====================

@analytics_router.get('/stores', response_model=StoreAnalyticsResponse)
async def get_store_analytics(
    city: str | None = None,
    chain_name: str | None = None,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoreAnalyticsResponse:
    """
    Get store performance analytics.

    Returns stores ranked by scan activity with breakdown by period.
    """
    def _get_analytics():
        period_start = datetime.utcnow() - timedelta(days=days)
        period_end = datetime.utcnow()

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            conditions = ["rs.is_active = true"]
            params = []

            if city:
                conditions.append("rs.city ILIKE %s")
                params.append(f"%{city}%")
            if chain_name:
                conditions.append("rs.chain_name ILIKE %s")
                params.append(f"%{chain_name}%")

            where_clause = " AND ".join(conditions)

            cur.execute(
                f"""
                WITH scan_stats AS (
                    SELECT
                        sse.store_id,
                        COUNT(*) as total_scans,
                        COUNT(DISTINCT sse.product_id) as unique_products,
                        COUNT(*) FILTER (WHERE sse.scanned_at >= CURRENT_DATE) as scans_today,
                        COUNT(*) FILTER (WHERE sse.scanned_at >= CURRENT_DATE - INTERVAL '7 days') as scans_week,
                        COUNT(*) FILTER (WHERE sse.scanned_at >= CURRENT_DATE - INTERVAL '30 days') as scans_month,
                        MODE() WITHIN GROUP (ORDER BY sse.scan_source) as top_source
                    FROM store_scan_events sse
                    WHERE sse.scanned_at >= %s
                    GROUP BY sse.store_id
                )
                SELECT
                    rs.id as store_id,
                    rs.name as store_name,
                    rs.store_code,
                    rs.chain_name,
                    rs.city,
                    COALESCE(ss.total_scans, 0) as total_scans,
                    COALESCE(ss.unique_products, 0) as unique_products_scanned,
                    COALESCE(ss.scans_today, 0) as scans_today,
                    COALESCE(ss.scans_week, 0) as scans_this_week,
                    COALESCE(ss.scans_month, 0) as scans_this_month,
                    ss.top_source
                FROM retail_stores rs
                LEFT JOIN scan_stats ss ON ss.store_id = rs.id
                WHERE {where_clause}
                ORDER BY total_scans DESC
                LIMIT %s
                """,
                [period_start] + params + [limit],
            )
            stores = [dict(r) for r in cur.fetchall()]

            # Get totals
            cur.execute(
                f"SELECT COUNT(*) FROM retail_stores rs WHERE {where_clause}",
                params,
            )
            total_stores = cur.fetchone()['count']

            cur.execute(
                """
                SELECT COUNT(*) FROM store_scan_events
                WHERE scanned_at >= %s
                """,
                (period_start,),
            )
            total_scans = cur.fetchone()['count']

            return StoreAnalyticsResponse(
                stores=stores,
                total_stores=total_stores,
                total_scans=total_scans,
                period_start=period_start,
                period_end=period_end,
            )

    return await run_in_threadpool(_get_analytics)


@analytics_router.get('/stores/{store_id}', response_model=StoreDetailedAnalytics)
async def get_store_detailed_analytics(
    store_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoreDetailedAnalytics:
    """Get detailed analytics for a specific store."""
    def _get_detailed():
        period_start = datetime.utcnow() - timedelta(days=days)

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get store info
            cur.execute(
                """
                SELECT id, name, store_code, chain_name, city
                FROM retail_stores WHERE id = %s
                """,
                (store_id,),
            )
            store = cur.fetchone()
            if not store:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Store not found",
                )

            # Get scan counts
            cur.execute(
                """
                SELECT
                    COUNT(*) as total_scans,
                    COUNT(DISTINCT product_id) as unique_products,
                    COUNT(*) FILTER (WHERE scanned_at >= CURRENT_DATE) as scans_today,
                    COUNT(*) FILTER (WHERE scanned_at >= CURRENT_DATE - INTERVAL '7 days') as scans_week,
                    COUNT(*) FILTER (WHERE scanned_at >= CURRENT_DATE - INTERVAL '30 days') as scans_month,
                    MODE() WITHIN GROUP (ORDER BY scan_source) as top_source
                FROM store_scan_events
                WHERE store_id = %s AND scanned_at >= %s
                """,
                (store_id, period_start),
            )
            stats = cur.fetchone()

            # Scans by source
            cur.execute(
                """
                SELECT scan_source, COUNT(*) as count
                FROM store_scan_events
                WHERE store_id = %s AND scanned_at >= %s
                GROUP BY scan_source
                """,
                (store_id, period_start),
            )
            by_source = {r['scan_source']: r['count'] for r in cur.fetchall()}

            # Scans by day
            cur.execute(
                """
                SELECT DATE(scanned_at) as date, COUNT(*) as count
                FROM store_scan_events
                WHERE store_id = %s AND scanned_at >= %s
                GROUP BY DATE(scanned_at)
                ORDER BY date
                """,
                (store_id, period_start),
            )
            by_day = [dict(r) for r in cur.fetchall()]

            # Top products
            cur.execute(
                """
                SELECT
                    sse.product_id,
                    p.name as product_name,
                    COUNT(*) as scan_count
                FROM store_scan_events sse
                LEFT JOIN products p ON p.id = sse.product_id
                WHERE sse.store_id = %s AND sse.scanned_at >= %s
                GROUP BY sse.product_id, p.name
                ORDER BY scan_count DESC
                LIMIT 10
                """,
                (store_id, period_start),
            )
            top_products = [dict(r) for r in cur.fetchall()]

            # Staff performance
            cur.execute(
                """
                SELECT
                    rs.id as staff_id,
                    ap.display_name as staff_name,
                    rs.customer_assists,
                    rs.scans_assisted
                FROM retail_staff rs
                LEFT JOIN app_profiles ap ON ap.id = rs.user_id
                WHERE rs.store_id = %s
                ORDER BY rs.scans_assisted DESC
                LIMIT 10
                """,
                (store_id,),
            )
            staff_perf = [dict(r) for r in cur.fetchall()]

            return StoreDetailedAnalytics(
                store_id=str(store['id']),
                store_name=store['name'],
                store_code=store['store_code'],
                chain_name=store['chain_name'],
                city=store['city'],
                total_scans=stats['total_scans'] or 0,
                unique_products_scanned=stats['unique_products'] or 0,
                scans_today=stats['scans_today'] or 0,
                scans_this_week=stats['scans_week'] or 0,
                scans_this_month=stats['scans_month'] or 0,
                top_source=stats['top_source'],
                scans_by_source=by_source,
                scans_by_day=by_day,
                top_products=top_products,
                staff_performance=staff_perf,
            )

    return await run_in_threadpool(_get_detailed)
