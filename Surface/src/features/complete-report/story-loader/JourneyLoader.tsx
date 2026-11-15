import { useEffect, useRef, useState } from 'react'
import styles from '../../assessment/review-loader/ReviewLoader.module.css'
import local from './JourneyLoader.module.css'

/** Same captions as journey.ts, kept here so they render before the animation chunk loads. */
const captions = [
  'Dreaming of your top-choice college?',
  'But it feels so far away…',
  'So much to do',
  'Applying can feel like a maze',
  'Statement Studio clears the path',
  'One clear path, step by step',
  '…all the way to your dream college',
] as const

export default function JourneyLoader({ elapsedSeconds }: { elapsedSeconds: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [caption, setCaption] = useState(0)
  const [ready, setReady] = useState(false)
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let stop: (() => void) | undefined
    let cancelled = false
    import('./journey')
      .then(({ startJourney }) => {
        if (cancelled) return
        stop = startJourney(svg, { reduced, onCaption: setCaption })
        setReady(true)
      })
      .catch(() => { /* The animation is decorative; the text still explains the wait. */ })
    return () => { cancelled = true; stop?.() }
  }, [reduced])

  // With reduced motion the scene is still, so rotate the captions on a calm timer.
  useEffect(() => {
    if (!reduced) return
    const timer = window.setInterval(() => setCaption((i) => (i + 1) % captions.length), 2600)
    return () => window.clearInterval(timer)
  }, [reduced])

  return (
    <section className={styles.loader} aria-labelledby="journey-loader-heading" aria-busy="true">
      <p className={styles.kicker}>Statement Studio</p>
      <h2 id="journey-loader-heading" className={styles.title}>Writing your complete report</h2>
      <div className={local.frame}>
        <svg ref={svgRef} className={`${local.stage} ${ready ? local.ready : ''}`} viewBox="0 0 800 450" aria-hidden="true" focusable="false" />
      </div>
      {/* Captions change every couple of seconds, so keep them out of the live region. */}
      <p key={caption} className={styles.caption} aria-hidden="true">{caption < 0 ? ' ' : captions[caption]}</p>
      <p className={styles.status} role="status">
        Your complete report is being written sentence by sentence. It keeps going if you leave this page, and it will be
        here when you come back.
      </p>
      <p className={styles.timer} role="timer" aria-live="off">{elapsedSeconds}s elapsed</p>
    </section>
  )
}
