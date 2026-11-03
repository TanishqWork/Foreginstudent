from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from depth.core.config import JWT_TTL_SECONDS, Settings
from depth.core.exceptions import AuthenticationError
from depth.models.auth_session import AuthSession
from depth.models.user import User
from depth.repositories.sessions import SessionRepository
from depth.repositories.users import UserRepository
from depth.security.passwords import hash_password, verify_password
from depth.security.tokens import sign_session_token, validate_session_token
from depth.services.rate_limit_service import RateLimitService


@dataclass(frozen=True)
class LoginResult:
    user: User
    expires_at: datetime
    token: str


class AuthService:
    def __init__(
        self, db: Session, users: UserRepository, sessions: SessionRepository,
        rate_limits: RateLimitService, settings: Settings,
    ):
        self.db = db
        self.users = users
        self.sessions = sessions
        self.rate_limits = rate_limits
        self.settings = settings

    def login(self, email: str, password: str, ip: str) -> LoginResult:
        self.rate_limits.check_login(email, ip)
        user = self.users.find_by_email(email)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        if user is None:
            user = self.users.create_if_absent(email, hash_password(password), now)
        # Also verify after insert-on-conflict, so a concurrent different password
        # cannot obtain a session for the account that won the unique-email race.
        if not verify_password(password, user.password_hash):
            raise AuthenticationError()
        expires_at = now + timedelta(seconds=JWT_TTL_SECONDS)
        session_id = uuid4()
        self.sessions.add(user.id, session_id, now, expires_at)
        token = sign_session_token(user.id, session_id, now, expires_at, self.settings.jwt_secret)
        self.db.commit()
        return LoginResult(user=user, expires_at=expires_at, token=token)

    def current_session(self, token: str | None) -> AuthSession:
        identity = validate_session_token(token, self.settings.jwt_secret)
        session = self.sessions.find_active(
            identity.session_id, identity.user_id, datetime.now(timezone.utc),
        )
        if session is None or session.user.password_hash is None:
            raise AuthenticationError()
        return session

    def logout(self, token: str | None) -> None:
        try:
            session = self.current_session(token)
        except AuthenticationError:
            return
        self.sessions.revoke(session, datetime.now(timezone.utc))
        self.db.commit()
