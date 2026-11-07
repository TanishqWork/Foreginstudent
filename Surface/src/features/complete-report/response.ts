import { COMPLETE_REPORT_VERSION } from './types.ts'
import type { CompleteReportContent } from './types.ts'

export class CompleteContentError extends Error {
  readonly field: string
  constructor(field: string) { super('The complete report has an unsupported format. Please try again.'); this.name = 'CompleteContentError'; this.field = field }
}

type Check = (value: unknown, path: string) => void
const fail = (path: string): never => { throw new CompleteContentError(path) }
const text: Check = (value, path) => { if (typeof value !== 'string') fail(path) }
const number: Check = (value, path) => { if (typeof value !== 'number' || !Number.isFinite(value)) fail(path) }
const integer: Check = (value, path) => { number(value, path); if (!Number.isInteger(value) || (value as number) < 0) fail(path) }
const nullable = (check: Check): Check => (value, path) => { if (value !== null) check(value, path) }
const oneOf = (...values: readonly unknown[]): Check => (value, path) => { if (!values.includes(value)) fail(path) }
const list = (check: Check): Check => (value, path) => { if (!Array.isArray(value)) fail(path); (value as unknown[]).forEach((item, index) => check(item, `${path}.${index}`)) }
const object = (fields: Record<string, Check>): Check => (value, path) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path)
  const row = value as Record<string, unknown>
  for (const [key, check] of Object.entries(fields)) check(row[key], `${path}.${key}`)
  if (Object.keys(row).some((key) => !(key in fields))) fail(`${path}.<unexpected_field>`)
}
const strings = list(text)
const evidence = list(object({ sentence_id: text, paragraph: integer, quote: text, use: oneOf('supports', 'limits', 'context') }))
const severity = oneOf('essential', 'material', 'minor')
const disposition = oneOf('Keep', 'Refine', 'Rebuild')
const action = oneOf('preserve', 'clarify', 'tighten', 'support', 'connect', 'move', 'split', 'merge', 'cut', 'rebuild')
const quality = object({ rating: oneOf('strong', 'adequate', 'weak', 'not_applicable', 'unknown'), reason: text })
const referenceFields = { sentence_ids: strings, paragraph_ids: strings }
const schema = object({
  report_version: oneOf(COMPLETE_REPORT_VERSION), report_status: oneOf('ready', 'needs_input', 'review_required', 'incomplete'), input_issues: strings,
  discrepancies: list(object({ finding_id: text, baseline_field: text, issue: text, evidence, resolution_needed: text })),
  executive_summary: nullable(object({ overall_score: nullable(integer), assessment_band: nullable(text), assessment_status: oneOf('complete', 'provisional', 'needs_input'), recommendation_path: nullable(oneOf('Refine', 'Rebuild')), main_concern_title: text, argument_summary: text, strengths_to_preserve: strings, main_concern_explanation: text, recommendation_explanation: text, first_action: text, limitations: strings })),
  criterion_details: list(object({ finding_id: text, dimension_id: text, label: text, baseline: object({ status: oneOf('scored', 'excluded'), weight: integer, base_score: nullable(integer), score: nullable(integer), level: nullable(integer), level_label: nullable(text), weighted_points: nullable(number) }), explanation_status: oneOf('aligned', 'review_required'), explanation: text, checkpoints: list(object({ index: integer, status: oneOf('scored', 'unknown', 'not_applicable'), rating: nullable(integer), explanation: text, evidence })), supporting_excerpts: evidence, limiting_factors: strings, recorded_adjustment_explanation: text, revision_direction: text, completion_check: text })),
  prompt_coverage: nullable(object({ assessment_status: oneOf('evaluated', 'unknown', 'ambiguous'), limit_compliance: object({ status: oneOf('within_limit', 'over_limit', 'unknown', 'not_supplied'), max_words: nullable(integer), max_characters: nullable(integer), largest_overrun_percent: nullable(number), prose_deduction: integer, reason: text }), requirements: list(object({ finding_id: text, requirement_id: text, prompt_quote: text, requirement: text, priority: oneOf('required', 'optional'), status: oneOf('covered', 'partial', 'missing', 'uncertain'), evidence, explanation: text, next_action: text })), missing_or_partial_required_ids: strings, uncertain_requirement_ids: strings, limitations: strings })),
  sentence_reviews: list(object({ finding_id: text, sentence_id: text, paragraph: integer, text, function: text, disposition, action, what_works: text, concern: nullable(text), explanation: text, revision_direction: text, criterion_ids: strings, context_sentence_ids: strings, uncertainty: nullable(text) })),
  paragraph_reviews: list(object({ finding_id: text, paragraph_id: text, number: integer, text, sentence_ids: strings, intended_function: text, actual_contribution: text, disposition, action, quality: object({ purpose: quality, coherence: quality, progression: quality, evidence_use: quality }), explanation: text, revision_direction: text, criterion_ids: strings, uncertainty: nullable(text) })),
  evidence_gaps: list(object({ finding_id: text, severity, criterion_ids: strings, evidence_status: oneOf('supported_in_draft', 'partial', 'absent', 'contradictory', 'context_unavailable'), gap_type: oneOf('role', 'setting', 'decision', 'method', 'outcome', 'learning', 'fit_link', 'feasibility', 'other'), ...referenceFields, evidence, claim_or_function: text, existing_support: text, missing_link: text, applicant_action: text, uncertainty: nullable(text) })),
  program_fit: nullable(object({ applicability: oneOf('applicable', 'not_applicable', 'unknown'), baseline_dimension_ids: strings, summary: text, findings: list(object({ finding_id: text, severity, judgment: oneOf('argued', 'asserted', 'generic', 'misaligned', 'unknown'), factual_status: oneOf('supported_by_supplied_context', 'applicant_claim_only', 'contradicted_by_supplied_context', 'unknown'), evidence, context_evidence: list(object({ source_id: text, quote: text, use: oneOf('supports', 'limits', 'context') })), applicant_need: text, program_feature: text, connection: text, revision_direction: text, uncertainty: nullable(text) })), limitations: strings })),
  voice_and_originality: nullable(object({ baseline_dimension_id: text, classification: oneOf('Natural and grounded', 'Mixed voice', 'Highly patterned', 'Insufficient context'), summary: text, findings: list(object({ finding_id: text, severity, kind: oneOf('grounding', 'particularity', 'defensibility', 'repetition', 'formulaic_pattern'), evidence, effect: text, revision_direction: text, uncertainty: nullable(text) })), limitations: strings })),
  unsupported_claims: list(object({ finding_id: text, severity, concern_types: list(oneOf('unsupported_assertion', 'overextended_scope', 'unclear_attribution', 'internal_contradiction', 'external_verification_needed')), evidence, context_sentence_ids: strings, criterion_ids: strings, baseline_integrity_flag_indices: list(integer), explanation: text, verification_action: text, extra_deduction: oneOf(0), uncertainty: nullable(text) })),
  cut_or_expand: list(object({ finding_id: text, operation: oneOf('cut', 'expand'), severity, ...referenceFields, evidence, related_finding_ids: strings, rationale: text, instruction: text, preserve: text, placement: text, length_tradeoff: text })),
  revision_plan: list(object({ finding_id: text, priority: integer, phase: oneOf('verify', 'rebuild_argument', 'develop_evidence', 'tailor_fit', 'refine_prose', 'final_check'), title: text, related_finding_ids: strings, ...referenceFields, depends_on: strings, action: text, why_now: text, preserve: text, completion_check: text })),
  limitations: strings,
  coverage: object({ expected_criteria: integer, reviewed_criteria: integer, expected_sentences: integer, reviewed_sentences: integer, expected_paragraphs: integer, reviewed_paragraphs: integer, unreviewed_dimension_ids: strings, unreviewed_sentence_ids: strings, unreviewed_paragraph_ids: strings }),
})

export function parseCompleteReportContent(value: unknown): CompleteReportContent {
  schema(value, 'report')
  const report = value as CompleteReportContent
  if (report.report_status === 'ready' && [report.executive_summary, report.prompt_coverage, report.program_fit, report.voice_and_originality].some((item) => item === null)) fail('report.report_status')
  if (report.report_status === 'ready' && report.revision_plan.length === 0) fail('report.revision_plan')
  const allIds = [report.criterion_details, report.prompt_coverage?.requirements ?? [], report.sentence_reviews, report.paragraph_reviews, report.evidence_gaps, report.program_fit?.findings ?? [], report.voice_and_originality?.findings ?? [], report.unsupported_claims, report.cut_or_expand, report.revision_plan, report.discrepancies].flat().map((item) => item.finding_id)
  if (new Set(allIds).size !== allIds.length) fail('report.finding_id')
  if (report.criterion_details.some((item) => item.checkpoints.length !== 4)) fail('report.criterion_details.checkpoints')
  return report
}
