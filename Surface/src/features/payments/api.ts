export type PaymentHistoryItem = {
  purchase_id: string
  status: string
  product_type: string
  amount_cents: number
  currency: string
  provider: string | null
  provider_payment_id: string | null
  paid_at: string | null
  created_at: string
}

export class PaymentHistoryError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'PaymentHistoryError'
    this.status = status
  }
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function stringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function parsePayment(value: unknown): PaymentHistoryItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new PaymentHistoryError('Payment history could not be displayed.')
  const row = value as Record<string, unknown>
  if (typeof row.purchase_id !== 'string' || !row.purchase_id) throw new PaymentHistoryError('Payment history could not be displayed.')
  if (typeof row.status !== 'string' || typeof row.product_type !== 'string') throw new PaymentHistoryError('Payment history could not be displayed.')
  if (typeof row.amount_cents !== 'number' || !Number.isInteger(row.amount_cents) || row.amount_cents < 0) throw new PaymentHistoryError('Payment history could not be displayed.')
  if (typeof row.currency !== 'string' || row.currency.length !== 3) throw new PaymentHistoryError('Payment history could not be displayed.')
  if (!stringOrNull(row.provider) || !stringOrNull(row.provider_payment_id)) throw new PaymentHistoryError('Payment history could not be displayed.')
  if (row.paid_at !== null && !isDateString(row.paid_at)) throw new PaymentHistoryError('Payment history could not be displayed.')
  if (!isDateString(row.created_at)) throw new PaymentHistoryError('Payment history could not be displayed.')
  return {
    purchase_id: row.purchase_id,
    status: row.status,
    product_type: row.product_type,
    amount_cents: row.amount_cents,
    currency: row.currency,
    provider: row.provider,
    provider_payment_id: row.provider_payment_id,
    paid_at: row.paid_at,
    created_at: row.created_at,
  }
}

export async function getPaymentHistory(signal?: AbortSignal): Promise<PaymentHistoryItem[]> {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(20_000)
    response = await fetch('/api/payments/history', {
      credentials: 'include',
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new PaymentHistoryError('We could not reach your payment history.')
  }
  if (!response.ok) throw new PaymentHistoryError('Payment history is unavailable right now.', response.status)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new PaymentHistoryError('Payment history could not be displayed.')
  let value: unknown
  try { value = await response.json() } catch { throw new PaymentHistoryError('Payment history could not be displayed.') }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new PaymentHistoryError('Payment history could not be displayed.')
  const items = (value as Record<string, unknown>).items
  if (!Array.isArray(items)) throw new PaymentHistoryError('Payment history could not be displayed.')
  return items.map(parsePayment)
}
