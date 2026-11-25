from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class CheckoutSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl


class CycleCheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: UUID


class CycleAccessResponse(BaseModel):
    status: Literal["none", "active", "expired", "refunded"]
    paid_at: datetime | None = None
    expires_at: datetime | None = None
    expires_soon: bool = False
    checkout_amount_cents: int | None = None


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
