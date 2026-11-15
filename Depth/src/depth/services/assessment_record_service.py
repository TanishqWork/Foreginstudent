"""Persist free AI assessments and their generation status. Never log statements or results."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from depth.models.assessment import Assessment
from depth.repositories.assessments import AssessmentRepository
from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.schemas.free_assessment import FreeAssessmentState

logger = logging.getLogger(__name__)
INTERRUPTED_MESSAGE = "The assessment was interrupted. Your draft is still here; run it again."


@dataclass(frozen=True)
class SavedAssessment:
    original_input: dict[str, Any]
    assessment: FreeDiagnosticResponse
    generation_seconds: float | None


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


class AssessmentRecordService:
    def __init__(self, db: Session, repository: AssessmentRepository):
        self.db = db
        self.repository = repository

    def create_pending(self, owner_id: str, assessment_id: str, original_input: dict[str, Any], model: str) -> None:
        """Record the run before the AI starts. Errors propagate: no row means no generation."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            raise ValueError("A saved assessment requires UUID identifiers.")
        try:
            self.repository.add_pending(record_id, user_id, original_input, model)
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def mark_ready(self, assessment_id: str, assessment: FreeDiagnosticResponse, generation_seconds: float | None) -> bool:
        return self._resolve("ready", lambda record_id: self.repository.mark_ready(
            record_id, assessment.model_dump(mode="json"), generation_seconds,
        ), assessment_id)

    def mark_failed(self, assessment_id: str, error: str, generation_seconds: float | None = None) -> bool:
        return self._resolve("failed", lambda record_id: self.repository.mark_failed(
            record_id, error, generation_seconds,
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
            # The type is enough to diagnose connectivity or schema issues.
            logger.warning("Assessment status update failed status=%s type=%s", status, type(error).__name__)
            return False

    def free_state(self, assessment_id: str, owner_id: str, stale_after_seconds: float) -> FreeAssessmentState | None:
        """The owner's run, or None. A run still `generating` past its deadline was lost to a restart: mark it failed."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        row = self.repository.get_owned(record_id, user_id, include_input=False)
        if row is None:
            return None
        if row.status == "generating":
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)
            if row.created_at < cutoff and self.repository.mark_failed(record_id, INTERRUPTED_MESSAGE, started_before=cutoff):
                self.db.commit()
                self.db.refresh(row)
        return FreeAssessmentState(
            assessment_id=str(row.id), status=row.status,
            assessment=None if row.result is None else FreeDiagnosticResponse.model_validate(row.result),
            generation_seconds=None if row.generation_seconds is None else float(row.generation_seconds),
            error=row.error,
        )

    def load_owned(self, assessment_id: str, owner_id: str) -> SavedAssessment | None:
        """A finished free assessment for the complete report; runs still generating or failed are unavailable."""
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        return saved_assessment(self.repository.get_owned(record_id, user_id))


def saved_assessment(row: Assessment | None, *, include_input: bool = True) -> SavedAssessment | None:
    """A ready assessment row as complete-report input; other rows are unavailable.

    Without include_input the statement was not loaded, and original_input is empty (status reads only).
    """
    if row is None or row.status != "ready" or row.result is None:
        return None
    return SavedAssessment(
        original_input=dict(row.input) if include_input else {},
        assessment=FreeDiagnosticResponse.model_validate(row.result),
        generation_seconds=None if row.generation_seconds is None else float(row.generation_seconds),
    )
