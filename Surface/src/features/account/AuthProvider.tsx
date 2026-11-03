import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthError, authErrorMessage, authRequest } from './auth'
import type { AccountSession } from './auth'
import { AuthContext } from './auth-context'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSession = useCallback((signal?: AbortSignal) => (
    authRequest<AccountSession>('me', { signal }).then((current) => {
      if (!signal?.aborted) {
        setSession(current)
        setError('')
      }
    }).catch((cause: unknown) => {
      if (signal?.aborted) return
      if (cause instanceof AuthError && cause.status === 401) setSession(null)
      else setError(authErrorMessage(cause))
    }).finally(() => {
      if (!signal?.aborted) setLoading(false)
    })
  ), [])

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

  const login = useCallback(async (email: string, password: string) => {
    const current = await authRequest<AccountSession>('login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setSession(current)
    setError('')
  }, [])

  const logout = useCallback(async () => {
    await authRequest<void>('logout', { method: 'POST', body: '{}' })
    setSession(null)
    setError('')
  }, [])

  return <AuthContext value={{ session, loading, error, refresh, login, logout }}>{children}</AuthContext>
}
