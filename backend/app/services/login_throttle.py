from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from psycopg.rows import dict_row

from app.core.db import get_connection

BASE_DELAY_SECONDS = 5
MAX_DELAY_SECONDS = 15 * 60  # 15 minutes


@dataclass
class ThrottleState:
    email: str
    failed_attempts: int
    locked_until: datetime | None

    @property
    def retry_after(self) -> int:
        if not self.locked_until:
            return 0
        now = datetime.now(timezone.utc)
        delta = self.locked_until - now
        return max(int(delta.total_seconds()), 0)


def get_state(email: str) -> ThrottleState | None:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT email, failed_attempts, locked_until FROM login_throttle WHERE email = %s', (email,))
            row = cur.fetchone()
            if not row:
                return None
            return ThrottleState(
                email=row['email'],
                failed_attempts=row['failed_attempts'],
                locked_until=row['locked_until'],
            )


def register_failure(email: str) -> int:
    now = datetime.now(timezone.utc)
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT failed_attempts FROM login_throttle WHERE email = %s FOR UPDATE',
                (email,),
            )
            row = cur.fetchone()
            if row:
                failed_attempts = row['failed_attempts'] + 1
            else:
                failed_attempts = 1
            delay = min(BASE_DELAY_SECONDS * (2 ** (failed_attempts - 1)), MAX_DELAY_SECONDS)
            locked_until = now + timedelta(seconds=delay)
            if row:
                cur.execute(
                    '''
                    UPDATE login_throttle
                    SET failed_attempts = %s,
                        last_failed_at = %s,
                        locked_until = %s,
                        updated_at = %s
                    WHERE email = %s
                    ''',
                    (failed_attempts, now, locked_until, now, email),
                )
            else:
                cur.execute(
                    '''
                    INSERT INTO login_throttle (email, failed_attempts, last_failed_at, locked_until, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ''',
                    (email, failed_attempts, now, locked_until, now, now),
                )
            conn.commit()
            return delay


def reset(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO login_throttle (email, failed_attempts, last_failed_at, locked_until, created_at, updated_at)
                VALUES (%s, 0, NULL, NULL, now(), now())
                ON CONFLICT (email) DO UPDATE SET
                    failed_attempts = 0,
                    last_failed_at = NULL,
                    locked_until = NULL,
                    updated_at = now()
                ''',
                (email,),
            )
            conn.commit()

