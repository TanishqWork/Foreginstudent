import { DIAGNOSTIC_SCHEMA_VERSION } from './types.ts'
import type { CategoryFinding, DiagnosticResponse, SentenceFinding } from './types.ts'

export class DiagnosticResponseError extends Error {
  readonly field: string

  constructor(field: string, unsupportedVersion = false) {
    super(unsupportedVersion
      ? 'This report format is not supported. Refresh the page and try again.'
      : 'The assessment response could not be displayed. Please try again. Your draft is still here.')
    this.name = 'DiagnosticResponseError'
    this.field = field
  }
}

function invalid(field: string): never { throw new DiagnosticResponseError(field) }

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(field)
  return value
}

function nullableText(value: unknown, field: string): string | null { return value === null ? null : text(value, field) }

function integer(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) invalid(field)
  return value
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(field)
  return value
}

function choice<const T extends readonly string[]>(value: unknown, choices: T, field: string): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) invalid(field)
  return value as T[number]
}

function list<T>(value: unknown, field: string, parse: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) invalid(field)
  return value.map((item: unknown, index: number) => parse(item, `${field}[${index}]`))
}

function strings(value: unknown, field: string): string[] { return list(value, field, text) }

function category(value: unknown, field: string): CategoryFinding {
  const row = object(value, field)
  return {
    dimension_id: text(row.dimension_id, `${field}.dimension_id`),
    label: text(row.label, `${field}.label`),
    score: integer(row.score, `${field}.score`, 100),
    reason: text(row.reason, `${field}.reason`),
  }
}

function sentence(value: unknown, field: string): SentenceFinding {
  const row = object(value, field)
  const result = {
    sentence_id: nullableText(row.sentence_id, `${field}.sentence_id`),
    paragraph: row.paragraph === null ? null : integer(row.paragraph, `${field}.paragraph`, Number.MAX_SAFE_INTEGER, 1),
    quote: nullableText(row.quote, `${field}.quote`),
    explanation: text(row.explanation, `${field}.explanation`),
    supporting_sentence_ids: strings(row.supporting_sentence_ids, `${field}.supporting_sentence_ids`),
  }
  if ((result.quote === null) !== (result.sentence_id === null) || (result.quote === null) !== (result.paragraph === null)) invalid(field)
  return result
}

/** Validate the fields V1 renders before allowing a response into the UI. */
export function parseDiagnosticResponse(value: unknown): DiagnosticResponse {
  const envelope = object(value, 'response')
  if (envelope.schema_version !== DIAGNOSTIC_SCHEMA_VERSION) throw new DiagnosticResponseError('schema_version', true)
  const context = object(envelope.context, 'context')
  const report = object(envelope.report, 'report')
  const measurements = object(report.measurements, 'report.measurements')
  const compliance = object(report.limit_compliance, 'report.limit_compliance')
  const confidence = object(report.confidence, 'report.confidence')
  const concern = object(report.main_concern, 'report.main_concern')
  const recommendation = object(report.recommendation, 'report.recommendation')
  const diagnostic = object(envelope.diagnostic, 'diagnostic')
  const gap = object(diagnostic.evidence_gap, 'diagnostic.evidence_gap')

  const parsed: DiagnosticResponse = {
    schema_version: DIAGNOSTIC_SCHEMA_VERSION,
    context: {
      pathway: choice(context.pathway, ['health', 'business', 'stem', 'policy'], 'context.pathway'),
      degree: text(context.degree, 'context.degree'),
      field: text(context.field, 'context.field'),
      target_institution: nullableText(context.target_institution, 'context.target_institution'),
      target_program: nullableText(context.target_program, 'context.target_program'),
      statement_type: text(context.statement_type, 'context.statement_type'),
    },
    report: {
      assessment_id: text(report.assessment_id, 'report.assessment_id'),
      rubric_version: text(report.rubric_version, 'report.rubric_version'),
      status: choice(report.status, ['complete', 'provisional', 'needs_input'], 'report.status'),
      input_issues: strings(report.input_issues, 'report.input_issues'),
      statement_type: text(report.statement_type, 'report.statement_type'),
      measurements: {
        word_count: integer(measurements.word_count, 'report.measurements.word_count'),
        character_count: integer(measurements.character_count, 'report.measurements.character_count'),
        paragraph_count: integer(measurements.paragraph_count, 'report.measurements.paragraph_count'),
        counting_method: text(measurements.counting_method, 'report.measurements.counting_method'),
      },
      limit_compliance: {
        status: choice(compliance.status, ['within_limit', 'over_limit', 'unknown', 'not_supplied'], 'report.limit_compliance.status'),
        max_words: compliance.max_words === null ? null : integer(compliance.max_words, 'report.limit_compliance.max_words', Number.MAX_SAFE_INTEGER, 1),
        reason: text(compliance.reason, 'report.limit_compliance.reason'),
      },
      overall_score: report.overall_score === null ? null : integer(report.overall_score, 'report.overall_score', 100),
      assessment_band: nullableText(report.assessment_band, 'report.assessment_band'),
      scored_weight: integer(report.scored_weight, 'report.scored_weight', 100),
      renormalized: boolean(report.renormalized, 'report.renormalized'),
      confidence: {
        level: choice(confidence.level, ['high', 'moderate', 'low'], 'report.confidence.level'),
        reason: text(confidence.reason, 'report.confidence.reason'),
      },
      strongest_categories: list(report.strongest_categories, 'report.strongest_categories', category),
      weakest_categories: list(report.weakest_categories, 'report.weakest_categories', category),
      ranking_note: text(report.ranking_note, 'report.ranking_note'),
      strongest_sentence: sentence(report.strongest_sentence, 'report.strongest_sentence'),
      riskiest_sentence: sentence(report.riskiest_sentence, 'report.riskiest_sentence'),
      prompt_requirements_status: choice(report.prompt_requirements_status, ['evaluated', 'unknown', 'ambiguous'], 'report.prompt_requirements_status'),
      missing_prompt_requirements: list(report.missing_prompt_requirements, 'report.missing_prompt_requirements', (value, field) => {
        const row = object(value, field)
        return { requirement_id: text(row.requirement_id, `${field}.requirement_id`), requirement: text(row.requirement, `${field}.requirement`), status: choice(row.status, ['missing', 'partial'], `${field}.status`), next_action: text(row.next_action, `${field}.next_action`) }
      }),
      uncertain_prompt_requirements: strings(report.uncertain_prompt_requirements, 'report.uncertain_prompt_requirements'),
      missing_context: strings(report.missing_context, 'report.missing_context'),
      verification_limits: strings(report.verification_limits, 'report.verification_limits'),
      integrity_flags: list(report.integrity_flags, 'report.integrity_flags', (value, field) => {
        const row = object(value, field)
        return { sentence_ids: strings(row.sentence_ids, `${field}.sentence_ids`), concern: text(row.concern, `${field}.concern`), action: text(row.action, `${field}.action`), extra_deduction: integer(row.extra_deduction, `${field}.extra_deduction`, 0) }
      }),
      main_concern: {
        title: text(concern.title, 'report.main_concern.title'),
        explanation: text(concern.explanation, 'report.main_concern.explanation'),
        dimension_ids: strings(concern.dimension_ids, 'report.main_concern.dimension_ids'),
        sentence_ids: strings(concern.sentence_ids, 'report.main_concern.sentence_ids'),
        first_action: text(concern.first_action, 'report.main_concern.first_action'),
      },
      recommendation: {
        path: recommendation.path === null ? null : choice(recommendation.path, ['Refine', 'Rebuild'], 'report.recommendation.path'),
        provisional: boolean(recommendation.provisional, 'report.recommendation.provisional'),
        reason: text(recommendation.reason, 'report.recommendation.reason'),
        next_action: text(recommendation.next_action, 'report.recommendation.next_action'),
      },
      priority_actions: strings(report.priority_actions, 'report.priority_actions'),
      score_meaning: text(report.score_meaning, 'report.score_meaning'),
    },
    diagnostic: {
      revision_opportunity: diagnostic.revision_opportunity === null ? null : choice(diagnostic.revision_opportunity, ['Low', 'Moderate', 'High', 'Foundational'], 'diagnostic.revision_opportunity'),
      pathway_observation: text(diagnostic.pathway_observation, 'diagnostic.pathway_observation'),
      evidence_gap: { summary: text(gap.summary, 'diagnostic.evidence_gap.summary'), quote: nullableText(gap.quote, 'diagnostic.evidence_gap.quote'), sentence_ids: strings(gap.sentence_ids, 'diagnostic.evidence_gap.sentence_ids') },
      evidence_examples: list(diagnostic.evidence_examples, 'diagnostic.evidence_examples', (value, field) => {
        const row = object(value, field)
        return { id: text(row.id, `${field}.id`), sentence_ids: strings(row.sentence_ids, `${field}.sentence_ids`), summary: text(row.summary, `${field}.summary`) }
      }),
    },
  }

  const categories = [...parsed.report.strongest_categories, ...parsed.report.weakest_categories]
  if (parsed.report.strongest_categories.length > 2 || parsed.report.weakest_categories.length > 2 || new Set(categories.map((item) => item.dimension_id)).size !== categories.length) invalid('report.category_rankings')
  const noScore = parsed.report.overall_score === null
  if (noScore !== (parsed.report.status === 'needs_input') || noScore !== (parsed.report.assessment_band === null) || noScore !== (parsed.report.recommendation.path === null) || noScore !== (parsed.diagnostic.revision_opportunity === null)) invalid('report.score_state')
  if (new Set(parsed.diagnostic.evidence_examples.map((item) => item.id)).size !== parsed.diagnostic.evidence_examples.length) invalid('diagnostic.evidence_examples')
  return parsed
}
