import { parseDiagnosticResponse } from './diagnostic/response.ts'
import type { DiagnosticResponse } from './diagnostic/types.ts'

/** POST /free saves a `generating` assessment and returns at once; GET /{id}/free reports its progress. */
export type FreeAssessmentStatus = 'generating' | 'ready' | 'failed'
export type FreeAssessmentState = {
  assessment_id: string
  status: FreeAssessmentStatus
  assessment: DiagnosticResponse | null
  generation_seconds: number | null
  error: string | null
}

export const FREE_POLL_INTERVAL_MS = 3_000
/** The backend gives up after 220 seconds; this leaves room for a final poll. */
export const FREE_WAIT_LIMIT_MS = 300_000

export class FreeAssessmentError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'FreeAssessmentError'
    this.status = status
  }
}

const unreadable = 'The assessment service returned an unsupported response. Please try again. Your draft is still here.'

function invalid(): never { throw new FreeAssessmentError(unreadable) }

export function parseFreeAssessmentState(value: unknown, expectedId?: string): FreeAssessmentState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid()
  const row = value as Record<string, unknown>
  if (typeof row.assessment_id !== 'string' || !row.assessment_id.trim()) invalid()
  if (expectedId !== undefined && row.assessment_id !== expectedId) invalid()
  if (row.status !== 'generating' && row.status !== 'ready' && row.status !== 'failed') invalid()
  if (row.error !== null && typeof row.error !== 'string') invalid()
  const seconds = row.generation_seconds
  if (seconds !== null && (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)) invalid()
  if ((row.status === 'ready') !== (row.assessment !== null)) invalid()
  // A malformed report keeps its DiagnosticResponseError so the field can be logged.
  const assessment = row.assessment === null ? null : parseDiagnosticResponse(row.assessment)
  if (assessment && assessment.report.assessment_id !== row.assessment_id) invalid()
  return { assessment_id: row.assessment_id, status: row.status, assessment, generation_seconds: seconds as number | null, error: row.error as string | null }
}

function failure(status: number): FreeAssessmentError {
  const message = status === 404 ? 'This assessment is no longer available. Your draft is still here; run it again.'
    : status === 503 ? 'The assessment service is unavailable right now. Your draft is still here; please try again.'
      : 'The assessment could not finish. Check your connection and try again. Your draft is still here.'
  return new FreeAssessmentError(message, status)
}

async function send(url: string, init: RequestInit, signal: AbortSignal | undefined, expectedId?: string): Promise<FreeAssessmentState> {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(20_000)
    response = await fetch(url, { ...init, credentials: 'include', cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new FreeAssessmentError('We could not reach the assessment service. Check your connection; your draft is still here.')
  }
  if (!response.ok) throw failure(response.status)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) invalid()
  let value: unknown
  try { value = await response.json() } catch { invalid() }
  return parseFreeAssessmentState(value, expectedId)
}

export function startFreeAssessment(body: Record<string, unknown>, signal?: AbortSignal): Promise<FreeAssessmentState> {
  return send('/api/assessments/free', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, signal)
}

export function getFreeAssessment(assessmentId: string, signal?: AbortSignal): Promise<FreeAssessmentState> {
  return send(`/api/assessments/${encodeURIComponent(assessmentId)}/free`, { method: 'GET' }, signal, assessmentId)
}

type WaitOptions = {
  signal?: AbortSignal
  intervalMs?: number
  limitMs?: number
  read?: typeof getFreeAssessment
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve() }, ms)
    function stop() { clearTimeout(timer); reject(signal?.reason) }
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/** Poll until the saved assessment is ready. A failed run throws its saved, student-safe message. */
export async function waitForFreeAssessment(assessmentId: string, options: WaitOptions = {}): Promise<FreeAssessmentState & { assessment: DiagnosticResponse }> {
  const { signal, intervalMs = FREE_POLL_INTERVAL_MS, limitMs = FREE_WAIT_LIMIT_MS, read = getFreeAssessment, sleep = pause } = options
  const deadline = Date.now() + limitMs
  while (Date.now() < deadline) {
    await sleep(intervalMs, signal)
    let state: FreeAssessmentState
    try {
      state = await read(assessmentId, signal)
    } catch (cause) {
      // A dropped poll or server error is retried; sign-out, a missing assessment, or an unreadable report stop the wait.
      if (signal?.aborted || !(cause instanceof FreeAssessmentError) || cause.message === unreadable) throw cause
      if (cause.status !== 0 && cause.status < 500) throw cause
      continue
    }
    if (state.status === 'ready' && state.assessment) return { ...state, assessment: state.assessment }
    if (state.status === 'failed') throw new FreeAssessmentError(state.error ?? 'The assessment could not finish. Your draft is still here; please try again.')
  }
  throw new FreeAssessmentError('The review took longer than expected. Your draft is still here; please try again.')
}
