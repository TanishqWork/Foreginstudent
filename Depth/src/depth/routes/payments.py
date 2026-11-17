from typing import Annotated

from fastapi import APIRouter, Depends, Request

from depth.controllers import payment_controller
from depth.dependencies import get_complete_report_records
from depth.schemas.payments import WebhookResponse
from depth.services.complete_report_record_service import CompleteReportRecordService

router = APIRouter(prefix="/api/payments", tags=["payments"])
Reports = Annotated[CompleteReportRecordService, Depends(get_complete_report_records)]


@router.post("/stripe/webhook", response_model=WebhookResponse, include_in_schema=False)
async def stripe_webhook(request: Request, reports: Reports) -> WebhookResponse:
    return await payment_controller.stripe_webhook(request, reports)
