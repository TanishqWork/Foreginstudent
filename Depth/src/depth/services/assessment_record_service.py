"""Persist free AI assessments. The AI result is already paid for, so a failed save never discards it."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from depth.repositories.assessments import AssessmentRepository
from depth.schemas.assessment_report import FreeDiagnosticResponse

logger = logging.getLogger(__name__)


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

    def save(
        self, owner_id: str, original_input: dict[str, Any], assessment: FreeDiagnosticResponse,
        model: str, generation_seconds: float | None,
    ) -> bool:
        assessment_id, user_id = _uuid(assessment.report.assessment_id), _uuid(owner_id)
        if assessment_id is None or user_id is None:
            logger.warning("Assessment save skipped reason=invalid_identifier")
            return False
        try:
            self.repository.add(
                assessment_id, user_id, original_input, assessment.model_dump(mode="json"), model, generation_seconds,
            )
            self.db.commit()
            return True
        except SQLAlchemyError as error:
            self.db.rollback()
            # Never log the statement or result; the type is enough to diagnose connectivity or schema issues.
            logger.warning("Assessment save failed type=%s", type(error).__name__)
            return False

    async def save_async(self, *args: Any, **kwargs: Any) -> bool:
        # SQLAlchemy here is synchronous; keep the event loop free for other requests.
        return await asyncio.to_thread(self.save, *args, **kwargs)

    def load_owned(self, assessment_id: str, owner_id: str) -> SavedAssessment | None:
        record_id, user_id = _uuid(assessment_id), _uuid(owner_id)
        if record_id is None or user_id is None:
            return None
        row = self.repository.get_owned(record_id, user_id)
        if row is None:
            return None
        return SavedAssessment(
            original_input=dict(row.input),
            assessment=FreeDiagnosticResponse.model_validate(row.result),
            generation_seconds=None if row.generation_seconds is None else float(row.generation_seconds),
        )
