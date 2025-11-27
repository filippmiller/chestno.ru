from contextlib import contextmanager
from typing import Iterator

from psycopg_pool import ConnectionPool
from psycopg import Connection

from .config import get_settings

settings = get_settings()

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=8,
    timeout=10,
)


@contextmanager
def get_connection() -> Iterator[Connection]:
    with pool.connection() as conn:  # type: Connection
        yield conn

