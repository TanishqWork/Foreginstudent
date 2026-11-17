import hashlib
import hmac
import json
import time

import pytest

from complete_report_fixture import make_source
from depth.core.config import Settings
from depth.core.exceptions import AssessmentError, PaymentError
from depth.services.payment_service import create_complete_report_checkout, fulfill_stripe_webhook
from test_complete_report import ID, OWNER, MemoryReports


class FakeStripe:
    def __init__(self):
        self.calls = []

    def create_checkout_session(self, **kwargs):
        self.calls.append(kwargs)
        return "https://checkout.stripe.com/c/session-test"


def settings():
    return Settings(
        database_url="postgresql+psycopg://test:test@example.test:5432/app",
        supabase_url="https://auth.example.test",
        supabase_publishable_key="publishable",
        frontend_url="https://statementstudio.vercel.app",
        api_url="https://statementstudio.vercel.app",
        payments_mode="stripe_test",
        stripe_secret_key="sk_test_secret",
        stripe_complete_report_price_id="price_complete_report",
        stripe_webhook_secret="whsec_test_secret",
        _env_file=None,
    )


def signature(payload: bytes, secret: str = "whsec_test_secret") -> str:
    timestamp = str(int(time.time()))
    digest = hmac.new(secret.encode(), timestamp.encode() + b"." + payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def checkout_session_event(payment_status="paid"):
    return {
        "id": "evt_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "object": "checkout.session",
                "mode": "payment",
                "payment_status": payment_status,
                "amount_total": 2900,
                "currency": "usd",
                "metadata": {"product": "complete_report", "assessment_id": ID, "user_id": OWNER},
            },
        },
    }


def locked_reports():
    reports = MemoryReports()
    reports.add(make_source(ID))
    return reports


def test_checkout_creation_requires_locked_ready_assessment():
    reports = locked_reports()
    fake = FakeStripe()
    response = create_complete_report_checkout(ID, OWNER, "student@example.com", reports, settings(), fake)
    assert str(response.url) == "https://checkout.stripe.com/c/session-test"
    call = fake.calls[0]
    assert call["price_id"] == "price_complete_report"
    assert call["assessment_id"] == ID and call["user_id"] == OWNER
    assert call["customer_email"] == "student@example.com"
    assert call["success_url"].startswith("https://statementstudio.vercel.app/dashboard/complete-report")
    assert "session_id={CHECKOUT_SESSION_ID}" in call["success_url"]
    assert "checkout=cancelled" in call["cancel_url"]


def test_checkout_rejects_unavailable_or_already_unlocked_assessments():
    reports = MemoryReports()
    with pytest.raises(AssessmentError, match="not_found"):
        create_complete_report_checkout(ID, OWNER, None, reports, settings(), FakeStripe())
    reports = locked_reports()
    reports.mark_paid(ID, OWNER)
    with pytest.raises(AssessmentError, match="already_unlocked"):
        create_complete_report_checkout(ID, OWNER, None, reports, settings(), FakeStripe())


def test_stripe_webhook_unlocks_complete_report_idempotently():
    reports = locked_reports()
    payload = json.dumps(checkout_session_event()).encode()
    assert fulfill_stripe_webhook(payload, signature(payload), reports, settings()).received is True
    assert reports.load(ID, OWNER, 660).record.status == "unlocked"
    assert fulfill_stripe_webhook(payload, signature(payload), reports, settings()).received is True
    assert reports.load(ID, OWNER, 660).remaining_successful_runs == 2


def test_webhook_requires_valid_signature_and_paid_session():
    reports = locked_reports()
    payload = json.dumps(checkout_session_event()).encode()
    with pytest.raises(PaymentError, match="invalid_webhook"):
        fulfill_stripe_webhook(payload, "t=1,v1=bad", reports, settings())
    unpaid = json.dumps(checkout_session_event(payment_status="unpaid")).encode()
    assert fulfill_stripe_webhook(unpaid, signature(unpaid), reports, settings()).received is True
    assert reports.load(ID, OWNER, 660).record is None
