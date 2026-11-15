"""Persist complete-report status and content. Never log report text or statements."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from depth.database.base import utcnow
from depth.repositories.complete_reports import CompleteReportRepository
from depth.schemas.complete_report_content import CompleteReportContent
from depth.services.assessment_record_service import SavedAssessment, saved_assessment

logger = logging.getLogger(__name__)
INTERRUPTED_MESSAGE = "Generation was interrupted. Your mock unlock is kept; try again."


@dataclass(frozen=True)
class ReportRecord:
    status: str  # unlocked | generating | ready | failed
    report: CompleteReportContent | None
    error: str | None
    generation_seconds: float | None
    started_at: datetime | None


@dataclass(frozen=True)
class LoadedReport:
    source: SavedAssessment  # The finished free assessment the report is built from.
    record: ReportRecord | None  # None means locked.


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
        """The owner's ready free assessment and its report row. A run left `generating` past its deadline is marked failed."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        found = self.repository.get_with_assessment(record_id, user_id, include_input=include_input)
        source = None if found is None else saved_assessment(found[0], include_input=include_input)
        if source is None:  # Missing, another user's, or a free assessment that is not ready.
            return None
        row = found[1]
        if row is not None and row.status == "generating" and row.started_at is not None:
            if row.started_at < utcnow() - timedelta(seconds=stale_after_seconds):
                if self.repository.mark_failed(record_id, row.started_at, INTERRUPTED_MESSAGE, None):
                    self.db.commit()
                self.db.refresh(row)
        if row is None:
            return LoadedReport(source, None)
        return LoadedReport(source, ReportRecord(
            status=row.status,
            report=None if row.report is None else CompleteReportContent.model_validate(row.report),
            error=row.error,
            generation_seconds=None if row.generation_seconds is None else float(row.generation_seconds),
            started_at=row.started_at,
        ))

    def unlock(self, assessment_id: str, owner_id: str, model: str) -> None:
        try:
            self.repository.add_unlocked(UUID(assessment_id), UUID(owner_id), model)
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def claim(self, assessment_id: str, owner_id: str) -> datetime | None:
        """Start a run: returns its start time, or None if another run holds the row or it is not retryable."""
        started_at = utcnow()
        try:
            claimed = self.repository.claim(UUID(assessment_id), UUID(owner_id), started_at)
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise
        return started_at if claimed else None

    def finish(self, assessment_id: str, started_at: datetime, report: CompleteReportContent, seconds: float) -> bool:
        return self._resolve("ready", lambda record_id: self.repository.mark_ready(
            record_id, started_at, report.model_dump(mode="json"), seconds,
        ), assessment_id)

    def fail(self, assessment_id: str, started_at: datetime, error: str, seconds: float | None) -> bool:
        return self._resolve("failed", lambda record_id: self.repository.mark_failed(
            record_id, started_at, error, seconds,
        ), assessment_id)

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
