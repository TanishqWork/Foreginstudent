from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class CompleteReport(Base):
    """The complete report for one assessment. No row means locked.

    unlocked -> generating -> ready | failed; failed (and an incomplete ready report) can generate again.
    """

    __tablename__ = "complete_reports"
    __table_args__ = (
        Index("ix_complete_reports_user_id", "user_id"),
        CheckConstraint("status IN ('unlocked', 'generating', 'ready', 'failed')", name="ck_complete_reports_status"),
        CheckConstraint("status <> 'ready' OR report IS NOT NULL", name="ck_complete_reports_ready_has_report"),
        CheckConstraint("status <> 'generating' OR started_at IS NOT NULL", name="ck_complete_reports_generating_started"),
    )

    assessment_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    # none_as_null: a cleared report is SQL NULL, so the ready-has-report check stays meaningful.
    report: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True))
    error: Mapped[str | None] = mapped_column(String(300))
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation_seconds: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
