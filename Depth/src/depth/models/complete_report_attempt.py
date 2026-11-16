from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class CompleteReportAttempt(Base):
    """One complete-report generation try. Failed tries do not consume paid access."""

    __tablename__ = "complete_report_attempts"
    __table_args__ = (
        Index("ix_complete_report_attempts_entitlement_created_at", "entitlement_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        Index("ix_complete_report_attempts_assessment_created_at", "assessment_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        Index("ix_complete_report_attempts_user_created_at", "user_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        Index(
            "uq_complete_report_attempts_generating_entitlement",
            "entitlement_id",
            unique=True,
            postgresql_where=text("status = 'generating'"),
        ),
        CheckConstraint("status IN ('generating', 'ready', 'failed')", name="ck_complete_report_attempts_status"),
        CheckConstraint("status <> 'ready' OR report IS NOT NULL", name="ck_complete_report_attempts_ready_has_report"),
        CheckConstraint("status <> 'failed' OR error IS NOT NULL", name="ck_complete_report_attempts_failed_has_error"),
        CheckConstraint("counts_against_limit = false OR status = 'ready'", name="ck_complete_report_attempts_counted_ready"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    entitlement_id: Mapped[UUID] = mapped_column(ForeignKey("complete_report_entitlements.id", ondelete="CASCADE"), nullable=False)
    assessment_id: Mapped[UUID] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    # none_as_null: failed/generating attempts should not store a JSON null payload.
    report: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True))
    error: Mapped[str | None] = mapped_column(String(300))
    failure_kind: Mapped[str | None] = mapped_column(String(50))
    counts_against_limit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation_seconds: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
