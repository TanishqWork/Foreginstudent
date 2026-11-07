from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from depth.main import create_app
from depth.models import AuthSession

from conftest import TEST_PASSWORD, TEST_PROVIDER_SECRET, AuthTestContext


def test_jwt_and_http_only_cookie_expire_in_one_day(auth_context: AuthTestContext) -> None:
    request_started = datetime.now(timezone.utc)
    response = auth_context.sign_in()
    response_received = datetime.now(timezone.utc)
    cookie_header = next(
        value for value in response.headers.get_list("set-cookie")
        if value.startswith("depth_session=")
    )
    cookie = cookie_header.lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/api" in cookie
    parsed = SimpleCookie()
    parsed.load(cookie_header)
    max_age = int(parsed["depth_session"]["max-age"])
    assert 0 < max_age <= 86400
    deadline = datetime.fromisoformat(response.json()["expires_at"].replace("Z", "+00:00"))
    remaining_at_receipt = (deadline - response_received).total_seconds()
    request_duration = (response_received - request_started).total_seconds()
    # Cookie issuance follows the cloud database work. Its remaining lifetime
    # must match the fixed server deadline, allowing rounding/response transit.
    assert remaining_at_receipt - 1 <= max_age <= remaining_at_receipt + request_duration + 1
    with auth_context.session_factory() as session:
        stored_session = session.scalar(select(AuthSession))
        assert stored_session.expires_at - stored_session.created_at == timedelta(days=1)
        assert stored_session.expires_at == deadline
    token = auth_context.client.cookies.get("depth_session")
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["exp"] - claims["iat"] == 86400
    assert claims["sub"] == str(auth_context.provider.users["student@example.com"][0].id)
    assert claims["session_id"]
    assert claims["iss"]
    assert claims["aud"]
    assert "password" not in claims
    assert response.headers["cache-control"] == "no-store"


def test_tampered_jwt_is_rejected(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    cookies = dict(auth_context.client.cookies)
    parts = cookies["depth_session"].split(".")
    parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    cookies["depth_session"] = ".".join(parts)
    auth_context.client.cookies.clear()
    for name, value in cookies.items():
        auth_context.client.cookies.set(name, value, path="/api")
    # The original valid session proof and refresh token are retained, so this
    # exercises rejection of the altered access token rather than a missing proof.
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_expired_jwt_is_rejected(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    cookies = dict(auth_context.client.cookies)
    claims = jwt.decode(cookies["depth_session"], options={"verify_signature": False})
    claims["iat"] = int((datetime.now(timezone.utc) - timedelta(days=2)).timestamp())
    claims["exp"] = claims["iat"] + 86400
    cookies["depth_session"] = jwt.encode(claims, TEST_PROVIDER_SECRET, algorithm="HS256")
    # Preserve the valid server proof, but deliberately remove refresh capability.
    # An expired access token with a valid refresh token is covered separately.
    cookies.pop("depth_refresh", None)
    auth_context.client.cookies.clear()
    for name, value in cookies.items():
        auth_context.client.cookies.set(name, value, path="/api")
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_expired_database_session_is_rejected(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    with auth_context.session_factory() as session:
        stored_session = session.scalar(select(AuthSession))
        stored_session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_logout_revokes_cookie_even_if_replayed(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    cookies = dict(auth_context.client.cookies)
    response = auth_context.client.post("/api/auth/logout")
    assert response.status_code == 204
    assert auth_context.client.get("/api/auth/me").status_code == 401
    with auth_context.session_factory() as session:
        assert session.scalar(select(AuthSession)).revoked_at is not None
    auth_context.client.cookies.clear()
    for name, value in cookies.items():
        auth_context.client.cookies.set(name, value, path="/api")
    # Replaying the complete original access/refresh/proof cookie set cannot
    # revive the revoked server session.
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_logout_is_idempotent_without_a_session(auth_context: AuthTestContext) -> None:
    assert auth_context.client.post("/api/auth/logout").status_code == 204
    assert auth_context.client.post("/api/auth/logout").status_code == 204


@pytest.mark.parametrize("origin_setting", ["frontend_url", "api_url"])
def test_configured_origins_can_sign_in_and_out(
    auth_context: AuthTestContext, origin_setting: str
) -> None:
    origin = getattr(auth_context.app.state.settings, origin_setting)
    headers = {"Origin": origin}
    response = auth_context.client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": TEST_PASSWORD},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert auth_context.client.get("/api/auth/me", headers=headers).status_code == 200
    assert auth_context.client.post("/api/auth/logout", headers=headers).status_code == 204
    assert auth_context.client.get("/api/auth/me", headers=headers).status_code == 401


def test_originless_cli_requests_can_sign_in_and_out(auth_context: AuthTestContext) -> None:
    auth_context.client.headers.pop("origin", None)
    response = auth_context.sign_in()
    assert "origin" not in response.request.headers
    assert auth_context.client.get("/api/auth/me").status_code == 200
    assert auth_context.client.post("/api/auth/logout").status_code == 204


def test_configured_api_origin_replaces_the_default(auth_context: AuthTestContext) -> None:
    api_origin = "https://api.statement.test"
    settings = auth_context.app.state.settings.model_copy(update={"api_url": api_origin})
    application = create_app(settings)
    application.state.session_factory = auth_context.session_factory
    auth_context.install_provider(application)
    with TestClient(application, base_url=api_origin) as client:
        body = {"email": "student@example.com", "password": TEST_PASSWORD}
        rejected = client.post(
            "/api/auth/login", json=body, headers={"Origin": "http://localhost:8000"}
        )
        assert rejected.status_code == 403
        accepted = client.post("/api/auth/login", json=body, headers={"Origin": api_origin})
        assert accepted.status_code == 200
        assert accepted.headers["access-control-allow-origin"] == api_origin
        assert client.get("/api/auth/me").status_code == 200


def test_foreign_origin_cannot_create_session(auth_context: AuthTestContext) -> None:
    response = auth_context.client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": TEST_PASSWORD},
        headers={"Origin": "https://untrusted.example"},
    )
    assert response.status_code == 403
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_spoofed_host_does_not_trust_a_foreign_origin(auth_context: AuthTestContext) -> None:
    response = auth_context.client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": TEST_PASSWORD},
        headers={"Origin": "http://untrusted.example", "Host": "untrusted.example"},
    )
    assert response.status_code == 403
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_login_rate_limit_is_enforced(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    for _ in range(4):
        response = auth_context.client.post(
            "/api/auth/login", json={"email": "student@example.com", "password": "Wrong Password 42!"}
        )
        assert response.status_code == 401
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": TEST_PASSWORD}
    )
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
