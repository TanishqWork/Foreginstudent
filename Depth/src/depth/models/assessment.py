from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class Assessment(Base):
    """One free AI assessment. `input` holds the student's statement, so treat rows as private.

    Created as `generating` with no result; becomes `ready` (with result) or `failed`.
    """

    __tablename__ = "assessments"
    __table_args__ = (
        # A student's assessments, newest first: the main read pattern.
        Index("ix_assessments_user_id_created_at", "user_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        CheckConstraint("status IN ('generating', 'ready', 'failed')", name="ck_assessments_status"),
        CheckConstraint("status <> 'ready' OR result IS NOT NULL", name="ck_assessments_ready_has_result"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="generating")
    input: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # none_as_null: an empty result is SQL NULL, so the ready-has-result check stays meaningful.
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True))
    error: Mapped[str | None] = mapped_column(String(300))
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    generation_seconds: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
