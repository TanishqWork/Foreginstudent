from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from depth.database.base import utcnow
from depth.models.complete_report import CompleteReport


def _seconds(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


class CompleteReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, assessment_id: UUID, user_id: UUID) -> CompleteReport | None:
        # Status changes use bulk UPDATEs, so always read the row's current values, never the session's copy.
        return self.db.scalar(select(CompleteReport).where(
            CompleteReport.assessment_id == assessment_id, CompleteReport.user_id == user_id,
        ).execution_options(populate_existing=True))

    def add_unlocked(self, assessment_id: UUID, user_id: UUID, model: str) -> None:
        """Idempotent: unlocking twice keeps the existing row and its report."""
        now = utcnow()
        self.db.execute(
            insert(CompleteReport)
            .values(assessment_id=assessment_id, user_id=user_id, status="unlocked", model=model, created_at=now, updated_at=now)
            .on_conflict_do_nothing(index_elements=[CompleteReport.assessment_id])
        )

    def claim(self, assessment_id: UUID, user_id: UUID, started_at: datetime) -> bool:
        """Atomically move a retryable row to `generating`. Only one caller can win, across processes."""
        retryable = or_(
            CompleteReport.status.in_(("unlocked", "failed")),
            and_(CompleteReport.status == "ready", CompleteReport.report["report_status"].astext == "incomplete"),
        )
        outcome = self.db.execute(
            update(CompleteReport)
            .where(CompleteReport.assessment_id == assessment_id, CompleteReport.user_id == user_id, retryable)
            .values(status="generating", started_at=started_at, report=None, error=None, generation_seconds=None, updated_at=started_at)
            .execution_options(synchronize_session=False)
        )
        return outcome.rowcount == 1

    def _finish_run(self, assessment_id: UUID, started_at: datetime, **values: Any) -> bool:
        # Matching started_at means a run cut off by a restart can never overwrite a newer run.
        outcome = self.db.execute(
            update(CompleteReport)
            .where(CompleteReport.assessment_id == assessment_id, CompleteReport.status == "generating",
                   CompleteReport.started_at == started_at)
            .values(**values, updated_at=utcnow())
            .execution_options(synchronize_session=False)
        )
        return outcome.rowcount == 1

    def mark_ready(self, assessment_id: UUID, started_at: datetime, report: dict[str, Any], generation_seconds: float) -> bool:
        return self._finish_run(assessment_id, started_at, status="ready", report=report, error=None,
                                generation_seconds=_seconds(generation_seconds))

    def mark_failed(self, assessment_id: UUID, started_at: datetime, error: str, generation_seconds: float | None) -> bool:
        return self._finish_run(assessment_id, started_at, status="failed", report=None, error=error,
                                generation_seconds=_seconds(generation_seconds))
