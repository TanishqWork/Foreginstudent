import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthError, authRequest, checkPasswordRecovery, requestPasswordReset, resetPassword } from '../src/features/account/auth.ts'
import { passwordResetError } from '../src/features/account/password-validation.ts'

test('recovery request normalizes email and uses only the backend cookie API', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json({ message: 'If the account exists, check your email.' })
  })
  await requestPasswordReset('  Person@Example.com  ')
  assert.equal(calls[0].url, '/api/auth/forgot-password')
  assert.equal(calls[0].options.credentials, 'include')
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'person@example.com' })
  assert.equal(calls[0].options.headers.Authorization, undefined)
  assert.equal(calls[0].options.headers.apikey, undefined)
})

test('password reset sends both exact password values without trimming them', async (t) => {
  let submitted
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/reset-password')
    assert.equal(options.credentials, 'include')
    submitted = JSON.parse(options.body)
    return Response.json({ message: 'Password updated.' })
  })
  await resetPassword(' New Password!9 ', ' New Password!9 ')
  assert.deepEqual(submitted, { password: ' New Password!9 ', password_confirmation: ' New Password!9 ' })
})

test('reset form is enabled only for an explicitly valid backend recovery context', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ valid: true }))
  assert.equal(await checkPasswordRecovery(), true)
  t.mock.method(globalThis, 'fetch', async () => Response.json({}))
  assert.equal(await checkPasswordRecovery(), false)
})

test('expired recovery and rate-limit responses preserve status for the page states', async (t) => {
  for (const status of [401, 429]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Please request a new link later.' }, { status }))
    await assert.rejects(authRequest('recovery'), (error) => {
      assert.ok(error instanceof AuthError)
      assert.equal(error.status, status)
      return true
    })
  }
})

test('structured validation errors produce safe actionable field messages', async (t) => {
  const cases = [
    [{ loc: ['body', 'email'], type: 'missing' }, 'Enter your email address.'],
    [{ loc: ['body', 'email'], type: 'value_error' }, 'Enter a valid email address.'],
    [{ loc: ['body', 'password'], type: 'missing' }, 'Enter your password.'],
    [{ loc: ['body', 'password'], type: 'too_short' }, 'Use at least 8 characters for your password.'],
    [{ loc: ['body', 'password'], type: 'string_too_long' }, 'Your password is too long. Use fewer characters.'],
    [{ loc: ['body', 'password'], type: 'value_error', msg: 'Value error, Use a password of at most 72 UTF-8 bytes.' }, 'Your password is too long. Use at most 72 UTF-8 bytes.'],
    [{ loc: ['body', 'password_confirmation'], type: 'missing' }, 'Enter the same password in the confirmation field.'],
    [{ loc: ['body', 'password_confirmation'], type: 'string_too_short' }, 'Enter the same password in both fields.'],
    [{ loc: ['body'], type: 'value_error', msg: 'Value error, Passwords do not match.' }, 'The passwords do not match. Enter the same password in both fields.'],
  ]
  for (const [issue, expected] of cases) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      detail: [{ msg: 'private-provider-value', input: 'private-password-value', ...issue }],
    }, { status: 422 }))
    await assert.rejects(authRequest('reset-password'), (error) => {
      assert.equal(error.status, 422)
      assert.equal(error.message, expected)
      assert.ok(!error.message.includes('private-'))
      return true
    })
  }
})

test('unknown or malformed422 payloads never display raw validator data or a server-outage message', async (t) => {
  for (const detail of [null, {}, [null, { loc: ['body', 'other'], type: 'value_error', msg: 'private-password-value' }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ detail }, { status: 422 }))
    await assert.rejects(authRequest('reset-password'), (error) => {
      assert.equal(error.message, 'Check the details you entered and try again.')
      assert.equal(error.status, 422)
      return true
    })
  }
})

test('safe backend string details remain precise and outage fallback is reserved for server failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Your password needs a symbol.' }, { status: 422 }))
  await assert.rejects(authRequest('reset-password'), { message: 'Your password needs a symbol.', status: 422 })
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }))
  await assert.rejects(authRequest('reset-password'), { message: 'Sign-in is temporarily unavailable. Please try again.', status: 503 })
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }))
  await assert.rejects(authRequest('recovery'), { message: 'The request could not be completed. Please try again.', status: 401 })
})

test('recovery validation counts Unicode characters and the provider byte limit', () => {
  assert.match(passwordResetError('😀😀😀😀', '😀😀😀😀'), /at least 8/)
  const unicodeBoundary = `Aa1!${'😀'.repeat(17)}`
  assert.equal(passwordResetError(unicodeBoundary, unicodeBoundary), null)
  assert.match(passwordResetError('😀'.repeat(19), '😀'.repeat(19)), /too long/)
  const asciiBoundary = `Aa1!${'a'.repeat(68)}`
  assert.equal(passwordResetError(asciiBoundary, asciiBoundary), null)
  assert.match(passwordResetError('a'.repeat(73), 'a'.repeat(73)), /too long/)
})

test('recovery validation names each missing password requirement before submission', () => {
  for (const [password, requirement] of [
    ['PASSWORD9!', 'a lowercase letter'],
    ['password9!', 'an uppercase letter'],
    ['Password!!', 'a number'],
    ['Password99', 'a symbol'],
  ]) {
    assert.equal(passwordResetError(password, password), `Your password needs ${requirement}.`)
  }
  const numericPassword = '12345678'
  const error = passwordResetError(numericPassword, numericPassword)
  assert.match(error, /lowercase/)
  assert.match(error, /uppercase/)
  assert.match(error, /symbol/)
  assert.ok(!error.includes(numericPassword))
})

test('recovery validation accepts the provider punctuation set and rejects emoji-only symbols', () => {
  const symbols = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"
  for (const symbol of symbols) {
    const password = `Password9${symbol}`
    assert.equal(passwordResetError(password, password), null)
  }
  for (const suffix of ['😀', ' ']) {
    const password = `Password9${suffix}`
    assert.match(passwordResetError(password, password), /symbol/)
  }
})

test('recovery validation requires matching values and preserves meaningful whitespace', () => {
  assert.match(passwordResetError('New password!9', 'Different password!9'), /do not match/)
  assert.equal(passwordResetError(' Space matters!9 ', ' Space matters!9 '), null)
  assert.match(passwordResetError(' Space matters!9 ', 'Space matters!9'), /do not match/)
})
