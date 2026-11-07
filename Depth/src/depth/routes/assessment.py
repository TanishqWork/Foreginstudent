from typing import Annotated
from time import perf_counter

from fastapi import APIRouter, Depends, Request, Response

from depth.controllers import assessment_controller, auth_controller, complete_report_controller
from depth.dependencies import get_assessment_store, get_auth_service
from depth.models.auth_session import AuthSession
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.schemas.complete_report import CompleteReportState
from depth.services.assessment_store import AssessmentStore
from depth.services.auth_service import AuthService

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def require_session(request: Request, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]) -> AuthSession:
    return auth_controller.require_session(request, response, service)


CurrentSession = Annotated[AuthSession, Depends(require_session)]
Store = Annotated[AssessmentStore, Depends(get_assessment_store)]


@router.post("/free", response_model=FreeDiagnosticResponse)
async def free_assessment(body: AssessmentRequest, request: Request, response: Response, session: CurrentSession, store: Store) -> FreeDiagnosticResponse:
    response.headers["Cache-Control"] = "no-store"
    started = perf_counter()
    result = await assessment_controller.assess(body, request.app.state.settings, str(session.user_id), store)
    response.headers["X-Generation-Seconds"] = str(round(perf_counter() - started, 3))
    return result


@router.get("/{assessment_id}/complete", response_model=CompleteReportState)
async def complete_state(assessment_id: str, response: Response, session: CurrentSession, store: Store) -> CompleteReportState:
    response.headers["Cache-Control"] = "no-store"
    return complete_report_controller.get(assessment_id, str(session.user_id), store)


@router.post("/{assessment_id}/mock-unlock", response_model=CompleteReportState)
async def mock_unlock(assessment_id: str, response: Response, session: CurrentSession, store: Store) -> CompleteReportState:
    response.headers["Cache-Control"] = "no-store"
    return complete_report_controller.unlock(assessment_id, str(session.user_id), store)


@router.post("/{assessment_id}/complete", response_model=CompleteReportState)
async def generate_complete(assessment_id: str, response: Response, session: CurrentSession, store: Store) -> CompleteReportState:
    result = await complete_report_controller.generate(assessment_id, str(session.user_id), store)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Generation-Seconds"] = str(result.generation_seconds)
    return result
