import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import SiteHeader from '../landing-page/components/SiteHeader'
import SiteFooter from '../landing-page/components/SiteFooter'
import { ui } from '../landing-page/ui'

const description =
  'Explore a fictional MPH and MBA combined degree assessment, with its strongest evidence, highest revision priority, and program fit concern.'

const summaryItems = [
  {
    label: 'Strongest evidence',
    detail: 'Operational leadership during a complex health delivery project.',
  },
  {
    label: 'Highest priority',
    detail: 'Define the management problem that an MPH alone cannot solve.',
  },
  {
    label: 'Fit concern',
    detail:
      'The program references rely on prestige and omit curriculum or community contribution.',
  },
] as const

const actionClasses =
  'inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-transparent px-[23px] text-center text-[.9rem] font-[750] tracking-[-.01em] no-underline transition duration-[220ms] ease-studio motion-reduce:transform-none motion-reduce:transition-none'

export default function SampleReportPage() {
  const { key } = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [key])

  useEffect(() => {
    const existingMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const meta = existingMeta ?? document.createElement('meta')
    const previousContent = meta.getAttribute('content')

    if (!existingMeta) {
      meta.name = 'description'
      document.head.append(meta)
    }
    meta.content = description

    return () => {
      if (!existingMeta) meta.remove()
      else if (previousContent === null) meta.removeAttribute('content')
      else meta.content = previousContent
    }
  }, [])

  return (
    <div className="min-h-svh bg-canvas bg-[radial-gradient(circle_at_50%_-8%,rgba(87,88,232,.08),transparent_36rem)] text-ink selection:bg-accent/20">
      <title>Sample report | Statement Studio</title>
      <SiteHeader />
      <main className={`${ui.shell} pt-[82px] pb-[110px]`} id="main" aria-labelledby="sample-report-heading">
        <Link
          className={`${ui.focus} inline-flex items-center gap-1 text-[.78rem] font-bold text-accent-dark no-underline transition-colors hover:text-accent motion-reduce:transition-none`}
          to="/"
        >
          <span aria-hidden="true">←</span>
          Return to product overview
        </Link>
        <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Confidential sample report</p>
        <h1
          ref={headingRef}
          className="mt-[22px] mb-[26px] max-w-[980px] font-display text-[clamp(3.2rem,6vw,6.2rem)] font-normal leading-[1.06] tracking-[-.035em] text-navy focus:outline-none"
          id="sample-report-heading"
          tabIndex={-1}
        >
          MPH and MBA combined degree assessment.
        </h1>
        <p className="mb-[1em] max-w-[980px] text-[1.05rem] leading-[1.65] text-slate">
          This fictional report shows the depth and structure of the paid
          assessment. It does not contain a real applicant’s writing.
        </p>

        <div className="mt-[34px] mb-12 flex gap-5 max-[760px]:flex-col max-[760px]:items-start">
          <Link
            className={`${actionClasses} ${ui.primary} ${ui.focus} hover:-translate-y-0.5`}
            to="/sample-report/full"
          >
            Open complete sample report
          </Link>
          <Link
            className={`${actionClasses} ${ui.focus} border-b-navy/25 py-2 text-ink hover:border-b-accent hover:text-accent-dark`}
            to="/assessment?pathway=business"
          >
            Assess a statement
          </Link>
        </div>

        <section className="rounded-panel border border-[rgba(183,120,66,.35)] bg-surface p-11 shadow-card max-[760px]:p-6" aria-label="Fictional sample assessment report">
          <div className="flex items-center gap-3 border-b border-line pb-6 max-[760px]:flex-wrap">
            <img
              src={`${import.meta.env.BASE_URL}assets/statement-lab-mark.svg`}
              alt=""
              className="size-11 shrink-0"
              width="44"
              height="44"
            />
            <div className="grid min-w-0">
              <span>Statement Studio</span>
              <strong className="font-bold">Admissions assessment system</strong>
            </div>
            <em className="ml-auto text-[.65rem] tracking-[.1em] text-accent-dark uppercase not-italic max-[760px]:ml-0 max-[760px]:w-full">Fictional sample</em>
          </div>

          <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-7 py-[38px] max-[760px]:grid-cols-1">
            <strong className="grid size-[130px] place-content-center rounded-full bg-navy text-5xl font-bold text-white" aria-label="Illustrative writing quality score: 94 out of 100">94</strong>
            <div className="min-w-0">
              <span>Highly developed · criterion standard v1.9</span>
              <h2 className="my-[7px] text-[2rem] font-[650] leading-[1.06] tracking-[-.045em] text-navy">Distinctive foundation, final precision pass</h2>
              <p className="mb-[1em] leading-[1.65] text-slate">
                The draft connects public health evidence with operational
                leadership and makes a credible case for both degrees. Final
                work should sharpen school-specific fit.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-line max-[760px]:grid-cols-1">
            {summaryItems.map((item) => (
              <div className="min-w-0 border-r border-line p-6 last:border-r-0 max-[760px]:border-r-0 max-[760px]:border-b" key={item.label}>
                <span className="text-[.64rem] font-bold tracking-[.1em] text-accent-dark uppercase">{item.label}</span>
                <p className="mt-2 leading-[1.65] text-slate">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
