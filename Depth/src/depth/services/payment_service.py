from datetime import datetime, timezone
from urllib.parse import quote
from uuid import NAMESPACE_URL, UUID, uuid5

from depth.core.config import Settings
from depth.core.exceptions import AssessmentError, PaymentError
from depth.integrations.stripe_checkout import StripeCheckoutClient, verify_webhook
from depth.repositories.complete_reports import COMPLETE_REPORT_PRICE_CENTS, CYCLE_PRODUCT
from depth.schemas.payments import CheckoutSessionResponse, CycleAccessResponse, WebhookResponse
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.complete_report_service import COMPLETE_REPORT_STALE_SECONDS

CYCLE_PRICE_CENTS = 9900


def _stripe_settings(settings: Settings) -> tuple[str, str, str]:
    if settings.payments_mode != "stripe_test":
        raise PaymentError("not_configured")
    secret = settings.stripe_secret_key.get_secret_value() if settings.stripe_secret_key else ""
    price_id = settings.stripe_complete_report_price_id or ""
    webhook_secret = settings.stripe_webhook_secret.get_secret_value() if settings.stripe_webhook_secret else ""
    if not secret.startswith("sk_test_") or not price_id.startswith("price_") or not webhook_secret.startswith("whsec_"):
        raise PaymentError("not_configured")
    return secret, price_id, webhook_secret


def create_complete_report_checkout(
    assessment_id: str, owner_id: str, owner_email: str | None,
    reports: CompleteReportRecordService, settings: Settings,
    stripe: StripeCheckoutClient | None = None,
) -> CheckoutSessionResponse:
    secret, price_id, _ = _stripe_settings(settings)
    loaded = reports.load(assessment_id, owner_id, COMPLETE_REPORT_STALE_SECONDS)
    if loaded is None:
        raise AssessmentError("not_found")
    if loaded.source.assessment.report.status == "needs_input" or loaded.source.assessment.report.overall_score is None:
        raise AssessmentError("needs_input")
    if loaded.max_successful_runs is not None or loaded.cycle_expires_at is not None:
        raise AssessmentError("already_unlocked")
    encoded = quote(assessment_id, safe="")
    success_url = (
        f"{settings.frontend_url}/dashboard/complete-report?assessment={encoded}"
        "&checkout=success&session_id={CHECKOUT_SESSION_ID}"
    )
    cancel_url = f"{settings.frontend_url}/dashboard/complete-report?assessment={encoded}&checkout=cancelled"
    stripe = stripe or StripeCheckoutClient(secret)
    url = stripe.create_checkout_session(
        price_id=price_id, success_url=success_url, cancel_url=cancel_url,
        assessment_id=assessment_id, user_id=owner_id, customer_email=owner_email,
    )
    return CheckoutSessionResponse(url=url)


def _cycle_price(settings: Settings) -> tuple[str, int]:
    _, complete_price, _ = _stripe_settings(settings)
    cycle_price = settings.stripe_cycle_price_id or complete_price
    if not cycle_price.startswith("price_"):
        raise PaymentError("not_configured")
    amount = COMPLETE_REPORT_PRICE_CENTS if cycle_price == complete_price else CYCLE_PRICE_CENTS
    return cycle_price, amount


def cycle_access(owner_id: UUID, reports: CompleteReportRecordService, settings: Settings) -> CycleAccessResponse:
    try:
        _, amount = _cycle_price(settings)
    except PaymentError:
        amount = None
    return reports.cycle_access(owner_id, checkout_amount_cents=amount)


def create_cycle_checkout(
    request_id: UUID, owner_id: UUID, owner_email: str | None,
    reports: CompleteReportRecordService, settings: Settings, stripe: StripeCheckoutClient | None = None,
) -> CheckoutSessionResponse:
    secret, _, _ = _stripe_settings(settings)
    price_id, _ = _cycle_price(settings)
    if reports.cycle_access(owner_id).status == "active":
        raise PaymentError("cycle_active")
    purchase_id = uuid5(NAMESPACE_URL, f"{CYCLE_PRODUCT}/{owner_id}/{request_id}")
    return CheckoutSessionResponse(url=(stripe or StripeCheckoutClient(secret)).create_checkout_session(
        price_id=price_id, user_id=str(owner_id), customer_email=owner_email,
        product=CYCLE_PRODUCT, purchase_id=str(purchase_id),
        success_url=f"{settings.frontend_url}/dashboard/payments?cycle=success",
        cancel_url=f"{settings.frontend_url}/dashboard/payments?cycle=cancelled",
    ))


def _cycle_ids(metadata: dict) -> tuple[UUID, UUID]:
    try:
        return UUID(metadata["purchase_id"]), UUID(metadata["user_id"])
    except (KeyError, TypeError, ValueError, AttributeError):
        raise PaymentError("invalid_webhook") from None


def _fulfill_cycle(
    event: dict, session: dict, metadata: dict,
    reports: CompleteReportRecordService, settings: Settings, stripe: StripeCheckoutClient,
) -> None:
    if session.get("payment_status") != "paid":
        return
    session_id = session.get("id")
    timestamp = event.get("created")
    if not isinstance(session_id, str) or type(timestamp) is not int or timestamp <= 0:
        raise PaymentError("invalid_webhook")
    try:
        paid_at = datetime.fromtimestamp(timestamp, timezone.utc)
    except (ValueError, OverflowError, OSError):
        raise PaymentError("invalid_webhook") from None
    purchase_id, owner_id = _cycle_ids(metadata)
    cycle_price, cycle_amount = _cycle_price(settings)
    # Serialize with refunds, including when Stripe delivers a refund ahead of the paid event.
    reports.lock_purchaser(owner_id)
    verified = stripe.get_checkout_session(session_id)
    line_items = verified.get("line_items") or {}
    items = line_items.get("data") or []
    line = items[0] if len(items) == 1 else {}
    price_id = (line.get("price") or {}).get("id")
    # Already-open test sessions can still settle after the sandbox price is switched.
    allowed_prices = {settings.stripe_complete_report_price_id: COMPLETE_REPORT_PRICE_CENTS, cycle_price: cycle_amount}
    expected_amount = allowed_prices.get(price_id)
    if (
        expected_amount is None or verified.get("id") != session_id or verified.get("livemode") is not False
        or verified.get("mode") != "payment" or verified.get("payment_status") != "paid"
        or verified.get("amount_total") != expected_amount or verified.get("currency") != "usd"
        or verified.get("metadata") != metadata or verified.get("client_reference_id") != f"{owner_id}:{purchase_id}"
        or line.get("quantity") != 1 or line_items.get("has_more")
    ):
        raise PaymentError("invalid_webhook")
    charge = (verified.get("payment_intent") or {}).get("latest_charge") or {}
    reports.record_cycle_payment(purchase_id, owner_id, session_id, expected_amount, paid_at, refunded=charge.get("refunded") is True)


def fulfill_stripe_webhook(
    payload: bytes, signature: str | None, reports: CompleteReportRecordService, settings: Settings,
    stripe: StripeCheckoutClient | None = None,
) -> WebhookResponse:
    secret, _, webhook_secret = _stripe_settings(settings)
    event = verify_webhook(payload, signature, webhook_secret)
    event_type = event["type"]
    if event_type not in {"checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"}:
        return WebhookResponse()
    session = event.get("data", {}).get("object") if isinstance(event.get("data"), dict) else None
    if event_type == "charge.refunded":
        if isinstance(session, dict) and session.get("object") == "charge" and session.get("livemode") is False and session.get("refunded") is True:
            metadata = session.get("metadata")
            if isinstance(metadata, dict) and metadata.get("product") == CYCLE_PRODUCT:
                reports.refund_cycle_payment(*_cycle_ids(metadata))
        return WebhookResponse()
    if not isinstance(session, dict) or session.get("object") != "checkout.session":
        raise PaymentError("invalid_webhook")
    metadata = session.get("metadata")
    if isinstance(metadata, dict) and metadata.get("product") == CYCLE_PRODUCT:
        _fulfill_cycle(event, session, metadata, reports, settings, stripe or StripeCheckoutClient(secret))
        return WebhookResponse()
    if not isinstance(metadata, dict) or metadata.get("product") != "complete_report":
        return WebhookResponse()
    if session.get("mode") != "payment":
        return WebhookResponse()
    payment_status = session.get("payment_status")
    if payment_status not in {"paid", "no_payment_required"}:
        return WebhookResponse()
    assessment_id = metadata.get("assessment_id")
    owner_id = metadata.get("user_id")
    checkout_id = session.get("id")
    amount_total = session.get("amount_total")
    currency = session.get("currency")
    if not all(isinstance(value, str) and value for value in (assessment_id, owner_id, checkout_id)):
        raise PaymentError("invalid_webhook")
    if not isinstance(amount_total, int) or amount_total < 0:
        amount_total = 2900
    currency_code = currency.upper() if isinstance(currency, str) and len(currency) == 3 else "USD"
    loaded = reports.load(assessment_id, owner_id, COMPLETE_REPORT_STALE_SECONDS)
    if loaded is None:
        raise PaymentError("invalid_webhook")
    if loaded.source.assessment.report.status == "needs_input" or loaded.source.assessment.report.overall_score is None:
        raise PaymentError("invalid_webhook")
    if loaded.max_successful_runs is None:
        reports.mark_paid(
            assessment_id, owner_id, provider="stripe", provider_payment_id=checkout_id,
            amount_cents=amount_total, currency=currency_code,
        )
    return WebhookResponse()
