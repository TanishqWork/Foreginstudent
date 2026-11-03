from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from depth.models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def create_if_absent(self, email: str, password_hash: str, created_at: datetime) -> User:
        # The unique email constraint arbitrates concurrent first sign-ins. Never
        # overwrite the existing password if a competing request wins the insert.
        self.db.execute(
            insert(User).values(id=uuid4(), email=email, password_hash=password_hash, created_at=created_at)
            .on_conflict_do_nothing(index_elements=[User.email])
        )
        user = self.find_by_email(email)
        if user is None:
            raise RuntimeError("The created account could not be loaded")
        return user
