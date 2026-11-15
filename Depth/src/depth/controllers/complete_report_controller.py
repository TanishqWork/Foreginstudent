from depth.schemas.complete_report import CompleteReportState
from depth.services import complete_report_service
from depth.services.assessment_record_service import AssessmentRecordService
from depth.services.assessment_store import AssessmentStore


def get(assessment_id: str, owner_id: str, store: AssessmentStore, records: AssessmentRecordService) -> CompleteReportState:
    return complete_report_service.complete_report_state(assessment_id, owner_id, store, records)


def unlock(assessment_id: str, owner_id: str, store: AssessmentStore, records: AssessmentRecordService) -> CompleteReportState:
    return complete_report_service.mock_unlock(assessment_id, owner_id, store, records)


async def generate(assessment_id: str, owner_id: str, store: AssessmentStore, records: AssessmentRecordService) -> CompleteReportState:
    return await complete_report_service.generate_complete_report(assessment_id, owner_id, store, records)
