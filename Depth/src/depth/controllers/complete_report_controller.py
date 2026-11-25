import asyncio

from depth.schemas.complete_report import CompleteReportState
from depth.services import complete_report_service
from depth.services.complete_report_record_service import CompleteReportRecordService
from depth.services.complete_report_service import ReportFactory


def get(assessment_id: str, owner_id: str, reports: CompleteReportRecordService, attempt_id: str | None = None) -> CompleteReportState:
    return complete_report_service.complete_report_state(assessment_id, owner_id, reports, attempt_id)


def mark_paid(assessment_id: str, owner_id: str, reports: CompleteReportRecordService) -> CompleteReportState:
    return complete_report_service.mark_paid(assessment_id, owner_id, reports)


async def start(
    assessment_id: str, owner_id: str, reports: CompleteReportRecordService,
    report_factory: ReportFactory, tasks: set[asyncio.Task],
) -> CompleteReportState:
    return await complete_report_service.start_complete_report(assessment_id, owner_id, reports, report_factory, tasks)
