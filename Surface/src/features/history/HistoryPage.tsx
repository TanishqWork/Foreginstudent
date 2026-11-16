import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import StatementLoader from '../shared/StatementLoader'
import { Badge, EmptyState, Icon, PageHeading } from '../student/ui'
import { getAssessmentHistory, getCompleteReportHistory } from './api'
import type { AssessmentHistoryItem, CompleteReportHistoryItem } from './api'
import { contextLine, formatDateTime, relativeTime, statementTypeLabel } from './format'

function scoreLabel(item: Pick<AssessmentHistoryItem, 'status' | 'overall_score'>) {
  if (item.status === 'generating') return 'Reviewing'
  if (item.status === 'failed') return 'Not finished'
  return item.overall_score === null ? 'Not scored' : `${item.overall_score}/100`
}

function assessmentTone(status: AssessmentHistoryItem['status']) {
  return status === 'ready' ? 'green' : status === 'failed' ? 'amber' : 'violet'
}

function reportTone(status: CompleteReportHistoryItem['status']) {
  return status === 'ready' ? 'green' : status === 'failed' ? 'amber' : 'violet'
}

function AssessmentCard({ item }: { item: AssessmentHistoryItem }) {
  return <article className="st-history-card">
    <div className={`st-history-score ${item.status === 'ready' && item.overall_score !== null ? '' : 'st-history-score-status'}`}><strong>{scoreLabel(item)}</strong><span>{item.assessment_band ?? 'Saved score'}</span></div>
    <div className="st-history-card-main">
      <div className="st-history-card-title"><Badge tone={assessmentTone(item.status)}>{item.status === 'ready' ? 'Score ready' : item.status === 'failed' ? 'Could not finish' : 'Reviewing'}</Badge><h3>{statementTypeLabel(item.statement_type)}</h3></div>
      <p>{contextLine(item)}</p>
      <small>{formatDateTime(item.created_at)} · {relativeTime(item.created_at)}</small>
      {item.has_complete_report_access && <span className="st-history-note">{item.complete_report_remaining_runs} of {item.complete_report_max_runs ?? 2} detailed reports remaining</span>}
    </div>
    <div className="st-history-actions">
      {item.status === 'ready' && <Link className="st-btn st-btn-secondary" to={`/dashboard/assessment?assessment=${encodeURIComponent(item.assessment_id)}`}>View score</Link>}
      {item.status === 'ready' && <Link className="st-btn st-btn-primary" to={`/dashboard/complete-report?assessment=${encodeURIComponent(item.assessment_id)}`}>{item.has_complete_report_access ? 'Open report' : 'Get complete report'}</Link>}
      {item.status === 'failed' && <Link className="st-btn st-btn-secondary" to="/dashboard/assessment">Run again</Link>}
    </div>
  </article>
}

function ReportCard({ item }: { item: CompleteReportHistoryItem }) {
  const ready = item.status === 'ready'
  return <article className="st-history-card st-history-card-report">
    <div className="st-history-score"><Icon name="file" size={26}/><span>{item.remaining_successful_runs} of {item.max_successful_runs} left</span></div>
    <div className="st-history-card-main">
      <div className="st-history-card-title"><Badge tone={reportTone(item.status)}>{ready ? 'Detailed report' : item.status === 'failed' ? 'Attempt failed' : item.status === 'generating' ? 'Generating' : 'Access ready'}</Badge><h3>{statementTypeLabel(item.statement_type)}</h3></div>
      <p>{contextLine(item)}</p>
      <small>{formatDateTime(item.created_at)} · {relativeTime(item.created_at)}</small>
      {item.status === 'failed' && <span className="st-history-note">Paid access was not used.</span>}
      {ready && item.generation_seconds !== null && <span className="st-history-note">Generated in {item.generation_seconds.toFixed(1)} seconds.</span>}
    </div>
    <div className="st-history-actions">
      <Link className="st-btn st-btn-primary" to={`/dashboard/complete-report?assessment=${encodeURIComponent(item.assessment_id)}`}>{ready ? 'View report' : item.status === 'failed' ? 'Try again' : 'Open'}</Link>
    </div>
  </article>
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<AssessmentHistoryItem[]>([])
  const [reports, setReports] = useState<CompleteReportHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const [assessmentItems, reportItems] = await Promise.all([
          getAssessmentHistory(controller.signal),
          getCompleteReportHistory(controller.signal),
        ])
        if (controller.signal.aborted) return
        setAssessments(assessmentItems)
        setReports(reportItems)
        setError('')
      } catch {
        if (!controller.signal.aborted) setError('We could not load your saved work history.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  return <section className="st-history-page" aria-labelledby="history-heading">
    <title>History | Statement Studio</title>
    <PageHeading eyebrow="Saved work" title="Your assessment history" description="Return to previous scores, paid report access, and detailed report attempts without losing your place." actions={<button className="st-btn st-btn-primary" type="button" onClick={() => navigate('/dashboard/assessment')}>Run new assessment</button>} />
    {loading ? <div className="st-history-loading" role="status"><StatementLoader/>Opening saved work...</div> : error ? <EmptyState title="History is unavailable" description={error}><button className="st-btn st-btn-secondary" type="button" onClick={() => window.location.reload()}>Try again</button></EmptyState> : <>
      {!assessments.length && !reports.length && <EmptyState title="No saved assessments yet" description="Run a free assessment and your scores will appear here with dates, report access, and next steps."><Link className="st-btn st-btn-primary" to="/dashboard/assessment">Start free assessment</Link></EmptyState>}
      {assessments.length > 0 && <section className="st-history-section" aria-labelledby="assessment-history-heading">
        <div className="st-section-heading"><div><span className="st-eyebrow">Scores</span><h2 id="assessment-history-heading">Free assessments</h2></div></div>
        <div className="st-history-list">{assessments.map((item) => <AssessmentCard key={item.assessment_id} item={item}/>)}</div>
      </section>}
      {reports.length > 0 && <section className="st-history-section" aria-labelledby="complete-history-heading">
        <div className="st-section-heading"><div><span className="st-eyebrow">Paid access</span><h2 id="complete-history-heading">Complete reports</h2></div></div>
        <div className="st-history-list">{reports.map((item) => <ReportCard key={`${item.assessment_id}:${item.attempt_id ?? 'access'}`} item={item}/>)}</div>
      </section>}
    </>}
  </section>
}
