export interface AccountSession {
  user: {
    id: string
    email: string
    created_at: string
  }
  expires_at: string
}

export interface ConfirmationRequired {
  status: 'confirmation_required'
  email: string
}

export type LoginResponse = AccountSession | ConfirmationRequired
export type LoginOutcome = 'signed_in' | 'confirmation_required'

export function isConfirmationRequired(response: LoginResponse): response is ConfirmationRequired {
  return 'status' in response && response.status === 'confirmation_required'
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

function validationErrorMessage(detail: unknown): string {
  const fallback = 'Check the details you entered and try again.'
  if (!Array.isArray(detail)) return fallback
  for (const item of detail) {
    if (!item || typeof item !== 'object') continue
    const issue = item as { loc?: unknown; type?: unknown; msg?: unknown }
    if (!Array.isArray(issue.loc) || issue.loc[0] !== 'body') continue
    const field = issue.loc[issue.loc.length - 1]
    if (field === 'email' && (issue.type === 'missing' || issue.type === 'value_error' || issue.type === 'string_type')) {
      return issue.type === 'missing' ? 'Enter your email address.' : 'Enter a valid email address.'
    }
    if (field === 'password' || field === 'password_confirmation') {
      if (issue.type === 'missing') return field === 'password'
        ? 'Enter your password.' : 'Enter the same password in the confirmation field.'
      if (issue.type === 'too_short' || issue.type === 'string_too_short') return field === 'password'
        ? 'Use at least 8 characters for your password.' : 'Enter the same password in both fields.'
      if (issue.type === 'too_long' || issue.type === 'string_too_long') return 'Your password is too long. Use fewer characters.'
      if (issue.type === 'value_error' && (
        issue.msg === 'Value error, Use a password of at most 72 UTF-8 bytes.'
        || issue.msg === 'Use a password of at most 72 UTF-8 bytes.'
      )) return 'Your password is too long. Use at most 72 UTF-8 bytes.'
    }
    if (field === 'body' && issue.type === 'value_error' && (
      issue.msg === 'Value error, Passwords do not match.' || issue.msg === 'Passwords do not match.'
    )) return 'The passwords do not match. Enter the same password in both fields.'
  }
  return fallback
}

export async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/auth/${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)])
        : AbortSignal.timeout(20_000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new AuthError('We could not reach sign-in. Please try again.', 0)
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
    const fallback = response.status === 422 ? validationErrorMessage(detail)
      : response.status >= 500 ? 'Sign-in is temporarily unavailable. Please try again.'
        : 'The request could not be completed. Please try again.'
    throw new AuthError(
      typeof detail === 'string' ? detail : fallback,
      response.status,
    )
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function authErrorMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : 'Something went wrong. Please try again.'
}

export function googleSignInErrorMessage(code: string | null): string {
  if (code === null) return ''
  switch (code) {
    case 'cancelled': return 'Google sign-in was cancelled. Try again or sign in with your email and password.'
    case 'invalid': return 'Your Google sign-in attempt expired or is missing its login state. Select Continue with Google to start again in this browser.'
    case 'unavailable': return 'Google sign-in is temporarily unavailable. Please try again, or use your email and password.'
    case 'conflict': return 'We could not connect this Google account to your existing account. Sign in with your existing email and password.'
    case 'rate_limited': return 'Too many sign-in attempts. Wait a few minutes, then try again.'
    default: return 'Google sign-in could not be completed. Please try again.'
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await authRequest<{ message: string }>('forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
}

export async function checkPasswordRecovery(signal?: AbortSignal): Promise<boolean> {
  const response = await authRequest<{ valid: boolean }>('recovery', { signal })
  return response.valid === true
}

export async function resetPassword(password: string, passwordConfirmation: string): Promise<void> {
  await authRequest<{ message: string }>('reset-password', {
    method: 'POST',
    body: JSON.stringify({ password, password_confirmation: passwordConfirmation }),
  })
}
