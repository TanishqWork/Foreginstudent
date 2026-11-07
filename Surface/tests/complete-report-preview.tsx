import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import CompleteReport from '../src/features/complete-report/CompleteReport'
import { parseCompleteReportState } from '../src/features/complete-report/api'
import { cachedCompleteState, reportWithEvidenceCount } from './complete-report-fixture.mjs'

export function Preview() {
  const [count, setCount] = useState('10')
  const [mode, setMode] = useState('ready')
  const state = cachedCompleteState()
  state.report = reportWithEvidenceCount(state.report, Number(count))
  if (mode === 'incomplete') {
    state.report.report_status = 'incomplete'
    state.report.input_issues = ['Fictional incomplete generation: some review sections need another attempt.']
  } else if (mode === 'review_required') {
    state.report.report_status = 'review_required'
    state.report.discrepancies = [{ finding_id: 'discrepancy:preview', baseline_field: '/overall_score', issue: 'Fictional baseline finding requires review.', evidence: [], resolution_needed: 'Confirm the original assessment before accepting this report.' }]
  } else if (mode === 'provisional') {
    state.assessment.report.status = 'provisional'
    state.assessment.report.recommendation.provisional = true
    state.assessment.report.missing_context = ['Fictional program context has not been supplied.']
    if (state.report.executive_summary) state.report.executive_summary.assessment_status = 'provisional'
  } else if (mode === 'literal_markup' && state.report.executive_summary) {
    state.report.executive_summary.argument_summary = '<strong data-fixture-injected="true">This must remain literal text.</strong>'
  }
  let issue = ''
  let parsed: ReturnType<typeof parseCompleteReportState> | null = null
  try { parsed = parseCompleteReportState(state) }
  catch (cause) { issue = cause instanceof Error ? cause.message : 'Invalid fixture.' }
  return <>
    <aside className="border-b border-line bg-parchment p-4 text-center text-sm">
      <strong>Fictional development fixture — no AI request, account, or payment required.</strong>
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        <label>Evidence findings <select className="ml-2 rounded border border-line bg-white p-2" value={count} onChange={(event) => setCount(event.target.value)}>{['0', '1', '10', '25'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Report state <select className="ml-2 rounded border border-line bg-white p-2" value={mode} onChange={(event) => setMode(event.target.value)}><option value="ready">Ready</option><option value="provisional">Provisional assessment</option><option value="incomplete">Incomplete report</option><option value="review_required">Baseline review required</option><option value="literal_markup">Literal markup text</option></select></label>
      </div>
    </aside>
    <main className="mx-auto w-[calc(100%_-_32px)] max-w-[1320px] py-8">{parsed?.report ? <CompleteReport report={parsed.report} assessment={parsed.assessment} /> : <p role="alert">{issue}</p>}</main>
  </>
}

createRoot(document.getElementById('root')!).render(<Preview />)
