import { useEffect, useState } from 'react'
import StatementLoader from '../shared/StatementLoader'
import { Badge, EmptyState, Icon, PageHeading } from '../student/ui'
import { formatDateTime, relativeTime } from '../history/format'
import { getPaymentHistory } from './api'
import type { PaymentHistoryItem } from './api'

function formatMoney(item: PaymentHistoryItem): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: item.currency.toUpperCase(),
  }).format(item.amount_cents / 100)
}

function productLabel(value: string): string {
  return value === 'complete_report' ? 'Complete report' : value.replace(/_/g, ' ')
}

function providerLabel(value: string | null): string {
  return value === 'stripe' ? 'Stripe test checkout' : value === 'mock' ? 'Mock payment' : value ?? 'Payment provider'
}

function statusTone(value: string) {
  return value === 'paid' ? 'green' : value === 'failed' ? 'amber' : 'violet'
}

function referenceLabel(value: string | null): string {
  if (!value) return 'No provider reference'
  return value.length > 12 ? `...${value.slice(-8)}` : value
}

function PaymentRow({ item }: { item: PaymentHistoryItem }) {
  const happenedAt = item.paid_at ?? item.created_at
  return <article className="st-payment-row">
    <div className="st-payment-symbol"><Icon name="card" size={24}/></div>
    <div className="st-payment-main">
      <div className="st-payment-title"><Badge tone={statusTone(item.status)}>{item.status}</Badge><h3>{productLabel(item.product_type)}</h3></div>
      <p>{providerLabel(item.provider)} · {referenceLabel(item.provider_payment_id)}</p>
      <small>{formatDateTime(happenedAt)} · {relativeTime(happenedAt)}</small>
    </div>
    <strong className="st-payment-amount">{formatMoney(item)}</strong>
  </article>
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void getPaymentHistory(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setPayments(items)
      setError('')
    }).catch(() => {
      if (!controller.signal.aborted) setError('We could not load your payment history.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])

  return <section className="st-payment-page" aria-labelledby="payment-history-heading">
    <title>Payment history | Statement Studio</title>
    <PageHeading eyebrow="Billing" title="Payment history" description="A simple record of complete report payments stored in your account." />
    {loading ? <div className="st-history-loading" role="status"><StatementLoader/>Opening payment history...</div> : error ? (
      <EmptyState title="Payment history is unavailable" description={error}><button className="st-btn st-btn-secondary" type="button" onClick={() => window.location.reload()}>Try again</button></EmptyState>
    ) : payments.length === 0 ? (
      <EmptyState title="No payments yet" description="When you unlock a complete report, the payment date, amount, and status will appear here." />
    ) : <div className="st-payment-list">{payments.map((item) => <PaymentRow key={item.purchase_id} item={item}/>)}</div>}
  </section>
}
