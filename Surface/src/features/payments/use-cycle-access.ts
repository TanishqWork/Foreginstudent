import { useCallback, useEffect, useState } from 'react'
import { getCycleAccess } from './api'
import type { CycleAccess } from './api'

const NOTICE_MS = 7 * 24 * 60 * 60 * 1_000
const MAX_DELAY_MS = 2_147_000_000

export function useCycleAccess(confirming: boolean, enabled = true) {
  const [access, setAccess] = useState<CycleAccess | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((current) => current + 1), [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const started = Date.now()
    let timer: number | undefined

    function schedule(delay: number) {
      timer = window.setTimeout(() => { void load() }, delay)
    }

    async function load() {
      try {
        const current = await getCycleAccess(controller.signal)
        if (controller.signal.aborted) return
        setAccess(current)
        setError(false)
        if (current.status === 'active' && current.expires_at) {
          const nextChange = Date.parse(current.expires_at) - (current.expires_soon ? 0 : NOTICE_MS)
          const delay = nextChange - Date.now() + 100
          schedule(Math.min(MAX_DELAY_MS, delay < -1_000 ? 60_000 : Math.max(1_000, delay)))
        } else if (confirming && Date.now() - started < 30_000) {
          schedule(2_500)
        }
      } catch {
        if (controller.signal.aborted) return
        setError(true)
        if (confirming && Date.now() - started < 30_000) schedule(2_500)
      }
    }

    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', refreshVisible)
    void load()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [confirming, enabled, refresh, revision])

  return { access, error, refresh }
}
