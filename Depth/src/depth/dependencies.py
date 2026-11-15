import asyncio
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from depth.database.session import get_db
from depth.integrations.supabase_auth import SupabaseAuthProvider
from depth.repositories.assessments import AssessmentRepository
from depth.repositories.complete_reports import CompleteReportRepository
from depth.repositories.health import HealthRepository
from depth.repositories.rate_limits import RateLimitRepository
from depth.repositories.sessions import SessionRepository
from depth.repositories.users import UserRepository
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.auth_service import AuthService
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.health_service import HealthService
from depth.services.rate_limit_service import RateLimitService

Db = Annotated[Session, Depends(get_db)]


def get_auth_service(request: Request, db: Db) -> AuthService:
    provider = getattr(request.app.state, "auth_provider", None) or SupabaseAuthProvider(request.app.state.settings)
    sessions = SessionRepository(db, getattr(request.app.state, "provider_session_check", None))
    return AuthService(
        db, UserRepository(db), sessions,
        RateLimitService(db, RateLimitRepository(db)), request.app.state.settings, provider,
    )


def get_health_service(db: Db) -> HealthService:
    return HealthService(HealthRepository(db))


def get_assessment_records(db: Db) -> AssessmentRecordService:
    return AssessmentRecordService(db, AssessmentRepository(db))


def get_assessment_record_factory(request: Request):
    """Background jobs outlive the request's session, so they open their own."""
    session_factory = request.app.state.session_factory

    @contextmanager
    def records() -> Iterator[AssessmentRecordService]:
        with session_factory() as db:
            yield AssessmentRecordService(db, AssessmentRepository(db))

    return records


def _complete_reports(db: Session) -> CompleteReportRecordService:
    return CompleteReportRecordService(db, CompleteReportRepository(db))


def get_complete_report_records(db: Db) -> CompleteReportRecordService:
    return _complete_reports(db)


def get_complete_report_record_factory(request: Request):
    """Background report jobs outlive the request's session, so they open their own."""
    session_factory = request.app.state.session_factory

    @contextmanager
    def reports() -> Iterator[CompleteReportRecordService]:
        with session_factory() as db:
            yield _complete_reports(db)

    return reports


def get_background_tasks(request: Request) -> set[asyncio.Task]:
    """Running AI jobs, held so they are not garbage-collected and are cancelled on shutdown."""
    return request.app.state.background_tasks
