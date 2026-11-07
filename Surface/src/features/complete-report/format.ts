import type { DiagnosticResponse } from '../assessment/diagnostic/types.ts'
import type { CompleteReportContent } from './types.ts'

const titles: [keyof CompleteReportContent, string][] = [
  ['executive_summary', 'Executive assessment'], ['criterion_details', 'Statement assessment profile'], ['prompt_coverage', 'Prompt coverage'],
  ['sentence_reviews', 'Sentence lab'], ['paragraph_reviews', 'Paragraph assessment'], ['evidence_gaps', 'Evidence map'], ['program_fit', 'Program fit'],
  ['voice_and_originality', 'Voice, grounding and originality'], ['unsupported_claims', 'Unsupported claims'], ['cut_or_expand', 'Cut and expand'], ['revision_plan', 'Revision plan'],
  ['input_issues', 'Input issues'], ['discrepancies', 'Baseline findings requiring review'], ['limitations', 'Limitations'], ['coverage', 'Review completeness'],
]

/** A readable export of every field; no second model call or HTML conversion. */
export function formatCompleteReport(report: CompleteReportContent, assessment: DiagnosticResponse): string {
  const baseline = assessment.report
  const lines = ['Statement Studio complete report', [assessment.context.degree, assessment.context.field, assessment.context.target_program, assessment.context.target_institution].filter(Boolean).join(' · '), `Original assessment: ${baseline.overall_score ?? 'Not scored'}${baseline.overall_score === null ? '' : '/100'} · ${baseline.assessment_band ?? 'More input needed'} · ${baseline.status}`, `Recommendation: ${baseline.recommendation.path ?? 'Not available'}`, `Detailed report status: ${report.report_status.replaceAll('_', ' ')}`, '']
  function append(name: string, value: unknown, depth = 0) {
    const indent = '  '.repeat(depth)
    if (value === null) { lines.push(`${indent}${name}: Not available`); return }
    if (Array.isArray(value)) {
      lines.push(`${indent}${name}:`)
      if (!value.length) lines.push(`${indent}  None recorded.`)
      value.forEach((item, index) => typeof item === 'object' && item !== null ? append(String(index + 1), item, depth + 1) : lines.push(`${indent}  - ${String(item)}`))
      return
    }
    if (typeof value === 'object') {
      lines.push(`${indent}${name}:`)
      Object.entries(value).forEach(([key, item]) => append(key.replaceAll('_', ' '), item, depth + 1))
      return
    }
    lines.push(`${indent}${name}: ${String(value)}`)
  }
  for (const [key, title] of titles) { append(title, report[key]); lines.push('') }
  lines.push(baseline.score_meaning, `Assessment ${baseline.assessment_id}`)
  return lines.join('\n')
}
