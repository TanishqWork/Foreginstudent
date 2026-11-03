import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import SiteHeader from '../landing-page/components/SiteHeader'
import SiteFooter from '../landing-page/components/SiteFooter'
import { ui } from '../landing-page/ui'
import { assessmentPathways, assessmentSamples, statementTypes } from './data'
import type { AssessmentSample, PathwayId } from './data'
import styles from './AssessmentPage.module.css'

const preflightSteps = [
  ['Copy from Word or Google Docs', 'This gives the most reliable paragraph structure.'],
  ['Remove the title and heading', 'Do not include “Statement of purpose” or a document title.'],
  ['Remove identity details', 'Do not include your name, email, phone number, address, or application ID.'],
  ['Keep paragraph breaks', 'Leave one blank line between paragraphs before copying.'],
] as const

const pasteGuide = [
  ['Open the final Word document', 'Select only the essay body.'],
  ['Copy the body text', 'Exclude the name, address, heading, and page numbers.'],
  ['Paste once', 'The paragraph map below the editor confirms the structure.'],
  ['Review the document check', 'Resolve any warning before running the assessment.'],
] as const

function AssessmentScreen({ initialPathway }: { initialPathway: PathwayId }) {
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const statementRef = useRef<HTMLTextAreaElement>(null)
  const initialProfile = assessmentPathways.find((item) => item.id === initialPathway)!
  const [context, setContext] = useState({
    pathway: initialPathway,
    degree: initialProfile.degrees[0],
    statementType: 'statement_of_purpose',
    field: '',
    applicantType: 'international',
    institution: '',
    program: '',
    wordLimit: '',
    reviewGoal: initialProfile.goals[0].value,
  })
  const [prompt, setPrompt] = useState('')
  const [statement, setStatement] = useState('')
  const profile = assessmentPathways.find((item) => item.id === context.pathway)!
  const statementType = statementTypes.find((item) => item.value === context.statementType)!
  const wordCount = statement.trim() ? statement.trim().split(/\s+/u).length : 0
  const essentialsComplete = 2 + Number(Boolean(context.field.trim())) + Number(wordCount >= 80)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  function updateContext(name: Exclude<keyof typeof context, 'pathway'>, value: string) {
    setContext((current) => ({ ...current, [name]: value }))
  }

  function selectPathway(pathway: PathwayId) {
    const nextProfile = assessmentPathways.find((item) => item.id === pathway)!
    setContext((current) => ({
      ...current,
      pathway,
      degree: nextProfile.degrees[0],
      reviewGoal: nextProfile.goals[0].value,
    }))
  }

  function loadSample(sample: AssessmentSample) {
    setContext((current) => ({
      ...current,
      pathway: sample.pathway,
      degree: sample.degree,
      statementType: sample.statementType,
      field: sample.field,
      institution: sample.institution,
      program: sample.program,
      wordLimit: String(sample.wordLimit),
      reviewGoal: sample.reviewGoal,
    }))
    setPrompt(sample.prompt)
    setStatement(sample.statement)
  }

  function runAssessment(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/account')
  }

  return (
    <div className={styles.page}>
      <title>Free assessment | Statement Studio</title>
      <meta name="description" content="Set your application context and paste your statement, then sign in to continue with Statement Studio." />
      <SiteHeader />
      <main className={styles.shell} id="main" aria-labelledby="assessment-heading">
        <div className={styles.hero}>
          <div className={styles.intro}>
            <Link className={styles.back} to="/">Return to product overview</Link>
            <p className={styles.overline}>Free assessment</p>
            <h1 ref={headingRef} id="assessment-heading" tabIndex={-1}>Set the context. Paste the statement as it was written.</h1>
            <p>Statement Studio evaluates the draft against its purpose, degree, program, and writing standard. A personal statement, research statement, and statement of purpose should not be assessed in the same way.</p>
          </div>
          <aside className={styles.summary} aria-label="Assessment readiness summary">
            <div className={styles.summaryHead}>
              <span>Assessment readiness</span>
              <strong id="intake-progress-label">{essentialsComplete} of 4 essentials complete</strong>
            </div>
            <div className={styles.progress} aria-hidden="true"><span style={{ width: `${essentialsComplete * 25}%` }} /></div>
            <dl>
              <div><dt>Pathway</dt><dd>{profile.title}</dd></div>
              <div><dt>Statement type</dt><dd>{statementType.label}</dd></div>
              <div><dt>Prompt</dt><dd>{prompt.trim() ? 'Added' : 'Optional · not added'}</dd></div>
              <div><dt>Draft structure</dt><dd>{statement.trim() ? 'Statement added' : 'Waiting for draft'}</dd></div>
            </dl>
          </aside>
        </div>

        <form className={styles.workspace} id="assessment-form" autoComplete="off" noValidate onSubmit={runAssessment}>
          <div className={styles.formColumn}>
            <fieldset className={styles.formSection}>
              <legend><span>01</span>Select the specialist pathway</legend>
              <p className={styles.sectionIntro}>This determines which degree and field standards are applied.</p>
              <div className={styles.pathways}>
                {assessmentPathways.map((pathway) => (
                  <label key={pathway.id}>
                    <input type="radio" name="pathway" value={pathway.id} checked={context.pathway === pathway.id} onChange={() => selectPathway(pathway.id)} />
                    <span><b>{pathway.index}</b><strong>{pathway.title}</strong><small>{pathway.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.formSection}>
              <legend><span>02</span>Define the application context</legend>
              <p className={styles.sectionIntro}>The selected statement type changes the scoring criteria and report language.</p>
              <div className={styles.fieldGrid}>
                <label className={styles.field}><span>Degree</span><select id="degree" value={context.degree} onChange={(event) => updateContext('degree', event.target.value)} required>{profile.degrees.map((degree) => <option key={degree}>{degree}</option>)}</select></label>
                <label className={styles.field}><span>Statement type</span><select id="statement-type" value={context.statementType} onChange={(event) => updateContext('statementType', event.target.value)} aria-describedby="statement-type-note" required>{statementTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><small id="statement-type-note">{statementType.focus}.</small></label>
                <label className={styles.field}><span>{profile.fieldLabel}</span><input id="field" type="text" placeholder={profile.fieldPlaceholder} value={context.field} onChange={(event) => updateContext('field', event.target.value)} required /></label>
                <label className={styles.field}><span>Applicant type</span><select id="applicant-type" value={context.applicantType} onChange={(event) => updateContext('applicantType', event.target.value)}><option value="international">International applicant</option><option value="domestic">Domestic applicant</option><option value="unsure">Prefer not to specify</option></select></label>
                <label className={styles.field}><span>Target institution <em className={styles.optional}>Optional</em></span><input id="institution" type="text" placeholder="Johns Hopkins University" value={context.institution} onChange={(event) => updateContext('institution', event.target.value)} /></label>
                <label className={styles.field}><span>Target program <em className={styles.optional}>Optional</em></span><input id="program" type="text" placeholder="MPH and MBA dual degree" value={context.program} onChange={(event) => updateContext('program', event.target.value)} /></label>
                <label className={styles.field}><span>Word limit <em className={styles.optional}>Optional</em></span><input id="word-limit" type="number" min="100" max="5000" placeholder="800" value={context.wordLimit} onChange={(event) => updateContext('wordLimit', event.target.value)} /></label>
                <label className={styles.field}><span>Review objective</span><select id="review-goal" value={context.reviewGoal} onChange={(event) => updateContext('reviewGoal', event.target.value)}>{profile.goals.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
              </div>
            </fieldset>

            <fieldset className={styles.formSection}>
              <legend><span>03</span>Add the program prompt</legend>
              <div className={styles.optionalHead}>
                <div><strong id="prompt-label">Exact application prompt</strong><span>Helpful, but optional</span></div>
                <p>Paste the wording exactly as the program provides it. This allows Statement Studio to assess whether the draft answers every part of the question.</p>
              </div>
              <label className={styles.field}>
                <span className="sr-only">Exact application prompt</span>
                <textarea id="prompt" rows={5} placeholder="Example: Describe your preparation, professional goals, and reasons for selecting this program." value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-describedby="prompt-status" />
                <small id="prompt-status">{prompt.trim() ? 'Program prompt added.' : 'No prompt added. The draft can still be assessed.'}</small>
              </label>
            </fieldset>

            <fieldset className={styles.formSection}>
              <legend><span>04</span>Paste the statement</legend>
              <div className={styles.preflight}>
                {preflightSteps.map(([title, copy], index) => <div key={title}><span>{String(index + 1).padStart(2, '0')}</span><strong>{title}</strong><small>{copy}</small></div>)}
              </div>
              <div className={styles.samples}>
                <span>Load a fictional sample:</span>
                {assessmentSamples.map((sample) => <button key={sample.id} type="button" onClick={() => loadSample(sample)}>{sample.label}</button>)}
              </div>
              <div className={styles.pasteWorkspace}>
                <div className={styles.pasteToolbar}>
                  <div><strong>Statement document</strong><small>Paragraph boundaries will be preserved during paste.</small></div>
                  <div>
                    <button type="button" onClick={() => setStatement((current) => current.replace(/\r\n?/gu, '\n').replace(/[\t ]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim())}>Tidy paragraph spacing</button>
                    <button type="button" onClick={() => { setStatement(''); statementRef.current?.focus() }}>Clear</button>
                  </div>
                </div>
                <label className={`${styles.field} ${styles.document}`}>
                  <span className="sr-only">Statement</span>
                  <textarea ref={statementRef} id="statement" rows={20} placeholder="Paste the statement here. Copying directly from Word or Google Docs is recommended." value={statement} onChange={(event) => setStatement(event.target.value)} aria-describedby="word-count" required />
                  <small className={styles.wordCount}><span id="word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span><span>{context.wordLimit ? `Word limit: ${context.wordLimit}` : ''}</span></small>
                </label>
              </div>
              <div className={styles.health}>
                <div className={styles.healthHead}><div><span>Document check</span><strong>{statement.trim() ? 'Statement added' : 'Waiting for the statement'}</strong></div><em>{statement.trim() ? 'Sign in to continue' : 'Not ready'}</em></div>
                <div className={styles.checks}>
                  {['Paragraph structure', 'Header and identity details', 'Draft length'].map((check) => <div key={check}><i aria-hidden="true" /><span>{check}</span><strong>{statement.trim() ? 'Pending sign-in' : 'Waiting'}</strong></div>)}
                </div>
              </div>
            </fieldset>

            <div className={styles.privacy}>
              <strong>Privacy and assessment standard</strong>
              <p>The free assessment runs in this browser and is not uploaded. If you choose a paid report, you will be asked before the draft is saved to your secure account. Remove passport, visa, financial, or other highly sensitive information. The assessment measures writing quality and revision readiness. It does not estimate admission chances.</p>
            </div>
            <div className={styles.submit}>
              <button className={`${ui.button} ${ui.primary} min-h-[52px] cursor-pointer px-6 tracking-[-.01em]`} id="run-assessment" type="submit">Run free assessment</button>
              <div><strong>{wordCount >= 80 ? 'Your statement is ready to continue.' : 'Paste at least 80 words to begin.'}</strong><small>Sign in to continue with your assessment.</small></div>
            </div>
          </div>

          <aside className={styles.guideColumn}>
            <div className={styles.guide}>
              <p className={styles.overline}>Paste guide</p>
              <h2>Give the assessment a clean document.</h2>
              <p>Statement Studio reads the writing itself. Headers, addresses, document titles, and broken paragraph formatting can distort the analysis.</p>
              <ol>{pasteGuide.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><small>{copy}</small></div></li>)}</ol>
              <div className={styles.guideNote}><strong>What is preserved</strong><p>Paragraph breaks, sentence order, punctuation, and wording are preserved. Font, margins, bold text, and other visual formatting are not needed for the assessment.</p></div>
            </div>
          </aside>
        </form>
      </main>
      <SiteFooter />
    </div>
  )
}

export default function AssessmentPage() {
  const [searchParams] = useSearchParams()
  const initialPathway = assessmentPathways.find((pathway) => pathway.id === searchParams.get('pathway'))?.id ?? 'health'
  return <AssessmentScreen key={initialPathway} initialPathway={initialPathway} />
}
