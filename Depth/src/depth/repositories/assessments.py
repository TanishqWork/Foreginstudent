from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, defer

from depth.models.assessment import Assessment


def _seconds(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


@dataclass(frozen=True)
class AssessmentHistoryRow:
    id: UUID
    status: str
    created_at: datetime
    generation_seconds: Decimal | None
    error: str | None
    overall_score: int | None
    assessment_band: str | None
    statement_type: str | None
    degree: str | None
    field: str | None
    target_program: str | None
    target_institution: str | None


def _result_report_text(key: str):
    return Assessment.result["report"][key].as_string()


def _result_report_int(key: str):
    return Assessment.result["report"][key].as_integer()


def _result_context_text(key: str):
    return Assessment.result["context"][key].as_string()


def _input_text(key: str):
    return Assessment.input[key].as_string()


class AssessmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_pending(self, assessment_id: UUID, user_id: UUID, input_data: dict[str, Any], model: str) -> Assessment:
        row = Assessment(id=assessment_id, user_id=user_id, status="generating", input=input_data, model=model)
        self.db.add(row)
        self.db.flush()
        return row

    def mark_ready(self, assessment_id: UUID, result: dict[str, Any], generation_seconds: float | None) -> bool:
        """Only a running row can finish; returns False if it was already resolved."""
        outcome = self.db.execute(
            update(Assessment)
            .where(Assessment.id == assessment_id, Assessment.status == "generating")
            .values(status="ready", result=result, error=None, generation_seconds=_seconds(generation_seconds))
        )
        return outcome.rowcount == 1

    def mark_failed(
        self, assessment_id: UUID, error: str, generation_seconds: float | None = None, *, started_before: datetime | None = None,
    ) -> bool:
        conditions = [Assessment.id == assessment_id, Assessment.status == "generating"]
        if started_before is not None:
            conditions.append(Assessment.created_at < started_before)
        outcome = self.db.execute(
            update(Assessment).where(*conditions)
            .values(status="failed", error=error, generation_seconds=_seconds(generation_seconds))
        )
        return outcome.rowcount == 1

    def get_owned(self, assessment_id: UUID, user_id: UUID, *, include_input: bool = True) -> Assessment | None:
        # Status changes use bulk UPDATEs, so always read the row's current values, never the session's copy.
        # Status polls skip the statement (input), which they never use, to send less over the network.
        query = select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user_id)
        if not include_input:
            query = query.options(defer(Assessment.input, raiseload=True))
        return self.db.scalar(query.execution_options(populate_existing=True))

    def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Assessment]:
        return list(self.db.scalars(
            select(Assessment).where(Assessment.user_id == user_id).order_by(Assessment.created_at.desc()).limit(limit)
        ))

    def list_history_for_user(self, user_id: UUID, limit: int = 50) -> list[AssessmentHistoryRow]:
        rows = self.db.execute(
            select(
                Assessment.id,
                Assessment.status,
                Assessment.created_at,
                Assessment.generation_seconds,
                Assessment.error,
                _result_report_int("overall_score").label("overall_score"),
                _result_report_text("assessment_band").label("assessment_band"),
                func.coalesce(
                    _result_report_text("statement_type"),
                    _result_context_text("statement_type"),
                    _input_text("statement_type"),
                ).label("statement_type"),
                func.coalesce(_result_context_text("degree"), _input_text("degree")).label("degree"),
                func.coalesce(_result_context_text("field"), _input_text("field")).label("field"),
                func.coalesce(_result_context_text("target_program"), _input_text("target_program")).label("target_program"),
                func.coalesce(_result_context_text("target_institution"), _input_text("target_institution")).label("target_institution"),
            )
            .where(Assessment.user_id == user_id)
            .order_by(Assessment.created_at.desc())
            .limit(limit)
        )
        return [AssessmentHistoryRow(*row) for row in rows]
