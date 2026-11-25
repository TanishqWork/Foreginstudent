import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDateTime } from '../history/format'
import { Badge } from '../student/ui'
import { createCycleCheckout, PaymentHistoryError } from './api'
import type { useCycleAccess } from './use-cycle-access'

export default function CycleAccessPanel({ cycle }: { cycle: ReturnType<typeof useCycleAccess> }) {
  const { access, error, refresh } = cycle
  const [params, setParams] = useSearchParams()
  const [opening, setOpening] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const operation = useRef<AbortController | null>(null)
  const checkoutId = useRef<string | null>(null)
  const active = access?.status === 'active'
  const confirming = params.get('cycle') === 'success' && !active
  const cancelled = params.get('cycle') === 'cancelled'
  const amount = access?.checkout_amount_cents
  const price = amount ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount / 100) : null

  useEffect(() => () => operation.current?.abort(), [])

  useEffect(() => {
    if (!active || params.get('cycle') !== 'success') return
    const next = new URLSearchParams(params)
    next.delete('cycle')
    setParams(next, { replace: true })
  }, [active, params, setParams])

  async function checkout() {
    if (operation.current) return
    const controller = new AbortController()
    operation.current = controller
    setOpening(true)
    setCheckoutError('')
    try {
      checkoutId.current ??= crypto.randomUUID()
      const url = await createCycleCheckout(checkoutId.current, controller.signal)
      if (!controller.signal.aborted) window.location.assign(url)
    } catch (cause) {
      if (controller.signal.aborted) return
      setCheckoutError(cause instanceof PaymentHistoryError ? cause.message : 'Checkout could not be opened. Please try again.')
      if (cause instanceof PaymentHistoryError && cause.status === 409) refresh()
    } finally {
      operation.current = null
      if (!controller.signal.aborted) setOpening(false)
    }
  }

  return <section className="st-cycle-card" aria-labelledby="cycle-access-heading">
    <div>
      <div className="st-cycle-heading"><h2 id="cycle-access-heading">Application Cycle Access</h2>
        {active && <Badge tone={access.expires_soon ? 'amber' : 'green'}>{access.expires_soon ? 'Expires soon' : 'Active'}</Badge>}
        {access?.status === 'expired' && <Badge tone="amber">Expired</Badge>}
        {access?.status === 'refunded' && <Badge tone="violet">Refunded</Badge>}
      </div>
      {active && access.expires_at ? <p>Unlimited complete reports until {formatDateTime(access.expires_at, true)}.</p>
        : access?.status === 'expired' && access.expires_at ? <p>Access ended {formatDateTime(access.expires_at, true)}. Your saved reports are available in History.</p>
          : <p>Unlimited complete reports for 12 months from payment.</p>}
      {price && !active && !confirming && <p>One-time Stripe test payment · {price}</p>}
      {confirming && <p role="status">Confirming your Stripe test payment. Check again if it takes a little longer.</p>}
      {cancelled && !active && <p role="status">Checkout cancelled. You can start again when you’re ready.</p>}
      {error && <p role="alert">We could not check your cycle access.</p>}
      {checkoutError && <p role="alert">{checkoutError}</p>}
      {!active && !price && !error && !confirming && <p role="status">{access ? 'Cycle checkout is unavailable.' : 'Checking cycle access…'}</p>}
    </div>
    <div className="st-cycle-actions">
      {active && <Link className="st-btn st-btn-primary" to="/dashboard/assessment">Start an assessment</Link>}
      {!active && price && !confirming && !error && <button className="st-btn st-btn-primary" type="button" disabled={opening} onClick={() => void checkout()}>
        {opening ? 'Opening checkout…' : `${access?.status === 'expired' ? 'Renew in test mode' : 'Open test checkout'} · ${price}`}
      </button>}
      {(confirming || error) && <button className="st-btn st-btn-secondary" type="button" onClick={refresh}>Check access</button>}
    </div>
  </section>
}
