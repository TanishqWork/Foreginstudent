from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from depth.controllers import auth_controller, payment_controller
from depth.dependencies import get_auth_service, get_complete_report_records, get_payment_history_service
from depth.models.auth_session import AuthSession
from depth.schemas.payments import PaymentHistoryResponse, WebhookResponse
from depth.services.auth_service import AuthService
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.payment_history_service import PaymentHistoryService

router = APIRouter(prefix="/api/payments", tags=["payments"])
Reports = Annotated[CompleteReportRecordService, Depends(get_complete_report_records)]
History = Annotated[PaymentHistoryService, Depends(get_payment_history_service)]


def require_session(request: Request, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]) -> AuthSession:
    return auth_controller.require_session(request, response, service)


CurrentSession = Annotated[AuthSession, Depends(require_session)]


@router.get("/history", response_model=PaymentHistoryResponse)
def payment_history(response: Response, session: CurrentSession, history: History) -> PaymentHistoryResponse:
    response.headers["Cache-Control"] = "no-store"
    return payment_controller.history(str(session.user_id), history)


@router.post("/stripe/webhook", response_model=WebhookResponse, include_in_schema=False)
async def stripe_webhook(request: Request, reports: Reports) -> WebhookResponse:
    return await payment_controller.stripe_webhook(request, reports)
