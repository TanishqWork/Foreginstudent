import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import SiteHeader from '../landing-page/components/SiteHeader'
import SiteFooter from '../landing-page/components/SiteFooter'
import { ui } from '../landing-page/ui'
import { methodologyPrinciples } from './data'

const description =
  'Explore the Statement Studio assessment framework: criterion referenced writing standards, pathway requirements, observable draft evidence, and evidence linked explanations.'

export default function MethodologyPage() {
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
    <div className="min-h-svh bg-canvas text-ink selection:bg-accent/20">
      <title>Methodology | Statement Studio</title>
      <SiteHeader />
      <main className={`${ui.shell} pt-[82px] pb-[110px]`} id="main" aria-labelledby="methodology-heading">
        <Link
          className={`${ui.focus} inline-flex items-center gap-1 text-[.78rem] font-bold text-accent-dark no-underline transition-colors hover:text-accent motion-reduce:transition-none`}
          to="/"
        >
          <span aria-hidden="true">←</span>
          Return to product overview
        </Link>
        <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Methodology</p>
        <h1
          ref={headingRef}
          className="mt-[22px] mb-[26px] max-w-[980px] font-display text-[clamp(3.2rem,6vw,6.2rem)] font-normal leading-[1.06] tracking-[-.035em] text-navy focus:outline-none"
          id="methodology-heading"
          tabIndex={-1}
        >
          The assessment framework behind Statement Studio.
        </h1>
        <p className="mb-4 max-w-[980px] text-[1.05rem] leading-[1.65] text-slate">
          The system uses a criterion referenced writing standard, statement
          specific requirements, observable draft evidence, and patterns
          identified across consented successful applications and before and
          after revisions.
        </p>

        <div className="mt-[50px] grid gap-3">
          {methodologyPrinciples.map((principle) => (
            <article
              className="grid grid-cols-[48px_minmax(0,1fr)] gap-6 rounded-card border border-line bg-surface p-[26px] max-[600px]:grid-cols-1 max-[600px]:gap-3 max-[600px]:p-5"
              aria-labelledby={`principle-${principle.number}`}
              key={principle.number}
            >
              <span className="font-bold text-accent-dark" aria-hidden="true">{principle.number}</span>
              <div className="min-w-0">
                <h2
                  className="mb-[.83em] text-[clamp(2rem,3.9vw,4.4rem)] font-[650] leading-[1.06] tracking-[-.045em] text-navy"
                  id={`principle-${principle.number}`}
                >
                  {principle.title}
                </h2>
                <p className="mb-4 leading-[1.65]">{principle.description}</p>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-card bg-navy p-[34px] text-white max-[600px]:p-6" aria-labelledby="assessment-standards-heading">
          <h2 className="mb-[.83em] text-[1.6rem] font-[650] leading-[1.06] tracking-[-.045em]" id="assessment-standards-heading">
            What the assessment does not claim
          </h2>
          <p className="mb-4 leading-[1.65] text-white/65">
            Statement Studio does not predict admission, verify the truth of an
            applicant’s experiences, determine whether artificial intelligence
            wrote a statement, or replace an admissions committee.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
