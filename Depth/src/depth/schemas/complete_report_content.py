"""Fixed report data contract; item arrays follow the source, never UI quotas."""

from typing import Literal

from pydantic import Field

from depth.schemas.assessment_report import LimitCompliance, ReportModel

Disposition = Literal["Keep", "Refine", "Rebuild"]
Action = Literal["preserve", "clarify", "tighten", "support", "connect", "move", "split", "merge", "cut", "rebuild"]
Severity = Literal["essential", "material", "minor"]


class Evidence(ReportModel):
    sentence_id: str
    paragraph: int
    quote: str
    use: Literal["supports", "limits", "context"]


class ContextEvidence(ReportModel):
    source_id: str
    quote: str
    use: Literal["supports", "limits", "context"]


class Discrepancy(ReportModel):
    finding_id: str
    baseline_field: str
    issue: str
    evidence: list[Evidence]
    resolution_needed: str


class ExecutiveSummary(ReportModel):
    overall_score: int | None
    assessment_band: str | None
    assessment_status: Literal["complete", "provisional", "needs_input"]
    recommendation_path: Literal["Refine", "Rebuild"] | None
    main_concern_title: str
    argument_summary: str
    strengths_to_preserve: list[str]
    main_concern_explanation: str
    recommendation_explanation: str
    first_action: str
    limitations: list[str]


class CriterionBaseline(ReportModel):
    status: Literal["scored", "excluded"]
    weight: int
    base_score: int | None
    score: int | None
    level: int | None
    level_label: str | None
    weighted_points: float | None


class CheckpointExplanation(ReportModel):
    index: int
    status: Literal["scored", "unknown", "not_applicable"]
    rating: int | None
    explanation: str
    evidence: list[Evidence]


class CriterionDetail(ReportModel):
    finding_id: str
    dimension_id: str
    label: str
    baseline: CriterionBaseline
    explanation_status: Literal["aligned", "review_required"]
    explanation: str
    checkpoints: list[CheckpointExplanation]
    supporting_excerpts: list[Evidence]
    limiting_factors: list[str]
    recorded_adjustment_explanation: str = Field(pattern=r"\S")
    revision_direction: str
    completion_check: str


class RequirementReview(ReportModel):
    finding_id: str
    requirement_id: str
    prompt_quote: str
    requirement: str
    priority: Literal["required", "optional"]
    status: Literal["covered", "partial", "missing", "uncertain"]
    evidence: list[Evidence]
    explanation: str
    next_action: str


class PromptCoverage(ReportModel):
    assessment_status: Literal["evaluated", "unknown", "ambiguous"]
    limit_compliance: LimitCompliance
    requirements: list[RequirementReview]
    missing_or_partial_required_ids: list[str]
    uncertain_requirement_ids: list[str]
    limitations: list[str]


class SentenceReview(ReportModel):
    finding_id: str
    sentence_id: str
    paragraph: int
    text: str
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


class QualityRating(ReportModel):
    rating: Literal["strong", "adequate", "weak", "not_applicable", "unknown"]
    reason: str


class ParagraphQuality(ReportModel):
    purpose: QualityRating
    coherence: QualityRating
    progression: QualityRating
    evidence_use: QualityRating


class ParagraphReview(ReportModel):
    finding_id: str
    paragraph_id: str
    number: int
    text: str
    sentence_ids: list[str]
    intended_function: str
    actual_contribution: str
    disposition: Disposition
    action: Action
    quality: ParagraphQuality
    explanation: str
    revision_direction: str
    criterion_ids: list[str]
    uncertainty: str | None


class EvidenceGap(ReportModel):
    finding_id: str
    severity: Severity
    criterion_ids: list[str]
    evidence_status: Literal["supported_in_draft", "partial", "absent", "contradictory", "context_unavailable"]
    gap_type: Literal["role", "setting", "decision", "method", "outcome", "learning", "fit_link", "feasibility", "other"]
    sentence_ids: list[str]
    paragraph_ids: list[str]
    evidence: list[Evidence]
    claim_or_function: str
    existing_support: str
    missing_link: str
    applicant_action: str
    uncertainty: str | None


class ProgramFinding(ReportModel):
    finding_id: str
    severity: Severity
    judgment: Literal["argued", "asserted", "generic", "misaligned", "unknown"]
    factual_status: Literal["supported_by_supplied_context", "applicant_claim_only", "contradicted_by_supplied_context", "unknown"]
    evidence: list[Evidence]
    context_evidence: list[ContextEvidence]
    applicant_need: str
    program_feature: str
    connection: str
    revision_direction: str
    uncertainty: str | None


class ProgramFit(ReportModel):
    applicability: Literal["applicable", "not_applicable", "unknown"]
    baseline_dimension_ids: list[str]
    summary: str
    findings: list[ProgramFinding]
    limitations: list[str]


class VoiceFinding(ReportModel):
    finding_id: str
    severity: Severity
    kind: Literal["grounding", "particularity", "defensibility", "repetition", "formulaic_pattern"]
    evidence: list[Evidence]
    effect: str
    revision_direction: str
    uncertainty: str | None


class VoiceAndOriginality(ReportModel):
    baseline_dimension_id: Literal["voiceAuthenticity"]
    classification: Literal["Natural and grounded", "Mixed voice", "Highly patterned", "Insufficient context"]
    summary: str
    findings: list[VoiceFinding]
    limitations: list[str]


class UnsupportedClaim(ReportModel):
    finding_id: str
    severity: Severity
    concern_types: list[Literal["unsupported_assertion", "overextended_scope", "unclear_attribution", "internal_contradiction", "external_verification_needed"]]
    evidence: list[Evidence]
    context_sentence_ids: list[str]
    criterion_ids: list[str]
    baseline_integrity_flag_indices: list[int]
    explanation: str
    verification_action: str
    extra_deduction: Literal[0]
    uncertainty: str | None


class EditDirection(ReportModel):
    finding_id: str
    operation: Literal["cut", "expand"]
    severity: Severity
    sentence_ids: list[str]
    paragraph_ids: list[str]
    evidence: list[Evidence]
    related_finding_ids: list[str]
    rationale: str
    instruction: str
    preserve: str
    placement: str
    length_tradeoff: str


class RevisionStep(ReportModel):
    finding_id: str
    priority: int
    phase: Literal["verify", "rebuild_argument", "develop_evidence", "tailor_fit", "refine_prose", "final_check"]
    title: str
    related_finding_ids: list[str]
    sentence_ids: list[str]
    paragraph_ids: list[str]
    depends_on: list[str]
    action: str
    why_now: str
    preserve: str
    completion_check: str


class Coverage(ReportModel):
    expected_criteria: int = Field(ge=0)
    reviewed_criteria: int = Field(ge=0)
    expected_sentences: int = Field(ge=0)
    reviewed_sentences: int = Field(ge=0)
    expected_paragraphs: int = Field(ge=0)
    reviewed_paragraphs: int = Field(ge=0)
    unreviewed_dimension_ids: list[str]
    unreviewed_sentence_ids: list[str]
    unreviewed_paragraph_ids: list[str]


class CompleteReportContent(ReportModel):
    report_version: Literal["complete-report.v1"]
    report_status: Literal["ready", "needs_input", "review_required", "incomplete"]
    input_issues: list[str]
    discrepancies: list[Discrepancy]
    executive_summary: ExecutiveSummary | None
    criterion_details: list[CriterionDetail]
    prompt_coverage: PromptCoverage | None
    sentence_reviews: list[SentenceReview]
    paragraph_reviews: list[ParagraphReview]
    evidence_gaps: list[EvidenceGap]
    program_fit: ProgramFit | None
    voice_and_originality: VoiceAndOriginality | None
    unsupported_claims: list[UnsupportedClaim]
    cut_or_expand: list[EditDirection]
    revision_plan: list[RevisionStep]
    limitations: list[str]
    coverage: Coverage
