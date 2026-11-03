"""PostgreSQL integration tests isolated from application data.

Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in ``_test``.
Each test runs in a transaction that is rolled back, including route commits.
"""

import os
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker


# Importing depth.main constructs the default app as well as create_app.
# These defaults are test-only; the factory below receives explicit settings.
os.environ.setdefault("JWT_SECRET", "test-only-signing-key-with-at-least-32-characters")
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://test:test@localhost:5433/statement_studio_test",
    ),
)

from depth.core.config import Settings  # noqa: E402
from depth.database.base import Base  # noqa: E402
from depth.main import create_app  # noqa: E402


TEST_JWT_SECRET = "test-only-signing-key-with-at-least-32-characters"
FRONTEND_ORIGIN = "http://localhost:5173"
TEST_PASSWORD = "Test Password 42!"


@dataclass
class AuthTestContext:
    client: TestClient
    app: Any
    session_factory: sessionmaker[Session]

    def sign_in(self, email: str = "student@example.com", password: str = TEST_PASSWORD) -> Any:
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return response


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or not (url.database or "").endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must point to a PostgreSQL database ending in _test")
    engine = create_engine(database_url, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def auth_context(test_engine: Engine) -> Iterator[AuthTestContext]:
    settings = Settings(
        database_url=str(test_engine.url.render_as_string(hide_password=False)),
        jwt_secret=TEST_JWT_SECRET,
        frontend_url=FRONTEND_ORIGIN,
        cookie_secure=False,
        _env_file=None,
    )
    application = create_app(settings)
    with test_engine.connect() as connection:
        transaction = connection.begin()
        factory = sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        application.state.session_factory = factory
        try:
            with TestClient(application, headers={"Origin": FRONTEND_ORIGIN}) as client:
                yield AuthTestContext(client, application, factory)
        finally:
            transaction.rollback()
            application.state.engine.dispose()
