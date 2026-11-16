import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getAssessmentHistory } from './api'
import type { AssessmentHistoryItem } from './api'
import { contextLine, formatDateTime, statementTypeLabel } from './format'

function scoreText(item: AssessmentHistoryItem) {
  if (item.status === 'generating') return 'Reviewing'
  if (item.status === 'failed') return 'Not finished'
  return item.overall_score === null ? 'Not scored' : `${item.overall_score}/100`
}

export default function RecentAssessments() {
  const [items, setItems] = useState<AssessmentHistoryItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void getAssessmentHistory(controller.signal)
      .then((history) => { if (!controller.signal.aborted) setItems(history.slice(0, 3)) })
      .catch(() => { if (!controller.signal.aborted) setError('Recent scores are unavailable right now.') })
    return () => controller.abort()
  }, [])

  if (error) return <div className="st-history-strip st-history-strip-muted" role="status">{error}</div>
  if (!items.length) return null

  return <section className="st-history-strip" aria-labelledby="recent-scores-heading">
    <div className="st-history-strip-head">
      <div><span className="st-eyebrow">Saved work</span><h2 id="recent-scores-heading">Recent scores</h2></div>
      <Link className="st-text-link" to="/dashboard/history">View history</Link>
    </div>
    <div className="st-recent-score-list">
      {items.map((item) => <article key={item.assessment_id} className="st-recent-score-card">
        <strong>{scoreText(item)}</strong>
        <div><b>{statementTypeLabel(item.statement_type)}</b><span>{contextLine(item)}</span><small>{formatDateTime(item.created_at)}</small></div>
        <div className="st-recent-score-actions">
          {item.status === 'ready' && <Link to={`/dashboard/assessment?assessment=${encodeURIComponent(item.assessment_id)}`}>View score</Link>}
          {item.status === 'ready' && <Link to={`/dashboard/complete-report?assessment=${encodeURIComponent(item.assessment_id)}`}>{item.has_complete_report_access ? 'Open report' : 'Get complete report'}</Link>}
          {item.status === 'failed' && <Link to="/dashboard/assessment">Run again</Link>}
        </div>
      </article>)}
    </div>
  </section>
}
