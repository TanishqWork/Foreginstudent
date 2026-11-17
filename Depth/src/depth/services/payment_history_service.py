from uuid import UUID

from depth.repositories.payments import PaymentRepository
from depth.schemas.payments import PaymentHistoryItem, PaymentHistoryResponse


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


class PaymentHistoryService:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def history(self, owner_id: str, limit: int = 50) -> PaymentHistoryResponse:
        user_id = _uuid(owner_id)
        if user_id is None:
            return PaymentHistoryResponse(items=[])
        return PaymentHistoryResponse(items=[
            PaymentHistoryItem(
                purchase_id=str(row.id),
                status=row.status,
                product_type=row.product_type,
                amount_cents=row.amount_cents,
                currency=row.currency,
                provider=row.provider,
                provider_payment_id=row.provider_payment_id,
                paid_at=row.paid_at,
                created_at=row.created_at,
            )
            for row in self.repository.list_for_user(user_id, limit=limit)
        ])
