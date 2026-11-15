import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Link } from 'react-router'
import { pricingPlans } from '../../pricing/data'
import type { DiagnosticResponse } from './types'
import {
  canOfferUnlock, isUnlockPromptDue, rememberUnlockPromptShown, unlockHighlights, wasUnlockPromptShown,
} from './unlock-prompt.ts'
import styles from './UnlockPrompt.module.css'

type UnlockPromptProps = {
  response: DiagnosticResponse
  /** The existing locked-preview section; reaching it counts as reading the result. */
  unlockSectionRef: RefObject<HTMLElement | null>
}

const completePlan = pricingPlans.find((plan) => plan.id === 'complete')

function readerIsBusy(): boolean {
  const selection = window.getSelection()?.toString().trim()
  const active = document.activeElement
  const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
  return Boolean(selection) || typing || document.querySelector('dialog[open]') !== null
}

export default function UnlockPrompt({ response, unlockSectionRef }: UnlockPromptProps) {
  const assessmentId = response.report.assessment_id
  const highlights = unlockHighlights(response)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const visibleSecondsRef = useRef(0)
  const reachedSectionRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(() => wasUnlockPromptShown(assessmentId))
  const [sectionInView, setSectionInView] = useState(false)
  const [pillHidden, setPillHidden] = useState(false)
  const eligible = highlights !== null && canOfferUnlock(response.report)

  useEffect(() => {
    const section = unlockSectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) reachedSectionRef.current = true
      setSectionInView(entry.isIntersecting)
    }, { threshold: 0.35 })
    observer.observe(section)
    return () => observer.disconnect()
  }, [unlockSectionRef])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') visibleSecondsRef.current += 1
      if (shown || !eligible || !isUnlockPromptDue(visibleSecondsRef.current, reachedSectionRef.current) || readerIsBusy()) return
      rememberUnlockPromptShown(assessmentId)
      setShown(true)
      setOpen(true)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [assessmentId, eligible, shown])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const previousFocus = document.activeElement
    const hadScrollLock = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    dialog.showModal()
    // Start on the heading so screen readers hear the offer and no button shows a focus ring on open.
    headingRef.current?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
      if (!hadScrollLock) document.body.classList.remove('overflow-hidden')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  if (!highlights || (!eligible && !open)) return null

  const checkoutPath = `/dashboard/complete-report?assessment=${encodeURIComponent(assessmentId)}&checkout=1`
  const price = completePlan?.price ?? '$29'
  const close = () => setOpen(false)
  const showPill = shown && !open && !sectionInView && !pillHidden && eligible

  return <>
    {open && (
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="unlock-prompt-heading" aria-describedby="unlock-prompt-summary"
        onCancel={(event) => { event.preventDefault(); close() }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
        }}>
        <button className={styles.close} type="button" aria-label="Close" onClick={close}>×</button>

        <div className={styles.head}>
          <div className={styles.score} aria-hidden="true" style={{ '--score': highlights.score } as CSSProperties}><strong>{highlights.score}</strong></div>
          <h2 id="unlock-prompt-heading" ref={headingRef} tabIndex={-1}>{highlights.weakestLabel ? <><em>{highlights.weakestLabel}</em> is holding your {highlights.score} back.</> : <>Here’s what is holding your {highlights.score} back.</>}</h2>
        </div>

        <div className={styles.evidence} id="unlock-prompt-summary">
          {highlights.riskyQuote ? <blockquote>“{highlights.riskyQuote}”</blockquote> : <p className={styles.concern}>{highlights.concernTitle}</p>}
          <div className={styles.locked}>
            <div className={styles.lockedLines} aria-hidden="true"><span /><span /></div>
            <p><span aria-hidden="true">◇ </span>{highlights.riskyQuote ? 'The fix for this sentence, and every other one' : 'The step-by-step fix'}</p>
          </div>
        </div>

        <Link className={styles.cta} to={checkoutPath} onClick={close}>See my complete report · {price}</Link>
        <p className={styles.fine}>{completePlan?.payment ?? 'One-time payment'}</p>
        <button className={styles.secondary} type="button" onClick={close}>Not now</button>
      </dialog>
    )}

    {showPill && (
      <div className={styles.pill} role="complementary" aria-label="Complete report offer">
        <Link to={checkoutPath}><strong>Complete report · {price}</strong><span>See what to fix first</span></Link>
        <button type="button" aria-label="Hide offer" onClick={() => setPillHidden(true)}>×</button>
      </div>
    )}
  </>
}
