from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from depth.models.auth_rate_limit import AuthRateLimit


class RateLimitRepository:
    def __init__(self, db: Session):
        self.db = db

    def increment(self, key: str, expires_at: datetime, limit: int) -> bool:
        statement = insert(AuthRateLimit).values(key=key, attempts=1, expires_at=expires_at)
        statement = statement.on_conflict_do_update(
            index_elements=[AuthRateLimit.key],
            set_={"attempts": AuthRateLimit.attempts + 1},
            where=AuthRateLimit.attempts < limit,
        ).returning(AuthRateLimit.key)
        return self.db.scalar(statement) is not None
