import assert from 'node:assert/strict'
import test from 'node:test'
import { createCycleCheckout, getCycleAccess, getPaymentHistory, PaymentHistoryError } from '../src/features/payments/api.ts'

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

test('cycle access displays the backend expiry and test charge', async (t) => {
  const access = {
    status: 'active', paid_at: '2026-11-26T10:00:00Z', expires_at: '2027-11-26T10:00:00Z',
    expires_soon: true, checkout_amount_cents: 2900,
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/payments/cycle')
    assert.equal(options.credentials, 'include')
    return jsonResponse(access)
  })
  assert.deepEqual(await getCycleAccess(), access)
})

test('cycle checkout sends an idempotency reference and accepts the hosted Stripe URL', async (t) => {
  const stripeUrl = 'https://checkout.stripe.com/c/session-test'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/payments/cycle/checkout')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { request_id: 'test-request' })
    return jsonResponse({ url: stripeUrl })
  })
  assert.equal(await createCycleCheckout('test-request'), stripeUrl)
})
