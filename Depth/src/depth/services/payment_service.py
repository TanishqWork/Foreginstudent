from urllib.parse import quote

from depth.core.config import Settings
from depth.core.exceptions import AssessmentError, PaymentError
from depth.integrations.stripe_checkout import StripeCheckoutClient, verify_webhook
from depth.schemas.payments import CheckoutSessionResponse, WebhookResponse
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.complete_report_service import COMPLETE_REPORT_STALE_SECONDS


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
    if loaded.record is not None:
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


def fulfill_stripe_webhook(
    payload: bytes, signature: str | None, reports: CompleteReportRecordService, settings: Settings,
) -> WebhookResponse:
    _, _, webhook_secret = _stripe_settings(settings)
    event = verify_webhook(payload, signature, webhook_secret)
    event_type = event["type"]
    if event_type not in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        return WebhookResponse()
    session = event.get("data", {}).get("object") if isinstance(event.get("data"), dict) else None
    if not isinstance(session, dict) or session.get("object") != "checkout.session":
        raise PaymentError("invalid_webhook")
    metadata = session.get("metadata")
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
    if loaded.record is None:
        reports.mark_paid(
            assessment_id, owner_id, provider="stripe", provider_payment_id=checkout_id,
            amount_cents=amount_total, currency=currency_code,
        )
    return WebhookResponse()
