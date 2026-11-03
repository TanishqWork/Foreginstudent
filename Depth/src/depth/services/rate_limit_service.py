from datetime import datetime, timezone
from hashlib import sha256
from math import ceil, floor

from sqlalchemy.orm import Session

from depth.core.exceptions import RateLimitError
from depth.repositories.rate_limits import RateLimitRepository


class RateLimitService:
    def __init__(self, db: Session, repository: RateLimitRepository):
        self.db = db
        self.repository = repository

    def check_login(self, email: str, ip: str) -> None:
        now = datetime.now(timezone.utc)
        window = floor(now.timestamp() / 900)
        expires_at = datetime.fromtimestamp((window + 1) * 900, timezone.utc)
        for scope, identity, limit in (("login-ip", ip, 20), ("login-email", email, 5)):
            key = sha256(f"{scope}:{identity}:{window}".encode()).hexdigest()
            if not self.repository.increment(key, expires_at, limit):
                self.db.commit()
                raise RateLimitError(max(1, ceil((expires_at - now).total_seconds())))
        # Persist failed-attempt counters independently of the login transaction.
        self.db.commit()
