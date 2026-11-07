import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../account/auth-context'
import { pricingPlans } from '../pricing/data'
import { CompleteReportError, generateCompleteReport, getCompleteReport, mockUnlockCompleteReport } from './api'
import { clearAssessmentId, readAssessmentId, rememberAssessmentId } from './session'
import type { CompleteReportState } from './types'
import CompleteReport from './CompleteReport'
import { formatCompleteReport } from './format'
import styles from './CompleteReportPage.module.css'

const completePlan = pricingPlans.find((plan) => plan.id === 'complete')

function MockCheckout({ busy, error, onDismiss, onConfirm }: { busy: boolean; error: string; onDismiss: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement
    const hadScrollLock = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    dialog.showModal()
    return () => {
      dialog.close()
      if (!hadScrollLock) document.body.classList.remove('overflow-hidden')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog ref={dialogRef} className={styles.checkout} aria-labelledby="complete-checkout-heading" aria-describedby="complete-checkout-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onDismiss() }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
      }}>
      <p className={styles.eyebrow}>Prototype checkout</p>
      <div className={styles.checkoutHeading}><h2 id="complete-checkout-heading">Complete report</h2><strong>{completePlan?.price ?? '$29'}</strong></div>
      <p id="complete-checkout-description">Try the complete-report flow with a simulated payment. No charge will be made.</p>
      <ul className={styles.features}><li>A detailed review of this assessed statement</li><li>The original assessment and score kept alongside it</li><li>The model’s full response, ready to read and copy</li></ul>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primaryButton} disabled={busy} type="button" onClick={onConfirm}>{busy ? 'Confirming…' : 'Simulate successful payment'}</button>
      <button className={styles.textButton} disabled={busy} type="button" onClick={onDismiss}>Return to report</button>
    </dialog>
  )
}

function EmptyReport({ message }: { message: string }) {
  return <section className={styles.page} aria-labelledby="complete-report-heading"><title>Complete report | Statement Studio</title><p className={styles.eyebrow}>Complete assessment</p><h1 id="complete-report-heading">Start with your free assessment.</h1><p className={styles.intro}>{message}</p><Link className={styles.primaryButton} to="/dashboard/assessment">Run a free assessment</Link></section>
}

function CompleteReportFlow({ assessmentId, userId, returnPath }: { assessmentId: string; userId: string; returnPath: string }) {
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const operationRef = useRef<AbortController | null>(null)
  const [reportState, setReportState] = useState<CompleteReportState | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [busy, setBusy] = useState<'unlocking' | 'generating' | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [copyStatus, setCopyStatus] = useState('')
  const serverStatus = reportState?.status
  const generating = busy === 'generating' || serverStatus === 'generating'

  const handleFailure = useCallback((cause: unknown) => {
    if (cause instanceof CompleteReportError && cause.status === 401) {
      navigate(`/account?next=${encodeURIComponent(returnPath)}`, { replace: true })
      return
    }
    if (cause instanceof CompleteReportError && cause.status === 404) {
      clearAssessmentId(userId, assessmentId)
      setUnavailable(true)
      setReportState(null)
      setError('')
      return
    }
    setError(cause instanceof CompleteReportError ? cause.message : 'The complete report could not finish. Please try again.')
  }, [assessmentId, navigate, returnPath, userId])

  useEffect(() => {
    const controller = new AbortController()
    void getCompleteReport(assessmentId, controller.signal).then((state) => {
      if (controller.signal.aborted) return
      rememberAssessmentId(userId, assessmentId)
      setReportState(state)
      setError('')
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) handleFailure(cause)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [assessmentId, handleFailure, reload, userId])

  useEffect(() => () => operationRef.current?.abort(), [])
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    if (!generating) return
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [generating])

  useEffect(() => {
    if (serverStatus !== 'generating') return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => { timer = setTimeout(() => { void poll() }, 4_000) }
    async function poll() {
      if (controller.signal.aborted) return
      if (document.visibilityState !== 'visible') { schedule(); return }
      try {
        const state = await getCompleteReport(assessmentId, controller.signal)
        if (controller.signal.aborted) return
        setReportState(state)
        setError('')
        if (state.status === 'generating') schedule()
      } catch (cause) {
        if (controller.signal.aborted) return
        handleFailure(cause)
        if (!(cause instanceof CompleteReportError && [401, 404].includes(cause.status))) schedule()
      }
    }
    schedule()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [assessmentId, handleFailure, serverStatus])

  async function unlock() {
    if (operationRef.current || !reportState || reportState.assessment.report.status === 'needs_input') return
    const controller = new AbortController()
    operationRef.current = controller
    setBusy('unlocking')
    setError('')
    try {
      const state = await mockUnlockCompleteReport(assessmentId, controller.signal)
      if (!controller.signal.aborted) { setReportState(state); setCheckoutOpen(false) }
    } catch (cause) {
      if (!controller.signal.aborted) handleFailure(cause)
    } finally {
      if (operationRef.current === controller) operationRef.current = null
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  async function generate() {
    const canGenerate = reportState && (['unlocked', 'failed'].includes(reportState.status) || reportState.status === 'ready' && reportState.report?.report_status === 'incomplete')
    if (operationRef.current || !reportState || !canGenerate || reportState.assessment.report.status === 'needs_input') return
    const controller = new AbortController()
    operationRef.current = controller
    setBusy('generating')
    setElapsed(0)
    setError('')
    try {
      const result = await generateCompleteReport(assessmentId, controller.signal)
      if (!controller.signal.aborted) setReportState(result)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof CompleteReportError && cause.status === 409) {
        setReportState((current) => current ? { ...current, status: 'generating', report: null, error: null } : current)
      } else {
        handleFailure(cause)
        if (!(cause instanceof CompleteReportError && [401, 404].includes(cause.status))) {
          try {
            const state = await getCompleteReport(assessmentId, controller.signal)
            if (!controller.signal.aborted) setReportState(state)
          } catch (refreshError) {
            if (!controller.signal.aborted && refreshError instanceof CompleteReportError && [401, 404].includes(refreshError.status)) handleFailure(refreshError)
          }
        }
      }
    } finally {
      if (operationRef.current === controller) operationRef.current = null
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  async function copyReport() {
    if (!reportState?.report) return
    try { await navigator.clipboard.writeText(formatCompleteReport(reportState.report, reportState.assessment)); setCopyStatus('Report copied.') }
    catch { setCopyStatus('Copy is unavailable. Select the report text and copy it directly.') }
  }

  if (unavailable) return <EmptyReport message="This assessment is no longer available. Run a new free assessment to continue." />
  const baseline = reportState?.assessment.report
  const context = reportState?.assessment.context
  const needsInput = baseline?.status === 'needs_input'

  return (
    <section className={styles.page} aria-labelledby="complete-report-heading" aria-busy={loading || generating}>
      <title>Complete report | Statement Studio</title>
      <Link className={styles.backLink} to="/dashboard/assessment">← Free assessment</Link>
      <p className={styles.eyebrow}>Complete assessment · Prototype</p>
      <h1 id="complete-report-heading" ref={headingRef} tabIndex={-1}>Your complete report.</h1>
      <p className={styles.intro}>A closer review of the statement from your free assessment.</p>
      {loading ? <div className={styles.loading} role="status"><span className={styles.spinner} aria-hidden="true" />Opening your assessment…</div> : !reportState ? (
        <div className={styles.panel}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primaryButton} type="button" onClick={() => { setLoading(true); setError(''); setReload((value) => value + 1) }}>Try again</button>
        </div>
      ) : <>
        <div className={styles.assessmentSummary}>
          <div><span className={styles.label}>Original assessment</span><h2>{[context?.degree, context?.field].filter(Boolean).join(' · ')}</h2><p>{[context?.target_program, context?.target_institution].filter(Boolean).join(' · ') || 'Your submitted statement'}</p></div>
          <div className={styles.baselineScore}><strong>{baseline?.overall_score ?? '—'}<small>{baseline?.overall_score === null ? '' : '/100'}</small></strong><span>{baseline?.assessment_band ?? 'More input needed'}</span><small>{baseline?.recommendation.path ? `${baseline.recommendation.path} path` : 'Revision path unavailable'}{baseline?.status === 'provisional' ? ' · provisional' : ''}</small></div>
        </div>
        {baseline?.status === 'provisional' && <p className={styles.notice}>Your original assessment is provisional. The complete report keeps those same limitations.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {needsInput ? (
          <div className={styles.panel}><h2>Complete the assessment context first.</h2><p>A complete report needs a usable first assessment. Add the missing information and run the free assessment again.</p><Link className={styles.primaryButton} to="/dashboard/assessment">Return to free assessment</Link></div>
        ) : reportState.status === 'locked' ? (
          <div className={styles.unlockPanel}>
            <div><span className={styles.label}>One complete report</span><h2>Follow the argument, sentence by sentence.</h2><p>Unlock a more detailed review of your existing statement and its revision priorities.</p><ul className={styles.features}><li>Sentence, paragraph, evidence, and revision feedback</li><li>Your original score and findings preserved</li><li>The full response to read and copy</li></ul></div>
            <div className={styles.unlockAction}><strong>{completePlan?.price ?? '$29'}</strong><span>Prototype checkout · no charge</span><button className={styles.primaryButton} type="button" onClick={() => { setError(''); setCheckoutOpen(true) }}>Try complete report</button></div>
          </div>
        ) : generating ? (
          <div className={styles.loading} role="status" aria-live="polite"><span className={styles.spinner} aria-hidden="true" /><div><strong>Generating your complete report…</strong><p>The model is reviewing your original statement and assessment.</p><span role="timer" aria-live="off">{elapsed}s elapsed</span></div></div>
        ) : reportState.status === 'ready' && reportState.report !== null ? (
          <section className={styles.structuredReport} aria-labelledby="complete-report-response-heading">
            <div className={styles.reportToolbar}><div><span className={styles.label}>Complete report</span><h2 id="complete-report-response-heading">Detailed assessment</h2><div className={styles.generationTimings}>{reportState.free_generation_seconds !== null && <p>Free assessment: {reportState.free_generation_seconds.toFixed(1)} seconds</p>}{reportState.generation_seconds !== null && <p>Complete report: {reportState.generation_seconds.toFixed(1)} seconds</p>}{reportState.free_generation_seconds !== null && reportState.generation_seconds !== null && <p>Total generation time: {(reportState.free_generation_seconds + reportState.generation_seconds).toFixed(1)} seconds</p>}</div></div><button className={styles.secondaryButton} type="button" onClick={() => void copyReport()}>Copy report</button></div>
            <p className={styles.copyStatus} role="status">{copyStatus}</p>
            {reportState.report.report_status === 'incomplete' && <div className={styles.panel}><h3>Finish the full review.</h3><p>This generation did not cover every required part. Your mock unlock is kept.</p><button className={styles.primaryButton} type="button" disabled={busy !== null} onClick={() => void generate()}>Retry full report</button></div>}
            <CompleteReport report={reportState.report} assessment={reportState.assessment} />
          </section>
        ) : (
          <div className={styles.panel}><span className={styles.label}>Prototype payment confirmed</span><h2>{reportState.status === 'failed' ? 'Try generating your report again.' : 'Your complete report is unlocked.'}</h2><p>{reportState.status === 'failed' ? 'The last attempt did not finish. Your assessment remains unlocked.' : 'Generate the full review using the statement and score from your free assessment.'}</p>{reportState.status === 'failed' && reportState.generation_seconds !== null && <p>Last attempt: {reportState.generation_seconds.toFixed(1)} seconds</p>}<button className={styles.primaryButton} type="button" disabled={busy !== null} onClick={() => void generate()}>{reportState.status === 'failed' ? 'Try generating again' : 'Generate complete report'}</button></div>
        )}
        <p className={styles.temporaryNote}>Reports are temporary in this preview. Keep a copy of the result.</p>
        <p className={styles.assessmentId}>Assessment {reportState.assessment_id}</p>
        {checkoutOpen && !needsInput && <MockCheckout busy={busy === 'unlocking'} error={error} onDismiss={() => setCheckoutOpen(false)} onConfirm={() => void unlock()} />}
      </>}
    </section>
  )
}

export default function CompleteReportPage() {
  const { session, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const userId = session?.user.id
  const assessmentId = searchParams.get('assessment') || (userId ? readAssessmentId(userId) : null)
  const returnParams = new URLSearchParams(location.search)
  if (assessmentId) returnParams.set('assessment', assessmentId)
  const returnPath = `${location.pathname}${returnParams.size ? `?${returnParams.toString()}` : ''}`
  if (loading) return <div className={styles.loading} role="status">Opening your account…</div>
  if (!userId) return <section className={styles.page}><h1>Sign in to open your report.</h1><Link className={styles.primaryButton} to={`/account?next=${encodeURIComponent(returnPath)}`}>Sign in</Link></section>
  if (!assessmentId) return <EmptyReport message="Run a free assessment first, then open its complete report from the results page." />
  return <CompleteReportFlow key={`${userId}:${assessmentId}`} assessmentId={assessmentId} userId={userId} returnPath={returnPath} />
}
