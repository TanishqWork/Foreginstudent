from depth.core.config import Settings
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.services.assessment_service import run_free_assessment
from depth.services.assessment_store import AssessmentStore


async def assess(
    body: AssessmentRequest, settings: Settings, owner_id: str, store: AssessmentStore,
) -> FreeDiagnosticResponse:
    return await run_free_assessment(body, settings, owner_id=owner_id, store=store)
