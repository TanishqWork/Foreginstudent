import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from complete_report_fixture import example_complete_report, make_source
from depth.core.config import Settings
from depth.core.exceptions import AssessmentError, PaymentError
from depth.repositories.assessments import AssessmentRepository
from depth.repositories.complete_reports import CompleteReportRepository
from depth.services import complete_report_record_service, payment_service
from depth.services.assessment_record_service import AssessmentRecordService
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


class CycleStripe(FakeStripe):
    def get_checkout_session(self, session_id):
        assert session_id == self.session["id"]
        return self.session

    def paid_event(self, paid_at, amount, session_id):
        order = self.calls[-1]
        metadata = {field: order[field] for field in ("product", "user_id", "purchase_id")}
        self.session = {
            "id": session_id, "object": "checkout.session", "mode": "payment", "livemode": False,
            "payment_status": "paid", "amount_total": amount, "currency": "usd", "metadata": metadata,
            "client_reference_id": f"{order['user_id']}:{order['purchase_id']}",
            "line_items": {"data": [{"quantity": 1, "price": {"id": order["price_id"]}}], "has_more": False},
            "payment_intent": {"latest_charge": {"refunded": False}},
        }
        return {
            "type": "checkout.session.completed", "created": int(paid_at.timestamp()),
            "data": {"object": {**self.session}},
        }


def deliver(client, event):
    payload = json.dumps(event).encode()
    return client.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": signature(payload)})


def test_cycle_checkout_expiry_and_renewal_preserve_paid_credits_and_reports(auth_context, monkeypatch):
    client = auth_context.client
    configured = settings()
    auth_context.app.state.settings = auth_context.app.state.settings.model_copy(update={
        "payments_mode": configured.payments_mode, "stripe_secret_key": configured.stripe_secret_key,
        "stripe_complete_report_price_id": configured.stripe_complete_report_price_id,
        "stripe_webhook_secret": configured.stripe_webhook_secret,
    })
    stripe = CycleStripe()
    monkeypatch.setattr(payment_service, "StripeCheckoutClient", lambda _: stripe)
    paid_at = datetime(2028, 2, 29, 10, tzinfo=timezone.utc)
    expires_at = datetime(2029, 2, 28, 10, tzinfo=timezone.utc)
    now = [paid_at]
    monkeypatch.setattr(complete_report_record_service, "utcnow", lambda: now[0])
    monkeypatch.setattr("depth.repositories.complete_reports.utcnow", lambda: now[0])

    assert client.get("/api/payments/cycle").status_code == 401
    owner = auth_context.sign_in().json()["user"]["id"]
    order = {"request_id": str(uuid4())}
    assert client.post("/api/payments/cycle/checkout", json=order, headers={"Origin": "https://other.example"}).status_code == 403
    assert client.get("/api/payments/cycle").json()["checkout_amount_cents"] == 2900
    for _ in range(2):
        assert client.post("/api/payments/cycle/checkout", json=order).status_code == 200
    assert stripe.calls[-1] == stripe.calls[-2]
    assert stripe.calls[-1]["price_id"] == "price_complete_report"
    assert stripe.calls[-1]["product"] == "application_cycle"
    assert client.get("/api/payments/history").json()["items"] == []

    event = stripe.paid_event(paid_at, 2900, "cs_test_cycleA")
    unpaid = {**event, "data": {"object": {**event["data"]["object"], "payment_status": "unpaid"}}}
    assert deliver(client, unpaid).status_code == 200
    assert client.get("/api/payments/cycle").json()["status"] == "none"
    assert deliver(client, event).status_code == 200
    assert deliver(client, {**event, "created": event["created"] + 10}).status_code == 200
    access = client.get("/api/payments/cycle").json()
    assert access["status"] == "active" and not access["expires_soon"]
    assert datetime.fromisoformat(access["expires_at"]) == expires_at
    payments = client.get("/api/payments/history").json()["items"]
    assert [(row["product_type"], row["amount_cents"], row["status"]) for row in payments] == [("application_cycle", 2900, "paid")]
    assert client.post("/api/payments/cycle/checkout", json=order).status_code == 409

    first, second = make_source(str(uuid4())), make_source(str(uuid4()))
    first_id, second_id = first.assessment.report.assessment_id, second.assessment.report.assessment_id
    with auth_context.session_factory() as db:
        free = AssessmentRecordService(db, AssessmentRepository(db))
        reports = complete_report_record_service.CompleteReportRecordService(db, CompleteReportRepository(db))
        for source in (first, second):
            assessment_id = source.assessment.report.assessment_id
            free.create_pending(owner, assessment_id, source.original_input, "gpt-5")
            assert free.mark_ready(assessment_id, source.assessment, 1.0)
        reports.mark_paid(first_id, owner)
        assert client.post(f"/api/assessments/{second_id}/complete/purchase").status_code == 503
        for _ in range(3):
            attempt_id, started_at = reports.claim(first_id, owner, "gpt-5")
            assert reports.finish(attempt_id, started_at, example_complete_report(first), 1.0)
        assert reports.load(first_id, owner, 660).remaining_successful_runs == 2

        now[0] = expires_at - timedelta(days=7)
        assert client.get("/api/payments/cycle").json()["expires_soon"] is True
        now[0] = expires_at - timedelta(seconds=1)
        saved_attempt, started_at = reports.claim(second_id, owner, "gpt-5")
        now[0] = expires_at
        assert reports.finish(saved_attempt, started_at, example_complete_report(second), 1.0)

    assert client.get("/api/payments/cycle").json()["status"] == "expired"
    state = client.get(f"/api/assessments/{second_id}/complete", params={"attempt_id": saved_attempt}).json()
    assert state["status"] == "ready" and not state["can_generate"]
    assert client.post(f"/api/assessments/{second_id}/complete").status_code == 403
    assert client.get(f"/api/assessments/{first_id}/complete").json()["can_generate"] is True
    assert client.get(f"/api/assessments/{first_id}/complete", params={"attempt_id": saved_attempt}).status_code == 404
    attempts = client.get("/api/assessments/complete/history").json()["items"]
    assert any(row["attempt_id"] == saved_attempt and row["max_successful_runs"] is None for row in attempts)

    # The real one-time $99 Price ID uses the same checkout, grant and expiry flow.
    auth_context.app.state.settings.stripe_cycle_price_id = "price_cycle"
    assert client.post("/api/payments/cycle/checkout", json={"request_id": str(uuid4())}).status_code == 200
    assert stripe.calls[-1]["price_id"] == "price_cycle"
    renewal = stripe.paid_event(now[0], 9900, "cs_test_cycleB")
    assert deliver(client, renewal).status_code == 200
    assert client.get("/api/payments/cycle").json()["status"] == "active"
    refund = {"type": "charge.refunded", "data": {"object": {
        "object": "charge", "livemode": False, "refunded": True, "metadata": stripe.session["metadata"],
    }}}
    assert deliver(client, refund).status_code == 200
    assert deliver(client, renewal).status_code == 200
    assert client.get("/api/payments/cycle").json()["status"] == "refunded"
    assert client.get(f"/api/assessments/{second_id}/complete", params={"attempt_id": saved_attempt}).json()["status"] == "ready"
