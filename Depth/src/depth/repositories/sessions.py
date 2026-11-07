from datetime import datetime
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from depth.models.auth_session import AuthSession
from depth.models.user import User


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

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

    def provider_is_active(self, session_id: UUID, provider_user_id: UUID) -> bool:
        # Supabase documents this read for immediate access-token revocation.
        # The managed auth schema is read only; application migrations never alter it.
        return bool(self.db.scalar(text(
            "SELECT EXISTS (SELECT 1 FROM auth.sessions WHERE id=:session_id AND user_id=:user_id)"
        ), {"session_id": session_id, "user_id": provider_user_id}))

    def revoke(self, session: AuthSession, now: datetime) -> None:
        session.revoked_at = now

    def revoke_all(self, user_id: UUID, now: datetime) -> None:
        self.db.execute(update(AuthSession).where(
            AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None),
        ).values(revoked_at=now))
