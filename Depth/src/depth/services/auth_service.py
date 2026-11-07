from base64 import urlsafe_b64encode
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from depth.core.config import JWT_TTL_SECONDS, RECOVERY_TTL_SECONDS, Settings
from depth.core.exceptions import (
    AuthenticationError, AuthInputError, AuthProviderUnavailableError,
    EmailConfirmationRequired, RateLimitError,
)
from depth.integrations.supabase_auth import ProviderSession, ProviderTokens, SupabaseAuthProvider
from depth.models.auth_session import AuthSession
from depth.repositories.sessions import SessionRepository
from depth.repositories.users import UserRepository
from depth.security.tokens import access_token_expired, token_hash
from depth.services.rate_limit_service import RateLimitService


@dataclass(frozen=True)
class LoginResult:
    session: AuthSession
    tokens: ProviderTokens = field(repr=False)
    proof: str = field(repr=False)


@dataclass(frozen=True)
class PendingLogin:
    verifier: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class AuthenticatedSession:
    session: AuthSession
    refreshed_tokens: ProviderTokens | None = field(default=None, repr=False)


class AuthService:
    def __init__(
        self, db: Session, users: UserRepository, sessions: SessionRepository,
        rate_limits: RateLimitService, settings: Settings, provider: SupabaseAuthProvider,
    ):
        self.db = db
        self.users = users
        self.sessions = sessions
        self.rate_limits = rate_limits
        self.settings = settings
        self.provider = provider

    @property
    def recovery_redirect(self) -> str:
        return self.settings.frontend_url + "/api/auth/recovery/callback"

    def login(self, email: str, password: str, ip: str) -> LoginResult | PendingLogin:
        self.rate_limits.check_login(email, ip)
        existing = self.users.find_by_email(email)
        try:
            provider_session = self.provider.sign_in(email, password)
        except EmailConfirmationRequired:
            return PendingLogin()
        except AuthenticationError:
            if existing is not None:
                raise
            if len(password.encode("utf-8")) > 72:
                raise AuthInputError("New passwords must contain at most 72 UTF-8 bytes.") from None
            verifier = token_urlsafe(48)
            challenge = urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
            try:
                provider_session = self.provider.sign_up(
                    email, password, self.settings.frontend_url + "/api/auth/confirmation/callback", challenge,
                )
            except EmailConfirmationRequired:
                return PendingLogin(verifier)
            if provider_session is None:
                return PendingLogin(verifier)
        return self._persist_login(provider_session)

    def _persist_login(self, provider_session: ProviderSession) -> LoginResult:
        if provider_session.identity.recovery:
            raise AuthenticationError()
        user = self.users.for_identity(
            provider_session.user.id, provider_session.user.email, provider_session.user.created_at,
        )
        now = datetime.now(timezone.utc).replace(microsecond=0)
        proof = token_urlsafe(32)
        session = self.sessions.add(
            user.id, provider_session.identity.session_id, now,
            now + timedelta(seconds=JWT_TTL_SECONDS), token_hash(proof),
        )
        if session.revoked_at is not None or session.user_id != user.id:
            raise AuthenticationError()
        self.db.commit()
        return LoginResult(session, provider_session.tokens, proof)

    def finish_confirmation(self, code: str | None, verifier: str | None) -> LoginResult:
        if not code or not verifier:
            raise AuthenticationError()
        return self._persist_login(self.provider.exchange_code(code, verifier))

    def current_session(
        self, token: str | None, refresh_token: str | None = None, proof: str | None = None,
    ) -> AuthenticatedSession:
        if not token or not proof:
            raise AuthenticationError()
        session = self.sessions.find_by_token_hash(token_hash(proof))
        now = datetime.now(timezone.utc)
        if session is None or session.revoked_at is not None or session.expires_at <= now:
            raise AuthenticationError()
        refreshed = None
        try:
            _, identity = self.provider.authenticate(token)
        except AuthenticationError:
            if not refresh_token or not access_token_expired(token):
                raise
            replacement = self.provider.refresh(refresh_token)
            identity = replacement.identity
            refreshed = replacement.tokens
        if (
            identity.recovery or session.id != identity.session_id
            or session.user.supabase_user_id != identity.user_id
            or not self.sessions.provider_is_active(identity.session_id, identity.user_id)
        ):
            raise AuthenticationError()
        return AuthenticatedSession(session, refreshed)

    def logout(self, token: str | None, proof: str | None, recovery_token: str | None) -> None:
        now = datetime.now(timezone.utc)
        owned = []
        for cookie in (proof, recovery_token):
            if cookie:
                session = self.sessions.find_by_token_hash(token_hash(cookie))
                if session is not None:
                    self.sessions.revoke(session, now)
                    owned.append(session)
        self.db.commit()
        if owned and (token or recovery_token):
            try:
                self.provider.sign_out(token or recovery_token)
            except (AuthenticationError, AuthProviderUnavailableError, RateLimitError):
                pass

    def start_recovery(self, email: str, ip: str) -> str:
        self.rate_limits.check_recovery(email, ip)
        verifier = token_urlsafe(48)
        challenge = urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
        try:
            self.provider.send_recovery(email, challenge, self.recovery_redirect)
        except AuthenticationError:
            pass
        return verifier

    def finish_recovery(
        self, *, code: str | None, verifier: str | None, recovery_hash: str | None,
    ) -> str:
        if recovery_hash:
            supplied = self.provider.verify_recovery(recovery_hash)
        elif code and verifier:
            supplied = self.provider.exchange_code(code, verifier)
        else:
            raise AuthenticationError()
        if not supplied.identity.recovery:
            raise AuthenticationError()
        user = self.users.for_identity(
            supplied.user.id, supplied.user.email, supplied.user.created_at,
            verified_recovery=supplied.user.email_verified,
        )
        now = datetime.now(timezone.utc)
        session = self.sessions.add(
            user.id, supplied.identity.session_id, now,
            now + timedelta(seconds=RECOVERY_TTL_SECONDS),
            token_hash(supplied.tokens.access_token),
        )
        if session.revoked_at is not None:
            raise AuthenticationError()
        self.db.commit()
        return supplied.tokens.access_token

    def recovery_session(self, token: str | None) -> AuthSession:
        if not token:
            raise AuthenticationError()
        session = self.sessions.find_by_token_hash(token_hash(token))
        now = datetime.now(timezone.utc)
        if session is None or session.revoked_at is not None or session.expires_at <= now:
            raise AuthenticationError()
        _, identity = self.provider.authenticate(token)
        if (
            not identity.recovery or session.id != identity.session_id
            or session.user.supabase_user_id != identity.user_id
            or not self.sessions.provider_is_active(identity.session_id, identity.user_id)
        ):
            raise AuthenticationError()
        return session

    def reset_password(self, token: str | None, password: str) -> None:
        session = self.recovery_session(token)
        self.provider.update_password(token, password)
        self.sessions.revoke_all(session.user_id, datetime.now(timezone.utc))
        self.db.commit()
        try:
            self.provider.sign_out(token, all_sessions=True)
        except (AuthenticationError, AuthProviderUnavailableError, RateLimitError):
            pass
