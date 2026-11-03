import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router'
import PricingCheckoutDialog from './PricingCheckoutDialog'
import SiteFooter from '../landing-page/components/SiteFooter'
import SiteHeader from '../landing-page/components/SiteHeader'
import { ui } from '../landing-page/ui'
import { choiceGuide, comparisonDetails, pricingFilters, pricingPlans } from './data'
import type { PricingFilter } from './data'

const description = 'Compare Statement Studio’s free assessment, complete report and revision check, application cycle access, and direct human review.'
const actionClasses = `${ui.button} min-h-[52px] px-[23px] font-[750] tracking-[-.01em]`

export default function PricingPage() {
  const { pathname } = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [filter, setFilter] = useState<PricingFilter>('all')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [pathname])

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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % pricingFilters.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + pricingFilters.length) % pricingFilters.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = pricingFilters.length - 1
    else return

    event.preventDefault()
    setFilter(pricingFilters[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="min-h-svh bg-canvas text-ink selection:bg-accent/20">
      <title>Pricing | Statement Studio</title>
      <SiteHeader />
      <main className="min-h-screen bg-[radial-gradient(circle_at_85%_5%,rgba(87,88,232,.11),transparent_25rem),radial-gradient(circle_at_8%_60%,rgba(25,115,96,.07),transparent_24rem),linear-gradient(180deg,#f8f7f3_0%,#efeff7_100%)]" id="main" aria-labelledby="pricing-heading">
        <div className={`${ui.shell} pt-[clamp(105px,12vw,150px)] pb-[120px]`}>
          <Link className={`${ui.focus} inline-flex items-center gap-1 text-[.78rem] font-bold text-accent-dark no-underline transition-colors hover:text-accent motion-reduce:transition-none`} to="/">
            <span aria-hidden="true">←</span> Return to product overview
          </Link>

          <header className="mt-8 mb-12 grid grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] items-end gap-[clamp(32px,6vw,90px)] max-[851px]:grid-cols-1">
            <div>
              <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Choose your level of support</p>
              <h1 ref={headingRef} className="mt-2.5 mb-5 max-w-[980px] font-display text-[clamp(2.8rem,6.5vw,6.4rem)] font-normal leading-[.92] tracking-[-.035em] text-navy focus:outline-none" id="pricing-heading" tabIndex={-1}>
                One statement. One application cycle. Or direct human review.
              </h1>
              <p className="mb-[1em] max-w-[760px] text-[.9rem] leading-[1.75] text-slate">
                Start free, unlock a complete report plus one revision check, or keep an application cycle in one secure account across your phone, tablet, laptop, and desktop.
              </p>
            </div>
            <aside className="rounded-[18px] border border-[rgba(11,32,52,.11)] bg-white/86 p-7 shadow-[0_28px_70px_rgba(11,32,52,.09)]">
              <span className="text-[.6rem] font-extrabold tracking-[.13em] text-accent uppercase">Most applicants choose</span>
              <strong className="mt-3 mb-2 block text-[1.25rem] font-bold text-navy">Application cycle access</strong>
              <p className="mb-5 text-[.7rem] leading-[1.65] text-muted">Five assessments over 60 days gives enough room to improve the statement, tailor it, and compare revisions.</p>
              <Link className={`${actionClasses} ${ui.primary}`} to="/pricing?panel=checkout&plan=cycle">Choose the recommended plan</Link>
            </aside>
          </header>

          <div className="mx-auto mb-[30px] flex w-max max-w-full overflow-auto rounded-full border border-[rgba(11,32,52,.1)] bg-white/72 p-[5px]" role="tablist" aria-label="Pricing views">
            {pricingFilters.map((item, index) => (
              <button
                className={`${ui.focus} cursor-pointer rounded-full border-0 px-[17px] py-[11px] text-[.66rem] font-extrabold whitespace-nowrap ${filter === item.id ? 'bg-accent text-white shadow-[0_8px_24px_rgba(11,32,52,.16)]' : 'bg-transparent text-muted'}`}
                ref={(element) => { tabRefs.current[index] = element }}
                key={item.id}
                id={`pricing-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                aria-controls="pricing-options"
                tabIndex={filter === item.id ? 0 : -1}
                onClick={() => setFilter(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 items-stretch gap-4 focus:outline-none" id="pricing-options" role="tabpanel" aria-labelledby={`pricing-tab-${filter}`} tabIndex={0}>
            {pricingPlans.filter((plan) => filter === 'all' || plan.group === filter).map((plan) => {
              const featured = plan.id === 'cycle'
              return (
                <article className={`relative col-span-3 flex min-h-[580px] flex-col overflow-hidden rounded-[26px] border border-navy/10 p-[30px] transition-[transform,box-shadow,border-color] duration-250 ease-in-out hover:-translate-y-[7px] hover:border-[rgba(182,108,55,.35)] hover:shadow-[0_30px_75px_rgba(11,32,52,.12)] motion-reduce:transform-none motion-reduce:transition-none max-[1181px]:col-span-6 max-[1181px]:min-h-[530px] max-[621px]:col-span-12 max-[621px]:min-h-0 ${featured ? 'bg-navy bg-[radial-gradient(circle_at_90%_0%,rgba(87,88,232,.55),transparent_22rem)] text-white shadow-[0_34px_90px_rgba(11,32,52,.22)]' : `${plan.id === 'expert' ? 'bg-[linear-gradient(155deg,#e5e5f4_0%,#f8f7f3_100%)]' : 'bg-white/90'} shadow-[0_18px_50px_rgba(11,32,52,.06)]`}`} key={plan.id} aria-labelledby={`pricing-plan-${plan.id}`}>
                  {featured && <div className="absolute top-[18px] -right-[38px] w-[150px] rotate-[38deg] bg-accent p-2 text-center text-[.56rem] font-black tracking-[.11em] text-white uppercase">Recommended</div>}
                  <div>
                    <span className={`mb-3.5 block text-[.58rem] font-[850] tracking-[.12em] uppercase ${featured ? 'text-[#e6b582]' : 'text-accent'}`}>{plan.eyebrow}</span>
                    <h2 className={`mb-3 text-[1.55rem] font-[650] leading-[1.04] tracking-[-.045em] ${featured ? 'text-white' : 'text-navy'}`} id={`pricing-plan-${plan.id}`}>{plan.title}</h2>
                    <p className={`m-0 min-h-[82px] text-[.7rem] leading-[1.65] ${featured ? 'text-white/67' : 'text-muted'}`}>{plan.description}</p>
                  </div>
                  <div className={`mt-[30px] mb-6 grid gap-1 border-y py-[22px] ${featured ? 'border-white/15' : 'border-[rgba(11,32,52,.1)]'}`}>
                    <strong className={`text-[2.55rem] font-bold tracking-[-.06em] ${featured ? 'text-white' : 'text-navy'}`}>{plan.price}</strong>
                    <span className={`text-[.62rem] ${featured ? 'text-white/58' : 'text-muted'}`}>{plan.payment}</span>
                  </div>
                  <ul className="m-0 mb-7 grid list-none gap-[13px] p-0">
                    {plan.features.map((feature) => (
                      <li className={`relative pl-5 text-[.68rem] leading-[1.5] before:absolute before:left-0 before:font-black before:content-['✓'] ${featured ? 'text-white/78 before:text-[#e6b582]' : 'text-slate before:text-positive'}`} key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link className={`${actionClasses} mt-auto w-full ${plan.id === 'free' ? 'bg-transparent text-ink hover:bg-white/50' : plan.id === 'expert' ? 'border-navy bg-navy text-white hover:bg-navy-soft' : ui.primary}`} to={plan.id === 'free' ? '/assessment' : `/pricing?panel=checkout&plan=${plan.id}`}>{plan.action}</Link>
                </article>
              )
            })}
          </div>

          <div className="mt-5 mb-14 grid grid-cols-4 overflow-hidden rounded-[15px] border border-[rgba(11,32,52,.1)] bg-white/72 max-[851px]:grid-cols-2 max-[621px]:grid-cols-1">
            {comparisonDetails.map((item, index) => (
              <div className={`border-r border-[rgba(11,32,52,.08)] p-[19px] last:border-r-0 max-[621px]:border-r-0 max-[621px]:border-b ${index === 1 ? 'max-[851px]:border-r-0' : ''} ${index < 2 ? 'max-[851px]:border-b' : ''}`} key={item.label}>
                <span className="mb-[5px] block text-[.55rem] font-extrabold tracking-[.1em] text-muted uppercase">{item.label}</span>
                <strong className="text-[.68rem] font-bold text-navy">{item.detail}</strong>
              </div>
            ))}
          </div>

          <section className={`${ui.darkPanel} grid grid-cols-[minmax(260px,.75fr)_minmax(0,1.25fr)] gap-[60px] rounded-card p-[42px] max-[851px]:grid-cols-1 max-[621px]:p-7`} aria-labelledby="pricing-guide-heading">
            <div>
              <p className={`${ui.overline} mb-[18px] text-accent-dark`}>A simple decision</p>
              <h2 className="mt-2 mb-0 font-display text-[clamp(1.8rem,3.5vw,3.4rem)] font-normal leading-none tracking-[-.025em] text-white" id="pricing-guide-heading">Choose based on how much work remains.</h2>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-white/12 bg-white/12">
              {choiceGuide.map((item) => (
                <article className="grid gap-[7px] bg-[rgba(9,27,44,.92)] p-5" key={item.situation}>
                  <span className="text-[.62rem] text-white/57">{item.situation}</span>
                  <strong className="text-[.76rem] font-bold text-white">{item.recommendation}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
      <PricingCheckoutDialog />
    </div>
  )
}
