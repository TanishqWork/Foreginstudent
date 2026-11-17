from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from depth.models.purchase import Purchase


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Purchase]:
        return list(self.db.scalars(
            select(Purchase)
            .where(Purchase.user_id == user_id)
            .order_by(Purchase.created_at.desc(), Purchase.id.desc())
            .limit(limit)
        ))
