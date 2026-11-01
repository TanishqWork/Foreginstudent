import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import HomeDialogs from './components/HomeDialogs'
import HeroSection from './components/HeroSection'
import {
  ClosingSection,
  FounderSection,
  MethodSection,
  OutcomesSection,
  PathwaysSection,
  PricingSection,
  ProductProofSection,
} from './components/HomeSections'
import { ui } from './ui'

function ConversionDock() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 620)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-[18px] left-1/2 z-40 flex w-[calc(100%_-_120px)] max-w-[820px] -translate-x-1/2 items-center justify-between gap-7 rounded-[18px] border border-white/15 bg-navy/95 py-3 pr-[13px] pl-5 text-white shadow-[0_24px_68px_rgba(17,19,27,.3)] backdrop-blur-xl max-[760px]:bottom-3 max-[760px]:w-[calc(100%_-_24px)] max-[760px]:gap-3 max-[760px]:p-[11px] max-[760px]:pl-[15px]" aria-label="Start a free assessment">
      <div className="grid leading-tight"><strong className="text-[.94rem] max-[720px]:text-[.88rem]">Free first read</strong><span className="mt-1 text-[.8rem] text-white/80 max-[760px]:hidden">No account required · first findings in about 3 seconds</span></div>
      <Link className={`${ui.button} ${ui.primary} min-h-11 px-[18px] text-[.86rem] max-[760px]:min-h-10 max-[760px]:px-[13px]`} to="/?panel=assessment">Review my draft</Link>
    </div>
  )
}

export default function HomePage() {
  const { hash, key, pathname, search } = useLocation()

  useEffect(() => {
    if (!hash || new URLSearchParams(search).has('panel')) return
    const target = document.getElementById(hash.slice(1))
    target?.scrollIntoView({ block: 'start' })
    target?.focus({ preventScroll: true })
  }, [hash, key, pathname, search])

  return (
    <div className="min-h-svh bg-canvas text-ink selection:bg-accent/20 max-[760px]:pb-[76px]">
      <SiteHeader />
      <main className="scroll-mt-[98px] focus:outline-none" id="main" tabIndex={-1}>
        <HeroSection />
        <ProductProofSection />
        <PathwaysSection />
        <MethodSection />
        <FounderSection />
        <OutcomesSection />
        <PricingSection />
        <ClosingSection />
      </main>
      <SiteFooter />
      <ConversionDock />
      <HomeDialogs />
    </div>
  )
}
