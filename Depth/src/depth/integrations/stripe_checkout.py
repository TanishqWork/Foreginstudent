import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

from depth.core.exceptions import PaymentError

STRIPE_API_URL = "https://api.stripe.com/v1"
WEBHOOK_TOLERANCE_SECONDS = 300


class StripeCheckoutClient:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def create_checkout_session(
        self, *, price_id: str, success_url: str, cancel_url: str,
        assessment_id: str, user_id: str, customer_email: str | None,
    ) -> str:
        data: dict[str, str] = {
            "mode": "payment",
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": "1",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": f"{user_id}:{assessment_id}",
            "metadata[product]": "complete_report",
            "metadata[assessment_id]": assessment_id,
            "metadata[user_id]": user_id,
        }
        if customer_email:
            data["customer_email"] = customer_email
        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    f"{STRIPE_API_URL}/checkout/sessions",
                    data=data,
                    auth=(self.secret_key, ""),
                )
        except httpx.HTTPError as error:
            raise PaymentError("provider_unavailable") from error
        if response.status_code >= 400:
            raise PaymentError("provider_unavailable")
        try:
            payload = response.json()
        except ValueError as error:
            raise PaymentError("provider_unavailable") from error
        url = payload.get("url")
        parsed = urlsplit(url if isinstance(url, str) else "")
        if parsed.scheme != "https" or not parsed.hostname:
            raise PaymentError("provider_unavailable")
        return url


def _signature_parts(header: str) -> tuple[int, list[str]]:
    timestamp = None
    signatures: list[str] = []
    for item in header.split(","):
        key, _, value = item.partition("=")
        if key == "t":
            try:
                timestamp = int(value)
            except ValueError as error:
                raise PaymentError("invalid_webhook") from error
        elif key == "v1":
            signatures.append(value)
    if timestamp is None or not signatures:
        raise PaymentError("invalid_webhook")
    return timestamp, signatures


def verify_webhook(payload: bytes, signature_header: str | None, secret: str) -> dict[str, Any]:
    if not signature_header:
        raise PaymentError("invalid_webhook")
    timestamp, signatures = _signature_parts(signature_header)
    if abs(time.time() - timestamp) > WEBHOOK_TOLERANCE_SECONDS:
        raise PaymentError("invalid_webhook")
    signed = str(timestamp).encode("ascii") + b"." + payload
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise PaymentError("invalid_webhook")
    try:
        event = json.loads(payload)
    except json.JSONDecodeError as error:
        raise PaymentError("invalid_webhook") from error
    if not isinstance(event, dict) or not isinstance(event.get("type"), str):
        raise PaymentError("invalid_webhook")
    return event
