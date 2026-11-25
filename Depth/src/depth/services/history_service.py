from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from depth.repositories.assessments import AssessmentRepository
from depth.repositories.complete_reports import CompleteReportRepository
from depth.schemas.history import (
    AssessmentHistoryItem, AssessmentHistoryResponse, CompleteReportHistoryItem, CompleteReportHistoryResponse,
)


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


def _seconds(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def _history_bits(row: object) -> dict:
    return {
        "overall_score": row.overall_score,
        "assessment_band": row.assessment_band,
        "statement_type": row.statement_type,
        "degree": row.degree,
        "field": row.field,
        "target_program": row.target_program,
        "target_institution": row.target_institution,
    }


class HistoryService:
    def __init__(self, db: Session, assessments: AssessmentRepository, reports: CompleteReportRepository):
        self.db = db
        self.assessments = assessments
        self.reports = reports

    def assessments_history(self, owner_id: str, limit: int = 30) -> AssessmentHistoryResponse:
        user_id = _uuid(owner_id)
        if user_id is None:
            return AssessmentHistoryResponse(items=[])
        items = []
        for row in self.assessments.list_history_for_user(user_id, limit=limit):
            access = self.reports.get_access(row.id, user_id, include_input=False)
            max_runs = access.entitlement.max_successful_runs if access and access.entitlement else None
            items.append(AssessmentHistoryItem(
                assessment_id=str(row.id),
                status=row.status,
                created_at=row.created_at,
                generation_seconds=_seconds(row.generation_seconds),
                error=row.error,
                has_complete_report_access=bool(access and (access.entitlement or access.cycle or access.latest_attempt)),
                complete_report_remaining_runs=max(max_runs - access.successful_runs, 0) if max_runs is not None else 0,
                complete_report_max_runs=max_runs,
                complete_report_unlimited=bool(access and access.cycle),
                **_history_bits(row),
            ))
        return AssessmentHistoryResponse(items=items)

    def complete_reports_history(self, owner_id: str, limit: int = 30) -> CompleteReportHistoryResponse:
        user_id = _uuid(owner_id)
        if user_id is None:
            return CompleteReportHistoryResponse(items=[])
        items = []
        for row in self.reports.list_history_for_user(user_id, limit=limit):
            max_runs = row.max_successful_runs
            items.append(CompleteReportHistoryItem(
                assessment_id=str(row.assessment_id),
                attempt_id=str(row.attempt_id) if row.attempt_id else None,
                status=row.status,
                report_status=row.report_status,
                created_at=row.created_at,
                started_at=row.started_at,
                finished_at=row.finished_at,
                generation_seconds=_seconds(row.generation_seconds),
                remaining_successful_runs=max(max_runs - row.successful_runs, 0) if max_runs is not None else 0,
                max_successful_runs=max_runs,
                counts_against_limit=row.counts_against_limit,
                failure_kind=row.failure_kind,
                error=row.error,
                **_history_bits(row),
            ))
        return CompleteReportHistoryResponse(items=items)
