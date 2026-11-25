export type AssessmentHistoryItem = {
  assessment_id: string
  status: 'generating' | 'ready' | 'failed'
  overall_score: number | null
  assessment_band: string | null
  statement_type: string | null
  degree: string | null
  field: string | null
  target_program: string | null
  target_institution: string | null
  created_at: string
  generation_seconds: number | null
  error: string | null
  has_complete_report_access: boolean
  complete_report_remaining_runs: number
  complete_report_max_runs: number | null
  complete_report_unlimited?: boolean
}

export type CompleteReportHistoryItem = {
  assessment_id: string
  attempt_id: string | null
  status: 'unlocked' | 'generating' | 'ready' | 'failed'
  report_status: string | null
  overall_score: number | null
  assessment_band: string | null
  statement_type: string | null
  degree: string | null
  field: string | null
  target_program: string | null
  target_institution: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  generation_seconds: number | null
  remaining_successful_runs: number
  max_successful_runs: number | null
  counts_against_limit: boolean
  failure_kind: string | null
  error: string | null
}

export class HistoryError extends Error {
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'HistoryError'
    this.status = status
  }
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function optionalSeconds(value: unknown): number | null {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  throw new HistoryError('Saved work history could not be displayed.')
}

function score(value: unknown): number | null {
  if (value === null) return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) return value
  throw new HistoryError('Saved work history could not be displayed.')
}

function nonnegativeInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  throw new HistoryError('Saved work history could not be displayed.')
}

function positiveInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  throw new HistoryError('Saved work history could not be displayed.')
}

function parseAssessmentItem(value: unknown): AssessmentHistoryItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HistoryError('Saved work history could not be displayed.')
  const row = value as Record<string, unknown>
  if (typeof row.assessment_id !== 'string' || !row.assessment_id) throw new HistoryError('Saved work history could not be displayed.')
  if (row.status !== 'generating' && row.status !== 'ready' && row.status !== 'failed') throw new HistoryError('Saved work history could not be displayed.')
  if (!isValidDateString(row.created_at)) throw new HistoryError('Saved work history could not be displayed.')
  if (!isStringOrNull(row.assessment_band) || !isStringOrNull(row.statement_type) || !isStringOrNull(row.degree) || !isStringOrNull(row.field) || !isStringOrNull(row.target_program) || !isStringOrNull(row.target_institution) || !isStringOrNull(row.error)) throw new HistoryError('Saved work history could not be displayed.')
  if (typeof row.has_complete_report_access !== 'boolean') throw new HistoryError('Saved work history could not be displayed.')
  const max = row.complete_report_max_runs
  if (max !== null && (typeof max !== 'number' || !Number.isInteger(max) || max < 1)) throw new HistoryError('Saved work history could not be displayed.')
  return {
    assessment_id: row.assessment_id,
    status: row.status,
    overall_score: score(row.overall_score),
    assessment_band: row.assessment_band,
    statement_type: row.statement_type,
    degree: row.degree,
    field: row.field,
    target_program: row.target_program,
    target_institution: row.target_institution,
    created_at: row.created_at,
    generation_seconds: optionalSeconds(row.generation_seconds),
    error: row.error,
    has_complete_report_access: row.has_complete_report_access,
    complete_report_remaining_runs: nonnegativeInteger(row.complete_report_remaining_runs),
    complete_report_max_runs: max as number | null,
    complete_report_unlimited: row.complete_report_unlimited === true,
  }
}

function parseCompleteItem(value: unknown): CompleteReportHistoryItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HistoryError('Saved work history could not be displayed.')
  const row = value as Record<string, unknown>
  if (typeof row.assessment_id !== 'string' || !row.assessment_id) throw new HistoryError('Saved work history could not be displayed.')
  if (!isStringOrNull(row.attempt_id) || !isStringOrNull(row.report_status) || !isStringOrNull(row.assessment_band) || !isStringOrNull(row.statement_type) || !isStringOrNull(row.degree) || !isStringOrNull(row.field) || !isStringOrNull(row.target_program) || !isStringOrNull(row.target_institution) || !isStringOrNull(row.failure_kind) || !isStringOrNull(row.error)) throw new HistoryError('Saved work history could not be displayed.')
  if (row.status !== 'unlocked' && row.status !== 'generating' && row.status !== 'ready' && row.status !== 'failed') throw new HistoryError('Saved work history could not be displayed.')
  if (!isValidDateString(row.created_at) || row.started_at !== null && !isValidDateString(row.started_at) || row.finished_at !== null && !isValidDateString(row.finished_at)) throw new HistoryError('Saved work history could not be displayed.')
  if (typeof row.counts_against_limit !== 'boolean') throw new HistoryError('Saved work history could not be displayed.')
  return {
    assessment_id: row.assessment_id,
    attempt_id: row.attempt_id,
    status: row.status,
    report_status: row.report_status,
    overall_score: score(row.overall_score),
    assessment_band: row.assessment_band,
    statement_type: row.statement_type,
    degree: row.degree,
    field: row.field,
    target_program: row.target_program,
    target_institution: row.target_institution,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    generation_seconds: optionalSeconds(row.generation_seconds),
    remaining_successful_runs: nonnegativeInteger(row.remaining_successful_runs),
    max_successful_runs: row.max_successful_runs === null ? null : positiveInteger(row.max_successful_runs),
    counts_against_limit: row.counts_against_limit,
    failure_kind: row.failure_kind,
    error: row.error,
  }
}

async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(20_000)
    response = await fetch(path, { credentials: 'include', cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new HistoryError('We could not reach your saved work history.')
  }
  if (!response.ok) throw new HistoryError('Saved work history is unavailable right now.', response.status)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new HistoryError('Saved work history could not be displayed.')
  try { return await response.json() } catch { throw new HistoryError('Saved work history could not be displayed.') }
}

export async function getAssessmentHistory(signal?: AbortSignal): Promise<AssessmentHistoryItem[]> {
  const value = await request('/api/assessments/history', signal)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HistoryError('Saved work history could not be displayed.')
  const items = (value as Record<string, unknown>).items
  if (!Array.isArray(items)) throw new HistoryError('Saved work history could not be displayed.')
  return items.map(parseAssessmentItem)
}

export async function getCompleteReportHistory(signal?: AbortSignal): Promise<CompleteReportHistoryItem[]> {
  const value = await request('/api/assessments/complete/history', signal)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HistoryError('Saved work history could not be displayed.')
  const items = (value as Record<string, unknown>).items
  if (!Array.isArray(items)) throw new HistoryError('Saved work history could not be displayed.')
  return items.map(parseCompleteItem)
}
