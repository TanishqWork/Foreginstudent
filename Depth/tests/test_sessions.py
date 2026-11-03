from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from depth.main import create_app
from depth.models import AuthSession

from conftest import TEST_JWT_SECRET, TEST_PASSWORD, AuthTestContext


def test_jwt_and_http_only_cookie_expire_in_one_day(auth_context: AuthTestContext) -> None:
    response = auth_context.sign_in()
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age=86400" in cookie
    assert "path=/api" in cookie
    token = auth_context.client.cookies.get("depth_session")
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["exp"] - claims["iat"] == 86400
    assert claims["sub"] == response.json()["user"]["id"]
    assert claims["jti"]
    assert claims["iss"]
    assert claims["aud"]
    assert "password" not in claims
    assert response.headers["cache-control"] == "no-store"


def test_tampered_jwt_is_rejected(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    token = auth_context.client.cookies.get("depth_session")
    parts = token.split(".")
    parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    auth_context.client.cookies.clear()
    auth_context.client.cookies.set("depth_session", ".".join(parts), path="/api")
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_expired_jwt_is_rejected(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    token = auth_context.client.cookies.get("depth_session")
    claims = jwt.decode(token, options={"verify_signature": False})
    claims["iat"] = int((datetime.now(timezone.utc) - timedelta(days=2)).timestamp())
    claims["exp"] = claims["iat"] + 86400
    expired = jwt.encode(claims, TEST_JWT_SECRET, algorithm="HS256")
    auth_context.client.cookies.clear()
    auth_context.client.cookies.set("depth_session", expired, path="/api")
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
    token = auth_context.client.cookies.get("depth_session")
    response = auth_context.client.post("/api/auth/logout")
    assert response.status_code == 204
    assert auth_context.client.get("/api/auth/me").status_code == 401
    auth_context.client.cookies.clear()
    auth_context.client.cookies.set("depth_session", token, path="/api")
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

