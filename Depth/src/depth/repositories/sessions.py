from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy import column, exists, select, table, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, contains_eager

from depth.models.auth_session import AuthSession
from depth.models.user import User


# Supabase's managed sessions, read for immediate access-token revocation.
# The auth schema is read only; application migrations never alter it.
PROVIDER_SESSIONS = table("sessions", column("id"), column("user_id"), schema="auth")


class SessionRepository:
    def __init__(self, db: Session, provider_check: Callable[[UUID, UUID], bool] | None = None):
        self.db = db
        # Tests without Supabase's auth schema supply their own revocation check.
        self.provider_check = provider_check

    def add(
        self, user_id: UUID, session_id: UUID, created_at: datetime,
        expires_at: datetime, token_hash: str,
    ) -> AuthSession:
        self.db.execute(insert(AuthSession).values(
            id=session_id, user_id=user_id, created_at=created_at,
            expires_at=expires_at, token_hash=token_hash,
        ).on_conflict_do_nothing(index_elements=[AuthSession.id]))
        return self.db.get(AuthSession, session_id)

    def find_active(self, session_id: UUID, provider_user_id: UUID, now: datetime) -> AuthSession | None:
        return self.db.scalar(select(AuthSession).join(User).where(
            AuthSession.id == session_id, User.supabase_user_id == provider_user_id,
            AuthSession.revoked_at.is_(None), AuthSession.expires_at > now,
        ))

    def find_by_token_hash(self, token_hash: str) -> AuthSession | None:
        return self.db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))

    def find_for_request(self, token_hash: str) -> tuple[AuthSession, bool] | None:
        """One round trip: the session, its user, and whether the Supabase session still exists.

        The caller requires the provider's session/user IDs to equal this session's, so checking
        auth.sessions for this session's own IDs is the same revocation check, done in the same query.
        """
        if self.provider_check is not None:
            session = self.db.scalar(select(AuthSession).join(AuthSession.user)
                                     .options(contains_eager(AuthSession.user)).where(AuthSession.token_hash == token_hash))
            return None if session is None else (session, self.provider_check(session.id, session.user.supabase_user_id))
        active = exists().where(PROVIDER_SESSIONS.c.id == AuthSession.id, PROVIDER_SESSIONS.c.user_id == User.supabase_user_id)
        row = self.db.execute(
            select(AuthSession, active.label("provider_active")).join(AuthSession.user)
            .options(contains_eager(AuthSession.user)).where(AuthSession.token_hash == token_hash)
        ).one_or_none()
        return None if row is None else (row[0], bool(row[1]))

    def revoke(self, session: AuthSession, now: datetime) -> None:
        session.revoked_at = now

    def revoke_all(self, user_id: UUID, now: datetime) -> None:
        self.db.execute(update(AuthSession).where(
            AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None),
        ).values(revoked_at=now))
