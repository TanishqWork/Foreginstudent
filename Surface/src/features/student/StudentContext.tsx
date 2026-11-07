import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { initialEssays } from './data'
import type { Essay, StudentProfile } from './data'

interface StudentState {
  profile: StudentProfile
  essays: Essay[]
  activeEssayId: string
  completedLessons: string[]
}

interface StudentContextValue extends StudentState {
  basePath: string
  updateProfile: (patch: Partial<StudentProfile>) => void
  createEssay: (input: Pick<Essay, 'title' | 'subject' | 'type' | 'targetWords' | 'prompt'>) => string
  updateEssay: (id: string, patch: Partial<Essay>) => void
  setActiveEssayId: (id: string) => void
  completeLesson: (id: string) => void
  showToast: (message: string) => void
  storageAvailable: boolean
}

const StudentContext = createContext<StudentContextValue | null>(null)

function readState(key: string, name: string): StudentState {
  const fallback: StudentState = {
    profile: { name, discipline: 'Environmental studies', level: 'Undergraduate', goals: ['Build stronger arguments', 'Write with confidence'], onboarded: false },
    essays: initialEssays,
    activeEssayId: initialEssays[0].id,
    completedLessons: [],
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as StudentState | null
    if (saved?.profile && typeof saved.profile.name === 'string' && Array.isArray(saved.profile.goals) && Array.isArray(saved.essays) && saved.essays.every((essay) => typeof essay.id === 'string' && typeof essay.content === 'string') && Array.isArray(saved.completedLessons)) return saved
  } catch { /* Browser storage is optional. */ }
  return fallback
}

// Context and its hook intentionally live together for this small feature.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudent() {
  const context = useContext(StudentContext)
  if (!context) throw new Error('Student pages must be inside StudentProvider')
  return context
}

export function StudentProvider({ children, basePath, identity = 'sample', name = 'Maya' }: { children: ReactNode; basePath: string; identity?: string; name?: string }) {
  const storageKey = `statement-studio:student:v1:${identity}`
  const [state, setState] = useState(() => readState(storageKey, name))
  const [toast, setToast] = useState('')
  const [storageAvailable, setStorageAvailable] = useState(true)

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)) }
    // The storage synchronization can fail; expose that external-system failure to the UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setStorageAvailable(false) }
  }, [state, storageKey])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = useCallback((message: string) => setToast(message), [])
  const updateProfile = useCallback((patch: Partial<StudentProfile>) => setState((current) => ({ ...current, profile: { ...current.profile, ...patch } })), [])
  const setActiveEssayId = useCallback((id: string) => setState((current) => ({ ...current, activeEssayId: id })), [])
  const updateEssay = useCallback((id: string, patch: Partial<Essay>) => setState((current) => ({ ...current, essays: current.essays.map((essay) => essay.id === id ? { ...essay, ...patch, id: essay.id, updatedAt: new Date().toISOString() } : essay) })), [])
  const createEssay = useCallback((input: Pick<Essay, 'title' | 'subject' | 'type' | 'targetWords' | 'prompt'>) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    setState((current) => ({ ...current, activeEssayId: id, essays: [{ ...input, id, status: 'draft', content: '', createdAt: now, updatedAt: now }, ...current.essays] }))
    return id
  }, [])
  const completeLesson = useCallback((id: string) => setState((current) => ({ ...current, completedLessons: current.completedLessons.includes(id) ? current.completedLessons : [...current.completedLessons, id] })), [])

  return <StudentContext value={{ ...state, basePath, updateProfile, createEssay, updateEssay, setActiveEssayId, completeLesson, showToast, storageAvailable }}>
    {children}
    {toast && <div className="st-toast" role="status"><span aria-hidden="true">✓</span>{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
  </StudentContext>
}
