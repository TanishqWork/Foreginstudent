const rememberedIds = new Map<string, string>()
const keyFor = (userId: string) => `statement-studio:complete-report:last-assessment:v1:${encodeURIComponent(userId)}`

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}

/** Remember only the assessment ID, scoped to the authenticated account and browser tab. */
export function rememberAssessmentId(userId: string, assessmentId: string): void {
  if (!validId(userId) || !validId(assessmentId)) return
  rememberedIds.set(userId, assessmentId)
  try { sessionStorage.setItem(keyFor(userId), assessmentId) } catch { /* Memory fallback when browser storage is unavailable. */ }
}

export function readAssessmentId(userId: string): string | null {
  if (!validId(userId)) return null
  try {
    const storedId = sessionStorage.getItem(keyFor(userId))
    if (validId(storedId)) {
      rememberedIds.set(userId, storedId)
      return storedId
    }
  } catch { /* Use the current tab's memory fallback. */ }
  return rememberedIds.get(userId) ?? null
}

/** An expired older link must not erase the account's newer assessment. */
export function clearAssessmentId(userId: string, expectedId?: string): void {
  if (!validId(userId) || (expectedId !== undefined && readAssessmentId(userId) !== expectedId)) return
  rememberedIds.delete(userId)
  try { sessionStorage.removeItem(keyFor(userId)) } catch { /* Nothing else is persisted. */ }
}
