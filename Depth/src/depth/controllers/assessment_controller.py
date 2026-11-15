import asyncio

from depth.core.config import Settings
from depth.core.exceptions import AssessmentError
from depth.schemas.assessment import AssessmentRequest
from depth.schemas.free_assessment import FreeAssessmentState
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.assessment_service import FREE_ASSESSMENT_STALE_SECONDS, RecordFactory, start_free_assessment


async def start(
    body: AssessmentRequest, settings: Settings, owner_id: str, records: AssessmentRecordService,
    record_factory: RecordFactory, tasks: set[asyncio.Task],
) -> FreeAssessmentState:
    return await start_free_assessment(body, settings, owner_id, records, record_factory, tasks)


def get(assessment_id: str, owner_id: str, records: AssessmentRecordService) -> FreeAssessmentState:
    state = records.free_state(assessment_id, owner_id, FREE_ASSESSMENT_STALE_SECONDS)
    if state is None:
        raise AssessmentError("not_found")
    return state
