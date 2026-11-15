from depth.core.config import Settings
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.assessment_service import run_free_assessment


async def assess(
    body: AssessmentRequest, settings: Settings, owner_id: str, records: AssessmentRecordService,
) -> FreeDiagnosticResponse:
    return await run_free_assessment(body, settings, owner_id=owner_id, records=records)
