import { Link, Route, Routes } from 'react-router'
import HomePage from './features/landing-page/HomePage'
import { ui } from './features/landing-page/ui'

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
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
