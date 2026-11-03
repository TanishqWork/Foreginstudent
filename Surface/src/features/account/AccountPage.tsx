import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useLocation } from 'react-router'
import SiteHeader from '../landing-page/components/SiteHeader'
import SiteFooter from '../landing-page/components/SiteFooter'
import { ui } from '../landing-page/ui'

const inputClasses = `${ui.focus} min-h-12 w-full rounded-[10px] border border-[rgba(11,32,52,.16)] bg-white px-[15px] py-3.5 text-[.76rem] leading-[1.65] text-navy placeholder:text-muted max-[850px]:text-base`
const labelClasses = 'text-[.68rem] font-bold leading-[1.65] text-navy'

export default function AccountPage() {
  const { key } = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [key])

  function handleSignIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Sign-in is not connected yet. Your email and password have not been sent.')
  }

  return (
    <div className="min-h-svh bg-canvas font-sans leading-[1.65] text-ink selection:bg-accent/20">
      <title>My account | Statement Studio</title>
      <meta name="description" content="Sign in to Statement Studio with your email and password to access your reports, credits, and review orders." />
      <SiteHeader />
      <main
        className="min-h-[82vh] bg-[radial-gradient(circle_at_85%_5%,rgba(87,88,232,.11),transparent_25rem),radial-gradient(circle_at_8%_60%,rgba(25,115,96,.07),transparent_24rem),linear-gradient(180deg,#f8f7f3_0%,#efeff7_100%)]"
        id="main"
        aria-labelledby="account-heading"
      >
        <div className={`${ui.shell} pt-[clamp(105px,12vw,155px)] pb-[120px]`}>
          <header className="mb-12 grid grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] items-end gap-[clamp(28px,6vw,90px)] max-[850px]:grid-cols-1">
            <div>
              <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Secure customer access</p>
              <h1
                ref={headingRef}
                className="mt-2.5 mb-[18px] max-w-[850px] font-display text-[clamp(2.5rem,5.7vw,5.3rem)] font-normal leading-[.96] tracking-[-.035em] text-navy focus:outline-none"
                id="account-heading"
                tabIndex={-1}
              >
                Your reports, credits, and review orders in one place.
              </h1>
              <p className="mb-4 max-w-[690px] text-[.88rem] leading-[1.75] text-slate">
                Use the email entered at checkout. Sign in to Statement Studio with your email and password.
              </p>
            </div>
            <aside className="rounded-2xl border border-[rgba(11,32,52,.1)] bg-white/70 p-[26px]">
              <span className="text-[.61rem] font-extrabold tracking-[.12em] text-accent uppercase">Private by design</span>
              <strong className="mt-2.5 mb-2 block text-base font-bold text-navy">Email and password access</strong>
              <p className="m-0 text-[.7rem] leading-[1.6] text-muted">Only records linked to your authenticated email are shown.</p>
            </aside>
          </header>

          <section
            className="grid grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)] gap-[42px] rounded-card border border-navy/10 bg-white/95 p-[clamp(26px,5vw,52px)] shadow-[0_30px_80px_rgba(11,32,52,.08)] max-[850px]:grid-cols-1"
            id="account-login-card"
            aria-labelledby="account-login-heading"
          >
            <div>
              <p className={`${ui.overline} mb-[18px] leading-[1.7] text-muted`}>Access my account</p>
              <h2 className="my-2.5 text-[clamp(1.7rem,3vw,2.8rem)] font-[650] leading-[1.06] tracking-[-.04em] text-navy" id="account-login-heading">Sign in to your account</h2>
              <p className="mb-4 text-base leading-[1.7] text-muted">Use the same email you entered during Stripe checkout.</p>
            </div>
            <form className="grid content-center gap-3" id="account-login-form" method="post" onSubmit={handleSignIn}>
              <label className={labelClasses} htmlFor="account-email">Email address</label>
              <input
                className={inputClasses}
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                required
              />
              <label className={labelClasses} htmlFor="account-password">Password</label>
              <input
                className={inputClasses}
                id="account-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
              <button className={`${ui.button} ${ui.primary} min-h-[52px] w-full cursor-pointer px-6 font-[750] tracking-[-.01em]`} type="submit">Sign in</button>
              <p className="m-0 min-h-5 text-[.65rem] leading-[1.7] text-muted" id="account-login-status" role="status" aria-live="polite">{status}</p>
            </form>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
