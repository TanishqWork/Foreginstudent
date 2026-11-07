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
  return {
    assessment_id: row.assessment_id,
    status,
    assessment,
    report,
    generation_seconds: optionalSeconds(row.generation_seconds),
    free_generation_seconds: optionalSeconds(row.free_generation_seconds),
    error: row.error,
  }
}

function requestFailure(status: number): CompleteReportError {
  const message = status === 401 ? 'Sign in to continue with your report.'
    : status === 404 ? 'This assessment is no longer available. Run a free assessment to start again.'
      : status === 409 ? 'Your complete report is already being generated.'
        : status === 403 ? 'Unlock this assessment before generating its complete report.'
          : status === 422 ? 'This assessment needs more information before a complete report can be generated.'
            : 'The complete report could not finish. Please try again.'
  return new CompleteReportError(message, status)
}

async function request(assessmentId: string, suffix: string, method: 'GET' | 'POST', signal?: AbortSignal): Promise<Response> {
  let response: Response
  const timeout = suffix === 'complete' && method === 'POST' ? 300_000 : 20_000
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

export async function getCompleteReport(assessmentId: string, signal?: AbortSignal): Promise<CompleteReportState> {
  return stateResponse(await request(assessmentId, 'complete', 'GET', signal), assessmentId)
}

export async function mockUnlockCompleteReport(assessmentId: string, signal?: AbortSignal): Promise<CompleteReportState> {
  return stateResponse(await request(assessmentId, 'mock-unlock', 'POST', signal), assessmentId)
}

export async function generateCompleteReport(assessmentId: string, signal?: AbortSignal): Promise<CompleteReportState> {
  return stateResponse(await request(assessmentId, 'complete', 'POST', signal), assessmentId)
}
