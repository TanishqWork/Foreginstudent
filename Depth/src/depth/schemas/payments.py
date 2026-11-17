from pydantic import BaseModel, ConfigDict, HttpUrl


class CheckoutSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl


class WebhookResponse(BaseModel):
    received: bool = True
