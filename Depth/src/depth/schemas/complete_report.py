"""HTTP state for the temporary structured complete-report prototype."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from depth.schemas.assessment_report import FreeDiagnosticResponse
from depth.schemas.complete_report_content import CompleteReportContent

CompleteStatus = Literal["locked", "unlocked", "generating", "ready", "failed"]


class CompleteReportState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str
    status: CompleteStatus
    assessment: FreeDiagnosticResponse
    report: CompleteReportContent | None
    generation_seconds: float | None
    free_generation_seconds: float | None
    error: str | None
