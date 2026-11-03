import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { ui } from '../landing-page/ui'
import { checkoutPlans } from './data'

type CheckoutPlan = (typeof checkoutPlans)[keyof typeof checkoutPlans]

function CheckoutDialog({ plan, onDismiss }: { plan: CheckoutPlan; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement
    const hadScrollLock = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    dialog.showModal()

    return () => {
      dialog.close()
      if (!hadScrollLock) document.body.classList.remove('overflow-hidden')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-40px)] w-[calc(100%_-_40px)] max-w-[660px] overflow-auto overscroll-contain rounded-panel border-0 bg-white p-[38px] font-sans text-base leading-[1.65] text-ink shadow-card backdrop:bg-[rgba(11,28,45,.64)] backdrop:backdrop-blur-[8px] max-[761px]:px-[22px] max-[761px]:py-[30px]"
      id="checkout-modal"
      data-pricing-checkout
      aria-labelledby="checkout-title"
      onClick={dismissFromBackdrop}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    >
      <button className={`${ui.focus} absolute top-3 right-4 cursor-pointer border-0 bg-transparent px-[6px] py-[2px] text-[1.6rem] font-normal text-ink`} id="checkout-close" type="button" aria-label="Close checkout" onClick={onDismiss}>×</button>
      <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Statement Studio checkout</p>
      <div className="grid grid-cols-[1fr_auto] items-start gap-7 border-b border-line pb-6 max-[761px]:grid-cols-1 max-[761px]:gap-3">
        <div>
          <h2 className="mb-2.5 text-[clamp(1.8rem,4vw,2.7rem)] font-[650] leading-[1.06] tracking-[-.045em] text-navy" id="checkout-title">{plan.title}</h2>
          <p className="m-0 max-w-[470px] text-[.82rem] leading-[1.6] text-slate" id="checkout-description">{plan.description}</p>
        </div>
        <strong className="text-[2.45rem] font-bold tracking-[-.06em] whitespace-nowrap text-navy max-[761px]:text-[2.1rem]" id="checkout-price">{plan.price}</strong>
      </div>
      <ul className="my-6 grid list-none gap-3 p-0" id="checkout-includes">
        {plan.includes.map((item) => (
          <li className="relative rounded-[11px] bg-parchment py-[13px] pr-3.5 pl-[42px] text-[.78rem] font-[650] text-navy before:absolute before:top-3 before:left-4 before:font-black before:text-positive before:content-['✓']" key={item}>{item}</li>
        ))}
      </ul>
      <div className="mb-[22px] flex flex-wrap gap-2">
        {['One-time payment', 'Secure Stripe checkout', 'No admission guarantee'].map((item) => (
          <span className="rounded-full border border-[rgba(49,92,74,.17)] bg-[rgba(49,92,74,.07)] px-2.5 py-[7px] text-[.61rem] font-extrabold text-positive" key={item}>{item}</span>
        ))}
      </div>
      <label className="mb-[18px] grid gap-2" htmlFor="checkout-email">
        <span className="text-[.72rem] font-extrabold text-navy">Email for your receipt and report access</span>
        <input className="min-h-[52px] w-full rounded-[11px] border border-[rgba(10,32,52,.18)] bg-white px-[15px] text-[.82rem] text-navy outline-none disabled:opacity-100" id="checkout-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required disabled />
        <small className="text-[.61rem] text-muted">Your statement text is never sent to Stripe.</small>
      </label>
      <button className={`${ui.button} ${ui.primary} min-h-[52px] w-full px-[23px] font-[750] tracking-[-.01em] disabled:transform-none disabled:cursor-wait disabled:opacity-58`} id="checkout-confirm" type="button" disabled>Payments disabled in preview</button>
      <button className={`${ui.focus} mx-auto mt-3 flex min-h-0 cursor-pointer items-center justify-center gap-2.5 rounded-none border border-transparent border-b-navy/26 bg-transparent px-0 py-2 text-[.9rem] font-[750] tracking-[-.01em] text-ink transition-colors hover:border-b-accent hover:text-accent-dark motion-reduce:transition-none`} id="checkout-cancel" type="button" onClick={onDismiss}>Return to Statement Studio</button>
      <p className="mt-[15px] mb-0 text-center text-[.68rem] text-muted" id="checkout-status" role="status" aria-live="polite">Payments are disabled in this private preview. No transaction will be created.</p>
    </dialog>
  )
}

export default function PricingCheckoutDialog() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const planId = searchParams.get('plan')
  if (searchParams.get('panel') !== 'checkout' || !planId || !Object.hasOwn(checkoutPlans, planId)) return null

  function dismiss() {
    const next = new URLSearchParams(searchParams)
    next.delete('panel')
    next.delete('plan')
    navigate({ pathname: location.pathname, search: next.size ? `?${next.toString()}` : '', hash: location.hash }, { replace: true, preventScrollReset: true })
  }

  return <CheckoutDialog key={planId} plan={checkoutPlans[planId as keyof typeof checkoutPlans]} onDismiss={dismiss} />
}
