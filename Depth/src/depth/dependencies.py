from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from depth.database.session import get_db
from depth.repositories.health import HealthRepository
from depth.repositories.rate_limits import RateLimitRepository
from depth.repositories.sessions import SessionRepository
from depth.repositories.users import UserRepository
from depth.services.auth_service import AuthService
from depth.services.health_service import HealthService
from depth.services.rate_limit_service import RateLimitService

Db = Annotated[Session, Depends(get_db)]


def get_auth_service(request: Request, db: Db) -> AuthService:
    return AuthService(
        db, UserRepository(db), SessionRepository(db),
        RateLimitService(db, RateLimitRepository(db)), request.app.state.settings,
    )


def get_health_service(db: Db) -> HealthService:
    return HealthService(HealthRepository(db))
