import { useEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import styles from './ReviewLoader.module.css'

const captions = [
  'Reading your statement…',
  'Checking it against your criteria…',
  'Writing your feedback…',
  'Putting your report together…',
] as const

const CONFETTI_COUNT = 18
const CONFETTI_COLORS = ['#ffc857', '#f4a940', '#5758E8', '#b3b4f7', '#ffc857']

type PersonColors = {
  skin: string; skinDark: string; top: string; topDark: string; pants: string; pantsDark: string; shoe: string
  back?: ReactNode; torso?: ReactNode; hairBack?: ReactNode; hair: ReactNode; face?: ReactNode; hand?: ReactNode
}

function Limb({ width, color, length }: { width: number; color: string; length: number }) {
  return <line x1="0" y1="0" x2="0" y2={length} stroke={color} strokeWidth={width} strokeLinecap="round" />
}

function Person({ id, c }: { id: 'stu' | 'men'; c: PersonColors }) {
  const shoe = <path d="M-6 63h13a5 5 0 0 1 5 5v2h-18z" fill={c.shoe} />
  return (
    <g data-ss={id}>
      <g data-ss={`${id}-body`}>
        <g data-ss={`${id}-legB`}><Limb width={11} color={c.pantsDark} length={62} />{shoe}</g>
        <g data-ss={`${id}-armB`}>
          <Limb width={8} color={c.topDark} length={26} />
          <g data-ss={`${id}-foreB`}><Limb width={7} color={c.topDark} length={20} /><circle cy="26" r="4.2" fill={c.skinDark} /></g>
        </g>
        {c.back}
        <g data-ss={`${id}-legF`}><Limb width={11} color={c.pants} length={62} />{shoe}</g>
        <path d="M-12-66C-14-88-15-106-10-116Q-5-123 3-123Q12-122 13-112C15-96 14-80 12-66Z" fill={c.top} />
        {c.torso}
        <rect x="-2.5" y="-131" width="7" height="10" rx="2" fill={c.skinDark} />
        <g data-ss={`${id}-head`}>{c.hairBack}<circle cx="1" cy="-12" r="11" fill={c.skin} />{c.hair}{c.face}</g>
        <g data-ss={`${id}-armF`}>
          <Limb width={8} color={c.top} length={26} />
          <g data-ss={`${id}-foreF`}><Limb width={7} color={c.top} length={20} />{c.hand}<circle cy="26" r="4.2" fill={c.skin} /></g>
        </g>
      </g>
    </g>
  )
}

const paperLine = (y: number) => <line data-ss="pl" x1="-7" y1={y} x2="7" y2={y} stroke="#5758E8" strokeWidth="1.8" strokeLinecap="round" />

const student: PersonColors = {
  skin: '#9b6250', skinDark: '#86523f', top: '#5758E8', topDark: '#4344c6', pants: '#2f2e41', pantsDark: '#26253a', shoe: '#b3b4f7',
  back: <rect x="-25" y="-117" width="14" height="38" rx="6" fill="#3f3d56" />,
  torso: <>
    <path d="M-8-119C-6-108-6-98-7-88" stroke="#3b3cb6" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M-4-82H9" stroke="#4a4bd6" strokeWidth="2" strokeLinecap="round" />
  </>,
  hairBack: <path d="M-8-18C-18-20-24-10-20 3C-17-4-13-8-9-10Z" fill="#2f2e41" />,
  hair: <path d="M-10.5-8C-12-22-1-27 9-22C12-20 13-17 12.5-14C7-17 2-16-1-12C-3-9-5-6-6-2C-8-3-10-5-10.5-8Z" fill="#2f2e41" />,
  hand: (
    <g data-ss="paper" opacity="0">
      <rect x="-11" y="-28" width="22" height="28" rx="2" fill="#fff" stroke="#d6d6e6" strokeWidth="1.2" />
      {paperLine(-21)}{paperLine(-15)}{paperLine(-9)}
      <g data-ss="check">
        <circle r="5" fill="#5758E8" />
        <path d="M-2.3 0.2L-0.6 1.9L2.4-1.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  ),
}

const mentor: PersonColors = {
  skin: '#f0c1a3', skinDark: '#dba98b', top: '#3f3d56', topDark: '#34324a', pants: '#2f2e41', pantsDark: '#26253a', shoe: '#1f1e2c',
  torso: <path d="M4-123L8-110L12-120Z" fill="#f2f2f7" />,
  hair: <path d="M-10.5-9C-11-22 0-26 9-22C12-20 12.5-18 12.5-15C6-18 0-17-3-14C-5-11-6-9-7-6Z" fill="#c9c8d3" />,
  face: <>
    <circle cx="8.5" cy="-13" r="3.2" fill="none" stroke="#2f2e41" strokeWidth="1.3" />
    <path d="M5.3-13.5H-2" stroke="#2f2e41" strokeWidth="1.2" />
  </>,
}

const grass = 'M0 0C-2-8-6-12-10-14C-5-10-3-5-2 0ZM2 0C2-10 4-16 8-19C5-13 4-6 4 0ZM6 0C8-6 11-9 15-10C11-6 9-3 8 0Z'
const spark = 'M10 0H26M8-10L19-22M8 10L19 22'

export default function ReviewLoader({ elapsedSeconds, headingRef }: { elapsedSeconds: number; headingRef?: Ref<HTMLHeadingElement> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [caption, setCaption] = useState(0)
  const [ready, setReady] = useState(false)
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let stop: (() => void) | undefined
    let cancelled = false
    import('./story')
      .then(({ startStory }) => {
        if (cancelled) return
        stop = startStory(svg, { reduced, onCaption: setCaption })
        setReady(true)
      })
      .catch(() => { /* animation is decorative; the text still explains the wait */ })
    return () => { cancelled = true; stop?.() }
  }, [reduced])

  // With reduced motion the scene is still, so rotate the captions on a calm timer.
  useEffect(() => {
    if (!reduced) return
    const timer = window.setInterval(() => setCaption((i) => (i + 1) % captions.length), 2600)
    return () => window.clearInterval(timer)
  }, [reduced])

  return (
    <section className={styles.loader} aria-labelledby="review-loader-heading" aria-busy="true">
      <p className={styles.kicker}>Statement Studio</p>
      <h1 id="review-loader-heading" ref={headingRef} tabIndex={-1} className={styles.title}>Reviewing your statement</h1>

      <svg
        ref={svgRef}
        className={`${styles.stage} ${ready ? styles.ready : ''} ${reduced ? styles.still : ''}`}
        viewBox="0 50 800 300"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M313.3 330 A125 125 0 1 1 486.7 330 Z" fill="#f2f2fc" />
        <g fill="#e4e4f1">
          <path transform="translate(172 330)" d={grass} />
          <path transform="translate(620 330)" d={grass} />
        </g>
        <line x1="20" y1="331" x2="780" y2="331" stroke="#e6e6f0" strokeWidth="2" strokeLinecap="round" />

        <g data-ss="logo" className={styles.logo}>
          <g transform="translate(-128 -232)">
            <path data-ss="pieceA" fill="#5758E8" d="M36 24H220A12 12 0 0 1 232 36V48H112C16 48 16 144 112 144H144C194 144 194 176 144 176H24V36A12 12 0 0 1 36 24Z" />
            <path data-ss="pieceB" fill="#5758E8" d="M24 208H144C240 208 240 112 144 112H112C62 112 62 80 112 80H232V220A12 12 0 0 1 220 232H36A12 12 0 0 1 24 220Z" />
            <path data-ss="ink" d="M232 64H112C39 64 39 128 112 128H144C217 128 217 192 144 192H24" fill="none" stroke="#2f2e41" strokeWidth="4" strokeLinecap="round" opacity="0" />
            <g data-ss="sparkR" stroke="#8b8cf2" strokeWidth="5" strokeLinecap="round" opacity="0"><path d={spark} /></g>
            <g data-ss="sparkL" stroke="#8b8cf2" strokeWidth="5" strokeLinecap="round" opacity="0"><path d={spark} transform="scale(-1 1)" /></g>
            <g data-ss="pen" opacity="0">
              <g transform="rotate(28)">
                <rect x="-6" y="-68" width="12" height="48" rx="3" fill="#3f3d56" />
                <rect x="-6" y="-31" width="12" height="8" fill="#b3b4f7" />
                <path d="M-6-21H6L0 0Z" fill="#f4f4fa" stroke="#2f2e41" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M-2.2-6.5H2.2L0 0Z" fill="#2f2e41" />
              </g>
            </g>
          </g>
        </g>

        <g>
          <Person id="stu" c={student} />
          <Person id="men" c={mentor} />
        </g>

        <g data-ss="bubble" opacity="0">
          <circle cx="-22" cy="34" r="3" fill="#fff" stroke="#d9d9e8" strokeWidth="1.5" />
          <circle cx="-14" cy="24" r="5" fill="#fff" stroke="#d9d9e8" strokeWidth="1.5" />
          <circle r="19" fill="#fff" stroke="#d9d9e8" strokeWidth="1.5" />
          <g data-ss="q">
            <path d="M-5.5-5C-5.5-11 5.5-11 5.5-4.5C5.5 0 0 0.5 0 5" fill="none" stroke="#5758E8" strokeWidth="3" strokeLinecap="round" />
            <circle cy="10" r="1.9" fill="#5758E8" />
          </g>
        </g>

        <g data-ss="env" opacity="0">
          <rect x="-13" y="-9" width="26" height="18" rx="3" fill="#5758E8" />
          <path d="M-11-7L0 2L11-7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g>
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <rect key={i} data-ss="confetti" x="-3" y="-4.5" width="6" height="9" rx="1.2" fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} opacity="0" />
          ))}
        </g>
      </svg>

      {/* Captions change every couple of seconds, so keep them out of the live region. */}
      <p key={caption} className={styles.caption} aria-hidden="true">{captions[caption]}</p>
      <p className={styles.status} role="status">
        A review can take a minute or two. Keep this tab open and your result will appear right here.
      </p>
      <p className={styles.timer} role="timer" aria-live="off">{elapsedSeconds}s elapsed</p>
    </section>
  )
}
