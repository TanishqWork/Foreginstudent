import assert from 'node:assert/strict'
import test from 'node:test'
import { getPaymentHistory, PaymentHistoryError } from '../src/features/payments/api.ts'

function jsonResponse(value, status = 200) {
  return Response.json(value, { status })
}

test('payment history fetches signed-in payment records', async (t) => {
  const row = {
    purchase_id: 'purchase-1',
    status: 'paid',
    product_type: 'complete_report',
    amount_cents: 2900,
    currency: 'USD',
    provider: 'stripe',
    provider_payment_id: 'cs_test_123',
    paid_at: '2026-11-18T10:00:00Z',
    created_at: '2026-11-18T10:00:00Z',
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/payments/history')
    assert.equal(options.credentials, 'include')
    assert.equal(options.cache, 'no-store')
    return jsonResponse({ items: [row] })
  })
  assert.deepEqual(await getPaymentHistory(), [row])
})

test('payment history rejects malformed rows safely', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({
    items: [{ purchase_id: 'purchase-1', status: 'paid', product_type: 'complete_report', amount_cents: '2900' }],
  }))
  await assert.rejects(getPaymentHistory(), (error) => {
    assert.ok(error instanceof PaymentHistoryError)
    assert.ok(!error.message.includes('purchase-1'))
    return true
  })
})
