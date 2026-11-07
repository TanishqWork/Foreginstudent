"""The model report and the single public free-diagnostic.v1 contract."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from depth.schemas.assessment import AssessmentRequest

StatementType = AssessmentRequest.model_fields["statement_type"].annotation


class ReportModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Measurements(ReportModel):
    word_count: int = Field(ge=0)
    character_count: int = Field(ge=0)
    paragraph_count: int = Field(ge=0)
    counting_method: Literal["ss-unicode-v1"]


class LimitCompliance(ReportModel):
    status: Literal["within_limit", "over_limit", "unknown", "not_supplied"]
    max_words: int | None
    max_characters: int | None
    largest_overrun_percent: float | None
    prose_deduction: Literal[0, 5, 10, 20]
    reason: str


class Confidence(ReportModel):
    level: Literal["high", "moderate", "low"]
    reason: str


class Checkpoint(ReportModel):
    index: int = Field(ge=1, le=4)
    status: Literal["scored", "unknown", "not_applicable"]
    rating: int | None = Field(ge=0, le=4)
    sentence_ids: list[str]
    reason: str


class Dimension(ReportModel):
    id: str
    label: str
    weight: int = Field(ge=0, le=100)
    status: Literal["scored", "excluded"]
    checkpoints: list[Checkpoint] = Field(min_length=4, max_length=4)
    base_score: int | None = Field(ge=0, le=100)
    score: int | None = Field(ge=0, le=100)
    level: int | None = Field(ge=0, le=4)
    level_label: str | None
    weighted_points: float | None
    reason: str
    next_action: str
    sentence_ids: list[str]


class Adjustment(ReportModel):
    dimension_id: str
    rule: Literal["missing_required_content", "partial_required_content", "length_overrun"]
    base_score: int
    cap: int | None
    deduction: int
    points_lost: int
    final_score: int
    evidence_requirement_ids: list[str]
    reason: str


class RankedCategory(ReportModel):
    dimension_id: str
    label: str
    score: int = Field(ge=0, le=100)
    reason: str


class SentenceFinding(ReportModel):
    sentence_id: str | None
    paragraph: int | None
    quote: str | None
    explanation: str
    supporting_sentence_ids: list[str]


class PromptRequirement(ReportModel):
    id: str
    prompt_quote: str
    requirement: str
    priority: Literal["required", "optional"]
    status: Literal["covered", "partial", "missing", "uncertain"]
    sentence_ids: list[str]
    reason: str
    next_action: str


class MissingRequirement(ReportModel):
    requirement_id: str
    requirement: str
    status: Literal["missing", "partial"]
    next_action: str


class IntegrityFlag(ReportModel):
    sentence_ids: list[str]
    concern: str
    action: str
    extra_deduction: Literal[0]


class MainConcern(ReportModel):
    title: str
    explanation: str
    dimension_ids: list[str]
    sentence_ids: list[str]
    first_action: str


class Recommendation(ReportModel):
    path: Literal["Refine", "Rebuild"] | None
    provisional: bool
    triggered_rules: list[str]
    reason: str
    next_action: str


class FreeAssessmentReport(ReportModel):
    assessment_id: str
    rubric_version: Literal["ss-free-ai-draft-1.0"]
    status: Literal["complete", "provisional", "needs_input"]
    input_issues: list[str]
    statement_type: StatementType
    measurements: Measurements
    limit_compliance: LimitCompliance
    overall_score: int | None = Field(ge=0, le=100)
    overall_unrounded: float | None
    assessment_band: Literal["Highly developed", "Credible draft", "Material gaps", "Rebuild recommended"] | None
    scored_weight: int = Field(ge=0, le=100)
    renormalized: bool
    excluded_dimension_ids: list[str]
    confidence: Confidence
    dimensions: list[Dimension]
    adjustments: list[Adjustment]
    strongest_categories: list[RankedCategory]
    weakest_categories: list[RankedCategory]
    ranking_note: str
    strongest_sentence: SentenceFinding
    riskiest_sentence: SentenceFinding
    prompt_requirements_status: Literal["evaluated", "unknown", "ambiguous"]
    prompt_requirements: list[PromptRequirement]
    missing_prompt_requirements: list[MissingRequirement]
    uncertain_prompt_requirements: list[str]
    missing_context: list[str]
    verification_limits: list[str]
    integrity_flags: list[IntegrityFlag]
    main_concern: MainConcern
    recommendation: Recommendation
    priority_actions: list[str]
    defaults_applied: list[str]
    score_meaning: str


class EvidenceGap(ReportModel):
    summary: str
    quote: str | None
    sentence_ids: list[str]


class EvidenceExample(ReportModel):
    id: str
    sentence_ids: list[str] = Field(min_length=1)
    summary: str


class AssessmentEvaluation(ReportModel):
    """Model judgments; the server supplies version, context and calculated fields."""

    report: FreeAssessmentReport
    evidence_gap: EvidenceGap
    evidence_examples: list[EvidenceExample]


class AssessmentContext(ReportModel):
    pathway: Literal["health", "business", "stem", "policy"]
    degree: str
    field: str
    target_institution: str | None
    target_program: str | None
    statement_type: StatementType


class DiagnosticPresentation(ReportModel):
    revision_opportunity: Literal["Low", "Moderate", "High", "Foundational"] | None
    pathway_observation: str
    evidence_gap: EvidenceGap
    evidence_examples: list[EvidenceExample]


class FreeDiagnosticResponse(ReportModel):
    schema_version: Literal["free-diagnostic.v1"]
    context: AssessmentContext
    report: FreeAssessmentReport
    diagnostic: DiagnosticPresentation
