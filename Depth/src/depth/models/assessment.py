from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class Assessment(Base):
    """One saved free AI assessment. `input` holds the student's statement, so treat rows as private."""

    __tablename__ = "assessments"
    __table_args__ = (
        # A student's assessments, newest first: the main read pattern.
        Index("ix_assessments_user_id_created_at", "user_id", "created_at", postgresql_ops={"created_at": "DESC"}),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    input: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    generation_seconds: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
