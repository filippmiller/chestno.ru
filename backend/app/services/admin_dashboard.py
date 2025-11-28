from __future__ import annotations

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.services.admin_guard import assert_platform_admin


def get_admin_dashboard_summary(user_id: str) -> AdminDashboardSummary:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT COUNT(*) AS cnt FROM organizations')
        total_orgs = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM organizations WHERE verification_status = 'verified'")
        verified_orgs = cur.fetchone()['cnt']

        cur.execute('SELECT COUNT(*) AS cnt FROM organizations WHERE public_visible = true')
        public_orgs = cur.fetchone()['cnt']

        cur.execute('SELECT COUNT(*) AS cnt FROM products')
        total_products = cur.fetchone()['cnt']

        cur.execute('SELECT COUNT(*) AS cnt FROM qr_codes')
        total_qr = cur.fetchone()['cnt']

        cur.execute('SELECT COUNT(*) AS cnt FROM qr_events')
        total_events = cur.fetchone()['cnt']

    return AdminDashboardSummary(
        total_organizations=total_orgs,
        verified_organizations=verified_orgs,
        public_organizations=public_orgs,
        total_products=total_products,
        total_qr_codes=total_qr,
        total_qr_events=total_events,
    )

