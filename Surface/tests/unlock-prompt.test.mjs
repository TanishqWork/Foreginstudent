import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  UNLOCK_PROMPT_MIN_SECONDS, UNLOCK_PROMPT_VISIBLE_SECONDS, canOfferUnlock, isUnlockPromptDue,
  rememberUnlockPromptShown, truncateQuote, unlockHighlights, wasUnlockPromptShown,
} from '../src/features/assessment/diagnostic/unlock-prompt.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/free-diagnostic.v1.json', import.meta.url), 'utf8'))
const copy = () => structuredClone(fixture)

test('appears after 30 visible seconds, or on reaching the unlock section after 15', () => {
  assert.equal(UNLOCK_PROMPT_VISIBLE_SECONDS, 30)
  assert.equal(UNLOCK_PROMPT_MIN_SECONDS, 15)
  assert.equal(isUnlockPromptDue(29, false), false)
  assert.equal(isUnlockPromptDue(30, false), true)
  assert.equal(isUnlockPromptDue(14, true), false)
  assert.equal(isUnlockPromptDue(15, true), true)
})

test('is offered only for a scored result', () => {
  const value = copy()
  assert.equal(canOfferUnlock(value.report), true)
  value.report.status = 'needs_input'
  assert.equal(canOfferUnlock(value.report), false)
  const unscored = copy()
  unscored.report.overall_score = null
  assert.equal(canOfferUnlock(unscored.report), false)
  assert.equal(unlockHighlights(unscored), null)
})

test('every claim comes from the student result', () => {
  const value = copy()
  const highlights = unlockHighlights(value)
  const weakest = [...value.report.weakest_categories].sort((a, b) => a.score - b.score)[0]
  assert.equal(highlights.score, value.report.overall_score)
  assert.equal(highlights.weakestLabel, weakest?.label ?? null)
  assert.equal(highlights.concernTitle, value.report.main_concern.title)
})

test('long quotes are shortened on a word boundary', () => {
  const short = 'I learned to listen.'
  assert.equal(truncateQuote(short), short)
  const long = `${'word '.repeat(60)}end`
  const result = truncateQuote(long, 40)
  assert.ok(result.endsWith('…') && result.length <= 41)
  assert.ok(!result.slice(0, -1).endsWith(' '))
})

test('shows once per assessment even without browser storage', () => {
  assert.equal(wasUnlockPromptShown('assessment-x'), false)
  rememberUnlockPromptShown('assessment-x')
  assert.equal(wasUnlockPromptShown('assessment-x'), true)
  assert.equal(wasUnlockPromptShown('assessment-y'), false)
})
