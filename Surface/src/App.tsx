import { lazy, Suspense, useLayoutEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import HomePage from './features/landing-page/HomePage'
import MethodologyPage from './features/methodology/MethodologyPage'
import SampleReportPage from './features/sample-report/SampleReportPage'
import PricingPage from './features/pricing/PricingPage'
import AccountPage from './features/account/AccountPage'
import AssessmentPage from './features/assessment/AssessmentPage'
import { ui } from './features/landing-page/ui'

const FullSampleReportPage = lazy(() => import('./features/sample-report/FullSampleReportPage'))

function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-svh w-[calc(100%_-_48px)] max-w-[760px] content-center justify-items-start py-16">
      <title>Page not found | Statement Studio</title>
      <p className={`${ui.overline} mb-[18px] text-accent-dark`}>404 · Page not found</p>
      <h1 className="mb-6 font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-tight tracking-tight">Let’s get you back to the first read.</h1>
      <p className="mb-6 text-slate">The page you’re looking for isn’t available.</p>
      <Link className={`${ui.button} ${ui.primary} min-h-13 px-6`} to="/">Return to the homepage</Link>
    </main>
  )
}

export default function App() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/methodology" element={<MethodologyPage />} />
      <Route path="/sample-report" element={<SampleReportPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="/sample-report/full" element={
        <Suspense fallback={
          <main className={`${ui.shell} grid min-h-svh content-center py-20`}>
            <p className="text-slate" role="status">Loading the complete sample report…</p>
          </main>
        }>
          <FullSampleReportPage />
        </Suspense>
      } />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
