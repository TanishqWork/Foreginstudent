from uuid import UUID

from fastapi import Request
from starlette.concurrency import run_in_threadpool

from depth.schemas.payments import CheckoutSessionResponse, CycleAccessResponse, PaymentHistoryResponse, WebhookResponse
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.payment_history_service import PaymentHistoryService
from depth.services import payment_service


def checkout(
    assessment_id: str, owner_id: str, owner_email: str | None,
    reports: CompleteReportRecordService, request: Request,
) -> CheckoutSessionResponse:
    return payment_service.create_complete_report_checkout(
        assessment_id, owner_id, owner_email, reports, request.app.state.settings,
    )


def cycle_checkout(
    request_id: UUID, owner_id: UUID, owner_email: str | None,
    reports: CompleteReportRecordService, request: Request,
) -> CheckoutSessionResponse:
    return payment_service.create_cycle_checkout(request_id, owner_id, owner_email, reports, request.app.state.settings)


def cycle_access(owner_id: UUID, reports: CompleteReportRecordService, request: Request) -> CycleAccessResponse:
    return payment_service.cycle_access(owner_id, reports, request.app.state.settings)


async def stripe_webhook(request: Request, reports: CompleteReportRecordService) -> WebhookResponse:
    payload = await request.body()
    return await run_in_threadpool(
        payment_service.fulfill_stripe_webhook, payload, request.headers.get("stripe-signature"), reports, request.app.state.settings,
    )


def history(owner_id: str, service: PaymentHistoryService) -> PaymentHistoryResponse:
    return service.history(owner_id)
