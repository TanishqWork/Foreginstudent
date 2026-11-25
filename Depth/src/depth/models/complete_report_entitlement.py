from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class CompleteReportEntitlement(Base):
    """A report allowance for one assessment or a time-limited account pass."""

    __tablename__ = "complete_report_entitlements"
    __table_args__ = (
        UniqueConstraint("assessment_id", "user_id", name="uq_complete_report_entitlements_assessment_user"),
        UniqueConstraint("purchase_id", name="uq_complete_report_entitlements_purchase"),
        Index("ix_complete_report_entitlements_user_id", "user_id"),
        CheckConstraint(
            "(assessment_id IS NOT NULL AND max_successful_runs IS NOT NULL AND max_successful_runs > 0 AND expires_at IS NULL) "
            "OR (assessment_id IS NULL AND max_successful_runs IS NULL AND expires_at IS NOT NULL)",
            name="ck_complete_report_entitlements_scope",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    purchase_id: Mapped[UUID] = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    assessment_id: Mapped[UUID | None] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    max_successful_runs: Mapped[int | None] = mapped_column()
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
