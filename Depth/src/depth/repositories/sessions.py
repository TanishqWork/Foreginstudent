from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from depth.models.auth_session import AuthSession


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, user_id: UUID, session_id: UUID, created_at: datetime, expires_at: datetime) -> None:
        self.db.add(AuthSession(id=session_id, user_id=user_id, created_at=created_at, expires_at=expires_at))

    def find_active(self, session_id: UUID, user_id: UUID, now: datetime) -> AuthSession | None:
        return self.db.scalar(select(AuthSession).where(
            AuthSession.id == session_id, AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None), AuthSession.expires_at > now,
        ))

    def revoke(self, session: AuthSession, now: datetime) -> None:
        session.revoked_at = now
