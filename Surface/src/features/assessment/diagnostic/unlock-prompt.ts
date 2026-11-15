import type { DiagnosticResponse } from './types.ts'

/** Earliest the prompt may appear, even if the student scrolls straight to the unlock section. */
export const UNLOCK_PROMPT_MIN_SECONDS = 15
/** Fallback: visible reading time after which the prompt appears without reaching the unlock section. */
export const UNLOCK_PROMPT_VISIBLE_SECONDS = 30

type Report = DiagnosticResponse['report']

/** The prompt sells a complete report, so it follows the same rule as the existing locked preview. */
export function canOfferUnlock(report: Report): boolean {
  return report.overall_score !== null && report.status !== 'needs_input'
}

/** Whichever comes first: the student reaches the unlock section (after a short floor) or reads for 30 visible seconds. */
export function isUnlockPromptDue(visibleSeconds: number, reachedUnlockSection: boolean): boolean {
  return visibleSeconds >= UNLOCK_PROMPT_VISIBLE_SECONDS || (reachedUnlockSection && visibleSeconds >= UNLOCK_PROMPT_MIN_SECONDS)
}

export function truncateQuote(text: string, max = 110): string {
  const clean = text.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export type UnlockHighlights = {
  score: number
  weakestLabel: string | null
  riskyQuote: string | null
  concernTitle: string
}

/** Everything the prompt says comes from the student's own free result. */
export function unlockHighlights(response: DiagnosticResponse): UnlockHighlights | null {
  const { report } = response
  if (report.overall_score === null) return null
  const weakest = [...report.weakest_categories].sort((a, b) => a.score - b.score)[0] ?? null
  return {
    score: report.overall_score,
    weakestLabel: weakest?.label ?? null,
    riskyQuote: report.riskiest_sentence.quote === null ? null : truncateQuote(report.riskiest_sentence.quote),
    concernTitle: report.main_concern.title,
  }
}

const dismissedKey = (assessmentId: string) => `statement-studio:unlock-prompt:dismissed:v1:${encodeURIComponent(assessmentId)}`
const dismissedMemory = new Set<string>()

/** Once dismissed, the prompt never reopens for that assessment in this tab. */
export function wasUnlockPromptShown(assessmentId: string): boolean {
  if (dismissedMemory.has(assessmentId)) return true
  try { return sessionStorage.getItem(dismissedKey(assessmentId)) === '1' } catch { return false }
}

export function rememberUnlockPromptShown(assessmentId: string): void {
  dismissedMemory.add(assessmentId)
  try { sessionStorage.setItem(dismissedKey(assessmentId), '1') } catch { /* The in-memory set still prevents a repeat. */ }
}
