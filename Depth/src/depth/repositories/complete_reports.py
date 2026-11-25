from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import exists, func, select, update
from sqlalchemy.orm import Session, defer

from depth.database.base import utcnow
from depth.models.assessment import Assessment
from depth.models.complete_report_attempt import CompleteReportAttempt
from depth.models.complete_report_entitlement import CompleteReportEntitlement
from depth.models.purchase import Purchase
from depth.models.user import User

COMPLETE_REPORT_PRICE_CENTS = 2900
COMPLETE_REPORT_SUCCESSFUL_RUNS = 2
CYCLE_PRODUCT = "application_cycle"


def _seconds(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


@dataclass(frozen=True)
class ReportAccess:
    assessment: Assessment
    entitlement: CompleteReportEntitlement | None
    latest_attempt: CompleteReportAttempt | None
    successful_runs: int
    cycle: CompleteReportEntitlement | None = None


@dataclass(frozen=True)
class CompleteReportHistoryRow:
    assessment_id: UUID
    max_successful_runs: int | None
    successful_runs: int
    overall_score: int | None
    assessment_band: str | None
    statement_type: str | None
    degree: str | None
    field: str | None
    target_program: str | None
    target_institution: str | None
    attempt_id: UUID | None
    status: str
    report_status: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    generation_seconds: Decimal | None
    counts_against_limit: bool
    failure_kind: str | None
    error: str | None


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

    def get_access(
        self, assessment_id: UUID, user_id: UUID, *, include_input: bool = True,
        attempt_id: UUID | None = None, for_claim: bool = False,
    ) -> ReportAccess | None:
        """Read a saved attempt and the grants available for new generations independently."""
        query = select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user_id)
        if not include_input:
            query = query.options(defer(Assessment.input, raiseload=True))
        if for_claim:
            query = query.with_for_update()
        assessment = self.db.scalar(query.execution_options(populate_existing=True))
        if assessment is None:
            return None

        attempts = select(CompleteReportAttempt).where(
            CompleteReportAttempt.assessment_id == assessment_id, CompleteReportAttempt.user_id == user_id,
        )
        if attempt_id is not None:
            attempts = attempts.where(CompleteReportAttempt.id == attempt_id)
        attempt = self.db.scalar(
            attempts.order_by(CompleteReportAttempt.created_at.desc(), CompleteReportAttempt.id.desc())
            .limit(1)
            .execution_options(populate_existing=True)
        )
        if attempt_id is not None and attempt is None:
            return None
        entitlement = self.db.scalar(
            select(CompleteReportEntitlement)
            .join(Purchase, Purchase.id == CompleteReportEntitlement.purchase_id)
            .where(
                CompleteReportEntitlement.assessment_id == assessment_id,
                CompleteReportEntitlement.user_id == user_id, Purchase.status == "paid",
            )
            .execution_options(populate_existing=True)
        )
        cycle = self.get_cycle(user_id, active_at=utcnow(), for_claim=for_claim)
        if entitlement is None:
            return ReportAccess(assessment, None, attempt, 0, cycle[0] if cycle else None)

        successful_runs = self.db.scalar(
            select(func.count())
            .select_from(CompleteReportAttempt)
            .where(
                CompleteReportAttempt.entitlement_id == entitlement.id,
                CompleteReportAttempt.status == "ready",
                CompleteReportAttempt.counts_against_limit.is_(True),
            )
        )
        return ReportAccess(assessment, entitlement, attempt, int(successful_runs or 0), cycle[0] if cycle else None)

    def get_cycle(
        self, user_id: UUID, *, active_at: datetime | None = None, for_claim: bool = False,
    ) -> tuple[CompleteReportEntitlement, Purchase] | None:
        query = (
            select(CompleteReportEntitlement, Purchase)
            .join(Purchase, Purchase.id == CompleteReportEntitlement.purchase_id)
            .where(
                CompleteReportEntitlement.user_id == user_id, Purchase.user_id == user_id,
                CompleteReportEntitlement.assessment_id.is_(None), Purchase.product_type == CYCLE_PRODUCT,
            )
        )
        if active_at is not None:
            query = query.where(
                Purchase.status == "paid", Purchase.paid_at <= active_at,
                CompleteReportEntitlement.expires_at > active_at,
            )
        if for_claim:
            query = query.with_for_update(of=Purchase)
        row = self.db.execute(query.order_by(
            CompleteReportEntitlement.expires_at.desc(), CompleteReportEntitlement.id.desc(),
        ).limit(1).execution_options(populate_existing=True)).first()
        return (row[0], row[1]) if row is not None else None

    def lock_purchaser(self, user_id: UUID) -> bool:
        return self.db.scalar(select(User.id).where(User.id == user_id).with_for_update()) is not None

    def add_cycle_payment(
        self, purchase_id: UUID, user_id: UUID, session_id: str, amount_cents: int, paid_at: datetime,
        expires_at: datetime, *, refunded: bool,
    ) -> None:
        existing = self.db.scalar(select(Purchase.id).where(
            Purchase.provider == "stripe", Purchase.provider_payment_id == session_id,
        ))
        if existing is not None:
            return
        self.db.add(Purchase(
            id=purchase_id, user_id=user_id, product_type=CYCLE_PRODUCT, status="refunded" if refunded else "paid",
            amount_cents=amount_cents, currency="USD", provider="stripe", provider_payment_id=session_id,
            paid_at=paid_at,
        ))
        self.db.flush()
        self.db.add(CompleteReportEntitlement(
            id=uuid4(), purchase_id=purchase_id, user_id=user_id, expires_at=expires_at,
        ))

    def refund_cycle_payment(self, purchase_id: UUID, user_id: UUID) -> None:
        self.db.execute(update(Purchase).where(
            Purchase.id == purchase_id, Purchase.user_id == user_id,
            Purchase.product_type == CYCLE_PRODUCT, Purchase.provider == "stripe", Purchase.status == "paid",
        ).values(status="refunded"))

    def list_history_for_user(self, user_id: UUID, limit: int = 50) -> list[CompleteReportHistoryRow]:
        counted = CompleteReportAttempt.__table__.alias("counted_attempts")
        successful_runs = (
            select(func.count())
            .select_from(counted)
            .where(
                counted.c.entitlement_id == CompleteReportEntitlement.id,
                counted.c.counts_against_limit.is_(True),
            )
            .correlate(CompleteReportEntitlement)
            .scalar_subquery()
        )
        created_at = func.coalesce(CompleteReportAttempt.created_at, CompleteReportEntitlement.created_at)
        rows = self.db.execute(
            select(
                Assessment.id.label("assessment_id"),
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
                CompleteReportAttempt.id.label("attempt_id"),
                func.coalesce(CompleteReportAttempt.status, "unlocked").label("status"),
                CompleteReportAttempt.report["report_status"].as_string().label("report_status"),
                created_at.label("created_at"),
                CompleteReportAttempt.started_at,
                CompleteReportAttempt.finished_at,
                CompleteReportAttempt.generation_seconds,
                func.coalesce(CompleteReportAttempt.counts_against_limit, False).label("counts_against_limit"),
                CompleteReportAttempt.failure_kind,
                CompleteReportAttempt.error,
            )
            .select_from(CompleteReportEntitlement)
            .outerjoin(CompleteReportAttempt, CompleteReportAttempt.entitlement_id == CompleteReportEntitlement.id)
            .join(Assessment, Assessment.id == func.coalesce(CompleteReportAttempt.assessment_id, CompleteReportEntitlement.assessment_id))
            .where(CompleteReportEntitlement.user_id == user_id, Assessment.user_id == user_id)
            .order_by(created_at.desc(), CompleteReportAttempt.id.desc(), CompleteReportEntitlement.id.desc())
            .limit(limit)
        ).mappings()
        return [CompleteReportHistoryRow(**row) for row in rows]

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
        self.db.scalar(select(Assessment.id).where(
            Assessment.id == assessment_id, Assessment.user_id == user_id,
        ).with_for_update())
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
        self.db.add(purchase)
        self.db.flush()
        self.db.add(entitlement)
        self.db.flush()
        return entitlement

    def claim_attempt(
        self,
        assessment_id: UUID,
        entitlement: CompleteReportEntitlement,
        successful_runs: int,
        *,
        model: str,
        started_at: datetime,
    ) -> CompleteReportAttempt | None:
        """Create a generating attempt when the paid entitlement still has successful runs left."""
        if entitlement.max_successful_runs is not None and successful_runs >= entitlement.max_successful_runs:
            return None
        running = self.db.scalar(
            select(CompleteReportAttempt.id)
            .where(CompleteReportAttempt.assessment_id == assessment_id, CompleteReportAttempt.status == "generating")
            .limit(1)
        )
        if running is not None:
            return None
        attempt = CompleteReportAttempt(
            id=uuid4(),
            entitlement_id=entitlement.id,
            assessment_id=assessment_id,
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
        metered = exists().where(
            CompleteReportEntitlement.id == CompleteReportAttempt.entitlement_id,
            CompleteReportEntitlement.max_successful_runs.is_not(None),
        )
        return self._finish_attempt(
            attempt_id,
            started_at,
            status="ready",
            report=report,
            error=None,
            failure_kind=None,
            counts_against_limit=counts_against_limit and metered,
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
