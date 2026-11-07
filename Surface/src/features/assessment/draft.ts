import type { PathwayId } from './data'

export const assessmentDraftKey = 'statement-studio:pending-assessment:v1'
export interface AssessmentDraft {
  context: { pathway: PathwayId; degree: string; statementType: string; field: string; applicantType: string; institution: string; program: string; wordLimit: string; reviewGoal: string }
  prompt: string
  statement: string
}

export function readAssessmentDraft(): AssessmentDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(assessmentDraftKey) ?? 'null') as AssessmentDraft | null
    if (draft && typeof draft.statement === 'string' && typeof draft.prompt === 'string' && draft.context && ['health', 'business', 'stem', 'policy'].includes(draft.context.pathway)) return draft
  } catch { /* Storage is optional; keep the editable form available. */ }
  return null
}

export function saveAssessmentDraft(draft: AssessmentDraft) {
  sessionStorage.setItem(assessmentDraftKey, JSON.stringify(draft))
}
