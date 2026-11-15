/*
 * Statement Studio review story (~9s loop):
 * the student and mentor push the logo halves together → blank page → a pen
 * writes along the S → the statement is sent → celebration → reset.
 *
 * Lives in its own module so GSAP is code-split and only downloaded when a
 * review actually starts (or is preloaded just before).
 */
import { gsap } from 'gsap'

type Vec = Record<string, number>
type CharState = {
  x: number; face: number; sc: number; lean: number; walk: number; phase: number; sw: number
  jump: number; legF: number; legB: number; head: number
  armF: number; foreF: number; armB: number; foreB: number
}
export type StoryOptions = { reduced: boolean; onCaption: (index: number) => void }

const GROUND = 330
const S = 0.72
const OFF = 300
const EDGE_L = 400 - 104 * S
const EDGE_R = 400 + 104 * S
const START_GAP = OFF * S
const RAD = Math.PI / 180
const INK_SAMPLES = 240

const POSE = {
  push: { armF: -65, foreF: -15, armB: -60, foreB: -18 },
  pull: { armF: -86, foreF: -4, armB: -84, foreB: -6 },
  rest: { armF: 4, foreF: -8, armB: -4, foreB: -10 },
}
const X = {
  stuEnd: EDGE_L - 67.6, stuStart: EDGE_L - 67.6 - START_GAP,
  menEnd: EDGE_R + 67.6 * 1.06, menStart: EDGE_R + 67.6 * 1.06 + START_GAP,
  stuPull: EDGE_L - 45.1, menPull: EDGE_R + 45.1 * 1.06,
}

const mix = (a: Vec, b: gsap.TweenVars): gsap.TweenVars => ({ ...a, ...b })
const tf = (node: Element, value: string) => node.setAttribute('transform', value)

function char(x: number, face: number, sc: number): CharState {
  return { x, face, sc, lean: 0, walk: 0, phase: 0, sw: 0.15, jump: 0, legF: 0, legB: 0, head: 0, ...POSE.push }
}

export function startStory(svg: SVGSVGElement, { reduced, onCaption }: StoryOptions): () => void {
  const q = <T extends Element = SVGGElement>(name: string) => {
    const node = svg.querySelector<T>(`[data-ss="${name}"]`)
    if (!node) throw new Error(`Review loader part missing: ${name}`)
    return node
  }

  /* ---------- elements (scoped to this SVG, no global ids) ---------- */
  const el = {
    logo: q('logo'), pA: q('pieceA'), pB: q('pieceB'), ink: q<SVGPathElement>('ink'), pen: q('pen'),
    sparkR: q('sparkR'), sparkL: q('sparkL'), bubble: q('bubble'), q: q('q'),
    paper: q('paper'), check: q('check'), env: q('env'),
    lines: Array.from(svg.querySelectorAll<SVGLineElement>('[data-ss="pl"]')),
    confetti: Array.from(svg.querySelectorAll<SVGRectElement>('[data-ss="confetti"]')),
  }
  const parts = ['', '-body', '-legF', '-legB', '-armF', '-foreF', '-armB', '-foreB', '-head'] as const
  const body = (id: 'stu' | 'men') => Object.fromEntries(parts.map((p) => [p, q(id + p)])) as Record<(typeof parts)[number], SVGGElement>
  const people = { stu: body('stu'), men: body('men') }

  // Sample the S path once instead of calling getPointAtLength every frame.
  const inkLen = el.ink.getTotalLength()
  const inkPts = new Float32Array((INK_SAMPLES + 1) * 2)
  for (let i = 0; i <= INK_SAMPLES; i++) {
    const p = el.ink.getPointAtLength((inkLen * i) / INK_SAMPLES)
    inkPts[i * 2] = p.x; inkPts[i * 2 + 1] = p.y
  }
  const inkPoint = (t: number) => {
    const f = Math.min(Math.max(t, 0), 1) * INK_SAMPLES
    const i = Math.min(Math.floor(f), INK_SAMPLES - 1), r = f - i
    return [inkPts[i * 2] + (inkPts[i * 2 + 2] - inkPts[i * 2]) * r, inkPts[i * 2 + 1] + (inkPts[i * 2 + 3] - inkPts[i * 2 + 1]) * r]
  }
  el.ink.style.strokeDasharray = `${inkLen} ${inkLen}`
  el.lines.forEach((l) => { l.style.strokeDasharray = '14 14' })

  /* ---------- animated state ---------- */
  const st = {
    logo: { s: 1 },
    pA: { x: -OFF }, pB: { x: OFF },
    spark: { s: 0.4, o: 0 },
    ink: { t: 0, e: 0 },
    pen: { s: 0 },
    bubble: { s: 0, q: 0 },
    paper: { s: 0, l1: 0, l2: 0, l3: 0, chk: 0 },
    env: { s: 0, t: 0, sx: 270, sy: 150 },
    stu: char(X.stuStart, 1, 1),
    men: char(X.menStart, -1, 1.06),
  }

  // Deterministic confetti so every loop looks the same.
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const confetti = el.confetti.map((node) => {
    const x0 = 400 + (rnd() - 0.5) * 50
    return { node, s: { x: x0, y: 182, r: 0, o: 0 }, x0, dx: (rnd() - 0.5) * 380, up: 55 + rnd() * 60, yEnd: GROUND - 3 - rnd() * 8, rot: (rnd() - 0.5) * 900, delay: rnd() * 0.08 }
  })

  /* ---------- draw one frame ---------- */
  function drawChar(id: 'stu' | 'men', c: CharState, time: number) {
    const n = people[id]
    const sn = Math.sin(c.phase * Math.PI * 2)
    const leg = c.walk * 24 * sn
    const drop = 70 * (1 - Math.cos(leg * RAD))
    const swing = c.walk * 22 * sn * c.sw
    const breathe = reduced ? 0 : Math.sin(time * 2.4 + (id === 'men' ? 1.4 : 0)) * 0.6
    const armF = c.armF + swing, armB = c.armB - swing
    tf(n[''], `translate(${c.x} ${GROUND - c.jump}) scale(${c.face * c.sc} ${c.sc})`)
    tf(n['-body'], `translate(0 ${drop}) rotate(${c.lean})`)
    tf(n['-legF'], `translate(0 -70) rotate(${-leg + c.legF})`)
    tf(n['-legB'], `translate(0 -70) rotate(${leg + c.legB})`)
    tf(n['-armF'], `translate(1 -114) rotate(${armF})`)
    tf(n['-foreF'], `translate(0 26) rotate(${c.foreF})`)
    tf(n['-armB'], `translate(1 -114) rotate(${armB})`)
    tf(n['-foreB'], `translate(0 26) rotate(${c.foreB})`)
    tf(n['-head'], `translate(1 ${-128 + breathe}) rotate(${c.head})`)
    return armF
  }

  function render(time = 0) {
    tf(el.logo, `translate(400 ${GROUND}) scale(${S * st.logo.s})`)
    tf(el.pA, `translate(${st.pA.x} 0)`)
    tf(el.pB, `translate(${st.pB.x} 0)`)

    el.ink.style.strokeDashoffset = String(inkLen * (1 - st.ink.t) - inkLen * st.ink.e)
    el.ink.setAttribute('opacity', st.ink.t > 0 && st.ink.e < 1 ? '1' : '0')
    const [px, py] = inkPoint(st.ink.t)
    tf(el.pen, `translate(${px} ${py}) scale(${st.pen.s})`)
    el.pen.setAttribute('opacity', st.pen.s > 0.01 ? '1' : '0')

    tf(el.sparkR, `translate(232 64) scale(${st.spark.s})`)
    tf(el.sparkL, `translate(24 192) scale(${st.spark.s})`)
    el.sparkR.setAttribute('opacity', String(st.spark.o))
    el.sparkL.setAttribute('opacity', String(st.spark.o))

    const stuArm = drawChar('stu', st.stu, time)
    drawChar('men', st.men, time)

    const p = st.paper
    tf(el.paper, `translate(0 26) rotate(${-(st.stu.lean + stuArm + st.stu.foreF)}) scale(${p.s})`)
    el.paper.setAttribute('opacity', p.s > 0.01 ? '1' : '0')
    el.lines[0].style.strokeDashoffset = String(14 * (1 - p.l1))
    el.lines[1].style.strokeDashoffset = String(14 * (1 - p.l2))
    el.lines[2].style.strokeDashoffset = String(14 * (1 - p.l3))
    tf(el.check, `translate(10 -27) scale(${p.chk})`)

    tf(el.bubble, `translate(${st.stu.x + 34} 140) scale(${st.bubble.s})`)
    el.bubble.setAttribute('opacity', st.bubble.s > 0.01 ? '1' : '0')
    tf(el.q, `rotate(${st.bubble.q})`)

    const e = st.env, t = e.t, u = 1 - t
    const cx = e.sx + 200, cy = e.sy - 120, tx = 880, ty = 80
    const ex = u * u * e.sx + 2 * u * t * cx + t * t * tx
    const ey = u * u * e.sy + 2 * u * t * cy + t * t * ty
    tf(el.env, `translate(${ex} ${ey}) rotate(${-18 + 34 * t}) scale(${1.15 * e.s})`)
    el.env.setAttribute('opacity', e.s > 0.01 ? '1' : '0')

    for (const c of confetti) {
      if (c.s.o <= 0 && c.node.getAttribute('opacity') === '0') continue
      tf(c.node, `translate(${c.s.x} ${c.s.y}) rotate(${c.s.r})`)
      c.node.setAttribute('opacity', String(c.s.o))
    }
  }

  /* ---------- the story timeline ---------- */
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'power2.out' } })
  const both = [st.stu, st.men]

  // 1 · Two halves come together
  tl.to(both, { lean: 8, duration: 0.3 }, 0)
    .to(st.pA, { x: 0, duration: 1.3, ease: 'power2.inOut' }, 0.25)
    .to(st.pB, { x: 0, duration: 1.3, ease: 'power2.inOut' }, 0.25)
    .to(st.stu, { x: X.stuEnd, phase: 2, duration: 1.3, ease: 'power2.inOut' }, 0.25)
    .to(st.men, { x: X.menEnd, phase: 2, duration: 1.3, ease: 'power2.inOut' }, 0.25)
    .to(both, { walk: 1, duration: 0.3, ease: 'sine.out' }, 0.25)
    .to(both, { walk: 0, duration: 0.3, ease: 'sine.in' }, 1.25)
    .to(st.logo, { s: 1.05, duration: 0.1 }, 1.55)
    .to(st.logo, { s: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)' }, 1.65)
    .fromTo(st.spark, { s: 0.4, o: 1 }, { s: 1.25, o: 0, duration: 0.55, immediateRender: false }, 1.55)
    .to(both, { lean: -2, duration: 0.15 }, 1.55)
    .to(both, { lean: 0, duration: 0.3, ease: 'sine.inOut' }, 1.7)
    .to(both, mix(POSE.rest, { sw: 1, duration: 0.45, ease: 'power2.inOut' }), 1.62)
    .to(st.stu, { head: 10, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.82)
    .to(st.men, { head: 8, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.86)

  // 2 · The blank page
  tl.call(onCaption, [1], 2.2)
    .to(st.stu, { armF: -30, foreF: -70, head: 8, duration: 0.4 }, 2.22)
    .fromTo(st.paper, { s: 0 }, { s: 1, duration: 0.35, ease: 'back.out(2)', immediateRender: false }, 2.25)
    .fromTo(st.bubble, { s: 0 }, { s: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: false }, 2.45)
    .to(st.bubble, { q: 12, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.85)
    .to(st.stu, { armB: -165, foreB: -70, duration: 0.3 }, 2.6)
    .to(st.stu, { foreB: -48, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.9)
    .to(st.stu, { armB: POSE.rest.armB, foreB: POSE.rest.foreB, duration: 0.35, ease: 'power2.inOut' }, 3.6)
    .to(st.men, { armF: -97, foreF: -3, lean: 3, duration: 0.35 }, 2.7)

  // 3 · Writing along the S
  tl.to(st.bubble, { s: 0, duration: 0.25, ease: 'back.in(2)' }, 3.5)
    .call(onCaption, [2], 3.5)
    .fromTo(st.pen, { s: 0 }, { s: 1, duration: 0.25, ease: 'back.out(2)', immediateRender: false }, 3.5)
    .to(st.men, mix(POSE.rest, { lean: 0, duration: 0.4, ease: 'power2.inOut' }), 3.75)
    .to(st.ink, { t: 1, duration: 1.4, ease: 'power1.inOut' }, 3.7)
    .to(st.paper, { l1: 1, duration: 0.4, ease: 'none' }, 3.8)
    .to(st.paper, { l2: 1, duration: 0.4, ease: 'none' }, 4.25)
    .to(st.paper, { l3: 1, duration: 0.4, ease: 'none' }, 4.7)
    .to(st.men, { head: 8, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 4.0)
    .to(st.pen, { s: 0, duration: 0.2, ease: 'back.in(2)' }, 5.12)
    .fromTo(st.paper, { chk: 0 }, { chk: 1, duration: 0.3, ease: 'back.out(2.5)', immediateRender: false }, 5.12)
    .to(st.stu, { head: 14, duration: 0.15, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 5.15)

  // 4 · Send it + celebrate
  tl.call(onCaption, [3], 5.45)
    .to(st.stu, { armF: -160, foreF: -12, head: -8, duration: 0.3 }, 5.47)
    .to(st.paper, { s: 0, duration: 0.1, ease: 'power1.in' }, 5.78)
    .fromTo(st.env, { s: 0 }, { s: 1, duration: 0.12, immediateRender: false }, 5.76)
    .to(st.env, { t: 1, duration: 0.8, ease: 'power1.in' }, 5.82)
    .set(st.env, { s: 0, t: 0 }, 6.7)
    .to(st.stu, { armF: -170, foreF: -5, armB: -150, foreB: -5, duration: 0.15 }, 5.98)
    .to(st.stu, { jump: 18, legF: -18, legB: 12, duration: 0.22 }, 6.0)
    .to(st.stu, { jump: 0, legF: 0, legB: 0, duration: 0.24, ease: 'power2.in' }, 6.22)
    .to(st.stu, mix(POSE.rest, { head: 0, duration: 0.4, ease: 'power2.inOut' }), 6.6)
    .to(st.men, { armF: -55, foreF: -75, armB: -45, foreB: -80, head: -6, duration: 0.2 }, 5.98)
    .to(st.men, { foreF: -50, duration: 0.09, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 6.2)
    .to(st.men, mix(POSE.rest, { head: 0, duration: 0.35, ease: 'power2.inOut' }), 6.95)
  for (const c of confetti) {
    const T = 6.0 + c.delay
    tl.set(c.s, { x: c.x0, y: 182, r: 0, o: 1 }, T)
      .to(c.s, { x: c.x0 + c.dx, duration: 1.6, ease: 'power1.out' }, T)
      .to(c.s, { y: 182 - c.up, duration: 0.42, ease: 'power2.out' }, T)
      .to(c.s, { y: c.yEnd, duration: 1.05, ease: 'power2.in' }, T + 0.42)
      .to(c.s, { r: c.rot, duration: 1.6, ease: 'none' }, T)
      .to(c.s, { o: 0, duration: 0.3, ease: 'none' }, T + 1.3)
  }

  // 5 · Calm reset: pull the halves back apart
  tl.set(st.paper, { l1: 0, l2: 0, l3: 0, chk: 0 }, 6.9)
    .call(onCaption, [0], 6.95)
    .to(st.ink, { e: 1, duration: 0.45, ease: 'power1.in' }, 6.9)
    .set(st.ink, { t: 0, e: 0 }, 7.4)
    .to(both, mix(POSE.pull, { sw: 0.15, lean: -6, duration: 0.35, ease: 'power2.inOut' }), 7.35)
    .to(st.stu, { x: X.stuPull, phase: 2.5, duration: 0.35, ease: 'power2.inOut' }, 7.35)
    .to(st.men, { x: X.menPull, phase: 2.5, duration: 0.35, ease: 'power2.inOut' }, 7.35)
    .to(both, { walk: 0.6, duration: 0.17, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 7.35)
    .to(st.pA, { x: -OFF, duration: 1.1, ease: 'power2.inOut' }, 7.75)
    .to(st.pB, { x: OFF, duration: 1.1, ease: 'power2.inOut' }, 7.75)
    .to(st.stu, { x: X.stuPull - START_GAP, phase: 0.5, duration: 1.1, ease: 'power2.inOut' }, 7.75)
    .to(st.men, { x: X.menPull + START_GAP, phase: 0.5, duration: 1.1, ease: 'power2.inOut' }, 7.75)
    .to(both, { walk: 1, duration: 0.25, ease: 'sine.out' }, 7.75)
    .to(both, { walk: 0, duration: 0.25, ease: 'sine.in' }, 8.6)
    .to(both, mix(POSE.push, { lean: 0, duration: 0.3, ease: 'power2.inOut' }), 8.85)
    .to(st.stu, { x: X.stuStart, phase: 0, duration: 0.3, ease: 'power2.inOut' }, 8.85)
    .to(st.men, { x: X.menStart, phase: 0, duration: 0.3, ease: 'power2.inOut' }, 8.85)
    .to(both, { walk: 0.5, duration: 0.15, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 8.85)

  /* ---------- envelope starts from the paper above the student's head ---------- */
  tl.seek(5.77, true); render()
  const m = svg.getScreenCTM(), n = el.paper.getScreenCTM()
  if (m && n) {
    const k = m.inverse().multiply(n)
    if (Number.isFinite(k.e) && Number.isFinite(k.f) && k.a !== 0) {
      st.env.sx = k.c * -14 + k.e
      st.env.sy = k.d * -14 + k.f
    }
  }

  if (reduced) {
    // Calm, still frame (halves joined); the component pulses it with CSS.
    tl.seek(2.15, true); render()
    onCaption(0)
    return () => { tl.kill() }
  }

  tl.seek(0, true); render()
  const tick = (time: number) => render(time)
  gsap.ticker.add(tick)
  tl.play(0)
  return () => {
    gsap.ticker.remove(tick)
    tl.kill()
  }
}
