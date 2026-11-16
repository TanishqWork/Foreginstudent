import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import styles from './StatementLoader.module.css'

export default function StatementLoader({ className = '' }: { className?: string }) {
  const rootRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const q = <T extends Element>(name: string) => root.querySelector<T>(`[data-ss="${name}"]`)
    const qa = <T extends Element>(name: string) => Array.from(root.querySelectorAll<T>(`[data-ss="${name}"]`))
    const ground = q<SVGEllipseElement>('ground')
    const paper = q<SVGGElement>('paper')
    const lines = qa<SVGLineElement>('line')
    const pencil = q<SVGGElement>('pencil')
    const logo = q<SVGGElement>('logo')
    const ring = q<SVGRectElement>('ring')
    const trail = q<SVGPathElement>('trail')
    const pieceA = q<SVGPathElement>('pieceA')
    const pieceB = q<SVGPathElement>('pieceB')
    const student = q<SVGGElement>('student')
    const walker = q<SVGGElement>('walker')
    const letter = q<SVGGElement>('letter')
    const sparks = qa<SVGLineElement>('spark')
    if (!ground || !paper || !pencil || !logo || !ring || !trail || !pieceA || !pieceB || !student || !walker || !letter || lines.length === 0) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      gsap.set(root, { autoAlpha: 1 })
      if (reduce) {
        gsap.set([paper, pencil, student, letter, ring, ...sparks], { autoAlpha: 0 })
        gsap.set(trail, { autoAlpha: 0 })
        gsap.to(logo, { opacity: .55, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        return
      }

      const trailLength = trail.getTotalLength()
      const rows = lines.map((el) => {
        const x1 = Number(el.getAttribute('x1'))
        const x2 = Number(el.getAttribute('x2'))
        const y = Number(el.getAttribute('y1'))
        return { el, x1, x2, y, len: x2 - x1 }
      })
      const start = trail.getPointAtLength(0)
      const walk = { p: 0 }
      const placeStudent = () => {
        const point = trail.getPointAtLength(walk.p * trailLength)
        gsap.set(student, { x: point.x, y: point.y })
      }

      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } })
      tl.set(ground, { scaleX: .7, autoAlpha: .5, transformOrigin: '50% 50%' }, 0)
        .set(paper, { autoAlpha: 0, scale: .86, y: 10, transformOrigin: '50% 50%' }, 0)
        .set(pencil, { autoAlpha: 0, x: rows[0].x1 + 30, y: rows[0].y - 30 }, 0)
        .set(logo, { autoAlpha: 1, scale: 1, svgOrigin: '128 128' }, 0)
        .set(ring, { autoAlpha: 0, scale: 1, svgOrigin: '128 128' }, 0)
        .set([pieceA, pieceB], { autoAlpha: 0, x: 0, y: 0, rotation: 0, scale: .7, transformOrigin: '50% 50%' }, 0)
        .set(trail, { autoAlpha: 0, strokeDasharray: trailLength, strokeDashoffset: trailLength }, 0)
        .set(student, { autoAlpha: 0, x: start.x, y: start.y, scale: 1, transformOrigin: '50% 50%' }, 0)
        .set(walker, { scale: 0, y: 0, transformOrigin: '50% 50%' }, 0)
        .set(letter, { autoAlpha: 0, scale: 0, rotation: -12, transformOrigin: '50% 50%' }, 0)
        .set(sparks, { autoAlpha: 0, scale: .3, transformOrigin: '50% 50%' }, 0)
        .to(paper, { autoAlpha: 1, scale: 1, y: 0, duration: .55, ease: 'back.out(1.6)' }, 0)
        .to(ground, { scaleX: 1, autoAlpha: 1, duration: .55 }, 0)
        .to(pencil, { autoAlpha: 1, x: rows[0].x1, y: rows[0].y, duration: .3 }, .25)

      rows.forEach((row) => {
        tl.set(row.el, { strokeDasharray: row.len + 1, strokeDashoffset: row.len + 1 }, 0)
      })

      let time = .55
      rows.forEach((row, index) => {
        const hop = index === 0 ? 0 : .07
        const draw = index === 0 ? .2 : .16 * (row.len / 100)
        if (hop) tl.to(pencil, { x: row.x1, y: row.y, duration: hop, ease: 'power1.inOut' }, time)
        tl.to(row.el, { strokeDashoffset: 0, duration: draw, ease: 'none' }, time + hop)
          .to(pencil, { x: row.x2, duration: draw, ease: 'none' }, time + hop)
        time += hop + draw
      })

      const splitTime = time + .12
      tl.to(pencil, { autoAlpha: 0, x: '+=26', y: '-=26', duration: .28, ease: 'power2.in' }, time)
        .to(paper, { autoAlpha: 0, scale: .9, duration: .3, ease: 'power2.in' }, splitTime)
        .to(pieceA, { autoAlpha: 1, scale: 1, x: -54, y: -54, rotation: -6, duration: .7, ease: 'power3.out' }, splitTime + .12)
        .to(pieceB, { autoAlpha: 1, scale: 1, x: 54, y: 54, rotation: 6, duration: .7, ease: 'power3.out' }, splitTime + .12)
        .to(ground, { scaleX: .82, autoAlpha: .7, duration: .7 }, splitTime + .12)
        .to(pieceA, { x: -58, y: -58, duration: .3, ease: 'sine.inOut' }, splitTime + .82)
        .to(pieceB, { x: 58, y: 58, duration: .3, ease: 'sine.inOut' }, splitTime + .82)

      const joinTime = splitTime + 1.12
      const lockTime = joinTime + .55
      tl.to([pieceA, pieceB], { x: 0, y: 0, rotation: 0, duration: .55, ease: 'power4.in' }, joinTime)
        .to(logo, { scale: 1.06, duration: .1 }, lockTime)
        .to(logo, { scale: 1, duration: .7, ease: 'elastic.out(1, .45)' }, lockTime + .1)
        .fromTo(ring, { autoAlpha: .55, scale: 1 }, { autoAlpha: 0, scale: 1.28, duration: .7 }, lockTime)
        .to(ground, { scaleX: 1, autoAlpha: 1, duration: .45, ease: 'back.out(3)' }, lockTime)

      const walkTime = lockTime + .6
      const walkDuration = 1.8
      tl.set([student, trail], { autoAlpha: 1 }, walkTime - .3)
        .to(walker, { scale: 1.35, duration: .35, ease: 'back.out(2.5)' }, walkTime - .3)
        .fromTo(walk, { p: 0 }, { p: 1, duration: walkDuration, ease: 'power1.inOut', onUpdate: placeStudent }, walkTime)
        .fromTo(trail, { strokeDashoffset: trailLength }, { strokeDashoffset: 0, duration: walkDuration, ease: 'power1.inOut' }, walkTime)
        .to(walker, { y: -3, duration: walkDuration / 12, repeat: 11, yoyo: true, ease: 'sine.inOut' }, walkTime)

      const winTime = walkTime + walkDuration
      tl.to(walker, { y: -10, duration: .18 }, winTime)
        .to(walker, { y: 0, duration: .35, ease: 'bounce.out' }, winTime + .18)
        .to(letter, { autoAlpha: 1, scale: 1, rotation: 0, duration: .5, ease: 'back.out(2.2)' }, winTime + .05)
        .to(sparks, { autoAlpha: 1, scale: 1, duration: .25, stagger: .06, ease: 'back.out(3)' }, winTime + .32)
        .to(sparks, { autoAlpha: 0, duration: .3, stagger: .06 }, winTime + .8)

      const outTime = winTime + 1.15
      tl.to([letter, student], { autoAlpha: 0, scale: .6, duration: .3, ease: 'power2.in' }, outTime)
        .to(logo, { autoAlpha: 0, scale: .9, duration: .45, ease: 'power2.in' }, outTime + .1)
        .to(ground, { scaleX: .7, autoAlpha: .5, duration: .45, ease: 'power2.in' }, outTime + .1)
        .to({}, { duration: .25 })
    }, root)

    return () => context.revert()
  }, [])

  return (
    <svg
      ref={rootRef}
      className={`${styles.loader} ${className}`.trim()}
      viewBox="-56 -56 368 368"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse data-ss="ground" cx="128" cy="266" rx="92" ry="7" fill="#EDEDF8" />
      <g data-ss="paper">
        <path
          transform="translate(8 8)"
          fill="#E6E6FB"
          d="M64 36 H174 L194 56 V206 A10 10 0 0 1 184 216 H64 A10 10 0 0 1 54 206 V46 A10 10 0 0 1 64 36 Z"
        />
        <path
          fill="#FFFFFF"
          stroke="#E3E3F5"
          strokeWidth="2"
          d="M64 36 H174 L194 56 V206 A10 10 0 0 1 184 216 H64 A10 10 0 0 1 54 206 V46 A10 10 0 0 1 64 36 Z"
        />
        <path fill="#E3E3F5" d="M174 36 V50 Q174 56 180 56 H194 Z" />
        <line data-ss="line" className={styles.linePrimary} x1="74" y1="72" x2="136" y2="72" strokeLinecap="round" />
        <line data-ss="line" className={styles.line} x1="74" y1="100" x2="174" y2="100" strokeLinecap="round" />
        <line data-ss="line" className={styles.line} x1="74" y1="120" x2="168" y2="120" strokeLinecap="round" />
        <line data-ss="line" className={styles.line} x1="74" y1="140" x2="174" y2="140" strokeLinecap="round" />
        <line data-ss="line" className={styles.line} x1="74" y1="160" x2="152" y2="160" strokeLinecap="round" />
        <line data-ss="line" className={styles.line} x1="74" y1="180" x2="124" y2="180" strokeLinecap="round" />
      </g>
      <g data-ss="pencil">
        <g transform="rotate(-38)">
          <path d="M0 0 L10 -5 L10 5 Z" fill="#F3D3A6" />
          <path d="M0 0 L3.6 -1.8 L3.6 1.8 Z" fill="#3F3D56" />
          <rect x="10" y="-5" width="34" height="10" fill="#F9A826" />
          <rect x="44" y="-5" width="5" height="10" fill="#3F3D56" />
          <rect x="49" y="-5" width="8" height="10" rx="3" fill="#F5A3B5" />
        </g>
      </g>
      <g data-ss="logo">
        <rect data-ss="ring" x="24" y="24" width="208" height="208" rx="12" fill="none" stroke="#5758E8" strokeWidth="3" />
        <path
          data-ss="trail"
          fill="none"
          stroke="#DCDCFB"
          strokeWidth="5"
          strokeLinecap="round"
          d="M24 192 H144 C217 192 217 128 144 128 H112 C39 128 39 64 112 64 H232"
        />
        <path
          data-ss="pieceA"
          fill="#5758E8"
          d="M24 36 A12 12 0 0 1 36 24 H220 A12 12 0 0 1 232 36 V48 H112 C16 48 16 144 112 144 H144 C194 144 194 176 144 176 H24 Z"
        />
        <path
          data-ss="pieceB"
          fill="#5758E8"
          d="M232 80 H112 C62 80 62 112 112 112 H144 C240 112 240 208 144 208 H24 V220 A12 12 0 0 0 36 232 H220 A12 12 0 0 0 232 220 Z"
        />
      </g>
      <g data-ss="student">
        <g data-ss="walker">
          <circle cx="0" cy="1" r="7" fill="#FFB8B8" />
          <path d="M-6 -4 V0 Q0 3 6 0 V-4 Z" fill="#3F3D56" />
          <path d="M-12 -6 L0 -11 L12 -6 L0 -1 Z" fill="#3F3D56" />
          <path d="M0 -6 L9 -4.5 V2" fill="none" stroke="#F9A826" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(272 30)">
        <g data-ss="letter">
          <rect x="-19" y="-13" width="38" height="26" rx="3" fill="#FFFFFF" stroke="#3F3D56" strokeWidth="2" />
          <path d="M-19 -11 L0 3 L19 -11" fill="none" stroke="#3F3D56" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="17" cy="-12" r="8" fill="#5758E8" />
          <path d="M13.5 -12 L16 -9.5 L20.5 -14.5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g stroke="#F9A826" strokeWidth="3.5" strokeLinecap="round">
          <line data-ss="spark" x1="-4.5" y1="-26" x2="-5.9" y2="-34" />
          <line data-ss="spark" x1="17.2" y1="-25" x2="21.8" y2="-31.5" />
          <line data-ss="spark" x1="29.5" y1="-5" x2="37" y2="-6.5" />
        </g>
      </g>
    </svg>
  )
}
