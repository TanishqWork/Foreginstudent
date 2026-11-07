export const DIAGNOSTIC_SCHEMA_VERSION = 'free-diagnostic.v1'

export type CategoryFinding = { dimension_id: string; label: string; score: number; reason: string }
export type SentenceFinding = {
  sentence_id: string | null
  paragraph: number | null
  quote: string | null
  explanation: string
  supporting_sentence_ids: string[]
}

export type DiagnosticResponse = {
  schema_version: typeof DIAGNOSTIC_SCHEMA_VERSION
  context: {
    pathway: 'health' | 'business' | 'stem' | 'policy'
    degree: string
    field: string
    target_institution: string | null
    target_program: string | null
    statement_type: string
  }
  // This renderer consumes these fields; the API also retains the full scoring audit.
  report: {
    assessment_id: string
    rubric_version: string
    status: 'complete' | 'provisional' | 'needs_input'
    input_issues: string[]
    statement_type: string
    measurements: { word_count: number; character_count: number; paragraph_count: number; counting_method: string }
    limit_compliance: { status: 'within_limit' | 'over_limit' | 'unknown' | 'not_supplied'; max_words: number | null; reason: string }
    overall_score: number | null
    assessment_band: string | null
    scored_weight: number
    renormalized: boolean
    confidence: { level: 'high' | 'moderate' | 'low'; reason: string }
    strongest_categories: CategoryFinding[]
    weakest_categories: CategoryFinding[]
    ranking_note: string
    strongest_sentence: SentenceFinding
    riskiest_sentence: SentenceFinding
    prompt_requirements_status: 'evaluated' | 'unknown' | 'ambiguous'
    missing_prompt_requirements: { requirement_id: string; requirement: string; status: 'missing' | 'partial'; next_action: string }[]
    uncertain_prompt_requirements: string[]
    missing_context: string[]
    verification_limits: string[]
    integrity_flags: { sentence_ids: string[]; concern: string; action: string; extra_deduction: number }[]
    main_concern: { title: string; explanation: string; dimension_ids: string[]; sentence_ids: string[]; first_action: string }
    recommendation: { path: 'Refine' | 'Rebuild' | null; provisional: boolean; reason: string; next_action: string }
    priority_actions: string[]
    score_meaning: string
  }
  diagnostic: {
    revision_opportunity: 'Low' | 'Moderate' | 'High' | 'Foundational' | null
    pathway_observation: string
    evidence_gap: { summary: string; quote: string | null; sentence_ids: string[] }
    evidence_examples: { id: string; sentence_ids: string[]; summary: string }[]
  }
}
