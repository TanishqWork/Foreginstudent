import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from depth.models import AuthSession, User

from conftest import TEST_PASSWORD, AuthTestContext


def test_current_user_requires_authentication(auth_context: AuthTestContext):
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_new_email_creates_provider_link_without_local_password(auth_context: AuthTestContext):
    response = auth_context.sign_in()
    payload = response.json()
    assert payload["user"]["email"] == "student@example.com"
    assert set(payload["user"]) == {"id", "email", "created_at"}
    assert "password" not in response.text
    with auth_context.session_factory() as session:
        user = session.scalar(select(User).where(User.email == "student@example.com"))
        assert user is not None
        assert user.supabase_user_id == auth_context.provider.users[user.email][0].id
        assert not hasattr(user, "password_hash")
    assert auth_context.client.get("/api/auth/me").json()["user"]["id"] == payload["user"]["id"]


def test_canonical_email_and_repeat_login_reuse_account(auth_context: AuthTestContext):
    first = auth_context.sign_in("  Student@Example.com  ").json()["user"]
    assert auth_context.client.post("/api/auth/logout").status_code == 204
    second = auth_context.sign_in("student@example.com").json()["user"]
    assert first["id"] == second["id"]
    with auth_context.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(User)) == 1


def test_wrong_password_does_not_overwrite_provider_credentials(auth_context: AuthTestContext):
    auth_context.sign_in()
    auth_context.client.cookies.clear()
    with auth_context.session_factory() as session:
        session_count = session.scalar(select(func.count()).select_from(AuthSession))
    response = auth_context.client.post("/api/auth/login", json={
        "email": "student@example.com", "password": "Wrong Password 42!",
    })
    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    assert auth_context.provider.users["student@example.com"][1] == TEST_PASSWORD
    assert auth_context.provider.signup_calls == 1
    with auth_context.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(AuthSession)) == session_count


def test_password_whitespace_is_preserved(auth_context: AuthTestContext):
    password = "  Significant Password 42!  "
    auth_context.sign_in(password=password)
    auth_context.client.cookies.clear()
    assert auth_context.client.post("/api/auth/login", json={
        "email": "student@example.com", "password": password.strip(),
    }).status_code == 401
    auth_context.sign_in(password=password)


def test_unmapped_legacy_account_cannot_be_claimed(auth_context: AuthTestContext):
    with auth_context.session_factory() as session:
        session.add(User(email="legacy@example.com", supabase_user_id=None))
        session.commit()
    response = auth_context.client.post("/api/auth/login", json={
        "email": "legacy@example.com", "password": TEST_PASSWORD,
    })
    assert response.status_code == 401
    assert auth_context.provider.signup_calls == 0
    with auth_context.session_factory() as session:
        assert session.scalar(select(User.supabase_user_id).where(User.email == "legacy@example.com")) is None
        assert session.scalar(select(func.count()).select_from(AuthSession)) == 0


@pytest.mark.parametrize("password", ["s3Cr!", "x" * 129])
def test_invalid_password_length_is_rejected_without_echoing_secret(auth_context: AuthTestContext, password):
    response = auth_context.client.post("/api/auth/login", json={"email": "student@example.com", "password": password})
    assert response.status_code == 422
    assert password not in response.text
    assert all("input" not in error and "ctx" not in error for error in response.json()["detail"])


def test_invalid_email_is_rejected_without_echoing_password(auth_context: AuthTestContext):
    response = auth_context.client.post("/api/auth/login", json={"email": "invalid-email", "password": TEST_PASSWORD})
    assert response.status_code == 422
    assert TEST_PASSWORD not in response.text


def test_database_enforces_unique_email(auth_context: AuthTestContext):
    auth_context.sign_in()
    with auth_context.session_factory() as session:
        with pytest.raises(IntegrityError):
            with session.begin_nested():
                session.add(User(email="student@example.com"))
                session.flush()


def test_confirmation_required_does_not_create_profile_or_session(auth_context: AuthTestContext):
    auth_context.provider.confirm_new = True
    response = auth_context.sign_in()
    assert response.json() == {"status": "confirmation_required", "email": "student@example.com"}
    assert "depth_signup_verifier" in response.headers.get("set-cookie", "")
    assert auth_context.client.cookies.get("depth_session") is None
    with auth_context.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(User)) == 0
        assert session.scalar(select(func.count()).select_from(AuthSession)) == 0


def test_magic_link_login_endpoints_are_not_added(auth_context: AuthTestContext):
    assert auth_context.client.post("/api/auth/magic-link", json={"email": "student@example.com"}).status_code == 404
    assert auth_context.client.post("/api/auth/verify", json={"token": "unused"}).status_code == 404
    paths = auth_context.client.get("/openapi.json").json()["paths"]
    assert "/api/auth/forgot-password" in paths
    assert "/api/auth/reset-password" in paths
    assert "/api/auth/magic-link" not in paths
