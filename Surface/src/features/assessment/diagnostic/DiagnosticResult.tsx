import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { pricingPlans } from '../../pricing/data'
import { statementTypes } from '../data'
import { DIAGNOSTIC_SCHEMA_VERSION } from './types'
import type { CategoryFinding, DiagnosticResponse, SentenceFinding } from './types'
import styles from './DiagnosticResult.module.css'

type DiagnosticProps = { response: DiagnosticResponse; onStartAnother: () => void; generationSeconds?: number | null }

const pathwayLabels = { health: 'Health and public health', business: 'Business and management', stem: 'STEM and research', policy: 'Policy and social impact' }

function TextList({ items, fallback }: { items: string[]; fallback: string }) {
  return items.length ? <ul className={styles.textList}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{fallback}</p>
}

function CategoryBar({ category, emphasis }: { category: CategoryFinding; emphasis: 'strength' | 'priority' }) {
  return (
    <article className={`${styles.category} ${emphasis === 'strength' ? styles.strengthBar : styles.priorityBar}`}>
      <div className={styles.categoryHead}><div><span className={styles.label}>{emphasis === 'strength' ? 'Relative strength' : 'Revision priority'}</span><h3>{category.label}</h3></div><strong>{category.score}<small>/100</small></strong></div>
      <div className={styles.track} aria-hidden="true"><span style={{ width: `${category.score}%` }} /></div>
      <p>{category.reason}</p>
    </article>
  )
}

function FindingCard({ number, label, tone, children }: { number: string; label: string; tone: 'strength' | 'risk' | 'missing'; children: ReactNode }) {
  return <article className={`${styles.findingCard} ${styles[tone]}`}><span className={styles.findingNumber} aria-hidden="true">{number}</span><h3 className={styles.label}>{label}</h3>{children}</article>
}

function SentenceContent({ finding, fallback }: { finding: SentenceFinding; fallback: string }) {
  return <>{finding.quote !== null ? <><blockquote>“{finding.quote}”</blockquote><span className={styles.source}>Paragraph {finding.paragraph}</span></> : <strong>{fallback}</strong>}<p>{finding.explanation}</p></>
}

function UnansweredContent({ report }: { report: DiagnosticResponse['report'] }) {
  if (report.prompt_requirements_status === 'unknown') return <><strong>Exact application prompt needed</strong><p>Prompt coverage could not be checked. Add the exact prompt to identify any unanswered requirements.</p></>
  if (report.missing_prompt_requirements.length) return <ul className={styles.promptGaps}>{report.missing_prompt_requirements.map((item) => <li key={item.requirement_id}><span className={styles.source}>{item.status === 'missing' ? 'Missing' : 'Partly answered'}</span><strong>{item.requirement}</strong><p>{item.next_action}</p></li>)}</ul>
  if (report.status === 'needs_input') return <><strong>More assessment input needed</strong><TextList items={report.input_issues} fallback="Add the requested context before treating the assessment as complete." /></>
  if (report.prompt_requirements_status === 'ambiguous' || report.uncertain_prompt_requirements.length) return <><strong>Prompt clarification needed</strong><TextList items={report.uncertain_prompt_requirements} fallback="Some requirements remain ambiguous. Clarify the task before treating coverage as complete." /></>
  return <><strong>No missing required content identified</strong><p>{report.main_concern.title ? `Current revision priority: ${report.main_concern.title}` : 'Use the findings below to refine the existing argument.'}</p></>
}

function ScoreCard({ report }: { report: DiagnosticResponse['report'] }) {
  const score = report.overall_score
  return (
    <div className={styles.scoreCard}>
      <div className={styles.scoreRing} role="img" aria-label={score === null ? 'Overall score unavailable: more input is needed' : `Overall statement score: ${score} out of 100`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle className={styles.ringTrack} cx="60" cy="60" r="52" /><circle className={styles.ringValue} cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${score ?? 0} 100`} /></svg>
        <div aria-hidden="true"><strong>{score ?? '—'}</strong><span>{score === null ? 'Not scored' : '/100'}</span></div>
      </div>
      <div><span className={styles.label}>Overall statement score</span><strong className={styles.band}>{report.assessment_band ?? 'More input needed'}</strong><small className={styles.standard}>Rubric {report.rubric_version}<br />{report.recommendation.path ? `${report.recommendation.path} path${report.recommendation.provisional ? ' · provisional' : ''}` : 'Revision path not yet available'}</small></div>
    </div>
  )
}

function FreeDiagnosticV1({ response, onStartAnother, generationSeconds }: DiagnosticProps) {
  const { report, context, diagnostic } = response
  const headingRef = useRef<HTMLHeadingElement>(null)
  const completePlan = pricingPlans.find((plan) => plan.id === 'complete')
  const statementLabel = statementTypes.find((item) => item.value === context.statement_type)?.label ?? context.statement_type.replaceAll('_', ' ')
  const contextText = [context.degree, statementLabel, context.field, context.target_program, context.target_institution].filter(Boolean).join(' · ')
  const statusLabel = report.status === 'complete' ? 'Assessment complete' : report.status === 'provisional' ? 'Provisional assessment' : 'More input needed'
  const limitations = [...new Set([...report.input_issues, ...report.missing_context])]
  const verificationItems = [...new Set(report.verification_limits)]

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [report.assessment_id])

  return (
    <section className={styles.page} aria-labelledby="diagnostic-heading" data-report-version={DIAGNOSTIC_SCHEMA_VERSION}>
      <title>Diagnostic findings | Statement Studio</title>
      <div className={styles.header}>
        <div><button className={styles.backButton} type="button" onClick={onStartAnother}>← Start another assessment</button><p className={styles.overline}>Free assessment</p><h1 id="diagnostic-heading" ref={headingRef} tabIndex={-1}>Diagnostic findings</h1><p className={styles.context}>{contextText || pathwayLabels[context.pathway]}</p>{generationSeconds !== null && generationSeconds !== undefined && <p className={styles.note} data-generation-seconds={generationSeconds}>Free assessment completed in {generationSeconds.toFixed(1)} seconds.</p>}</div>
        <ScoreCard report={report} />
      </div>

      <aside className={`${styles.status} ${report.status === 'complete' ? '' : styles.statusAttention}`} aria-label="Assessment status">
        <div><strong>{statusLabel}</strong><span>{report.confidence.level} assessment confidence</span></div>
        <p>{report.confidence.reason}</p>
        {report.status === 'provisional' && <p>{report.scored_weight}/100 rubric weight assessed{report.renormalized ? '; the available category weights were normalized for this score.' : '.'} This result may change when missing context is supplied.</p>}
        {limitations.length > 0 && <TextList items={limitations} fallback="" />}
      </aside>

      <div className={styles.snapshot} aria-label="Draft snapshot"><span><strong>{report.measurements.word_count}</strong> words</span><span><strong>{report.measurements.paragraph_count}</strong> paragraphs</span><span>{pathwayLabels[context.pathway]}</span>{report.limit_compliance.max_words !== null && <span><strong>{report.limit_compliance.max_words}</strong> word limit</span>}</div>
      {report.limit_compliance.status === 'over_limit' && <p className={styles.lengthWarning} role="note">{report.limit_compliance.reason || 'The statement exceeds the supplied length limit. The score includes the rubric’s length adjustment.'}</p>}

      <section className={styles.scorePreview} aria-labelledby="diagnostic-categories">
        <div className={styles.sectionHead}><div><span className={styles.label}>Score preview</span><h2 id="diagnostic-categories">Where the draft is strongest and weakest</h2></div><p>Scores reflect the submitted draft, prompt, degree, and pathway.</p></div>
        <div className={styles.categoryGrid}>{report.strongest_categories.map((category) => <CategoryBar key={category.dimension_id} category={category} emphasis="strength" />)}{report.weakest_categories.map((category) => <CategoryBar key={category.dimension_id} category={category} emphasis="priority" />)}</div>
        {!report.strongest_categories.length && !report.weakest_categories.length && <p className={styles.empty}>Category scores are unavailable until the assessment has enough information.</p>}
        {report.ranking_note && <p className={styles.note}>{report.ranking_note}</p>}
      </section>

      <section className={styles.findings} aria-labelledby="diagnostic-first-read">
        <div className={styles.sectionHead}><div><span className={styles.label}>What the first read reveals</span><h2 id="diagnostic-first-read">Three findings to guide your next revision.</h2></div><div className={styles.opportunity}><span className={styles.label}>Revision opportunity</span><strong>{diagnostic.revision_opportunity ?? 'Not yet assessed'}</strong><span>{report.recommendation.path ? `${report.recommendation.path} path recommended` : 'Add the requested context first'}</span></div></div>
        <div className={styles.findingGrid}>
          <FindingCard number="01" label="What lands" tone="strength"><SentenceContent finding={report.strongest_sentence} fallback="No strongest sentence selected yet" /></FindingCard>
          <FindingCard number="02" label="What weakens confidence" tone="risk"><SentenceContent finding={report.riskiest_sentence} fallback="No sentence-specific concern identified" /></FindingCard>
          <FindingCard number="03" label="What is still unanswered" tone="missing"><UnansweredContent report={report} /></FindingCard>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <article className={styles.detailCard}><h2 className={`${styles.label} ${styles.positiveText}`}>Strongest elements</h2><TextList items={report.strongest_categories.map((item) => `${item.label} · ${item.score}/100. ${item.reason}`)} fallback="The draft needs more interpretable material before strengths can be ranked." /></article>
        <article className={styles.detailCard}><h2 className={`${styles.label} ${styles.dangerText}`}>Priority concerns</h2><h3>{report.main_concern.title || 'Complete the requested input'}</h3><p>{report.main_concern.explanation}</p>{report.main_concern.first_action && <p className={styles.firstAction}>{report.main_concern.first_action}</p>}<TextList items={report.weakest_categories.map((item) => `${item.label} · ${item.score}/100. ${item.reason}`)} fallback="Category priorities are not yet available." /></article>
        <article className={styles.detailCard}><h2 className={styles.label}>Pathway observation</h2><p>{diagnostic.pathway_observation}</p></article>
        <article className={styles.detailCard}><h2 className={styles.label}>Evidence gap</h2><p><strong>{diagnostic.evidence_examples.length}</strong> action- or outcome-linked evidence {diagnostic.evidence_examples.length === 1 ? 'example identified' : 'examples identified'}.</p><p>{diagnostic.evidence_gap.summary}</p>{diagnostic.evidence_gap.quote !== null && <blockquote>“{diagnostic.evidence_gap.quote}”</blockquote>}{diagnostic.evidence_examples.length > 0 && <details className={styles.evidenceDetails}><summary>View identified evidence</summary><TextList items={diagnostic.evidence_examples.map((item) => item.summary)} fallback="" /></details>}</article>
      </div>

      <section className={styles.nextSteps} aria-labelledby="diagnostic-next-steps"><div><span className={styles.label}>Recommended next step</span><h2 id="diagnostic-next-steps">{report.recommendation.path ? `${report.recommendation.path} the statement` : 'Add context before choosing a revision path'}</h2><p>{report.recommendation.reason}</p><p className={styles.firstAction}>{report.recommendation.next_action}</p></div>{report.priority_actions.length > 0 && <ol>{report.priority_actions.map((action, index) => <li key={index}>{action}</li>)}</ol>}</section>

      {(report.integrity_flags.length > 0 || verificationItems.length > 0 || report.uncertain_prompt_requirements.length > 0) && <details className={styles.limitations}><summary>Evidence checks and assessment limitations</summary>{report.integrity_flags.map((flag, index) => <div key={index}><h3>{flag.concern}</h3><p>{flag.action}</p></div>)}{verificationItems.length > 0 && <TextList items={verificationItems} fallback="" />}{report.uncertain_prompt_requirements.length > 0 && <TextList items={report.uncertain_prompt_requirements} fallback="" />}</details>}

      {report.overall_score !== null && <section className={styles.lockedPreview} aria-labelledby="diagnostic-complete-preview"><div className={styles.previewVisual} aria-hidden="true"><strong>{report.overall_score}<small>/100</small></strong><div className={styles.previewLines}>{[...report.strongest_categories, ...report.weakest_categories].map((item) => <span key={item.dimension_id}><i style={{ width: `${item.score}%` }} /></span>)}</div><span className={styles.lockIcon}>◇</span></div><div className={styles.lockedCopy}><span className={styles.label}>Complete assessment</span><h2 id="diagnostic-complete-preview">See what each sentence contributes, and what to change first.</h2><ul><li>Sentence and paragraph diagnosis</li><li>Prompt and evidence maps</li><li>Ranked revision sequence</li></ul></div><div className={styles.lockedActions}><Link className={styles.primaryLink} to={`/dashboard/complete-report?assessment=${encodeURIComponent(report.assessment_id)}`}>Unlock complete report{completePlan ? ` · ${completePlan.price}` : ''}</Link><Link className={styles.secondaryLink} to="/sample-report">View sample report</Link><Link className={styles.reviewLink} to="/pricing">Explore human review</Link></div></section>}

      <footer className={styles.reportFooter}><p>{report.score_meaning}</p><span>Assessment {report.assessment_id}</span></footer>
    </section>
  )
}

/** A contract version selects exactly one report renderer. */
export default function DiagnosticResult(props: DiagnosticProps) {
  switch (props.response.schema_version) {
    case DIAGNOSTIC_SCHEMA_VERSION:
      return <FreeDiagnosticV1 {...props} />
    default:
      return <section className={styles.status} role="alert"><h1 id="diagnostic-heading">Report format unavailable</h1><p>Refresh the page to load the supported report format.</p><button className={styles.backButton} type="button" onClick={props.onStartAnother}>Return to your draft</button></section>
  }
}
