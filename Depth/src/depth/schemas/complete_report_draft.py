"""What the model writes for a complete report: the analysis only.

Fields that would only repeat the saved free assessment or the statement (sentence and
paragraph text, baseline scores, labels, checkpoint ratings, prompt-requirement text and
verdicts, limit compliance, coverage, report_version) are not requested. The backend fills
them from saved data to build CompleteReportContent, so the model writes less and cannot
mistype them. Unchanged row types are reused from complete_report_content.
"""

from typing import Literal

from pydantic import Field

from depth.schemas.assessment_report import ReportModel
from depth.schemas.complete_report_content import (
    Action, Discrepancy, Disposition, EditDirection, Evidence, EvidenceGap, ParagraphQuality,
    ProgramFit, RevisionStep, UnsupportedClaim, VoiceAndOriginality,
)


class DraftExecutiveSummary(ReportModel):
    argument_summary: str
    strengths_to_preserve: list[str]
    main_concern_explanation: str
    recommendation_explanation: str
    first_action: str
    limitations: list[str]


class DraftCheckpointExplanation(ReportModel):
    index: int
    explanation: str
    evidence: list[Evidence]


class DraftCriterionDetail(ReportModel):
    finding_id: str
    dimension_id: str
    explanation_status: Literal["aligned", "review_required"]
    explanation: str
    checkpoints: list[DraftCheckpointExplanation]
    supporting_excerpts: list[Evidence]
    limiting_factors: list[str]
    recorded_adjustment_explanation: str = Field(pattern=r"\S")
    revision_direction: str
    completion_check: str


class DraftRequirementReview(ReportModel):
    finding_id: str
    requirement_id: str
    evidence: list[Evidence]
    explanation: str
    next_action: str


class DraftPromptCoverage(ReportModel):
    requirements: list[DraftRequirementReview]
    limitations: list[str]


class DraftSentenceReview(ReportModel):
    finding_id: str
    sentence_id: str
    function: str
    disposition: Disposition
    action: Action
    what_works: str
    concern: str | None
    explanation: str
    revision_direction: str
    criterion_ids: list[str]
    context_sentence_ids: list[str]
    uncertainty: str | None


class DraftParagraphReview(ReportModel):
    finding_id: str
    paragraph_id: str
    intended_function: str
    actual_contribution: str
    disposition: Disposition
    action: Action
    quality: ParagraphQuality
    explanation: str
    revision_direction: str
    criterion_ids: list[str]
    uncertainty: str | None


class DraftCompleteReport(ReportModel):
    report_status: Literal["ready", "needs_input", "review_required", "incomplete"]
    input_issues: list[str]
    discrepancies: list[Discrepancy]
    executive_summary: DraftExecutiveSummary | None
    criterion_details: list[DraftCriterionDetail]
    prompt_coverage: DraftPromptCoverage | None
    sentence_reviews: list[DraftSentenceReview]
    paragraph_reviews: list[DraftParagraphReview]
    evidence_gaps: list[EvidenceGap]
    program_fit: ProgramFit | None
    voice_and_originality: VoiceAndOriginality | None
    unsupported_claims: list[UnsupportedClaim]
    cut_or_expand: list[EditDirection]
    revision_plan: list[RevisionStep]
    limitations: list[str]
