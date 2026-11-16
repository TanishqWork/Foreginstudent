import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import { BrowserRouter } from 'react-router'
import '../src/index.css'
import '../src/features/student/student.css'

const now = Date.now()
const iso = (daysAgo: number, hoursAgo = 0) => new Date(now - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000).toISOString()

globalThis.fetch = async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes('/api/assessments/complete/history')) {
    return Response.json({
      items: [
        {
          assessment_id: 'assessment-1',
          entitlement_id: 'entitlement-1',
          attempt_id: 'attempt-ready',
          status: 'ready',
          statement_type: 'personal_statement',
          degree: 'Masters',
          field: 'Computer Science',
          target_program: 'MS Computer Science',
          target_institution: 'Columbia University',
          overall_score: 82,
          assessment_band: 'Strong',
          created_at: iso(0, 3),
          started_at: iso(0, 3),
          finished_at: iso(0, 2),
          updated_at: iso(0, 2),
          remaining_successful_runs: 1,
          max_successful_runs: 2,
          counts_against_limit: true,
          failure_kind: null,
          error: null,
          report_status: 'ready',
          generation_seconds: 48.3,
        },
        {
          assessment_id: 'assessment-1',
          entitlement_id: 'entitlement-1',
          attempt_id: 'attempt-failed',
          status: 'failed',
          statement_type: 'personal_statement',
          degree: 'Masters',
          field: 'Computer Science',
          target_program: 'MS Computer Science',
          target_institution: 'Columbia University',
          overall_score: 82,
          assessment_band: 'Strong',
          created_at: iso(1, 4),
          started_at: iso(1, 4),
          finished_at: iso(1, 4),
          updated_at: iso(1, 4),
          remaining_successful_runs: 1,
          max_successful_runs: 2,
          counts_against_limit: false,
          failure_kind: 'provider_error',
          error: 'Provider request timed out.',
          report_status: null,
          generation_seconds: null,
        },
        {
          assessment_id: 'assessment-3',
          entitlement_id: 'entitlement-3',
          attempt_id: null,
          status: 'unlocked',
          statement_type: 'sop',
          degree: 'MBA',
          field: 'Business',
          target_program: 'MBA',
          target_institution: 'University of Toronto',
          overall_score: 74,
          assessment_band: 'Competitive',
          created_at: iso(5),
          started_at: null,
          finished_at: null,
          updated_at: iso(5),
          remaining_successful_runs: 2,
          max_successful_runs: 2,
          counts_against_limit: false,
          failure_kind: null,
          error: null,
          report_status: null,
          generation_seconds: null,
        },
      ],
    })
  }
  if (url.includes('/api/assessments/history')) {
    return Response.json({
      items: [
        {
          assessment_id: 'assessment-1',
          status: 'ready',
          statement_type: 'personal_statement',
          degree: 'Masters',
          field: 'Computer Science',
          target_program: 'MS Computer Science',
          target_institution: 'Columbia University',
          overall_score: 82,
          assessment_band: 'Strong',
          created_at: iso(0, 5),
          generation_seconds: 12.4,
          error: null,
          has_complete_report_access: true,
          complete_report_remaining_runs: 1,
          complete_report_max_runs: 2,
        },
        {
          assessment_id: 'assessment-2',
          status: 'ready',
          statement_type: 'scholarship',
          degree: 'Masters',
          field: 'Public Policy',
          target_program: 'Chevening Scholarship',
          target_institution: null,
          overall_score: 68,
          assessment_band: 'Promising',
          created_at: iso(3),
          generation_seconds: 10.8,
          error: null,
          has_complete_report_access: false,
          complete_report_remaining_runs: 0,
          complete_report_max_runs: null,
        },
        {
          assessment_id: 'assessment-3',
          status: 'failed',
          statement_type: 'sop',
          degree: 'MBA',
          field: 'Business',
          target_program: 'MBA',
          target_institution: 'University of Toronto',
          overall_score: null,
          assessment_band: null,
          created_at: iso(7),
          generation_seconds: null,
          error: 'Assessment generation was interrupted.',
          has_complete_report_access: false,
          complete_report_remaining_runs: 0,
          complete_report_max_runs: null,
        },
      ],
    })
  }
  return Response.json({ message: 'Unknown preview endpoint' }, { status: 404 })
}

const HistoryPage = lazy(() => import('../src/features/history/HistoryPage'))

export function Preview() {
  return <div className="st-app"><main className="st-main">
    <aside className="border-b border-line bg-parchment p-4 text-center text-sm">
      <strong>Fictional development fixture — no account, payment, or AI request required.</strong>
    </aside>
    <div className="st-main-scroll">
      <div className="st-main-inner">
        <Suspense fallback={<p>Opening saved work...</p>}><HistoryPage /></Suspense>
      </div>
    </div>
  </main></div>
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Preview /></BrowserRouter>)
