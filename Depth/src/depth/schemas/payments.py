from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class CheckoutSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl


class WebhookResponse(BaseModel):
    received: bool = True


class PaymentHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purchase_id: str
    status: str
    product_type: str
    amount_cents: int = Field(ge=0)
    currency: str
    provider: str | None
    provider_payment_id: str | None
    paid_at: datetime | None
    created_at: datetime


class PaymentHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PaymentHistoryItem]
