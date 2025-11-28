from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.analytics import CountryMetric, DailyMetric, QROverviewResponse, SourceMetric


def _ensure_member(cur, organization_id: str, user_id: str) -> None:
    cur.execute(
        'SELECT 1 FROM organization_members WHERE organization_id = %s AND user_id = %s',
        (organization_id, user_id),
    )
    if cur.fetchone() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Нет доступа к организации')


def get_qr_overview(organization_id: str, user_id: str, days: int = 30) -> QROverviewResponse:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _ensure_member(cur, organization_id, user_id)
        cur.execute(
            '''
            SELECT
                COUNT(*) AS total_scans,
                MIN(qe.occurred_at) AS first_scan,
                MAX(qe.occurred_at) AS last_scan
            FROM qr_events qe
            JOIN qr_codes qc ON qc.id = qe.qr_code_id
            WHERE qc.organization_id = %s
            ''',
            (organization_id,),
        )
        totals = cur.fetchone()

        cur.execute(
            '''
            SELECT date_trunc('day', qe.occurred_at) AS day, COUNT(*) AS count
            FROM qr_events qe
            JOIN qr_codes qc ON qc.id = qe.qr_code_id
            WHERE qc.organization_id = %s
              AND qe.occurred_at BETWEEN %s AND %s
            GROUP BY day
            ORDER BY day ASC
            ''',
            (organization_id, start, end),
        )
        daily = [DailyMetric(date=row['day'], count=row['count']) for row in cur.fetchall()]

        # Метрики по странам
        cur.execute(
            '''
            SELECT qe.country, COUNT(*) AS count
            FROM qr_events qe
            JOIN qr_codes qc ON qc.id = qe.qr_code_id
            WHERE qc.organization_id = %s
              AND qe.occurred_at BETWEEN %s AND %s
            GROUP BY qe.country
            ORDER BY count DESC
            LIMIT 10
            ''',
            (organization_id, start, end),
        )
        by_country = [CountryMetric(country=row['country'], count=row['count']) for row in cur.fetchall()]

        # Метрики по источникам (utm_source)
        cur.execute(
            '''
            SELECT qe.utm_source AS source, COUNT(*) AS count
            FROM qr_events qe
            JOIN qr_codes qc ON qc.id = qe.qr_code_id
            WHERE qc.organization_id = %s
              AND qe.occurred_at BETWEEN %s AND %s
              AND qe.utm_source IS NOT NULL
            GROUP BY qe.utm_source
            ORDER BY count DESC
            LIMIT 10
            ''',
            (organization_id, start, end),
        )
        by_source = [SourceMetric(source=row['source'], count=row['count']) for row in cur.fetchall()]

    return QROverviewResponse(
        total_scans=totals['total_scans'] or 0,
        first_scan_at=totals['first_scan'],
        last_scan_at=totals['last_scan'],
        daily=daily,
        by_country=by_country,
        by_source=by_source,
    )


def export_qr_data(data: QROverviewResponse, format: str) -> str:
    """
    Экспортирует данные аналитики в CSV или JSON формат.
    """
    import json
    
    if format == 'csv':
        lines = ['Дата,Сканов']
        for metric in data.daily:
            date_str = metric.date.strftime('%Y-%m-%d')
            lines.append(f'{date_str},{metric.count}')
        return '\n'.join(lines)
    else:
        return json.dumps(
            {
                'total_scans': data.total_scans,
                'first_scan_at': data.first_scan_at.isoformat() if data.first_scan_at else None,
                'last_scan_at': data.last_scan_at.isoformat() if data.last_scan_at else None,
                'daily': [{'date': m.date.isoformat(), 'count': m.count} for m in data.daily],
                'by_country': [{'country': m.country, 'count': m.count} for m in data.by_country],
                'by_source': [{'source': m.source, 'count': m.count} for m in data.by_source],
            },
            indent=2,
            ensure_ascii=False,
        )

