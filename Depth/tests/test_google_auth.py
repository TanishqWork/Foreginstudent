"""Focused Google OAuth checks; no real provider calls, email, or database writes."""
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from http.cookies import SimpleCookie
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import parse_qs, urlencode, urlsplit

import pytest
from starlette.requests import Request

from depth.controllers import auth_controller
from depth.core.config import Settings
from depth.core.exceptions import AuthenticationError, AuthProviderUnavailableError
from depth.integrations.supabase_auth import SupabaseAuthProvider
from depth.services.auth_service import AuthService, LoginResult
from fake_auth_provider import FakeAuthProvider, TEST_PROVIDER_URL


def settings():
    return Settings(
        database_url="postgresql+psycopg://test:test@localhost/oauth_test",
        supabase_url=TEST_PROVIDER_URL, supabase_publishable_key="public-test-key",
        cookie_secure=True, _env_file=None,
    )


def service():
    return AuthService(Mock(), Mock(), Mock(), Mock(), settings(), Mock())


def request(query=None, verifier="browser-bound-verifier"):
    cookie = f"depth_google_verifier={verifier}" if verifier else ""
    return Request({
        "type": "http", "method": "GET", "scheme": "https",
        "path": "/api/auth/google/callback", "root_path": "",
        "query_string": urlencode(query or {}).encode(),
        "headers": [(b"cookie", cookie.encode())], "client": ("127.0.0.1", 1234),
        "server": ("localhost", 5173),
    })


def test_authorize_url_uses_fixed_google_provider_and_server_callback():
    url = SupabaseAuthProvider(settings()).google_authorize_url(
        "test-challenge", "http://localhost:5173/api/auth/google/callback",
    )
    parsed = urlsplit(url)
    assert parsed.scheme == "https" and parsed.netloc == "auth.example.test"
    assert parsed.path == "/auth/v1/authorize"
    assert parse_qs(parsed.query) == {
        "provider": ["google"],
        "redirect_to": ["http://localhost:5173/api/auth/google/callback"],
        "code_challenge": ["test-challenge"], "code_challenge_method": ["s256"],
        "scopes": ["email profile"],
    }
    assert "public-test-key" not in url


def test_google_start_generates_browser_bound_s256_challenge():
    auth = service()
    auth.provider.google_authorize_url.return_value = "https://auth.example.test/authorize"
    url, verifier = auth.start_google("127.0.0.1")
    challenge = urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).decode().rstrip("=")
    auth.provider.google_authorize_url.assert_called_once_with(
        challenge, "http://localhost:5173/api/auth/google/callback",
    )
    assert len(verifier) >= 43 and challenge != verifier
    assert url == "https://auth.example.test/authorize"
    auth.rate_limits.check_google.assert_called_once_with("127.0.0.1")
    auth.start_google = Mock(return_value=(url, verifier))
    response = auth_controller.google_login(request(), auth)
    assert response.status_code == 303 and response.headers["location"] == url
    cookies = SimpleCookie()
    for header in response.headers.getlist("set-cookie"):
        cookies.load(header)
    pending = cookies["depth_google_verifier"]
    assert pending.value == verifier and pending["httponly"] and pending["secure"]
    assert pending["path"] == "/api/auth/google/callback" and pending["max-age"] == "600"
    assert "depth_session" not in cookies


def test_google_finish_requires_code_and_browser_verifier_before_exchange():
    auth = service()
    for code, verifier in ((None, "verifier"), ("code", None), ("", "verifier")):
        with pytest.raises(AuthenticationError):
            auth.finish_google(code, verifier)
    auth.provider.exchange_code.assert_not_called()


def test_google_finish_rejects_unverified_email_before_mapping_account():
    auth = service()
    provider = FakeAuthProvider()
    user = provider.register("student@example.com", "unused-password", confirmed=False)
    auth.provider.exchange_code.return_value = provider._issue(user)
    with pytest.raises(AuthenticationError):
        auth.finish_google("one-time-code", "browser-verifier")
    auth.users.for_identity.assert_not_called()
    auth.db.commit.assert_not_called()


def test_google_callback_sets_http_only_session_and_erases_code_from_log_scope():
    auth = service()
    provider = FakeAuthProvider()
    user = provider.register("student@example.com", "unused-password")
    issued = provider._issue(user)
    session = SimpleNamespace(expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    auth.finish_google = Mock(return_value=LoginResult(session, issued.tokens, "independent-session-proof"))
    incoming = request({"code": "private-one-time-code"})
    response = auth_controller.google_callback(incoming, auth)
    assert response.status_code == 303
    assert response.headers["location"] == "http://localhost:5173/dashboard"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert incoming.scope["query_string"] == b""
    cookies = SimpleCookie()
    for header in response.headers.getlist("set-cookie"):
        cookies.load(header)
    for name in ("depth_session", "depth_refresh", "depth_session_proof"):
        cookie = cookies[name]
        assert cookie["httponly"] and cookie["secure"] and cookie["samesite"] == "lax"
        assert cookie["path"] == "/api" and 86395 <= int(cookie["max-age"]) <= 86400
    assert cookies["depth_google_verifier"]["max-age"] == "0"
    assert cookies["depth_google_verifier"]["path"] == "/api/auth/google/callback"
    assert "private-one-time-code" not in str(response.headers)


def test_google_cancelled_consent_never_exchanges_or_exposes_provider_message():
    auth = service()
    auth.finish_google = Mock()
    response = auth_controller.google_callback(request({
        "error": "access_denied", "error_description": "private-provider-details",
    }), auth)
    assert response.headers["location"] == "http://localhost:5173/account?google=cancelled"
    auth.finish_google.assert_not_called()
    assert "private-provider-details" not in str(response.headers)
    assert "depth_session=" not in str(response.headers)


@pytest.mark.parametrize("error,code", [
    (AuthenticationError(), "invalid"),
    (AuthProviderUnavailableError(), "unavailable"),
])
def test_google_callback_failure_is_safe_and_clears_pending_browser_state(error, code):
    auth = service()
    auth.finish_google = Mock(side_effect=error)
    response = auth_controller.google_callback(request({"code": "private-code"}), auth)
    assert response.headers["location"] == f"http://localhost:5173/account?google={code}"
    assert "depth_google_verifier=\"\"" in str(response.headers)
    assert "Max-Age=0" in str(response.headers)
    assert "depth_session=" not in str(response.headers)
    assert "private-code" not in str(response.headers)
