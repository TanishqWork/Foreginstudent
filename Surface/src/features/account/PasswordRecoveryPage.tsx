import { useEffect, useRef, useState } from 'react'
import type { ReactNode, SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import SiteFooter from '../landing-page/components/SiteFooter'
import SiteHeader from '../landing-page/components/SiteHeader'
import { ui } from '../landing-page/ui'
import { AuthError, authErrorMessage, checkPasswordRecovery, requestPasswordReset, resetPassword } from './auth'
import { useAuth } from './auth-context'
import { passwordResetError } from './password-validation'

const inputClasses = `${ui.focus} min-h-12 w-full rounded-[10px] border border-navy/15 bg-white px-[15px] py-3.5 text-base text-navy placeholder:text-muted`
const labelClasses = 'text-sm font-bold text-navy'
const buttonClasses = `${ui.button} ${ui.primary} min-h-[52px] w-full cursor-pointer px-6 font-bold disabled:cursor-wait disabled:opacity-60`

function RecoveryLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="min-h-svh bg-canvas font-sans leading-[1.65] text-ink selection:bg-accent/20">
      <title>{title} | Statement Studio</title>
      <meta name="description" content={description} />
      <SiteHeader />
      <main className="min-h-[78vh] bg-[radial-gradient(circle_at_85%_5%,rgba(87,88,232,.11),transparent_25rem),linear-gradient(180deg,#f8f7f3_0%,#efeff7_100%)]" id="main" aria-labelledby="recovery-heading">
        <div className={`${ui.shell} pt-[clamp(105px,12vw,155px)] pb-24`}>
          <section className="mx-auto grid max-w-[620px] gap-6 rounded-card border border-navy/10 bg-white/95 p-[clamp(26px,5vw,48px)] shadow-[0_30px_80px_rgba(11,32,52,.08)]">
            <header>
              <p className={`${ui.overline} mb-4 text-accent-dark`}>Account access</p>
              <h1 ref={headingRef} className="mb-4 font-display text-[clamp(2rem,5vw,3.3rem)] leading-[1.05] tracking-[-.035em] text-navy focus:outline-none" id="recovery-heading" tabIndex={-1}>{title}</h1>
              <p className="m-0 text-base text-muted">{description}</p>
            </header>
            {children}
            <Link className={`${ui.focus} inline-flex min-h-11 items-center justify-center rounded-md text-sm font-semibold text-accent underline underline-offset-4`} to="/account">Back to sign in</Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function ForgotPasswordPage() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '')
    setPending(true)
    setError('')
    try {
      await requestPasswordReset(email)
      form.reset()
      setSent(true)
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <RecoveryLayout title={sent ? 'Check your email' : 'Forgot your password?'} description={sent
      ? 'If an account exists for that email address, a password-reset link is on its way.'
      : 'Enter the email address you use for Statement Studio. We will send you a link to choose a new password.'}>
      {sent ? (
        <div className="grid gap-4 rounded-xl border border-accent/15 bg-accent/5 p-5" role="status" aria-live="polite">
          <p className="m-0 text-sm text-navy">Open the link in this browser. If you do not see the email, check your spam folder. For your security, the link can only be used once.</p>
          <Link className={`${ui.focus} inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-accent underline underline-offset-4`} to="/forgot-password" onClick={() => setSent(false)}>Try another email address</Link>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)} aria-busy={pending}>
          <label className={labelClasses} htmlFor="recovery-email">Email address</label>
          <input className={inputClasses} id="recovery-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="you@example.com" disabled={pending} aria-describedby="recovery-error" required />
          <button className={`${buttonClasses} mt-2`} type="submit" disabled={pending}>{pending ? 'Requesting link…' : 'Send reset link'}</button>
          <p className="m-0 min-h-6 text-sm text-red-700" id="recovery-error" role="alert">{error}</p>
        </form>
      )}
    </RecoveryLayout>
  )
}

type RecoveryState = 'checking' | 'ready' | 'expired' | 'unavailable'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clearSession } = useAuth()
  const invalidLink = searchParams.get('error') === 'invalid_recovery'
  const [state, setState] = useState<RecoveryState>(invalidLink ? 'expired' : 'checking')
  const [retry, setRetry] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const recoveryState = invalidLink ? 'expired' : state

  useEffect(() => {
    if (invalidLink) return
    const controller = new AbortController()
    void checkPasswordRecovery(controller.signal).then((valid) => {
      if (!controller.signal.aborted) setState(valid ? 'ready' : 'expired')
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if (cause instanceof AuthError && cause.status === 401) setState('expired')
      else {
        setError(authErrorMessage(cause))
        setState('unavailable')
      }
    })
    return () => controller.abort()
  }, [invalidLink, retry])

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || recoveryState !== 'ready') return
    const form = event.currentTarget
    const values = new FormData(form)
    const password = String(values.get('password') ?? '')
    const confirmation = String(values.get('password_confirmation') ?? '')
    const invalidPassword = passwordResetError(password, confirmation)
    if (invalidPassword) {
      setError(invalidPassword)
      return
    }
    setPending(true)
    setError('')
    try {
      await resetPassword(password, confirmation)
      form.reset()
      clearSession()
      navigate('/account?password_reset=complete', { replace: true })
    } catch (cause) {
      if (cause instanceof AuthError && (cause.status === 401 || cause.status === 403)) setState('expired')
      else setError(authErrorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <RecoveryLayout title="Choose a new password" description="Enter your new password twice. Once it is saved, sign in again with your new password.">
      {recoveryState === 'checking' && <p className="m-0 text-base text-muted" role="status">Checking your reset link…</p>}
      {recoveryState === 'expired' && (
        <div className="grid gap-4 rounded-xl border border-navy/10 bg-canvas p-5" role="alert">
          <p className="m-0 text-base text-navy">This reset link is no longer available. It may have expired, already been used, or been opened in a different browser.</p>
          <Link className={buttonClasses} to="/forgot-password">Request a new reset link</Link>
        </div>
      )}
      {recoveryState === 'unavailable' && (
        <div className="grid gap-4" role="alert">
          <p className="m-0 text-sm text-red-700">{error}</p>
          <button className={buttonClasses} type="button" onClick={() => { setError(''); setState('checking'); setRetry((value) => value + 1) }}>Try again</button>
        </div>
      )}
      {recoveryState === 'ready' && (
        <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)} aria-busy={pending}>
          <label className={labelClasses} htmlFor="new-password">New password</label>
          <input className={inputClasses} id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} disabled={pending} aria-describedby="password-help password-reset-error" required />
          <p className="m-0 text-sm text-muted" id="password-help">Use at least 8 characters, including uppercase and lowercase letters, a number, and a symbol.</p>
          <label className={`${labelClasses} mt-2`} htmlFor="confirm-password">Confirm new password</label>
          <input className={inputClasses} id="confirm-password" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} disabled={pending} aria-describedby="password-reset-error" required />
          <button className={`${buttonClasses} mt-2`} type="submit" disabled={pending}>{pending ? 'Saving password…' : 'Save new password'}</button>
          <p className="m-0 min-h-6 text-sm text-red-700" id="password-reset-error" role="alert">{error}</p>
        </form>
      )}
    </RecoveryLayout>
  )
}
