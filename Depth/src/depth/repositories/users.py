from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from depth.core.exceptions import AuthenticationError
from depth.models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def find_by_provider_id(self, provider_id: UUID) -> User | None:
        return self.db.scalar(select(User).where(User.supabase_user_id == provider_id))

    def for_identity(
        self, provider_id: UUID, email: str, created_at: datetime, *,
        verified_recovery: bool = False,
    ) -> User:
        user = self.find_by_provider_id(provider_id)
        if user is not None:
            return user
        existing = self.find_by_email(email)
        if existing is not None:
            # Existing identities are linked by the controlled migration, matching
            # imported UUID, or proof of email ownership through verified recovery.
            if existing.supabase_user_id is not None or not (
                existing.id == provider_id or verified_recovery
            ):
                raise AuthenticationError()
            existing.supabase_user_id = provider_id
            self.db.flush()
            return existing
        self.db.execute(
            insert(User).values(
                id=uuid4(), email=email, supabase_user_id=provider_id, created_at=created_at,
            ).on_conflict_do_nothing()
        )
        user = self.find_by_provider_id(provider_id)
        if user is None:
            raise AuthenticationError()
        return user
