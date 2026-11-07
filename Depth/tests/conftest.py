"""PostgreSQL tests use a dedicated *_test database and roll back each case."""
import os
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("SUPABASE_URL", "https://auth.example.test")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
os.environ.setdefault("DATABASE_URL", os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://test:test@localhost:5433/statement_studio_test",
))

from depth.core.config import Settings  # noqa: E402
from depth.database.base import Base  # noqa: E402
from depth.main import create_app  # noqa: E402
from fake_auth_provider import FakeAuthProvider, TEST_PROVIDER_SECRET, TEST_PROVIDER_URL  # noqa: E402

FRONTEND_ORIGIN = "http://localhost:5173"
TEST_PASSWORD = "Test Password 42!"


@dataclass
class AuthTestContext:
    client: TestClient
    app: Any
    session_factory: sessionmaker[Session]
    provider: FakeAuthProvider

    def sign_in(self, email="student@example.com", password=TEST_PASSWORD):
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return response

    def install_provider(self, application):
        application.state.auth_provider = self.provider
        application.state.provider_session_check = self.provider.session_active


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or not (url.database or "").endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must point to a PostgreSQL database ending in _test")
    engine = create_engine(database_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def auth_context(test_engine: Engine) -> Iterator[AuthTestContext]:
    settings = Settings(
        database_url=test_engine.url.render_as_string(hide_password=False),
        supabase_url=TEST_PROVIDER_URL, supabase_publishable_key="test-publishable-key",
        frontend_url=FRONTEND_ORIGIN, cookie_secure=False, _env_file=None,
    )
    application = create_app(settings)
    provider = FakeAuthProvider()
    application.state.auth_provider = provider
    application.state.provider_session_check = provider.session_active
    with test_engine.connect() as connection:
        transaction = connection.begin()
        factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")
        application.state.session_factory = factory
        try:
            with TestClient(application, headers={"Origin": FRONTEND_ORIGIN}) as client:
                yield AuthTestContext(client, application, factory, provider)
        finally:
            transaction.rollback()
            application.state.engine.dispose()
