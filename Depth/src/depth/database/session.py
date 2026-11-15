from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def create_database(url: str) -> tuple[Engine, sessionmaker[Session]]:
    # No per-checkout ping: it cost a full database round trip on every request. Connections are
    # replaced after five minutes instead (no round trip), and TCP keepalives detect dropped links;
    # a connection that still fails is discarded by SQLAlchemy and the next request reconnects.
    engine = create_engine(url, pool_pre_ping=False, pool_recycle=300, connect_args={
        "connect_timeout": 10, "keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 3,
    })
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session
