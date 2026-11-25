import { parseDiagnosticResponse } from '../assessment/diagnostic/response.ts'
import { parseCompleteReportContent } from './response.ts'
import type { CompleteReportState, CompleteReportStatus } from './types.ts'

export class CompleteReportError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'CompleteReportError'
    this.status = status
  }
}

export class CheckoutError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'CheckoutError'
    this.status = status
  }
}

function invalidResponse(): never {
  throw new CompleteReportError('The report response could not be displayed. Please try again.')
}

function optionalSeconds(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidResponse()
  return value
}

export function parseCompleteReportState(value: unknown, expectedAssessmentId?: string): CompleteReportState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  const row = value as Record<string, unknown>
  if (typeof row.assessment_id !== 'string' || !row.assessment_id.trim()) invalidResponse()
  if (expectedAssessmentId !== undefined && row.assessment_id !== expectedAssessmentId) invalidResponse()
  const statuses: CompleteReportStatus[] = ['locked', 'unlocked', 'generating', 'ready', 'failed']
  if (typeof row.status !== 'string' || !statuses.includes(row.status as CompleteReportStatus)) invalidResponse()
  if (row.error !== null && typeof row.error !== 'string') invalidResponse()
  const status = row.status as CompleteReportStatus
  let report = null
  if (row.report !== null) {
    try { report = parseCompleteReportContent(row.report) } catch { invalidResponse() }
  }
  if (status === 'ready' ? report === null : report !== null) invalidResponse()
  let assessment
  try { assessment = parseDiagnosticResponse(row.assessment) } catch { invalidResponse() }
  if (assessment.report.assessment_id !== row.assessment_id) invalidResponse()
  const remaining = row.remaining_successful_runs
  const successful = row.successful_runs
  const max = row.max_successful_runs
  if (typeof remaining !== 'number' || !Number.isInteger(remaining) || remaining < 0) invalidResponse()
  if (typeof successful !== 'number' || !Number.isInteger(successful) || successful < 0) invalidResponse()
  if (max !== null && (typeof max !== 'number' || !Number.isInteger(max) || max < 1)) invalidResponse()
  const cycleExpiresAt = row.cycle_expires_at ?? null
  if (cycleExpiresAt !== null && (typeof cycleExpiresAt !== 'string' || !Number.isFinite(Date.parse(cycleExpiresAt)))) invalidResponse()
  if (row.can_generate !== undefined && typeof row.can_generate !== 'boolean') invalidResponse()
  return {
    assessment_id: row.assessment_id,
    status,
    assessment,
    report,
    generation_seconds: optionalSeconds(row.generation_seconds),
    free_generation_seconds: optionalSeconds(row.free_generation_seconds),
    remaining_successful_runs: remaining,
    successful_runs: successful,
    max_successful_runs: max,
    can_generate: row.can_generate ?? (status !== 'locked' && status !== 'generating' && remaining > 0),
    cycle_expires_at: cycleExpiresAt,
    error: row.error,
  }
}

function requestFailure(status: number): CompleteReportError {
  const message = status === 401 ? 'Sign in to continue with your report.'
    : status === 404 ? 'This assessment is no longer available. Run a free assessment to start again.'
      : status === 409 ? 'Your complete report is already unlocked or being generated.'
        : status === 403 ? 'Purchase this assessment before generating its complete report, or use an existing paid generation.'
          : status === 422 ? 'This assessment needs more information before a complete report can be generated.'
            : status === 503 ? 'Checkout is not configured yet. Please try again later.'
            : 'The complete report could not finish. Please try again.'
  return new CompleteReportError(message, status)
}

async function request(assessmentId: string, suffix: string, method: 'GET' | 'POST', signal?: AbortSignal): Promise<Response> {
  let response: Response
  // POST /complete only starts generation (202 + status "generating"); the page then polls GET for the result.
  const timeout = 20_000
  try {
    response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/${suffix}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new CompleteReportError('We could not reach your report. Check your connection and try again.')
  }
  if (!response.ok) throw requestFailure(response.status)
  return response
}

async function stateResponse(response: Response, assessmentId: string): Promise<CompleteReportState> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) invalidResponse()
  let value: unknown
  try { value = await response.json() } catch { invalidResponse() }
  return parseCompleteReportState(value, assessmentId)
}

export async function getCompleteReport(assessmentId: string, signal?: AbortSignal, attemptId?: string): Promise<CompleteReportState> {
  const suffix = attemptId ? `complete?${new URLSearchParams({ attempt_id: attemptId })}` : 'complete'
  return stateResponse(await request(assessmentId, suffix, 'GET', signal), assessmentId)
}

export async function purchaseCompleteReport(assessmentId: string, signal?: AbortSignal): Promise<CompleteReportState> {
  return stateResponse(await request(assessmentId, 'complete/purchase', 'POST', signal), assessmentId)
}

export async function createCompleteReportCheckout(assessmentId: string, signal?: AbortSignal): Promise<string> {
  const response = await request(assessmentId, 'complete/checkout', 'POST', signal)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new CheckoutError('Checkout could not be opened. Please try again.')
  }
  let value: unknown
  try { value = await response.json() } catch { throw new CheckoutError('Checkout could not be opened. Please try again.') }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new CheckoutError('Checkout could not be opened. Please try again.')
  }
  const url = (value as Record<string, unknown>).url
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new CheckoutError('Checkout could not be opened. Please try again.')
  }
  return url
}

export async function generateCompleteReport(assessmentId: string, signal?: AbortSignal): Promise<CompleteReportState> {
  return stateResponse(await request(assessmentId, 'complete', 'POST', signal), assessmentId)
}
