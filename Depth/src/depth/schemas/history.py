from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AssessmentHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str
    status: Literal["generating", "ready", "failed"]
    overall_score: int | None = Field(ge=0, le=100)
    assessment_band: str | None
    statement_type: str | None
    degree: str | None
    field: str | None
    target_program: str | None
    target_institution: str | None
    created_at: datetime
    generation_seconds: float | None
    error: str | None
    has_complete_report_access: bool
    complete_report_remaining_runs: int
    complete_report_max_runs: int | None


class AssessmentHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AssessmentHistoryItem]


class CompleteReportHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str
    attempt_id: str | None
    status: Literal["unlocked", "generating", "ready", "failed"]
    report_status: str | None
    overall_score: int | None = Field(ge=0, le=100)
    assessment_band: str | None
    statement_type: str | None
    degree: str | None
    field: str | None
    target_program: str | None
    target_institution: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    generation_seconds: float | None
    remaining_successful_runs: int
    max_successful_runs: int
    counts_against_limit: bool
    failure_kind: str | None
    error: str | None


class CompleteReportHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CompleteReportHistoryItem]
