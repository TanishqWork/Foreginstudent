import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CompleteReportError,
  generateCompleteReport,
  getCompleteReport,
  mockUnlockCompleteReport,
  parseCompleteReportState,
} from '../src/features/complete-report/api.ts'
import { CompleteContentError, parseCompleteReportContent } from '../src/features/complete-report/response.ts'
import { formatCompleteReport } from '../src/features/complete-report/format.ts'
import { clearAssessmentId, readAssessmentId, rememberAssessmentId } from '../src/features/complete-report/session.ts'
import { cachedCompleteState, completeFixture, reportWithEvidenceCount } from './complete-report-fixture.mjs'

const reportGroups = [
  'executive_summary', 'criterion_details', 'prompt_coverage', 'sentence_reviews',
  'paragraph_reviews', 'evidence_gaps', 'program_fit', 'voice_and_originality',
  'unsupported_claims', 'cut_or_expand', 'revision_plan',
]

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

test('parses every cached workflow state and preserves its canonical assessment', () => {
  for (const status of ['locked', 'unlocked', 'generating', 'ready', 'failed']) {
    const state = cachedCompleteState(status)
    const parsed = parseCompleteReportState(state, state.assessment_id)
    assert.equal(parsed.status, status)
    assert.equal(parsed.assessment.report.assessment_id, state.assessment_id)
    assert.equal(parsed.assessment.report.overall_score, completeFixture.assessment.report.overall_score)
    assert.equal(parsed.report?.report_version ?? null, state.report?.report_version ?? null)
    assert.equal(parsed.free_generation_seconds, 2.5)
  }
})

test('rejects an assessment ID mismatch at either envelope level', () => {
  assert.throws(() => parseCompleteReportState(cachedCompleteState(), 'some-other-assessment'))
  const value = cachedCompleteState()
  value.assessment.report.assessment_id = 'another-assessment'
  assert.throws(() => parseCompleteReportState(value))
})

test('rejects unsupported workflow states and report leaks while locked', () => {
  for (const changes of [
    { status: 'paid' }, { status: 'ready', report: null },
    { status: 'ready', report: 'Raw prose is not the structured contract.' },
    { status: 'locked', report: completeFixture.report }, { error: { detail: 'unexpected object' } },
  ]) assert.throws(() => parseCompleteReportState({ ...cachedCompleteState('locked'), ...changes }))
})

test('rejects invalid free and complete generation durations', () => {
  for (const field of ['generation_seconds', 'free_generation_seconds']) {
    for (const duration of [-1, Number.NaN, Number.POSITIVE_INFINITY, '12']) {
      assert.throws(() => parseCompleteReportState({ ...cachedCompleteState(), [field]: duration }))
    }
  }
})

test('the structured report includes all eleven required analytical groups', () => {
  const parsed = parseCompleteReportContent(structuredClone(completeFixture.report))
  for (const field of reportGroups) assert.ok(Object.hasOwn(parsed, field), field)
  assert.deepEqual(parsed.sentence_reviews, completeFixture.report.sentence_reviews)
  assert.deepEqual(parsed.paragraph_reviews, completeFixture.report.paragraph_reviews)
})

test('rejects unknown report versions and missing analytical groups', () => {
  const unsupported = { ...completeFixture.report, report_version: 'complete-report.v999' }
  assert.throws(() => parseCompleteReportContent(unsupported), CompleteContentError)
  for (const field of reportGroups) {
    const value = structuredClone(completeFixture.report)
    delete value[field]
    assert.throws(() => parseCompleteReportContent(value), CompleteContentError, field)
  }
})

test('rejects malformed nested report rows instead of passing invalid props to React', () => {
  const mutations = [
    (value) => { value.sentence_reviews[0].disposition = 'invented-classification' },
    (value) => { value.sentence_reviews[0].text = { html: '<img onerror=alert(1)>' } },
    (value) => { value.paragraph_reviews[0].quality.purpose.rating = '95/100' },
    (value) => { value.criterion_details[0].checkpoints[0].rating = '4' },
    (value) => { value.evidence_gaps = 'unexpected text' },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(completeFixture.report)
    mutate(value)
    assert.throws(() => parseCompleteReportContent(value), CompleteContentError)
  }
})

test('rejects model-selected section and component names outside the fixed contract', () => {
  for (const mutate of [
    (value) => { value.sections = [{ name: 'Model-selected heading' }] },
    (value) => { value.evidence_gaps[0].component_name = 'ModelSelectedComponent' },
  ]) {
    const value = structuredClone(completeFixture.report)
    mutate(value)
    assert.throws(() => parseCompleteReportContent(value), (error) => {
      assert.ok(error instanceof CompleteContentError)
      assert.ok(error.field.endsWith('<unexpected_field>'))
      return true
    })
  }
})

test('rejects duplicate finding IDs and incomplete rubric checkpoint inventories', () => {
  const duplicate = structuredClone(completeFixture.report)
  duplicate.evidence_gaps[0].finding_id = duplicate.sentence_reviews[0].finding_id
  assert.throws(() => parseCompleteReportContent(duplicate), CompleteContentError)
  for (const count of [3, 5]) {
    const value = structuredClone(completeFixture.report)
    const checkpoint = value.criterion_details[0].checkpoints[0]
    value.criterion_details[0].checkpoints = Array.from({ length: count }, (_, index) => ({ ...checkpoint, index: index + 1 }))
    assert.throws(() => parseCompleteReportContent(value), CompleteContentError)
  }
})

test('preserves unavailable nullable analysis without replacing it with fabricated content', () => {
  const value = structuredClone(completeFixture.report)
  value.report_status = 'needs_input'
  value.input_issues = ['Additional source context is needed.']
  for (const field of ['executive_summary', 'prompt_coverage', 'program_fit', 'voice_and_originality']) value[field] = null
  for (const field of ['criterion_details', 'sentence_reviews', 'paragraph_reviews', 'evidence_gaps', 'unsupported_claims', 'cut_or_expand', 'revision_plan']) value[field] = []
  const parsed = parseCompleteReportContent(value)
  assert.equal(parsed.executive_summary, null)
  assert.equal(parsed.program_fit, null)
  assert.equal(parsed.voice_and_originality, null)
  assert.deepEqual(parsed.evidence_gaps, [])
})

for (const count of [0, 1, 10, 25]) {
  test(`retains all ${count} repeated evidence findings for reusable cards and text export`, () => {
    const value = reportWithEvidenceCount(completeFixture.report, count)
    const parsed = parseCompleteReportContent(value)
    assert.equal(parsed.evidence_gaps.length, count)
    const text = formatCompleteReport(parsed, completeFixture.assessment)
    for (let index = 1; index <= count; index++) assert.ok(text.includes(`Preview evidence finding ${index}`))
    assert.ok(!text.includes(`Preview evidence finding ${count + 1}`))
  })
}

test('readable text export includes full source reviews and every analytical section', () => {
  const parsed = parseCompleteReportContent(completeFixture.report)
  const text = formatCompleteReport(parsed, completeFixture.assessment)
  for (const sentence of parsed.sentence_reviews) assert.ok(text.includes(sentence.text), sentence.sentence_id)
  for (const paragraph of parsed.paragraph_reviews) assert.ok(text.includes(paragraph.text), paragraph.paragraph_id)
  for (const title of ['Executive', 'Prompt', 'Sentence', 'Paragraph', 'Evidence', 'Program', 'Voice', 'Unsupported', 'Cut', 'Revision']) {
    assert.ok(text.toLowerCase().includes(title.toLowerCase()), title)
  }
  assert.ok(text.includes(String(completeFixture.assessment.report.overall_score)))
})

test('keeps incomplete and review-required analytical statuses explicit', () => {
  for (const status of ['incomplete', 'review_required']) {
    const value = structuredClone(completeFixture.report)
    value.report_status = status
    value.input_issues = ['Fictional unfinished review notice.']
    const parsed = parseCompleteReportContent(value)
    assert.equal(parsed.report_status, status)
    assert.deepEqual(parsed.input_issues, value.input_issues)
    assert.ok(formatCompleteReport(parsed, completeFixture.assessment).includes('Fictional unfinished review notice.'))
  }
})

test('requires a revision step for a ready report while preserving explicit incomplete output', () => {
  const value = structuredClone(completeFixture.report)
  value.revision_plan = []
  assert.throws(() => parseCompleteReportContent(value), (error) => {
    assert.ok(error instanceof CompleteContentError)
    assert.equal(error.field, 'report.revision_plan')
    return true
  })
  value.report_status = 'incomplete'
  value.input_issues = ['The revision plan has not been completed.']
  const parsed = parseCompleteReportContent(value)
  assert.equal(parsed.report_status, 'incomplete')
  assert.deepEqual(parsed.revision_plan, [])
  assert.deepEqual(parsed.input_issues, value.input_issues)
})

test('validation errors contain field paths without submitted prose', () => {
  const value = structuredClone(completeFixture.report)
  value.sentence_reviews[0].disposition = 'private-applicant-text-sentinel'
  assert.throws(() => parseCompleteReportContent(value), (error) => {
    assert.ok(error instanceof CompleteContentError)
    assert.equal(typeof error.field, 'string')
    assert.ok(!error.message.includes('private-applicant-text-sentinel'))
    return true
  })
})

test('fetches encoded assessment IDs using the existing signed-in credentials', async (t) => {
  const id = 'assessment/with space?#☃'
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return jsonResponse(cachedCompleteState('locked', id))
  })
  const state = await getCompleteReport(id)
  assert.equal(state.assessment_id, id)
  assert.equal(calls[0].url, `/api/assessments/${encodeURIComponent(id)}/complete`)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.method ?? 'GET', 'GET')
  assert.equal(calls[0].options.cache, 'no-store')
})

test('mock unlock POST returns the same structured metadata envelope', async (t) => {
  const id = 'assessment/with space'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/assessments/${encodeURIComponent(id)}/mock-unlock`)
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'include')
    return jsonResponse(cachedCompleteState('unlocked', id))
  })
  assert.equal((await mockUnlockCompleteReport(id)).status, 'unlocked')
})

for (const status of [401, 403, 404, 409, 422, 502]) {
  test(`preserves safe HTTP ${status} handling without echoing provider details`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ detail: 'private-provider-or-essay-sentinel' }, status))
    await assert.rejects(getCompleteReport('private-id'), (error) => {
      assert.ok(error instanceof CompleteReportError)
      assert.equal(error.status, status)
      assert.ok(!error.message.includes('private-provider-or-essay-sentinel'))
      return true
    })
  })
}

test('generation POST returns validated structured report and measured durations', async (t) => {
  const id = 'fictional-id'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `/api/assessments/${id}/complete`)
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'include')
    return jsonResponse(cachedCompleteState('ready', id))
  })
  const result = await generateCompleteReport(id)
  assert.equal(result.status, 'ready')
  assert.equal(result.report.report_version, 'complete-report.v1')
  assert.equal(result.generation_seconds, 1.25)
  assert.equal(result.free_generation_seconds, 2.5)
})

test('a finished generation preserves an incomplete analytical report and its canonical baseline', async (t) => {
  const id = 'fictional-incomplete-id'
  const value = cachedCompleteState('ready', id)
  value.report.report_status = 'incomplete'
  value.report.revision_plan = []
  value.report.input_issues = ['The revision plan has not been completed.']
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(value))
  const result = await generateCompleteReport(id)
  assert.equal(result.status, 'ready')
  assert.equal(result.report.report_status, 'incomplete')
  assert.deepEqual(result.report.revision_plan, [])
  assert.deepEqual(result.report.input_issues, value.report.input_issues)
  assert.equal(result.assessment.report.assessment_id, id)
  assert.equal(result.assessment.report.overall_score, value.assessment.report.overall_score)
})

test('rejects raw text, HTML, malformed JSON, and wrong report identity on generation', async (t) => {
  let body = new Response('A raw report.', { headers: { 'Content-Type': 'text/plain' } })
  t.mock.method(globalThis, 'fetch', async () => body)
  for (body of [
    new Response('A raw report.', { headers: { 'Content-Type': 'text/plain' } }),
    new Response('<html>unexpected</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{ malformed', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse(cachedCompleteState('ready', 'a-different-id')),
  ]) await assert.rejects(generateCompleteReport('fictional-id'), CompleteReportError)
})

function installStorage(t, storage) {
  for (const [key, value] of [['window', { sessionStorage: storage }], ['sessionStorage', storage]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key])
  }
}

function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), values }
}

test('remembers only assessment IDs, scoped to each signed-in user', (t) => {
  const storage = memoryStorage()
  installStorage(t, storage)
  rememberAssessmentId('session-test-user-a', 'assessment-a')
  rememberAssessmentId('session-test-user-b', 'assessment-b')
  assert.equal(readAssessmentId('session-test-user-a'), 'assessment-a')
  assert.equal(readAssessmentId('session-test-user-b'), 'assessment-b')
  assert.equal(readAssessmentId('session-test-user-c'), null)
  assert.ok([...storage.values.values()].every((value) => ['assessment-a', 'assessment-b'].includes(value)))
  clearAssessmentId('session-test-user-a')
  assert.equal(readAssessmentId('session-test-user-a'), null)
  assert.equal(readAssessmentId('session-test-user-b'), 'assessment-b')
  clearAssessmentId('session-test-user-b')
})

test('an expired older assessment cannot clear a newer assessment ID', (t) => {
  installStorage(t, memoryStorage())
  rememberAssessmentId('session-test-latest-user', 'old-assessment')
  rememberAssessmentId('session-test-latest-user', 'new-assessment')
  clearAssessmentId('session-test-latest-user', 'old-assessment')
  assert.equal(readAssessmentId('session-test-latest-user'), 'new-assessment')
  clearAssessmentId('session-test-latest-user', 'new-assessment')
  assert.equal(readAssessmentId('session-test-latest-user'), null)
})

test('unavailable browser storage falls back to user-scoped in-memory IDs', (t) => {
  installStorage(t, {
    getItem() { throw new Error('Storage disabled') },
    setItem() { throw new Error('Storage disabled') },
    removeItem() { throw new Error('Storage disabled') },
  })
  rememberAssessmentId('session-test-memory-a', 'memory-assessment')
  assert.equal(readAssessmentId('session-test-memory-a'), 'memory-assessment')
  assert.equal(readAssessmentId('session-test-memory-b'), null)
  clearAssessmentId('session-test-memory-a')
  assert.equal(readAssessmentId('session-test-memory-a'), null)
})
