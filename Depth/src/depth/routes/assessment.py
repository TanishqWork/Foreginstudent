import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from depth.controllers import assessment_controller, auth_controller, complete_report_controller, payment_controller
from depth.core.exceptions import PaymentError
from depth.dependencies import (
    get_assessment_record_factory, get_assessment_records, get_auth_service, get_background_tasks,
    get_complete_report_record_factory, get_complete_report_records, get_history_service,
)
from depth.models.auth_session import AuthSession
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.free_assessment import FreeAssessmentState
from depth.schemas.complete_report import CompleteReportState
from depth.schemas.history import AssessmentHistoryResponse, CompleteReportHistoryResponse
from depth.schemas.payments import CheckoutSessionResponse
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.auth_service import AuthService
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.history_service import HistoryService

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def require_session(request: Request, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]) -> AuthSession:
    return auth_controller.require_session(request, response, service)


CurrentSession = Annotated[AuthSession, Depends(require_session)]
Records = Annotated[AssessmentRecordService, Depends(get_assessment_records)]
RunningTasks = Annotated[set[asyncio.Task], Depends(get_background_tasks)]
RecordFactory = Annotated[object, Depends(get_assessment_record_factory)]
Reports = Annotated[CompleteReportRecordService, Depends(get_complete_report_records)]
ReportFactory = Annotated[object, Depends(get_complete_report_record_factory)]
History = Annotated[HistoryService, Depends(get_history_service)]


@router.post("/free", response_model=FreeAssessmentState, status_code=202)
async def start_free(
    body: AssessmentRequest, request: Request, response: Response, session: CurrentSession,
    records: Records, record_factory: RecordFactory, tasks: RunningTasks,
) -> FreeAssessmentState:
    """Saves a `generating` assessment, starts the model, and returns at once; poll GET /{id}/free for the result."""
    response.headers["Cache-Control"] = "no-store"
    return await assessment_controller.start(body, request.app.state.settings, str(session.user_id), records, record_factory, tasks)


@router.get("/history", response_model=AssessmentHistoryResponse)
def assessment_history(response: Response, session: CurrentSession, history: History) -> AssessmentHistoryResponse:
    response.headers["Cache-Control"] = "no-store"
    return history.assessments_history(str(session.user_id))


@router.get("/complete/history", response_model=CompleteReportHistoryResponse)
def complete_report_history(response: Response, session: CurrentSession, history: History) -> CompleteReportHistoryResponse:
    response.headers["Cache-Control"] = "no-store"
    return history.complete_reports_history(str(session.user_id))


@router.get("/{assessment_id}/free", response_model=FreeAssessmentState)
def free_state(assessment_id: str, response: Response, session: CurrentSession, records: Records) -> FreeAssessmentState:
    response.headers["Cache-Control"] = "no-store"
    return assessment_controller.get(assessment_id, str(session.user_id), records)


@router.get("/{assessment_id}/complete", response_model=CompleteReportState)
def complete_state(
    assessment_id: str, response: Response, session: CurrentSession, reports: Reports, attempt_id: str | None = None,
) -> CompleteReportState:
    response.headers["Cache-Control"] = "no-store"
    return complete_report_controller.get(assessment_id, str(session.user_id), reports, attempt_id)


@router.post("/{assessment_id}/complete/purchase", response_model=CompleteReportState)
def purchase_complete_report(
    assessment_id: str, request: Request, response: Response, session: CurrentSession, reports: Reports,
) -> CompleteReportState:
    response.headers["Cache-Control"] = "no-store"
    if request.app.state.settings.payments_mode != "mock":
        raise PaymentError("not_configured")
    return complete_report_controller.mark_paid(assessment_id, str(session.user_id), reports)


@router.post("/{assessment_id}/complete/checkout", response_model=CheckoutSessionResponse)
def checkout_complete_report(
    assessment_id: str, request: Request, response: Response, session: CurrentSession, reports: Reports,
) -> CheckoutSessionResponse:
    response.headers["Cache-Control"] = "no-store"
    return payment_controller.checkout(assessment_id, str(session.user_id), session.user.email, reports, request)


@router.post("/{assessment_id}/complete", response_model=CompleteReportState)
async def start_complete(
    assessment_id: str, response: Response, session: CurrentSession, reports: Reports,
    report_factory: ReportFactory, tasks: RunningTasks,
) -> CompleteReportState:
    """Starts generation and returns at once (202 while generating); poll GET for the result."""
    result = await complete_report_controller.start(assessment_id, str(session.user_id), reports, report_factory, tasks)
    response.headers["Cache-Control"] = "no-store"
    if result.status == "generating":
        response.status_code = 202
    if result.generation_seconds is not None:
        response.headers["X-Generation-Seconds"] = str(result.generation_seconds)
    return result
