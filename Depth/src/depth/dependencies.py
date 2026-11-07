from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from depth.database.session import get_db
from depth.integrations.supabase_auth import SupabaseAuthProvider
from depth.repositories.health import HealthRepository
from depth.repositories.rate_limits import RateLimitRepository
from depth.repositories.sessions import SessionRepository
from depth.repositories.users import UserRepository
from depth.services.auth_service import AuthService
from depth.services.assessment_store import AssessmentStore
from depth.services.health_service import HealthService
from depth.services.rate_limit_service import RateLimitService

Db = Annotated[Session, Depends(get_db)]


def get_auth_service(request: Request, db: Db) -> AuthService:
    provider = getattr(request.app.state, "auth_provider", None) or SupabaseAuthProvider(request.app.state.settings)
    sessions = SessionRepository(db)
    provider_check = getattr(request.app.state, "provider_session_check", None)
    if provider_check is not None:
        sessions.provider_is_active = provider_check
    return AuthService(
        db, UserRepository(db), sessions,
        RateLimitService(db, RateLimitRepository(db)), request.app.state.settings, provider,
    )


def get_health_service(db: Db) -> HealthService:
    return HealthService(HealthRepository(db))


def get_assessment_store(request: Request) -> AssessmentStore:
    return request.app.state.assessment_store
