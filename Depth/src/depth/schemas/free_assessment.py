"""HTTP state for an asynchronous free assessment; the result keeps the free-diagnostic.v1 contract."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from depth.schemas.assessment_report import FreeDiagnosticResponse

FreeStatus = Literal["generating", "ready", "failed"]


class FreeAssessmentState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str
    status: FreeStatus
    assessment: FreeDiagnosticResponse | None
    generation_seconds: float | None
    error: str | None
