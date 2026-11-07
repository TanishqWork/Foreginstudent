"""Provider double: authentication tests never call Supabase or send email."""
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from uuid import UUID, uuid4

import jwt

from depth.core.exceptions import AuthenticationError, AuthProviderUnavailableError, EmailConfirmationRequired
from depth.integrations.supabase_auth import ProviderSession, ProviderTokens, ProviderUser
from depth.security.tokens import claims_after_provider_validation

TEST_PROVIDER_SECRET = "provider-test-signing-secret-not-a-production-key"
TEST_PROVIDER_URL = "https://auth.example.test"


class FakeAuthProvider:
    def __init__(self):
        self.users = {}
        self.sessions = {}
        self.refresh_tokens = {}
        self.recoveries = {}
        self.confirmations = {}
        self.signup_challenges = {}
        self.sent = {}
        self.available = True
        self.confirm_new = False
        self.signup_calls = 0

    def _available(self):
        if not self.available:
            raise AuthProviderUnavailableError()

    def register(self, email, password, *, user_id=None, confirmed=True):
        user = ProviderUser(user_id or uuid4(), email, datetime.now(timezone.utc), confirmed)
        self.users[email] = (user, password)
        return user

    def _issue(self, user, *, recovery=False, session_id=None):
        now = datetime.now(timezone.utc).replace(microsecond=0)
        sid = session_id or uuid4()
        token = jwt.encode({
            "sub": str(user.id), "session_id": str(sid), "iat": now, "exp": now + timedelta(days=1),
            "iss": TEST_PROVIDER_URL + "/auth/v1", "aud": "authenticated",
            "amr": [{"method": "recovery" if recovery else "password", "timestamp": int(now.timestamp())}],
        }, TEST_PROVIDER_SECRET, algorithm="HS256")
        refresh = token_urlsafe(32)
        self.sessions[sid] = user.id
        self.refresh_tokens[refresh] = (sid, user, recovery)
        return ProviderSession(
            user, claims_after_provider_validation(token, user.id, TEST_PROVIDER_URL + "/auth/v1"),
            ProviderTokens(token, refresh),
        )

    def authenticate(self, token):
        self._available()
        try:
            claims = jwt.decode(token, TEST_PROVIDER_SECRET, algorithms=["HS256"], audience="authenticated", issuer=TEST_PROVIDER_URL + "/auth/v1")
            user_id = UUID(claims["sub"])
            user = next(item[0] for item in self.users.values() if item[0].id == user_id)
        except (jwt.PyJWTError, ValueError, KeyError, StopIteration):
            raise AuthenticationError() from None
        return user, claims_after_provider_validation(token, user.id, TEST_PROVIDER_URL + "/auth/v1")

    def sign_in(self, email, password):
        self._available()
        if email not in self.users or self.users[email][1] != password:
            raise AuthenticationError()
        user = self.users[email][0]
        if not user.email_verified:
            raise EmailConfirmationRequired()
        return self._issue(user)

    def sign_up(self, email, password, redirect_to, challenge=None):
        self._available()
        self.signup_calls += 1
        if email in self.users:
            return None
        user = self.register(email, password, confirmed=not self.confirm_new)
        if self.confirm_new:
            self.signup_challenges[email] = challenge
            return None
        return self._issue(user)

    def refresh(self, refresh_token):
        self._available()
        try:
            sid, user, recovery = self.refresh_tokens[refresh_token]
            if sid not in self.sessions:
                raise KeyError()
        except KeyError:
            raise AuthenticationError() from None
        return self._issue(user, recovery=recovery, session_id=sid)

    def send_recovery(self, email, challenge, redirect_to):
        self._available()
        if email in self.users:
            self.sent[email] = (challenge, redirect_to)

    def recovery_code(self, email):
        code = token_urlsafe(24)
        self.recoveries[code] = (email, self.sent[email][0])
        return code

    def confirmation_code(self, email):
        code = token_urlsafe(24)
        self.confirmations[code] = (email, self.signup_challenges[email])
        return code

    def exchange_code(self, code, verifier):
        self._available()
        from base64 import urlsafe_b64encode
        from hashlib import sha256
        recovery = code not in self.confirmations
        try:
            email, expected = (self.recoveries if recovery else self.confirmations).pop(code)
        except KeyError:
            raise AuthenticationError() from None
        challenge = urlsafe_b64encode(sha256(verifier.encode()).digest()).decode().rstrip("=")
        if challenge != expected:
            raise AuthenticationError()
        user, password = self.users[email]
        if not user.email_verified:
            user = ProviderUser(user.id, user.email, user.created_at, True)
            self.users[email] = (user, password)
        return self._issue(user, recovery=recovery)

    def verify_recovery(self, token_hash):
        raise AuthenticationError()

    def update_password(self, token, password):
        user, identity = self.authenticate(token)
        if not identity.recovery:
            raise AuthenticationError()
        self.users[user.email] = (user, password)

    def sign_out(self, token, *, all_sessions=False):
        self._available()
        user, identity = self.authenticate(token)
        for sid, uid in list(self.sessions.items()):
            if sid == identity.session_id or (all_sessions and uid == user.id):
                self.sessions.pop(sid)

    def session_active(self, session_id, user_id):
        return self.sessions.get(session_id) == user_id
