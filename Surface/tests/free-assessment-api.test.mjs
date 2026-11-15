import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  FreeAssessmentError, parseFreeAssessmentState, waitForFreeAssessment,
} from '../src/features/assessment/api.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/free-diagnostic.v1.json', import.meta.url), 'utf8'))
const id = fixture.report.assessment_id
const generating = { assessment_id: id, status: 'generating', assessment: null, generation_seconds: null, error: null }
const ready = { assessment_id: id, status: 'ready', assessment: structuredClone(fixture), generation_seconds: 131.2, error: null }
const failed = { assessment_id: id, status: 'failed', assessment: null, generation_seconds: 12, error: 'The assessment could not finish. Please try again.' }
const noSleep = async () => {}

test('parses generating, ready, and failed states', () => {
  assert.equal(parseFreeAssessmentState(generating).status, 'generating')
  const parsed = parseFreeAssessmentState(structuredClone(ready), id)
  assert.equal(parsed.assessment.report.assessment_id, id)
  assert.equal(parsed.generation_seconds, 131.2)
  assert.equal(parseFreeAssessmentState(failed).error, failed.error)
})

test('rejects inconsistent or mismatched states', () => {
  for (const bad of [
    { ...generating, status: 'done' },
    { ...ready, assessment: null },
    { ...generating, assessment: structuredClone(fixture) },
    { ...generating, generation_seconds: -1 },
    { ...ready, assessment_id: 'other', assessment: structuredClone(fixture) },
  ]) assert.throws(() => parseFreeAssessmentState(bad), FreeAssessmentError)
  assert.throws(() => parseFreeAssessmentState(generating, 'other-id'), FreeAssessmentError)
})

test('polls until the saved result is ready', async () => {
  const states = [generating, generating, ready]
  let reads = 0
  const result = await waitForFreeAssessment(id, { sleep: noSleep, read: async () => parseFreeAssessmentState(structuredClone(states[reads++])) })
  assert.equal(reads, 3)
  assert.equal(result.status, 'ready')
  assert.equal(result.assessment.report.assessment_id, id)
})

test('a failed run ends the wait with its saved message', async () => {
  await assert.rejects(
    waitForFreeAssessment(id, { sleep: noSleep, read: async () => parseFreeAssessmentState(failed) }),
    { name: 'FreeAssessmentError', message: failed.error },
  )
})

test('dropped polls and server errors are retried; sign-out stops the wait', async () => {
  const outcomes = [new FreeAssessmentError('offline'), new FreeAssessmentError('busy', 503), ready]
  let reads = 0
  const result = await waitForFreeAssessment(id, {
    sleep: noSleep,
    read: async () => {
      const next = outcomes[reads++]
      if (next instanceof Error) throw next
      return parseFreeAssessmentState(structuredClone(next))
    },
  })
  assert.equal(reads, 3)
  assert.equal(result.status, 'ready')
  await assert.rejects(
    waitForFreeAssessment(id, { sleep: noSleep, read: async () => { throw new FreeAssessmentError('signed out', 401) } }),
    { status: 401 },
  )
})

test('gives up after the wait limit', async () => {
  await assert.rejects(
    waitForFreeAssessment(id, { sleep: noSleep, limitMs: 0, read: async () => parseFreeAssessmentState(generating) }),
    /took longer than expected/,
  )
})
