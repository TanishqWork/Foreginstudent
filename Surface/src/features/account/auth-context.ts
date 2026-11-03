import { createContext, useContext } from 'react'
import type { AccountSession } from './auth'

interface AuthContextValue {
  session: AccountSession | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
