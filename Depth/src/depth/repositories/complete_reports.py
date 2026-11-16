from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, defer

from depth.database.base import utcnow
from depth.models.assessment import Assessment
from depth.models.complete_report_attempt import CompleteReportAttempt
from depth.models.complete_report_entitlement import CompleteReportEntitlement
from depth.models.purchase import Purchase

COMPLETE_REPORT_PRICE_CENTS = 2900
COMPLETE_REPORT_SUCCESSFUL_RUNS = 2


def _seconds(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


@dataclass(frozen=True)
class ReportAccess:
    assessment: Assessment
    entitlement: CompleteReportEntitlement | None
    latest_attempt: CompleteReportAttempt | None
    successful_runs: int


@dataclass(frozen=True)
class CompleteReportHistoryAttemptRow:
    id: UUID
    status: str
    report_status: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    generation_seconds: Decimal | None
    counts_against_limit: bool
    failure_kind: str | None
    error: str | None


@dataclass(frozen=True)
class CompleteReportHistoryAccess:
    assessment_id: UUID
    entitlement_id: UUID
    entitlement_created_at: datetime
    max_successful_runs: int
    successful_runs: int
    overall_score: int | None
    assessment_band: str | None
    statement_type: str | None
    degree: str | None
    field: str | None
    target_program: str | None
    target_institution: str | None
    attempts: list[CompleteReportHistoryAttemptRow]


def _assessment_report_text(key: str):
    return Assessment.result["report"][key].as_string()


def _assessment_report_int(key: str):
    return Assessment.result["report"][key].as_integer()


def _assessment_context_text(key: str):
    return Assessment.result["context"][key].as_string()


def _assessment_input_text(key: str):
    return Assessment.input[key].as_string()


class CompleteReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_access(self, assessment_id: UUID, user_id: UUID, *, include_input: bool = True) -> ReportAccess | None:
        """The owner's assessment, paid entitlement if any, latest attempt, and successful usage count."""
        query = select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user_id)
        if not include_input:
            query = query.options(defer(Assessment.input, raiseload=True))
        assessment = self.db.scalar(query.execution_options(populate_existing=True))
        if assessment is None:
            return None

        entitlement = self.db.scalar(
            select(CompleteReportEntitlement)
            .where(CompleteReportEntitlement.assessment_id == assessment_id, CompleteReportEntitlement.user_id == user_id)
            .execution_options(populate_existing=True)
        )
        if entitlement is None:
            return ReportAccess(assessment, None, None, 0)

        latest_attempt = self.db.scalar(
            select(CompleteReportAttempt)
            .where(CompleteReportAttempt.entitlement_id == entitlement.id)
            .order_by(CompleteReportAttempt.created_at.desc(), CompleteReportAttempt.id.desc())
            .limit(1)
            .execution_options(populate_existing=True)
        )
        successful_runs = self.db.scalar(
            select(func.count())
            .select_from(CompleteReportAttempt)
            .where(
                CompleteReportAttempt.entitlement_id == entitlement.id,
                CompleteReportAttempt.status == "ready",
                CompleteReportAttempt.counts_against_limit.is_(True),
            )
        )
        return ReportAccess(assessment, entitlement, latest_attempt, int(successful_runs or 0))

    def list_access_for_user(self, user_id: UUID, limit: int = 50) -> list[ReportAccess]:
        entitlements = list(self.db.scalars(
            select(CompleteReportEntitlement)
            .where(CompleteReportEntitlement.user_id == user_id)
            .order_by(CompleteReportEntitlement.created_at.desc())
            .limit(limit)
        ))
        access: list[ReportAccess] = []
        for entitlement in entitlements:
            found = self.get_access(entitlement.assessment_id, user_id, include_input=False)
            if found is not None and found.entitlement is not None:
                access.append(found)
        return access

    def list_history_for_user(self, user_id: UUID, limit: int = 50) -> list[CompleteReportHistoryAccess]:
        successful_runs = (
            select(func.count())
            .select_from(CompleteReportAttempt)
            .where(
                CompleteReportAttempt.entitlement_id == CompleteReportEntitlement.id,
                CompleteReportAttempt.status == "ready",
                CompleteReportAttempt.counts_against_limit.is_(True),
            )
            .correlate(CompleteReportEntitlement)
            .scalar_subquery()
        )
        access_rows = self.db.execute(
            select(
                CompleteReportEntitlement.assessment_id,
                CompleteReportEntitlement.id,
                CompleteReportEntitlement.created_at,
                CompleteReportEntitlement.max_successful_runs,
                successful_runs.label("successful_runs"),
                _assessment_report_int("overall_score").label("overall_score"),
                _assessment_report_text("assessment_band").label("assessment_band"),
                func.coalesce(
                    _assessment_report_text("statement_type"),
                    _assessment_context_text("statement_type"),
                    _assessment_input_text("statement_type"),
                ).label("statement_type"),
                func.coalesce(_assessment_context_text("degree"), _assessment_input_text("degree")).label("degree"),
                func.coalesce(_assessment_context_text("field"), _assessment_input_text("field")).label("field"),
                func.coalesce(_assessment_context_text("target_program"), _assessment_input_text("target_program")).label("target_program"),
                func.coalesce(_assessment_context_text("target_institution"), _assessment_input_text("target_institution")).label("target_institution"),
            )
            .join(Assessment, Assessment.id == CompleteReportEntitlement.assessment_id)
            .where(CompleteReportEntitlement.user_id == user_id, Assessment.user_id == user_id)
            .order_by(CompleteReportEntitlement.created_at.desc())
            .limit(limit)
        )
        access: list[CompleteReportHistoryAccess] = []
        for row in access_rows:
            attempt_rows = self.db.execute(
                select(
                    CompleteReportAttempt.id,
                    CompleteReportAttempt.status,
                    CompleteReportAttempt.report["report_status"].as_string().label("report_status"),
                    CompleteReportAttempt.created_at,
                    CompleteReportAttempt.started_at,
                    CompleteReportAttempt.finished_at,
                    CompleteReportAttempt.generation_seconds,
                    CompleteReportAttempt.counts_against_limit,
                    CompleteReportAttempt.failure_kind,
                    CompleteReportAttempt.error,
                )
                .where(CompleteReportAttempt.entitlement_id == row.id)
                .order_by(CompleteReportAttempt.created_at.desc(), CompleteReportAttempt.id.desc())
                .limit(limit)
            )
            attempts = [CompleteReportHistoryAttemptRow(*attempt) for attempt in attempt_rows]
            access.append(CompleteReportHistoryAccess(
                assessment_id=row.assessment_id,
                entitlement_id=row.id,
                entitlement_created_at=row.created_at,
                max_successful_runs=row.max_successful_runs,
                successful_runs=int(row.successful_runs or 0),
                overall_score=row.overall_score,
                assessment_band=row.assessment_band,
                statement_type=row.statement_type,
                degree=row.degree,
                field=row.field,
                target_program=row.target_program,
                target_institution=row.target_institution,
                attempts=attempts,
            ))
        return access

    def add_paid_entitlement(
        self,
        assessment_id: UUID,
        user_id: UUID,
        *,
        provider: str = "mock",
        provider_payment_id: str | None = None,
        amount_cents: int = COMPLETE_REPORT_PRICE_CENTS,
        currency: str = "USD",
        max_successful_runs: int = COMPLETE_REPORT_SUCCESSFUL_RUNS,
    ) -> CompleteReportEntitlement:
        """Create the paid purchase and entitlement, or return the existing entitlement."""
        existing = self.db.scalar(
            select(CompleteReportEntitlement)
            .where(CompleteReportEntitlement.assessment_id == assessment_id, CompleteReportEntitlement.user_id == user_id)
        )
        if existing is not None:
            return existing

        now = utcnow()
        purchase = Purchase(
            id=uuid4(),
            user_id=user_id,
            status="paid",
            product_type="complete_report",
            amount_cents=amount_cents,
            currency=currency,
            provider=provider,
            provider_payment_id=provider_payment_id,
            paid_at=now,
            created_at=now,
            updated_at=now,
        )
        entitlement = CompleteReportEntitlement(
            id=uuid4(),
            purchase_id=purchase.id,
            assessment_id=assessment_id,
            user_id=user_id,
            max_successful_runs=max_successful_runs,
            created_at=now,
            updated_at=now,
        )
        self.db.add_all([purchase, entitlement])
        self.db.flush()
        return entitlement

    def claim_attempt(
        self,
        entitlement: CompleteReportEntitlement,
        successful_runs: int,
        *,
        model: str,
        started_at: datetime,
    ) -> CompleteReportAttempt | None:
        """Create a generating attempt when the paid entitlement still has successful runs left."""
        if successful_runs >= entitlement.max_successful_runs:
            return None
        running = self.db.scalar(
            select(CompleteReportAttempt.id)
            .where(CompleteReportAttempt.entitlement_id == entitlement.id, CompleteReportAttempt.status == "generating")
            .limit(1)
        )
        if running is not None:
            return None
        attempt = CompleteReportAttempt(
            id=uuid4(),
            entitlement_id=entitlement.id,
            assessment_id=entitlement.assessment_id,
            user_id=entitlement.user_id,
            status="generating",
            report=None,
            error=None,
            failure_kind=None,
            counts_against_limit=False,
            model=model,
            started_at=started_at,
            finished_at=None,
            generation_seconds=None,
            created_at=started_at,
        )
        self.db.add(attempt)
        self.db.flush()
        return attempt

    def _finish_attempt(self, attempt_id: UUID, started_at: datetime, **values: Any) -> bool:
        # Matching started_at means an old background job cannot overwrite a newer retry.
        outcome = self.db.execute(
            update(CompleteReportAttempt)
            .where(
                CompleteReportAttempt.id == attempt_id,
                CompleteReportAttempt.status == "generating",
                CompleteReportAttempt.started_at == started_at,
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        return outcome.rowcount == 1

    def mark_ready(
        self,
        attempt_id: UUID,
        started_at: datetime,
        report: dict[str, Any],
        generation_seconds: float,
        counts_against_limit: bool,
    ) -> bool:
        return self._finish_attempt(
            attempt_id,
            started_at,
            status="ready",
            report=report,
            error=None,
            failure_kind=None,
            counts_against_limit=counts_against_limit,
            finished_at=utcnow(),
            generation_seconds=_seconds(generation_seconds),
        )

    def mark_failed(
        self,
        attempt_id: UUID,
        started_at: datetime,
        error: str,
        generation_seconds: float | None,
        failure_kind: str,
    ) -> bool:
        return self._finish_attempt(
            attempt_id,
            started_at,
            status="failed",
            report=None,
            error=error,
            failure_kind=failure_kind,
            counts_against_limit=False,
            finished_at=utcnow(),
            generation_seconds=_seconds(generation_seconds),
        )
