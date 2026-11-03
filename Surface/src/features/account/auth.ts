export interface AccountSession {
  user: {
    id: string
    email: string
    created_at: string
  }
  expires_at: string
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
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
    throw new AuthError(
      typeof detail === 'string' ? detail : 'Sign-in is temporarily unavailable. Please try again.',
      response.status,
    )
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function authErrorMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : 'Something went wrong. Please try again.'
}
