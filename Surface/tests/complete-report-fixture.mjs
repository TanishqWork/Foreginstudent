import fixture from './fixtures/complete-report.v1.json' with { type: 'json' }

export const completeFixture = fixture

export function cachedCompleteState(status = 'ready', id = completeFixture.assessment_id) {
  const value = structuredClone(completeFixture)
  value.assessment_id = id
  value.assessment.report.assessment_id = id
  value.status = status
  value.report = status === 'ready' ? value.report : null
  value.generation_seconds = status === 'ready' ? 1.25 : null
  value.free_generation_seconds = 2.5
  value.error = status === 'failed' ? 'The report could not finish.' : null
  return value
}

// Synthetic repeated findings exercise real components without provider requests.
// Source-bound sentence/paragraph/criterion rows remain unchanged.
export function reportWithEvidenceCount(report, count) {
  const value = structuredClone(report)
  const firstSentence = value.sentence_reviews[0]
  const firstParagraph = value.paragraph_reviews[0]
  const dimensionId = value.criterion_details[0].dimension_id
  const previousIds = new Set(value.evidence_gaps.map((item) => item.finding_id))
  value.evidence_gaps = Array.from({ length: count }, (_, index) => ({
    finding_id: `gap:preview-${index + 1}`,
    severity: 'material', criterion_ids: [dimensionId], evidence_status: 'partial', gap_type: 'outcome',
    sentence_ids: [firstSentence.sentence_id], paragraph_ids: [firstParagraph.paragraph_id],
    evidence: [{ sentence_id: firstSentence.sentence_id, paragraph: firstSentence.paragraph, quote: firstSentence.text, use: 'context' }],
    claim_or_function: `Preview evidence finding ${index + 1}`,
    existing_support: `Fictional support for finding ${index + 1}.`,
    missing_link: `Fictional missing link ${index + 1}.`,
    applicant_action: `Supply true supporting detail ${index + 1}.`, uncertainty: null,
  }))
  for (const item of [...value.cut_or_expand, ...value.revision_plan]) {
    item.related_finding_ids = item.related_finding_ids.filter((id) => !previousIds.has(id))
  }
  return value
}
