import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DiagnosticResponseError, parseDiagnosticResponse } from '../src/features/assessment/diagnostic/response.ts'

// Synthetic, backend-validated V1 output. No provider or browser is needed.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/free-diagnostic.v1.json', import.meta.url), 'utf8'))
const copy = () => structuredClone(fixture)

function rejects(value, field) {
  assert.throws(() => parseDiagnosticResponse(value), (error) => {
    assert.ok(error instanceof DiagnosticResponseError)
    assert.equal(error.field, field)
    return true
  })
}

test('accepts the backend fixture and preserves the report identity and displayed values', () => {
  const result = parseDiagnosticResponse(copy())
  assert.equal(result.schema_version, 'free-diagnostic.v1')
  assert.equal(result.report.assessment_id, fixture.report.assessment_id)
  assert.equal(result.report.overall_score, fixture.report.overall_score)
  assert.deepEqual(result.context, fixture.context)
  assert.deepEqual(result.report.strongest_categories, fixture.report.strongest_categories)
  assert.deepEqual(result.diagnostic.evidence_examples, fixture.diagnostic.evidence_examples)
})

test('all pathways use the same V1 response contract', () => {
  for (const pathway of ['health', 'business', 'stem', 'policy']) {
    const value = copy()
    value.context.pathway = pathway
    assert.equal(parseDiagnosticResponse(value).context.pathway, pathway)
  }
})

test('rejects unknown versions with a safe message and debug field', () => {
  const value = copy()
  value.schema_version = 'free-diagnostic.v2'
  rejects(value, 'schema_version')
  assert.throws(() => parseDiagnosticResponse(value), /format is not supported/)
})

test('rejects missing sections and malformed display arrays', () => {
  const value = copy()
  delete value.diagnostic
  rejects(value, 'diagnostic')
  const malformed = copy()
  malformed.report.priority_actions = ['A valid action', { unsafe: 'unexpected object' }]
  rejects(malformed, 'report.priority_actions[1]')
})

for (const score of [-1, 101, 50.5, Number.NaN, Number.POSITIVE_INFINITY, '75']) {
  test(`rejects invalid overall score ${String(score)}`, () => {
    const value = copy()
    value.report.overall_score = score
    rejects(value, 'report.overall_score')
  })
}

test('accepts a provisional score and its limitations', () => {
  const value = copy()
  value.report.status = 'provisional'
  value.report.confidence.level = 'moderate'
  value.report.missing_context = ['Program context was not supplied.']
  value.report.recommendation.provisional = true
  const result = parseDiagnosticResponse(value)
  assert.equal(result.report.status, 'provisional')
  assert.equal(result.report.overall_score, fixture.report.overall_score)
  assert.deepEqual(result.report.missing_context, value.report.missing_context)
})

test('accepts needs-input without turning a null score into zero', () => {
  const value = copy()
  Object.assign(value.report, {
    status: 'needs_input', overall_score: null, overall_unrounded: null,
    assessment_band: null, scored_weight: 0, renormalized: false,
    strongest_categories: [], weakest_categories: [], input_issues: ['Provide meaningful applicant prose.'],
  })
  value.report.recommendation.path = null
  value.diagnostic.revision_opportunity = null
  const result = parseDiagnosticResponse(value)
  assert.equal(result.report.overall_score, null)
  assert.equal(result.report.recommendation.path, null)
})

test('rejects a complete report with no score and a needs-input report with a score', () => {
  const complete = copy()
  complete.report.overall_score = null
  rejects(complete, 'report.score_state')
  const needsInput = copy()
  needsInput.report.status = 'needs_input'
  rejects(needsInput, 'report.score_state')
})

test('allows no sentence-specific risk, but rejects a partial quotation reference', () => {
  const value = copy()
  value.report.riskiest_sentence = {
    sentence_id: null, paragraph: null, quote: null,
    explanation: 'No sentence-specific concern was identified.', supporting_sentence_ids: [],
  }
  assert.equal(parseDiagnosticResponse(value).report.riskiest_sentence.quote, null)
  value.report.riskiest_sentence.sentence_id = 's1'
  rejects(value, 'report.riskiest_sentence')
})

test('rejects repeated categories and invalid category scores', () => {
  const duplicate = copy()
  duplicate.report.weakest_categories[0] = structuredClone(duplicate.report.strongest_categories[0])
  rejects(duplicate, 'report.category_rankings')
  const score = copy()
  score.report.strongest_categories[0].score = 120
  rejects(score, 'report.strongest_categories[0].score')
})

test('rejects duplicate evidence example IDs so the display count stays meaningful', () => {
  const value = copy()
  const example = value.diagnostic.evidence_examples[0]
  assert.ok(example, 'The fixture should include one grounded example')
  value.diagnostic.evidence_examples.push(structuredClone(example))
  rejects(value, 'diagnostic.evidence_examples')
})

test('invalid data errors never repeat submitted text', () => {
  const value = copy()
  value.report.overall_score = 'private-essay-sentinel'
  assert.throws(() => parseDiagnosticResponse(value), (error) => {
    assert.ok(!String(error).includes('private-essay-sentinel'))
    return true
  })
})
