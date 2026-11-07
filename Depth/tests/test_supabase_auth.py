import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import jwt
import pytest
from pydantic import ValidationError

from depth.core.config import Settings
from depth.core.exceptions import AuthenticationError, AuthInputError, AuthProviderUnavailableError
from depth.integrations.supabase_auth import SupabaseAuthProvider
from depth.schemas.auth import ResetPasswordRequest
from depth.security.tokens import claims_after_provider_validation
from fake_auth_provider import FakeAuthProvider, TEST_PROVIDER_SECRET, TEST_PROVIDER_URL


def settings():
    return Settings(
        database_url="postgresql+psycopg://test:test@localhost/test_test",
        supabase_url=TEST_PROVIDER_URL, supabase_publishable_key="public-test-key",
        supabase_secret_key="private-admin-key", _env_file=None,
    )


def mock_http(monkeypatch, handler):
    original = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original(
        transport=httpx.MockTransport(handler), **kwargs,
    ))


def test_password_login_uses_publishable_key_and_validates_exact_token(monkeypatch):
    fake = FakeAuthProvider()
    user = fake.register("student@example.com", "Password 123!")
    issued = fake._issue(user)
    calls = []
    def handler(request):
        calls.append(request)
        assert request.headers["apikey"] == "public-test-key"
        assert "private-admin-key" not in str(request.headers)
        if request.url.path.endswith("/token"):
            assert json.loads(request.content) == {"email": user.email, "password": "Password 123!"}
            return httpx.Response(200, json={
                "access_token": issued.tokens.access_token, "refresh_token": issued.tokens.refresh_token,
            })
        assert request.headers["authorization"] == "Bearer " + issued.tokens.access_token
        return httpx.Response(200, json={
            "id": str(user.id), "email": user.email, "created_at": user.created_at.isoformat(),
            "email_confirmed_at": user.created_at.isoformat(),
        })
    mock_http(monkeypatch, handler)
    result = SupabaseAuthProvider(settings()).sign_in(user.email, "Password 123!")
    assert result.identity.user_id == user.id
    assert len(calls) == 2


def test_recovery_request_uses_pkce_and_backend_callback(monkeypatch):
    def handler(request):
        assert request.url.path.endswith("/recover")
        assert request.url.params["redirect_to"] == "http://localhost:5173/api/auth/recovery/callback"
        assert json.loads(request.content) == {
            "email": "student@example.com", "code_challenge": "challenge", "code_challenge_method": "s256",
        }
        return httpx.Response(200, json={})
    mock_http(monkeypatch, handler)
    SupabaseAuthProvider(settings()).send_recovery(
        "student@example.com", "challenge", "http://localhost:5173/api/auth/recovery/callback",
    )


@pytest.mark.parametrize("status,code,error", [
    (400, "invalid_credentials", AuthenticationError),
    (422, "weak_password", AuthInputError),
    (503, "unexpected_failure", AuthProviderUnavailableError),
])
def test_provider_errors_never_expose_response_credentials(monkeypatch, status, code, error):
    mock_http(monkeypatch, lambda request: httpx.Response(status, json={
        "code": code, "message": "sensitive-provider-password-and-token",
    }))
    with pytest.raises(error) as caught:
        SupabaseAuthProvider(settings()).sign_in("student@example.com", "Password 123!")
    assert "sensitive-provider" not in str(caught.value)


def test_unconfirmed_signup_user_is_not_treated_as_a_session(monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(200, json={
        "id": str(uuid4()), "email": "student@example.com",
    }))
    assert SupabaseAuthProvider(settings()).sign_up(
        "student@example.com", "Password 123!", "http://localhost:5173/account",
    ) is None


def test_recovery_error_does_not_reveal_unknown_or_unauthorized_email(monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(400, json={
        "code": "email_address_not_authorized", "message": "secret-account-status",
    }))
    assert SupabaseAuthProvider(settings()).send_recovery("absent@example.com", "challenge", "http://localhost:5173") is None


def test_provider_claims_must_match_authenticated_user_and_issuer():
    fake = FakeAuthProvider()
    user = fake.register("student@example.com", "Password 123!")
    supplied = fake._issue(user)
    with pytest.raises(AuthenticationError):
        claims_after_provider_validation(supplied.tokens.access_token, uuid4(), TEST_PROVIDER_URL + "/auth/v1")
    with pytest.raises(AuthenticationError):
        claims_after_provider_validation(supplied.tokens.access_token, user.id, "https://foreign.example/auth/v1")


@pytest.mark.parametrize("password", ["x" * 73, "🔒" * 19])
def test_new_password_bcrypt_byte_limit_is_checked_without_exposing_input(password):
    with pytest.raises(ValidationError):
        ResetPasswordRequest(password=password, password_confirmation=password)


def test_reset_confirmation_must_match():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(password="Password 123!", password_confirmation="Other Password 123!")


@pytest.mark.parametrize("weakness,expected", [
    ({"reasons": ["characters"]}, "an uppercase letter, a lowercase letter, a number, and a symbol"),
    ({"reasons": ["length"]}, "Use at least 8 characters"),
    ({"reasons": ["pwned"]}, "known to be compromised"),
    ({"reasons": ["unrecognized-private-provider-value"]}, "an uppercase letter"),
    ({"reasons": "malformed-private-provider-value"}, "an uppercase letter"),
])
def test_password_update_reports_safe_actionable_requirements(monkeypatch, weakness, expected):
    mock_http(monkeypatch, lambda request: httpx.Response(422, json={
        "error_code": "weak_password", "weak_password": weakness,
        "message": "private-entered-password-or-provider-token",
    }))
    with pytest.raises(AuthInputError) as caught:
        SupabaseAuthProvider(settings()).update_password("test-only-recovery-token", "test-only-input")
    message = str(caught.value)
    assert expected in message
    assert "private" not in message
    assert "test-only" not in message


def test_supabase_configuration_uses_https_and_hides_keys():
    config = settings()
    assert "private-admin-key" not in repr(config)
    assert "public-test-key" not in repr(config)
    with pytest.raises(ValidationError):
        Settings(
            database_url=config.database_url, supabase_url="http://auth.example.test",
            supabase_publishable_key="secret-test-key", _env_file=None,
        )


def test_same_password_rejection_is_not_reported_as_an_expired_recovery_session(monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(422, json={
        "error_code": "same_password", "message": "private-entered-password",
    }))
    with pytest.raises(AuthInputError, match="different from your current password") as caught:
        SupabaseAuthProvider(settings()).update_password("test-recovery-token", "test-password")
    assert "private" not in str(caught.value)
