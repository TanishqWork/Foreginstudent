import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthError, authErrorMessage, authRequest, isConfirmationRequired } from './auth'
import type { AccountSession, LoginOutcome, LoginResponse } from './auth'
import { AuthContext } from './auth-context'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sessionVersion = useRef(0)

  const loadSession = useCallback((signal?: AbortSignal) => {
    const version = sessionVersion.current
    return authRequest<AccountSession>('me', { signal }).then((current) => {
      if (!signal?.aborted && version === sessionVersion.current) {
        setSession(current)
        setError('')
      }
    }).catch((cause: unknown) => {
      if (signal?.aborted || version !== sessionVersion.current) return
      if (cause instanceof AuthError && cause.status === 401) setSession(null)
      else setError(authErrorMessage(cause))
    }).finally(() => {
      if (!signal?.aborted && version === sessionVersion.current) setLoading(false)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadSession(controller.signal)
    return () => controller.abort()
  }, [loadSession])

  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(() => setSession(null), Math.max(0, Date.parse(session.expires_at) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [session])

  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    return loadSession()
  }, [loadSession])

  const login = useCallback(async (email: string, password: string): Promise<LoginOutcome> => {
    const current = await authRequest<LoginResponse>('login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    sessionVersion.current += 1
    setLoading(false)
    setError('')
    if (isConfirmationRequired(current)) {
      setSession(null)
      return 'confirmation_required'
    }
    setSession(current)
    return 'signed_in'
  }, [])

  const logout = useCallback(async () => {
    await authRequest<void>('logout', { method: 'POST', body: '{}' })
    sessionVersion.current += 1
    setSession(null)
    setError('')
    setLoading(false)
  }, [])

  const clearSession = useCallback(() => {
    sessionVersion.current += 1
    setSession(null)
    setError('')
    setLoading(false)
  }, [])

  return <AuthContext value={{ session, loading, error, refresh, login, logout, clearSession }}>{children}</AuthContext>
}
