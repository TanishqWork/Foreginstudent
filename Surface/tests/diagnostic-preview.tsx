import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '../src/index.css'
import DiagnosticResult from '../src/features/assessment/diagnostic/DiagnosticResult'
import { parseDiagnosticResponse } from '../src/features/assessment/diagnostic/response'
import fixture from './fixtures/free-diagnostic.v1.json'

function sample(mode: string): unknown {
  if (mode === 'unsupported') return { ...fixture, schema_version: 'free-diagnostic.v999' }
  if (mode === 'provisional') return { ...fixture, report: { ...fixture.report, status: 'provisional', missing_context: ['Program details have not been supplied for interpreting the fit argument.'], confidence: { level: 'moderate', reason: 'The score is provisional because relevant program context is missing.' }, recommendation: { ...fixture.report.recommendation, provisional: true } } }
  if (mode === 'needs_input') return { ...fixture, report: { ...fixture.report, status: 'needs_input', overall_score: null, assessment_band: null, scored_weight: 0, strongest_categories: [], weakest_categories: [], input_issues: ['Not enough rubric dimensions could be assessed with the available context.'], recommendation: { ...fixture.report.recommendation, path: null, reason: 'More context is needed before recommending a revision path.', next_action: 'Add the requested context and run the assessment again.' } }, diagnostic: { ...fixture.diagnostic, revision_opportunity: null } }
  if (mode === 'no_risk') return { ...fixture, report: { ...fixture.report, riskiest_sentence: { sentence_id: null, paragraph: null, quote: null, supporting_sentence_ids: [], explanation: 'No sentence-specific concern was identified.' } } }
  return fixture
}

export function Preview() {
  const [mode, setMode] = useState('complete')
  let response: ReturnType<typeof parseDiagnosticResponse> | null = null
  let issue = ''
  try { response = parseDiagnosticResponse(sample(mode)) }
  catch (error) { issue = error instanceof Error ? error.message : 'Invalid preview response.' }
  return <>
    <aside className="border-b border-line bg-parchment p-4 text-center text-sm">
      <strong>Fictional development fixture — no AI request or account required.</strong>{' '}
      <label>Preview state <select className="ml-2 rounded border border-line bg-white p-2" value={mode} onChange={(event) => setMode(event.target.value)}>
        <option value="complete">Complete</option><option value="provisional">Provisional</option><option value="needs_input">Needs input</option><option value="no_risk">No risky sentence</option><option value="unsupported">Unsupported version</option>
      </select></label>
    </aside>
    <main className="mx-auto w-[calc(100%_-_32px)] max-w-[1320px]">{response ? <DiagnosticResult response={response} onStartAnother={() => setMode('complete')} /> : <p role="alert" className="rounded-xl border border-line bg-white p-6">{issue}</p>}</main>
  </>
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Preview /></BrowserRouter>)
