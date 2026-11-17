from fastapi import Request

from depth.schemas.payments import CheckoutSessionResponse, WebhookResponse
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.payment_service import create_complete_report_checkout, fulfill_stripe_webhook


def checkout(
    assessment_id: str, owner_id: str, owner_email: str | None,
    reports: CompleteReportRecordService, request: Request,
) -> CheckoutSessionResponse:
    return create_complete_report_checkout(
        assessment_id, owner_id, owner_email, reports, request.app.state.settings,
    )


async def stripe_webhook(request: Request, reports: CompleteReportRecordService) -> WebhookResponse:
    payload = await request.body()
    return fulfill_stripe_webhook(
        payload, request.headers.get("stripe-signature"), reports, request.app.state.settings,
    )
