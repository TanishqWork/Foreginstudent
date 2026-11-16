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
            remaining = 0
            if access is not None and access.entitlement is not None:
                remaining = max(access.entitlement.max_successful_runs - access.successful_runs, 0)
            items.append(AssessmentHistoryItem(
                assessment_id=str(row.id),
                status=row.status,
                created_at=row.created_at,
                generation_seconds=_seconds(row.generation_seconds),
                error=row.error,
                has_complete_report_access=bool(access and access.entitlement),
                complete_report_remaining_runs=remaining,
                complete_report_max_runs=None if access is None or access.entitlement is None else access.entitlement.max_successful_runs,
                **_history_bits(row),
            ))
        return AssessmentHistoryResponse(items=items)

    def complete_reports_history(self, owner_id: str, limit: int = 30) -> CompleteReportHistoryResponse:
        user_id = _uuid(owner_id)
        if user_id is None:
            return CompleteReportHistoryResponse(items=[])
        items = []
        for access in self.reports.list_history_for_user(user_id, limit=limit):
            remaining = max(access.max_successful_runs - access.successful_runs, 0)
            if not access.attempts:
                items.append(CompleteReportHistoryItem(
                    assessment_id=str(access.assessment_id),
                    attempt_id=None,
                    status="unlocked",
                    report_status=None,
                    created_at=access.entitlement_created_at,
                    started_at=None,
                    finished_at=None,
                    generation_seconds=None,
                    remaining_successful_runs=remaining,
                    max_successful_runs=access.max_successful_runs,
                    counts_against_limit=False,
                    failure_kind=None,
                    error=None,
                    **_history_bits(access),
                ))
                continue
            for row in access.attempts:
                items.append(CompleteReportHistoryItem(
                    assessment_id=str(access.assessment_id),
                    attempt_id=str(row.id),
                    status=row.status,
                    report_status=row.report_status,
                    created_at=row.created_at,
                    started_at=row.started_at,
                    finished_at=row.finished_at,
                    generation_seconds=_seconds(row.generation_seconds),
                    remaining_successful_runs=remaining,
                    max_successful_runs=access.max_successful_runs,
                    counts_against_limit=row.counts_against_limit,
                    failure_kind=row.failure_kind,
                    error=row.error,
                    **_history_bits(access),
                ))
        items.sort(key=lambda item: item.created_at, reverse=True)
        return CompleteReportHistoryResponse(items=items[:limit])
