import logging
from collections.abc import Iterator
from time import perf_counter

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def create_database(url: str) -> tuple[Engine, sessionmaker[Session]]:
    # No per-checkout ping: it cost a full database round trip on every request. TCP keepalives
    # detect dropped links, and connections are replaced after 30 minutes (opening one costs seconds
    # on a distant database, so a shorter recycle would make users wait); a connection that still
    # fails is discarded by SQLAlchemy and the next request reconnects.
    engine = create_engine(url, pool_pre_ping=False, pool_recycle=1800, connect_args={
        "connect_timeout": 10, "keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 3,
    })
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


logger = logging.getLogger(__name__)


def warm_pool(engine: Engine, connections: int = 2) -> None:
    """Open connections at startup so the first requests do not pay the connection setup.

    Two: one for requests and one for a background job saving its result. Failures are only logged;
    requests then connect on demand as before.
    """
    started = perf_counter()
    opened = []
    try:
        for _ in range(connections):
            opened.append(engine.connect())
    except Exception as error:
        logger.warning("Database warm-up failed type=%s", type(error).__name__)
    finally:
        for connection in opened:
            connection.close()  # Returned to the pool, still open.
    if opened:
        logger.info("Database warm-up opened=%d seconds=%.1f", len(opened), perf_counter() - started)


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session
