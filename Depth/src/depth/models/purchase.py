from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from depth.database.base import Base, utcnow


class Purchase(Base):
    """Generic payment record. Product-specific access lives in entitlement tables."""

    __tablename__ = "purchases"
    __table_args__ = (
        Index("ix_purchases_user_id_created_at", "user_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        CheckConstraint("status IN ('pending', 'paid', 'failed', 'refunded')", name="ck_purchases_status"),
        CheckConstraint("amount_cents >= 0", name="ck_purchases_amount_nonnegative"),
        CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="ck_purchases_currency"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    product_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    provider: Mapped[str | None] = mapped_column(String(50))
    provider_payment_id: Mapped[str | None] = mapped_column(String(200))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
