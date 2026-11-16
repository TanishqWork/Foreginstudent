export interface StudentProfile {
  name: string
  discipline: string
  level: string
  goals: string[]
  onboarded: boolean
}

export interface Essay {
  id: string
  title: string
  subject: string
  type: string
  status: 'draft' | 'reviewed' | 'complete'
  targetWords: number
  prompt: string
  content: string
  updatedAt: string
  createdAt: string
  feedbackScore?: number
}

export const countWords = (text: string) => text.trim() ? (text.trim().match(/\S+/gu)?.length ?? 0) : 0

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}
