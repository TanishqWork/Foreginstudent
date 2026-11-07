import type { DiagnosticResponse } from '../assessment/diagnostic/types.ts'

export const COMPLETE_REPORT_VERSION = 'complete-report.v1'
export type Disposition = 'Keep' | 'Refine' | 'Rebuild'
export type Severity = 'essential' | 'material' | 'minor'
export type EvidenceExcerpt = { sentence_id: string; paragraph: number; quote: string; use: 'supports' | 'limits' | 'context' }
export type ContextExcerpt = { source_id: string; quote: string; use: 'supports' | 'limits' | 'context' }
export type QualityRating = { rating: 'strong' | 'adequate' | 'weak' | 'not_applicable' | 'unknown'; reason: string }
export type ExecutiveSummary = {
  overall_score: number | null; assessment_band: string | null; assessment_status: 'complete' | 'provisional' | 'needs_input'
  recommendation_path: 'Refine' | 'Rebuild' | null; main_concern_title: string; argument_summary: string
  strengths_to_preserve: string[]; main_concern_explanation: string; recommendation_explanation: string; first_action: string; limitations: string[]
}
export type CriterionDetail = {
  finding_id: string; dimension_id: string; label: string
  baseline: { status: 'scored' | 'excluded'; weight: number; base_score: number | null; score: number | null; level: number | null; level_label: string | null; weighted_points: number | null }
  explanation_status: 'aligned' | 'review_required'; explanation: string
  checkpoints: { index: number; status: 'scored' | 'unknown' | 'not_applicable'; rating: number | null; explanation: string; evidence: EvidenceExcerpt[] }[]
  supporting_excerpts: EvidenceExcerpt[]; limiting_factors: string[]; recorded_adjustment_explanation: string; revision_direction: string; completion_check: string
}
export type PromptCoverage = {
  assessment_status: 'evaluated' | 'unknown' | 'ambiguous'
  limit_compliance: { status: 'within_limit' | 'over_limit' | 'unknown' | 'not_supplied'; max_words: number | null; max_characters: number | null; largest_overrun_percent: number | null; prose_deduction: number; reason: string }
  requirements: { finding_id: string; requirement_id: string; prompt_quote: string; requirement: string; priority: 'required' | 'optional'; status: 'covered' | 'partial' | 'missing' | 'uncertain'; evidence: EvidenceExcerpt[]; explanation: string; next_action: string }[]
  missing_or_partial_required_ids: string[]; uncertain_requirement_ids: string[]; limitations: string[]
}
export type SentenceReview = {
  finding_id: string; sentence_id: string; paragraph: number; text: string; function: string; disposition: Disposition; action: string
  what_works: string; concern: string | null; explanation: string; revision_direction: string; criterion_ids: string[]; context_sentence_ids: string[]; uncertainty: string | null
}
export type ParagraphReview = {
  finding_id: string; paragraph_id: string; number: number; text: string; sentence_ids: string[]; intended_function: string; actual_contribution: string
  disposition: Disposition; action: string; quality: { purpose: QualityRating; coherence: QualityRating; progression: QualityRating; evidence_use: QualityRating }
  explanation: string; revision_direction: string; criterion_ids: string[]; uncertainty: string | null
}
export type EvidenceGap = {
  finding_id: string; severity: Severity; criterion_ids: string[]; evidence_status: 'supported_in_draft' | 'partial' | 'absent' | 'contradictory' | 'context_unavailable'
  gap_type: 'role' | 'setting' | 'decision' | 'method' | 'outcome' | 'learning' | 'fit_link' | 'feasibility' | 'other'
  sentence_ids: string[]; paragraph_ids: string[]; evidence: EvidenceExcerpt[]; claim_or_function: string; existing_support: string; missing_link: string; applicant_action: string; uncertainty: string | null
}
export type ProgramFit = {
  applicability: 'applicable' | 'not_applicable' | 'unknown'; baseline_dimension_ids: string[]; summary: string
  findings: { finding_id: string; severity: Severity; judgment: 'argued' | 'asserted' | 'generic' | 'misaligned' | 'unknown'; factual_status: 'supported_by_supplied_context' | 'applicant_claim_only' | 'contradicted_by_supplied_context' | 'unknown'; evidence: EvidenceExcerpt[]; context_evidence: ContextExcerpt[]; applicant_need: string; program_feature: string; connection: string; revision_direction: string; uncertainty: string | null }[]
  limitations: string[]
}
export type VoiceAndOriginality = {
  baseline_dimension_id: string; classification: 'Natural and grounded' | 'Mixed voice' | 'Highly patterned' | 'Insufficient context'; summary: string
  findings: { finding_id: string; severity: Severity; kind: 'grounding' | 'particularity' | 'defensibility' | 'repetition' | 'formulaic_pattern'; evidence: EvidenceExcerpt[]; effect: string; revision_direction: string; uncertainty: string | null }[]
  limitations: string[]
}
export type UnsupportedClaim = {
  finding_id: string; severity: Severity; concern_types: ('unsupported_assertion' | 'overextended_scope' | 'unclear_attribution' | 'internal_contradiction' | 'external_verification_needed')[]
  evidence: EvidenceExcerpt[]; context_sentence_ids: string[]; criterion_ids: string[]; baseline_integrity_flag_indices: number[]; explanation: string; verification_action: string; extra_deduction: 0; uncertainty: string | null
}
export type EditDirection = {
  finding_id: string; operation: 'cut' | 'expand'; severity: Severity; sentence_ids: string[]; paragraph_ids: string[]; evidence: EvidenceExcerpt[]; related_finding_ids: string[]
  rationale: string; instruction: string; preserve: string; placement: string; length_tradeoff: string
}
export type RevisionStep = {
  finding_id: string; priority: number; phase: 'verify' | 'rebuild_argument' | 'develop_evidence' | 'tailor_fit' | 'refine_prose' | 'final_check'; title: string
  related_finding_ids: string[]; sentence_ids: string[]; paragraph_ids: string[]; depends_on: string[]; action: string; why_now: string; preserve: string; completion_check: string
}
export type Discrepancy = { finding_id: string; baseline_field: string; issue: string; evidence: EvidenceExcerpt[]; resolution_needed: string }
export type CompleteReportContent = {
  report_version: typeof COMPLETE_REPORT_VERSION
  report_status: 'ready' | 'needs_input' | 'review_required' | 'incomplete'
  input_issues: string[]; discrepancies: Discrepancy[]; executive_summary: ExecutiveSummary | null
  criterion_details: CriterionDetail[]; prompt_coverage: PromptCoverage | null; sentence_reviews: SentenceReview[]; paragraph_reviews: ParagraphReview[]
  evidence_gaps: EvidenceGap[]; program_fit: ProgramFit | null; voice_and_originality: VoiceAndOriginality | null; unsupported_claims: UnsupportedClaim[]
  cut_or_expand: EditDirection[]; revision_plan: RevisionStep[]; limitations: string[]
  coverage: { expected_criteria: number; reviewed_criteria: number; expected_sentences: number; reviewed_sentences: number; expected_paragraphs: number; reviewed_paragraphs: number; unreviewed_dimension_ids: string[]; unreviewed_sentence_ids: string[]; unreviewed_paragraph_ids: string[] }
}
export type CompleteReportStatus = 'locked' | 'unlocked' | 'generating' | 'ready' | 'failed'
export type CompleteReportState = {
  assessment_id: string; status: CompleteReportStatus; assessment: DiagnosticResponse; report: CompleteReportContent | null
  generation_seconds: number | null; free_generation_seconds: number | null; error: string | null
}
