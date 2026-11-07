from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from depth.core.config import PKCE_COOKIE, RECOVERY_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, SESSION_PROOF_COOKIE
from depth.models import AuthSession, User

from conftest import TEST_PASSWORD, AuthTestContext

NEW_PASSWORD = "New Password 63!"


def begin_recovery(context: AuthTestContext):
    response = context.client.post("/api/auth/forgot-password", json={"email": "student@example.com"})
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "path=/api/auth/recovery/callback" in cookie
    code = context.provider.recovery_code("student@example.com")
    callback = context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert callback.status_code == 303
    assert callback.headers["location"] == "http://localhost:5173/reset-password"
    assert callback.headers["referrer-policy"] == "no-referrer"
    return code


def test_recovery_has_same_public_response_for_known_and_unknown_email(auth_context: AuthTestContext):
    auth_context.sign_in()
    known = auth_context.client.post("/api/auth/forgot-password", json={"email": "student@example.com"})
    unknown = auth_context.client.post("/api/auth/forgot-password", json={"email": "absent@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert "access_token" not in known.text
    assert "absent@example.com" not in auth_context.provider.sent


def test_recovery_cookie_cannot_authenticate_normal_routes(auth_context: AuthTestContext):
    auth_context.sign_in()
    begin_recovery(auth_context)
    recovery = auth_context.client.cookies.get(RECOVERY_COOKIE)
    auth_context.client.cookies.clear()
    auth_context.client.cookies.set(RECOVERY_COOKIE, recovery, path="/api")
    assert auth_context.client.get("/api/auth/recovery").json() == {"valid": True}
    assert auth_context.client.get("/api/auth/me").status_code == 401
    assert auth_context.client.post("/api/assessments/free", json={}).status_code == 401


def test_recovery_callback_requires_verifier_and_is_single_use(auth_context: AuthTestContext):
    auth_context.sign_in()
    auth_context.client.post("/api/auth/forgot-password", json={"email": "student@example.com"})
    code = auth_context.provider.recovery_code("student@example.com")
    verifier = auth_context.client.cookies.get(PKCE_COOKIE)
    auth_context.client.cookies.clear()
    response = auth_context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert "error=invalid_recovery" in response.headers["location"]
    auth_context.client.cookies.set(PKCE_COOKIE, verifier, path="/api/auth/recovery/callback")
    response = auth_context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert "?" not in response.headers["location"]
    response = auth_context.client.get("/api/auth/recovery/callback", params={"code": code}, follow_redirects=False)
    assert "error=invalid_recovery" in response.headers["location"]


def test_new_password_revokes_sessions_and_requires_fresh_login(auth_context: AuthTestContext):
    auth_context.sign_in()
    old_cookies = dict(auth_context.client.cookies)
    begin_recovery(auth_context)
    response = auth_context.client.post("/api/auth/reset-password", json={
        "password": NEW_PASSWORD, "password_confirmation": NEW_PASSWORD,
    })
    assert response.status_code == 200
    assert auth_context.client.get("/api/auth/me").status_code == 401
    assert auth_context.client.get("/api/auth/recovery").status_code == 401
    for name, value in old_cookies.items():
        auth_context.client.cookies.set(name, value, path="/api")
    assert auth_context.client.get("/api/auth/me").status_code == 401
    assert auth_context.client.post("/api/auth/login", json={
        "email": "student@example.com", "password": TEST_PASSWORD,
    }).status_code == 401
    auth_context.sign_in(password=NEW_PASSWORD)


def test_reset_requires_valid_recovery_and_matching_passwords(auth_context: AuthTestContext):
    auth_context.sign_in()
    assert auth_context.client.post("/api/auth/reset-password", json={
        "password": NEW_PASSWORD, "password_confirmation": NEW_PASSWORD,
    }).status_code == 401
    begin_recovery(auth_context)
    response = auth_context.client.post("/api/auth/reset-password", json={
        "password": NEW_PASSWORD, "password_confirmation": "Different Password 9!",
    })
    assert response.status_code == 422
    assert NEW_PASSWORD not in response.text
    assert "Different Password 9!" not in response.text


def test_expired_recovery_is_rejected(auth_context: AuthTestContext):
    auth_context.sign_in()
    begin_recovery(auth_context)
    with auth_context.session_factory() as session:
        from depth.security.tokens import token_hash
        row = session.scalar(select(AuthSession).where(
            AuthSession.token_hash == token_hash(auth_context.client.cookies.get(RECOVERY_COOKIE)),
        ))
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()
    assert auth_context.client.get("/api/auth/recovery").status_code == 401


def test_verified_recovery_preserves_legacy_local_user_id(auth_context: AuthTestContext):
    with auth_context.session_factory() as session:
        user = User(email="student@example.com")
        session.add(user)
        session.commit()
        local_id = user.id
    auth_context.provider.register("student@example.com", TEST_PASSWORD, confirmed=False)
    begin_recovery(auth_context)
    with auth_context.session_factory() as session:
        user = session.scalar(select(User).where(User.email == "student@example.com"))
        assert user.id == local_id
        assert user.supabase_user_id == auth_context.provider.users[user.email][0].id


def test_logout_revokes_local_session_during_provider_outage(auth_context: AuthTestContext):
    auth_context.sign_in()
    cookies = dict(auth_context.client.cookies)
    auth_context.provider.available = False
    assert auth_context.client.post("/api/auth/logout").status_code == 204
    auth_context.provider.available = True
    for name, value in cookies.items():
        auth_context.client.cookies.set(name, value, path="/api")
    assert auth_context.client.get("/api/auth/me").status_code == 401
