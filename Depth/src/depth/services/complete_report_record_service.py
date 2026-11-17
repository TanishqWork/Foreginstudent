"""Persist complete-report status and content. Never log report text or statements."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from depth.database.base import utcnow
from depth.repositories.complete_reports import CompleteReportRepository
from depth.schemas.complete_report_content import CompleteReportContent
from depth.services.assessment_record_service import SavedAssessment, saved_assessment

logger = logging.getLogger(__name__)
INTERRUPTED_MESSAGE = "Generation was interrupted. Your paid access was not used; try again."


@dataclass(frozen=True)
class ReportRecord:
    status: str  # unlocked | generating | ready | failed
    attempt_id: str | None
    report: CompleteReportContent | None
    error: str | None
    failure_kind: str | None
    generation_seconds: float | None
    started_at: datetime | None


@dataclass(frozen=True)
class LoadedReport:
    source: SavedAssessment  # The finished free assessment the report is built from.
    record: ReportRecord | None  # None means locked.
    remaining_successful_runs: int
    successful_runs: int
    max_successful_runs: int | None


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


class CompleteReportRecordService:
    def __init__(self, db: Session, repository: CompleteReportRepository):
        self.db = db
        self.repository = repository

    def load(self, assessment_id: str, owner_id: str, stale_after_seconds: float, *, include_input: bool = False) -> LoadedReport | None:
        """The owner's ready free assessment and paid report access. Stale attempts are marked failed."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        found = self.repository.get_access(record_id, user_id, include_input=include_input)
        source = None if found is None else saved_assessment(found.assessment, include_input=include_input)
        if source is None:  # Missing, another user's, or a free assessment that is not ready.
            return None
        entitlement = found.entitlement
        row = found.latest_attempt
        successful_runs = found.successful_runs
        max_runs = None if entitlement is None else entitlement.max_successful_runs
        remaining = 0 if entitlement is None else max(max_runs - successful_runs, 0)
        if row is not None and row.status == "generating":
            if row.started_at < utcnow() - timedelta(seconds=stale_after_seconds):
                if self.repository.mark_failed(row.id, row.started_at, INTERRUPTED_MESSAGE, None, "interrupted"):
                    self.db.commit()
                self.db.refresh(row)
        record = None if entitlement is None else ReportRecord(
            status="unlocked" if row is None else row.status,
            attempt_id=None if row is None else str(row.id),
            report=None if row is None or row.report is None else CompleteReportContent.model_validate(row.report),
            error=None if row is None else row.error,
            failure_kind=None if row is None else row.failure_kind,
            generation_seconds=None if row is None or row.generation_seconds is None else float(row.generation_seconds),
            started_at=None if row is None else row.started_at,
        )
        return LoadedReport(source, record, remaining, successful_runs, max_runs)

    def mark_paid(
        self, assessment_id: str, owner_id: str, *, provider: str = "mock",
        provider_payment_id: str | None = None, amount_cents: int = 2900, currency: str = "USD",
    ) -> None:
        try:
            self.repository.add_paid_entitlement(
                UUID(assessment_id), UUID(owner_id), provider=provider,
                provider_payment_id=provider_payment_id, amount_cents=amount_cents, currency=currency,
            )
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def claim(self, assessment_id: str, owner_id: str, model: str) -> tuple[str, datetime] | None:
        """Start a paid attempt, or None if another run holds the row or no successful runs remain."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        started_at = utcnow()
        try:
            access = self.repository.get_access(record_id, user_id, include_input=False)
            if access is None or access.entitlement is None:
                return None
            claimed = self.repository.claim_attempt(access.entitlement, access.successful_runs, model=model, started_at=started_at)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return None
        except SQLAlchemyError:
            self.db.rollback()
            raise
        return None if claimed is None else (str(claimed.id), started_at)

    def finish(self, attempt_id: str, started_at: datetime, report: CompleteReportContent, seconds: float) -> bool:
        counts_against_limit = report.report_status != "incomplete"
        return self._resolve("ready", lambda record_id: self.repository.mark_ready(
            record_id, started_at, report.model_dump(mode="json"), seconds, counts_against_limit,
        ), attempt_id)

    def fail(self, attempt_id: str, started_at: datetime, error: str, seconds: float | None, failure_kind: str) -> bool:
        return self._resolve("failed", lambda record_id: self.repository.mark_failed(
            record_id, started_at, error, seconds, failure_kind,
        ), attempt_id)

    def _resolve(self, status: str, write, assessment_id: str) -> bool:
        record_id = _uuid(assessment_id)
        if record_id is None:
            return False
        try:
            changed = write(record_id)
            self.db.commit()
            return changed
        except SQLAlchemyError as error:
            self.db.rollback()
            logger.warning("Complete report status update failed status=%s type=%s", status, type(error).__name__)
            return False
