import pytest
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from depth.models import AuthSession, User

from conftest import TEST_PASSWORD, AuthTestContext


def test_current_user_requires_authentication(auth_context: AuthTestContext) -> None:
    assert auth_context.client.get("/api/auth/me").status_code == 401


def test_new_email_creates_account_with_a_password_hash(auth_context: AuthTestContext) -> None:
    response = auth_context.sign_in()
    payload = response.json()
    assert payload["user"]["email"] == "student@example.com"
    assert set(payload["user"]) == {"id", "email", "created_at"}
    assert "password" not in response.text
    with auth_context.session_factory() as session:
        user = session.scalar(select(User).where(User.email == "student@example.com"))
        assert user is not None
        assert user.password_hash.startswith("$argon2id$")
        assert TEST_PASSWORD not in user.password_hash
        assert PasswordHash.recommended().verify(TEST_PASSWORD, user.password_hash)
    current = auth_context.client.get("/api/auth/me")
    assert current.status_code == 200
    assert current.json()["user"]["id"] == payload["user"]["id"]
    assert "password" not in current.text


def test_canonical_email_and_repeat_login_reuse_account(auth_context: AuthTestContext) -> None:
    first = auth_context.sign_in("  Student@Example.com  ").json()["user"]
    assert auth_context.client.post("/api/auth/logout").status_code == 204
    second = auth_context.sign_in("student@example.com").json()["user"]
    assert first["id"] == second["id"]
    assert second["email"] == "student@example.com"
    with auth_context.session_factory() as session:
        count = session.scalar(select(func.count()).select_from(User).where(User.email == second["email"]))
        assert count == 1


def test_wrong_password_does_not_overwrite_credentials_or_create_session(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    auth_context.client.cookies.clear()
    with auth_context.session_factory() as session:
        stored_hash = session.scalar(select(User.password_hash).where(User.email == "student@example.com"))
        session_count = session.scalar(select(func.count()).select_from(AuthSession))
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "Wrong Password 42!"}
    )
    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    assert auth_context.client.get("/api/auth/me").status_code == 401
    with auth_context.session_factory() as session:
        assert session.scalar(select(User.password_hash).where(User.email == "student@example.com")) == stored_hash
        assert session.scalar(select(func.count()).select_from(AuthSession)) == session_count


def test_password_whitespace_is_preserved(auth_context: AuthTestContext) -> None:
    password = "  Significant Password 42!  "
    auth_context.sign_in(password=password)
    auth_context.client.cookies.clear()
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": password.strip()}
    )
    assert response.status_code == 401
    auth_context.sign_in(password=password)


def test_passwordless_legacy_account_cannot_be_claimed(auth_context: AuthTestContext) -> None:
    with auth_context.session_factory() as session:
        session.add(User(email="legacy@example.com", password_hash=None))
        session.commit()
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "legacy@example.com", "password": TEST_PASSWORD}
    )
    assert response.status_code == 401
    with auth_context.session_factory() as session:
        assert session.scalar(select(User.password_hash).where(User.email == "legacy@example.com")) is None
        assert session.scalar(select(func.count()).select_from(AuthSession)) == 0


@pytest.mark.parametrize("password", ["s3Cr!", "x" * 129])
def test_invalid_password_length_is_rejected_without_echoing_secret(
    auth_context: AuthTestContext, password: str
) -> None:
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": password}
    )
    assert response.status_code == 422
    assert password not in response.text
    for error in response.json()["detail"]:
        assert "input" not in error
        assert "ctx" not in error
    with auth_context.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(User)) == 0


def test_invalid_email_is_rejected_without_echoing_password(auth_context: AuthTestContext) -> None:
    response = auth_context.client.post(
        "/api/auth/login", json={"email": "invalid-email", "password": TEST_PASSWORD}
    )
    assert response.status_code == 422
    assert TEST_PASSWORD not in response.text


def test_database_enforces_unique_email(auth_context: AuthTestContext) -> None:
    auth_context.sign_in()
    with auth_context.session_factory() as session:
        with pytest.raises(IntegrityError):
            with session.begin_nested():
                session.add(User(email="student@example.com", password_hash=None))
                session.flush()


def test_magic_link_endpoints_are_removed(auth_context: AuthTestContext) -> None:
    assert auth_context.client.post("/api/auth/magic-link", json={"email": "student@example.com"}).status_code == 404
    assert auth_context.client.post("/api/auth/verify", json={"token": "unused"}).status_code == 404
    paths = auth_context.client.get("/openapi.json").json()["paths"]
    assert "/api/auth/login" in paths
    assert "/api/auth/magic-link" not in paths
    assert "/api/auth/verify" not in paths

