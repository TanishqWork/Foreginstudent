"""Fast HTTP/service security tests; SQL persistence is covered separately."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from depth.core.config import (
    RECOVERY_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, SESSION_PROOF_COOKIE,
    SIGNUP_PKCE_COOKIE, Settings,
)
from depth.dependencies import get_auth_service
from depth.main import create_app
from depth.models import AuthSession, User
from depth.services.auth_service import AuthService
from depth.services.rate_limit_service import RateLimitService
from fake_auth_provider import FakeAuthProvider, TEST_PROVIDER_SECRET, TEST_PROVIDER_URL

PASSWORD = "A Test Password 42!"
NEW_PASSWORD = "A New Password 63!"


class MemoryUsers:
    def __init__(self):
        self.items = {}

    def find_by_email(self, email):
        return next((user for user in self.items.values() if user.email == email), None)

    def for_identity(self, provider_id, email, created_at, *, verified_recovery=False):
        from depth.core.exceptions import AuthenticationError
        for user in self.items.values():
            if user.supabase_user_id == provider_id:
                return user
        existing = self.find_by_email(email)
        if existing:
            if existing.supabase_user_id is not None or not (existing.id == provider_id or verified_recovery):
                raise AuthenticationError()
            existing.supabase_user_id = provider_id
            return existing
        user = User(id=uuid4(), email=email, supabase_user_id=provider_id, created_at=created_at)
        self.items[user.id] = user
        return user


class MemorySessions:
    def __init__(self, users, provider):
        self.items = {}
        self.users = users
        self.provider = provider

    def add(self, user_id, session_id, created_at, expires_at, token_hash):
        if session_id not in self.items:
            row = AuthSession(
                id=session_id, user_id=user_id, created_at=created_at,
                expires_at=expires_at, token_hash=token_hash,
            )
            row.user = self.users.items[user_id]
            self.items[session_id] = row
        return self.items[session_id]

    def find_by_token_hash(self, hashed):
        return next((row for row in self.items.values() if row.token_hash == hashed), None)

    def provider_is_active(self, sid, uid):
        return self.provider.session_active(sid, uid)

    def revoke(self, session, now):
        session.revoked_at = now

    def revoke_all(self, user_id, now):
        for row in self.items.values():
            if row.user_id == user_id:
                row.revoked_at = now


class MemoryRateLimits:
    def __init__(self):
        self.attempts = {}

    def increment(self, key, expires_at, limit):
        self.attempts[key] = self.attempts.get(key, 0) + 1
        return self.attempts[key] <= limit


@pytest.fixture
def context():
    settings = Settings(
        database_url="postgresql+psycopg://test:test@localhost/auth_test",
        supabase_url=TEST_PROVIDER_URL, supabase_publishable_key="test-publishable-key",
        _env_file=None,
    )
    provider = FakeAuthProvider()
    users = MemoryUsers()
    sessions = MemorySessions(users, provider)
    db = SimpleNamespace(commit=lambda: None)
    service = AuthService(db, users, sessions, RateLimitService(db, MemoryRateLimits()), settings, provider)
    app = create_app(settings)
    app.dependency_overrides[get_auth_service] = lambda: service
    recorded = []
    @app.middleware("http")
    async def record_scope(request, call_next):
        response = await call_next(request)
        recorded.append((request.url.path, request.scope["query_string"]))
        return response
    with TestClient(app, headers={"Origin": "http://localhost:5173"}) as client:
        yield SimpleNamespace(
            client=client, provider=provider, service=service, sessions=sessions, users=users, recorded=recorded,
        )


def login(context):
    response = context.client.post("/api/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    assert response.status_code == 200
    assert "user" in response.json()
    return response


def recover(context):
    assert context.client.post("/api/auth/forgot-password", json={"email": "student@example.com"}).status_code == 200
    code = context.provider.recovery_code("student@example.com")
    response = context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert response.status_code == 303 and response.headers["location"].endswith("/reset-password")
    return code


def test_cookie_tokens_are_httponly_and_absent_from_api_payload(context):
    response = login(context)
    cookies = response.headers.get_list("set-cookie")
    assert all("httponly" in item.lower() for item in cookies)
    assert any("max-age=86400" in item.lower() for item in cookies)
    assert "access_token" not in response.text and "refresh_token" not in response.text
    token = context.client.cookies.get(SESSION_COOKIE)
    assert token not in response.text
    assert "password" not in response.text
    assert context.client.get("/api/auth/me").status_code == 200


def test_access_token_alone_does_not_authenticate_without_local_session_proof(context):
    login(context)
    access = context.client.cookies.get(SESSION_COOKIE)
    context.client.cookies.clear()
    context.client.cookies.set(SESSION_COOKIE, access, path="/api")
    assert context.client.get("/api/auth/me").status_code == 401


def test_local_revocation_rejects_replayed_cookie_during_provider_outage(context):
    login(context)
    cookies = dict(context.client.cookies)
    context.provider.available = False
    assert context.client.post("/api/auth/logout").status_code == 204
    context.provider.available = True
    for name, value in cookies.items():
        context.client.cookies.set(name, value, path="/api")
    assert context.client.get("/api/auth/me").status_code == 401


def test_provider_revocation_is_checked_even_while_jwt_is_unexpired(context):
    login(context)
    context.provider.sign_out(context.client.cookies.get(SESSION_COOKIE))
    assert context.client.get("/api/auth/me").status_code == 401


def test_refresh_does_not_extend_absolute_session_expiry(context):
    login(context)
    row = next(iter(context.sessions.items.values()))
    deadline = row.expires_at
    access = context.client.cookies.get(SESSION_COOKIE)
    claims = jwt.decode(access, options={"verify_signature": False})
    claims["iat"] = int((datetime.now(timezone.utc) - timedelta(hours=25)).timestamp())
    claims["exp"] = claims["iat"] + 86400
    expired = jwt.encode(claims, TEST_PROVIDER_SECRET, algorithm="HS256")
    context.client.cookies.set(SESSION_COOKIE, expired, path="/api")
    assert context.client.get("/api/auth/me").status_code == 200
    assert row.expires_at == deadline
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert context.client.get("/api/auth/me").status_code == 401


def test_recovery_session_is_restricted_to_password_reset(context):
    login(context)
    recover(context)
    token = context.client.cookies.get(RECOVERY_COOKIE)
    context.client.cookies.clear()
    context.client.cookies.set(RECOVERY_COOKIE, token, path="/api")
    assert context.client.get("/api/auth/recovery").json() == {"valid": True}
    assert context.client.get("/api/auth/me").status_code == 401
    assert context.client.post("/api/assessments/free", json={}).status_code == 401


def test_recovery_code_is_single_use_and_removed_from_access_log_scope(context):
    login(context)
    code = recover(context)
    assert context.recorded[-1][1] == b""
    response = context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert "invalid_recovery" in response.headers["location"]


def test_password_reset_revokes_all_old_sessions_and_needs_new_signin(context):
    login(context)
    old = dict(context.client.cookies)
    recover(context)
    response = context.client.post("/api/auth/reset-password", json={
        "password": NEW_PASSWORD, "password_confirmation": NEW_PASSWORD,
    })
    assert response.status_code == 200
    assert context.client.get("/api/auth/recovery").status_code == 401
    for name, value in old.items():
        context.client.cookies.set(name, value, path="/api")
    assert context.client.get("/api/auth/me").status_code == 401
    assert context.client.post("/api/auth/login", json={"email": "student@example.com", "password": PASSWORD}).status_code == 401
    assert context.client.post("/api/auth/login", json={"email": "student@example.com", "password": NEW_PASSWORD}).status_code == 200


def test_normal_session_cannot_be_used_as_password_recovery(context):
    login(context)
    context.client.cookies.set(RECOVERY_COOKIE, context.client.cookies.get(SESSION_COOKIE), path="/api")
    assert context.client.get("/api/auth/recovery").status_code == 401
    assert context.client.post("/api/auth/reset-password", json={
        "password": NEW_PASSWORD, "password_confirmation": NEW_PASSWORD,
    }).status_code == 401


def test_signup_confirmation_exchanges_code_on_backend_and_keeps_tokens_out_of_url(context):
    context.provider.confirm_new = True
    response = context.client.post("/api/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    assert response.json()["status"] == "confirmation_required"
    assert context.client.cookies.get(SESSION_COOKIE) is None
    assert context.client.cookies.get(SIGNUP_PKCE_COOKIE)
    code = context.provider.confirmation_code("student@example.com")
    context.client.cookies.set(RECOVERY_COOKIE, "stale-recovery-context", domain="testserver.local", path="/api")
    callback = context.client.get("/api/auth/confirmation/callback", params={"code": code}, follow_redirects=False)
    assert callback.headers["location"] == "http://localhost:5173/dashboard"
    assert "#" not in callback.headers["location"]
    assert context.client.cookies.get(RECOVERY_COOKIE) is None
    assert any("depth_recovery=" in item and "Max-Age=0" in item for item in callback.headers.get_list("set-cookie"))
    assert context.client.get("/api/auth/me").status_code == 200


def test_recovery_amr_cannot_be_exchanged_as_signup_confirmation(context):
    login(context)
    context.client.post("/api/auth/forgot-password", json={"email": "student@example.com"})
    code = context.provider.recovery_code("student@example.com")
    from depth.core.config import PKCE_COOKIE
    verifier = context.client.cookies.get(PKCE_COOKIE)
    context.client.cookies.set(SIGNUP_PKCE_COOKIE, verifier, path="/api/auth/confirmation/callback")
    response = context.client.get("/api/auth/confirmation/callback", params={"code": code}, follow_redirects=False)
    assert response.headers["location"].endswith("/account?confirmation=invalid")
