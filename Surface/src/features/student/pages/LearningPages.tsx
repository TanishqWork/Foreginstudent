import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useStudent } from '../StudentContext'
import { Badge, Button, Icon, PageHeading } from '../ui'
import './LearningPages.css'

type Lesson = {
  id: string
  label: string
  short: string
  title: string
  description: string
  purpose: string
  example: { text: string; label: string; why: string }[]
  takeaway: string
  question: string
  answers: string[]
  correct: number
  explanation: string
}

const lessons: Lesson[] = [
  {
    id: 'structure-introduction', label: 'Introduction', short: 'Set the scene',
    title: 'Give your reader a reason to keep reading.',
    description: 'An introduction brings a reader into a specific question, then makes the direction of your argument clear.',
    purpose: 'Move from a useful context to a focused question. The opening does not need a dramatic story or a sweeping claim.',
    example: [
      { text: 'A recorded lecture can be watched from almost anywhere, but access to a recording is not the same as access to learning. ', label: '01 · Context', why: 'Introduces a precise tension rather than making a claim about all education.' },
      { text: 'For students studying around work and caring responsibilities, the design of online courses matters as much as their availability. ', label: '02 · Focus', why: 'Narrows the discussion to a particular group and a question of course design.' },
      { text: 'This essay argues that flexible deadlines and purposeful interaction are essential to making that access meaningful.', label: '03 · Direction', why: 'Gives the reader a position to follow and two ideas the essay will develop.' },
    ],
    takeaway: 'Start close to your question. Give only the background your reader needs to understand why your argument matters.',
    question: 'Which opening gives an essay the clearest focus?',
    answers: ['Education has been important throughout all of human history.', 'This essay will discuss some advantages and disadvantages of learning.', 'Flexible courses offer access, but their design determines who can participate.'],
    correct: 2, explanation: 'The third opening establishes a specific tension that an argument can explore. The other openings are broad or announce a topic without a position.',
  },
  {
    id: 'structure-thesis', label: 'Thesis statement', short: 'Make your claim',
    title: 'A useful thesis takes a position.',
    description: 'Turn your topic into a claim that your evidence can support, qualify, or challenge.',
    purpose: 'Tell the reader what you argue and why. A working thesis can change as your reading and thinking develop.',
    example: [
      { text: 'Universities should retain a flexible route through introductory courses ', label: '01 · Position', why: 'Makes a debatable claim rather than naming the general topic of online learning.' },
      { text: 'because predictable deadlines and multiple ways to participate ', label: '02 · Reasoning', why: 'Identifies the reasons that the body of the essay must explain and support.' },
      { text: 'can reduce scheduling barriers without removing opportunities for discussion.', label: '03 · Scope', why: 'Sets a boundary around the argument instead of promising a solution to every learning problem.' },
    ],
    takeaway: 'Ask: could a thoughtful reader disagree? Then ask: can I support this exact claim within the assignment?',
    question: 'Which statement is a thesis rather than just a topic?',
    answers: ['This essay is about university libraries.', 'Longer evening library hours can improve access for working students, provided quiet study space is available.', 'There are many different kinds of university library.'],
    correct: 1, explanation: 'The second option makes a specific, qualified claim. It gives the writer a position to defend and a condition to examine.',
  },
  {
    id: 'structure-body', label: 'Body paragraphs', short: 'Build your case',
    title: 'Let each paragraph do a clear job.',
    description: 'Connect a focused point with evidence and your own explanation of what that evidence means.',
    purpose: 'A paragraph needs more than a source or an example. Show how the material supports the particular argument you are making.',
    example: [
      { text: 'Predictable weekly deadlines can make a flexible course easier to navigate. ', label: '01 · Point', why: 'States one idea that this paragraph can develop.' },
      { text: 'Consider a student who can study only after a changing work shift: a published schedule lets them plan that limited time. ', label: '02 · Illustration', why: 'Uses a fictional scenario to make the reasoning concrete. A research essay would also need suitable evidence for its broader claim.' },
      { text: 'The value of flexibility therefore lies in a usable structure, rather than simply in the absence of a classroom timetable.', label: '03 · Analysis', why: 'Explains the significance of the example and brings it back to the argument.' },
    ],
    takeaway: 'After a quotation or example, answer “How does this support my point?” Your reader should not have to supply that connection.',
    question: 'What should you usually do after introducing relevant evidence?',
    answers: ['Explain what it shows and how it supports or complicates your point.', 'Add another quotation immediately so the paragraph has more sources.', 'Repeat your thesis word for word.'],
    correct: 0, explanation: 'Your analysis connects the source to your argument. More quotations cannot make that connection on their own.',
  },
  {
    id: 'structure-counterargument', label: 'Counterargument', short: 'Think it through',
    title: 'Take another perspective seriously.',
    description: 'A considered objection can help you test your reasoning and make your claim more precise.',
    purpose: 'Represent a credible alternative fairly. You can respond with evidence, concede part of the point, or adjust the scope of your argument.',
    example: [
      { text: 'A reasonable concern is that flexible deadlines may make shared discussion harder to coordinate. ', label: '01 · Objection', why: 'Identifies a real trade-off rather than inventing an obviously weak opponent.' },
      { text: 'This concern matters when an activity depends on students responding to one another in sequence. ', label: '02 · Concession', why: 'Acknowledges when and why the objection has force.' },
      { text: 'A bounded submission window, alongside scheduled discussion milestones, offers a more defensible approach than unlimited extensions.', label: '03 · Response', why: 'Refines the original proposal instead of dismissing the objection.' },
    ],
    takeaway: 'The goal is a better argument, not a victory over an imaginary opponent. Let a strong objection improve your position.',
    question: 'Which response handles a counterargument most thoughtfully?',
    answers: ['People who disagree simply do not understand the issue.', 'Mention an objection, then return to your claim without addressing it.', 'Recognize the valid concern and explain how it changes the scope of your proposal.'],
    correct: 2, explanation: 'A fair response considers the objection on its merits. A concession can strengthen an argument by making its limits clearer.',
  },
  {
    id: 'structure-conclusion', label: 'Conclusion', short: 'Leave a thought',
    title: 'Show what your argument makes possible.',
    description: 'Bring the essay’s reasoning together and leave the reader with a clear sense of its significance.',
    purpose: 'Resolve the question your essay raised. Explain what follows from your findings without introducing a new, unsupported argument.',
    example: [
      { text: 'Flexible learning is most useful when students can understand and plan their participation. ', label: '01 · Synthesis', why: 'Returns to the central argument in light of the discussion, rather than copying the introduction.' },
      { text: 'Predictable schedules and purposeful opportunities for interaction address different parts of that challenge. ', label: '02 · Connection', why: 'Brings the main strands together and shows their relationship.' },
      { text: 'The practical question for course design is therefore not simply where students learn, but what enables them to take part.', label: '03 · Significance', why: 'Ends with a focused implication that follows from the argument.' },
    ],
    takeaway: 'Bring your ideas together, then answer “So what?” Let the ending follow from what the essay has established.',
    question: 'What belongs in a well-supported conclusion?',
    answers: ['A new claim that needs a separate body paragraph to explain.', 'A synthesis of the argument and an implication supported by the discussion.', 'A list of every sentence used in the introduction.'],
    correct: 1, explanation: 'A conclusion draws the argument together and explains its significance. New evidence or a separate major claim usually belongs earlier in the essay.',
  },
]

export function StructurePage() {
  const { completedLessons, completeLesson, activeEssayId, basePath, showToast } = useStudent()
  const [lessonParams] = useSearchParams()
  const [lessonIndex, setLessonIndex] = useState(() => {
    const requested = lessonParams.get('lesson')
    const slug = requested === 'evidence' ? 'body' : requested
    return Math.max(0, lessons.findIndex((item) => item.id === `structure-${slug}`))
  })
  const [annotation, setAnnotation] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const lesson = lessons[lessonIndex]
  const finished = lessons.filter((item) => completedLessons.includes(item.id)).length
  const correct = checked && answer === lesson.correct

  function chooseLesson(index: number) {
    setLessonIndex(index)
    setAnnotation(0)
    setAnswer(null)
    setChecked(false)
  }

  function checkAnswer() {
    if (answer === null) return
    setChecked(true)
    if (answer === lesson.correct) {
      completeLesson(lesson.id)
      showToast('Nice work. This lesson is now complete.')
    }
  }

  return (
    <div className="st-learning">
      <PageHeading eyebrow="THE WRITING TOOLKIT" title="Good essays have a little architecture." description="Understand the moves behind a clear argument, one small lesson at a time." actions={<Link className="st-btn st-btn-secondary" to={activeEssayId ? `${basePath}/editor/${activeEssayId}` : `${basePath}/new`}>Put it into practice <Icon name="arrowUpRight" size={16} /></Link>} />
      <div className="st-learn-progress"><span><Icon name="book" size={17} /> Your learning path</span><div role="progressbar" aria-label="Structure lessons completed" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={lessons.length}><i style={{ width: `${finished / lessons.length * 100}%` }} /></div><strong>{finished} of {lessons.length} complete</strong></div>
      <div className="st-learning-grid">
        <nav className="st-lesson-nav" aria-label="Essay structure lessons">
          <p className="st-learning-overline">THE PARTS OF AN ESSAY</p>
          {lessons.map((item, index) => <button type="button" key={item.id} className={`st-lesson-tab ${index === lessonIndex ? 'is-active' : ''}`} onClick={() => chooseLesson(index)} aria-current={index === lessonIndex ? 'step' : undefined}><span className={`st-lesson-number ${completedLessons.includes(item.id) ? 'is-complete' : ''}`}>{completedLessons.includes(item.id) ? <Icon name="check" size={15} /> : String(index + 1).padStart(2, '0')}</span><span><strong>{item.label}</strong><small>{item.short}</small></span><Icon name="chevronRight" size={15} /></button>)}
          <div className="st-lesson-note"><Icon name="lightbulb" size={21} /><strong>A framework, not a formula.</strong><p>Your assignment comes first. These moves can change order or share a paragraph.</p></div>
        </nav>
        <div className="st-lesson-main">
          <section className="st-learning-card st-lesson-content" aria-labelledby="st-lesson-title">
            <div className="st-learning-card-top"><Badge tone="violet">Lesson {lessonIndex + 1} of 5</Badge><span><Icon name="clock" size={14} /> 3 min read</span></div>
            <h2 id="st-lesson-title">{lesson.title}</h2><p className="st-lesson-description">{lesson.description}</p>
            <div className="st-lesson-purpose"><span className="st-learning-small-icon"><Icon name="target" size={20} /></span><div><h3>The job of this section</h3><p>{lesson.purpose}</p></div></div>
            <div className="st-example-heading"><span className="st-learning-overline">SEE IT IN ACTION</span><span>Fictional teaching example</span></div>
            <div className="st-annotated-paragraph" aria-label="Annotated example paragraph">{lesson.example.map((part, index) => <button key={part.label} type="button" className={`st-annotation-text st-annotation-${index} ${annotation === index ? 'is-selected' : ''}`} onClick={() => setAnnotation(index)} aria-pressed={annotation === index}>{part.text}</button>)}</div>
            <div className="st-annotation-legend">{lesson.example.map((part, index) => <button type="button" key={part.label} onClick={() => setAnnotation(index)} className={annotation === index ? 'is-active' : ''} aria-pressed={annotation === index}><i className={`st-annotation-dot-${index}`} />{part.label}</button>)}</div>
            <div className="st-annotation-explanation" aria-live="polite"><Icon name="sparkles" size={18} /><div><strong>Why this works</strong><p>{lesson.example[annotation].why}</p></div></div>
            <div className="st-lesson-takeaway"><span>TAKE THIS WITH YOU</span><p>{lesson.takeaway}</p></div>
          </section>
          <section className="st-learning-card st-quiz" aria-labelledby="st-quiz-title" key={lesson.id}>
            <div className="st-learning-card-top"><span className="st-quiz-label"><Icon name="graduation" size={19} /> A quick check</span><span>Small steps, stronger writing</span></div>
            <h3 id="st-quiz-title">{lesson.question}</h3>
            <fieldset><legend className="st-visually-hidden">Choose an answer</legend>{lesson.answers.map((item, index) => <label key={item} className={`st-quiz-answer ${answer === index ? 'is-selected' : ''} ${checked && answer === index ? answer === lesson.correct ? 'is-correct' : 'is-incorrect' : ''}`}><input type="radio" name={`quiz-${lesson.id}`} value={index} checked={answer === index} onChange={() => { setAnswer(index); setChecked(false) }} /><span className="st-quiz-letter">{String.fromCharCode(65 + index)}</span><span>{item}</span>{checked && answer === index && <Icon name={correct ? 'checkCircle' : 'help'} size={19} />}</label>)}</fieldset>
            {checked && <div className={`st-quiz-explanation ${correct ? 'is-correct' : ''}`} role="status"><strong>{correct ? 'You’ve got it.' : 'A useful starting point. Take another look.'}</strong><p>{lesson.explanation}</p></div>}
            <div className="st-quiz-footer"><span>{completedLessons.includes(lesson.id) ? <><Icon name="checkCircle" size={16} /> Lesson completed</> : 'Choose the answer that best supports the reader.'}</span>{correct ? <Button variant="primary" onClick={() => chooseLesson((lessonIndex + 1) % lessons.length)}>{lessonIndex === lessons.length - 1 ? 'Explore lessons again' : 'Next lesson'} <Icon name="arrowRight" size={16} /></Button> : <Button variant="primary" disabled={answer === null} onClick={checkAnswer}>Check my answer <Icon name="arrowRight" size={16} /></Button>}</div>
          </section>
        </div>
      </div>
    </div>
  )
}

type FeedbackPriority = 'focus' | 'develop' | 'strength'
const feedbackExamples: { id: string; title: string; category: string; priority: FeedbackPriority; summary: string; excerpt: string; why: string; next: string }[] = [
  { id: 'thesis', title: 'Make the central claim more precise', category: 'Argument & focus', priority: 'focus', summary: 'A topic tells the reader where you are. A position tells them where you are going.', excerpt: '“Technology has changed the way students learn in many ways.”', why: 'This fictional sentence introduces a broad topic, but the reader cannot yet tell which change matters or what the writer argues about it. A narrower claim would also make it easier to select relevant evidence.', next: 'Identify one change, the group it affects, and the position you can defend with the evidence you have.' },
  { id: 'evidence', title: 'Give your evidence a little more context', category: 'Evidence & sources', priority: 'focus', summary: 'Help a reader understand who the evidence describes and what it can establish.', excerpt: '“A study found that online learning improved student outcomes.”', why: 'A result means more when the reader knows what was measured, whose experience was studied, and what comparison was used. The sentence alone does not establish that the result applies to every course or student.', next: 'Return to the source. Identify the population, the outcome, and any limitation that matters to your specific claim.' },
  { id: 'analysis', title: 'Explain the connection after the example', category: 'Analysis & reasoning', priority: 'develop', summary: 'Your interpretation is what turns a collection of sources into an argument.', excerpt: '“Students could watch the lecture after their shifts. This demonstrates the importance of flexibility.”', why: 'The example offers a concrete situation. The next sentence could explain the mechanism more fully: which barrier changes, and what remains unresolved?', next: 'Add one sentence explaining how the example supports your claim, and acknowledge what it does not show.' },
  { id: 'structure', title: 'Give this transition a clear purpose', category: 'Structure & flow', priority: 'develop', summary: 'The relationship between two ideas matters more than the linking word.', excerpt: '“Furthermore, online discussion has several disadvantages.”', why: 'The reader needs to know whether this paragraph adds a second reason, qualifies an earlier claim, or raises an objection. “Furthermore” does not establish that relationship by itself.', next: 'Name the connection to the previous paragraph before introducing the next piece of evidence.' },
  { id: 'voice', title: 'Keep this balanced, specific reasoning', category: 'Voice & clarity', priority: 'strength', summary: 'A qualified claim can be more persuasive than an absolute one.', excerpt: '“Flexible deadlines can help working students plan, though shared tasks still need agreed milestones.”', why: 'The sentence makes a focused point and recognizes a relevant condition. It leaves room for evidence and avoids promising the same result in every situation.', next: 'Preserve this balance as you develop the example. Support both the benefit and the condition with relevant material.' },
]

export function FeedbackPage() {
  const { essays, activeEssayId, setActiveEssayId, updateEssay, basePath, showToast } = useStudent()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const requestedId = params.essayId || searchParams.get('essay') || activeEssayId
  const essay = essays.find((item) => item.id === requestedId) || essays[0]
  const [filter, setFilter] = useState<'all' | FeedbackPriority>('all')
  const [expanded, setExpanded] = useState<string | null>('thesis')
  const [previewed, setPreviewed] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState<string[]>([])
  const visible = feedbackExamples.filter((item) => filter === 'all' || item.priority === filter)

  function chooseEssay(id: string) {
    setActiveEssayId(id)
    navigate(`${basePath}/feedback?essay=${encodeURIComponent(id)}`, { replace: true })
    setPreviewed(false)
  }

  return (
    <div className="st-feedback">
      <PageHeading eyebrow="THOUGHTFUL REVISION" title="A fresh perspective on your writing." description="Learn what useful feedback looks like, then bring those questions to your own draft." />
      <div className="st-feedback-draft-bar"><span className="st-learning-small-icon"><Icon name="file" size={22} /></span><label><span>Your writing</span><select aria-label="Choose an essay for revision" value={essay?.id || ''} onChange={(event) => chooseEssay(event.target.value)}>{essays.length ? essays.map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled essay'}</option>) : <option value="">No essay yet</option>}</select></label><Badge tone="neutral">{essay?.status === 'reviewed' ? 'Marked reviewed' : 'Your draft'}</Badge><Button variant="primary" disabled={!essay} onClick={() => { setPreviewed(true); showToast('Illustrative feedback opened. Your draft has not been assessed.') }}><Icon name="sparkles" size={16} /> Review writing</Button></div>
      <div className="st-feedback-demo" role="note"><Icon name="lightbulb" size={20} /><div><strong>{previewed ? 'Your example review is ready to explore.' : 'Explore an illustrative review.'}</strong><p>The comments and excerpts below are teaching examples, not an assessment of your selected essay. No AI review or score is generated here.</p></div><Badge tone="violet">Sample feedback</Badge></div>
      <div className="st-feedback-layout">
        <div>
          <div className="st-feedback-section-heading"><div><h2>Small changes. Stronger thinking.</h2><p>Start with the argument, then work your way to the sentence.</p></div><span>{feedbackExamples.length} sample annotations</span></div>
          <div className="st-feedback-filters" aria-label="Filter feedback">{([['all', 'All feedback'], ['focus', 'Start here'], ['develop', 'Worth developing'], ['strength', 'Keep doing']] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{value === 'focus' && <span>2</span>}</button>)}</div>
          <div className="st-feedback-cards">{visible.map((item) => <article className={`st-feedback-card st-feedback-${item.priority}`} key={item.id}><button type="button" className="st-feedback-card-toggle" aria-expanded={expanded === item.id} aria-controls={`feedback-${item.id}`} onClick={() => setExpanded(expanded === item.id ? null : item.id)}><span className="st-feedback-status-icon"><Icon name={item.priority === 'strength' ? 'checkCircle' : item.priority === 'focus' ? 'target' : 'lightbulb'} size={20} /></span><span><span className="st-feedback-category">{item.category} <i>·</i> {item.priority === 'focus' ? 'Start here' : item.priority === 'develop' ? 'Worth developing' : 'A strength to keep'}</span><strong>{item.title}</strong><small>{item.summary}</small></span><Icon name="chevronDown" className={expanded === item.id ? 'st-is-rotated' : ''} size={19} /></button>{expanded === item.id && <div className="st-feedback-card-detail" id={`feedback-${item.id}`}><div className="st-feedback-quote"><span>EXAMPLE EXCERPT</span><blockquote>{item.excerpt}</blockquote></div><h3>Why this matters</h3><p>{item.why}</p><div className="st-feedback-next"><Icon name="arrowRight" size={18} /><div><strong>One useful next step</strong><p>{item.next}</p></div></div>{essay && <Link className="st-feedback-editor-link" to={`${basePath}/editor/${essay.id}?issue=${item.id}`}>Try this in your draft <Icon name="arrowUpRight" size={15} /></Link>}</div>}</article>)}</div>
        </div>
        <aside className="st-feedback-sidebar">
          <div className="st-feedback-plan"><span className="st-learning-overline">YOUR NEXT WRITING SESSION</span><h2>One good revision at a time.</h2><p>Use these questions to guide your own review. Check them off as you work.</p><div className="st-feedback-checklist">{[['claim', 'I can state my central argument in one sentence.'], ['support', 'I have checked how my evidence supports that argument.'], ['read', 'I have read my revised paragraph aloud.']].map(([id, label]) => <label key={id}><input type="checkbox" checked={checkedSteps.includes(id)} onChange={(event) => setCheckedSteps((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} /><span>{label}</span></label>)}</div><span className="st-feedback-check-count">{checkedSteps.length} of 3 steps checked</span>{essay ? <Link className="st-btn st-btn-primary" to={`${basePath}/editor/${essay.id}`}>Back to my essay <Icon name="arrowRight" size={16} /></Link> : <Link className="st-btn st-btn-primary" to={`${basePath}/new`}>Start an essay <Icon name="plus" size={16} /></Link>}</div>
          <div className="st-feedback-review-note"><Icon name="checkCircle" size={23} /><h3>Finished your own review?</h3><p>Mark the draft reviewed when you are ready. This is your progress marker, not a grade.</p><Button variant="secondary" disabled={!essay || essay.status === 'reviewed' || essay.status === 'complete'} onClick={() => { if (essay) { updateEssay(essay.id, { status: 'reviewed' }); showToast('Your draft is marked as reviewed.') } }}>{essay?.status === 'reviewed' ? 'Marked as reviewed' : essay?.status === 'complete' ? 'Essay complete' : 'Mark as reviewed'}</Button></div>
          <p className="st-feedback-footnote">Your ideas stay yours. Helpful feedback asks better questions; it does not take over your writing.</p>
        </aside>
      </div>
    </div>
  )
}

type SourceType = 'journal' | 'book' | 'website'
type CitationStyle = 'APA 7' | 'MLA 9' | 'Harvard'
type Source = { id: string; author: string; title: string; year: string; url: string; type: SourceType; publication: string; volume: string; issue: string; pages: string; subject: string; description: string; saved: boolean; note: string; essayId: string; starter: boolean }
const starterSources: Source[] = [
  { id: 'source-learning-techniques', author: 'Dunlosky, John; Rawson, Katherine A.; Marsh, Elizabeth J.; Nathan, Mitchell J.; Willingham, Daniel T.', title: 'Improving Students’ Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology', year: '2013', url: 'https://doi.org/10.1177/1529100612453266', type: 'journal', publication: 'Psychological Science in the Public Interest', volume: '14', issue: '1', pages: '4–58', subject: 'Psychology', description: 'A review of learning techniques and the contexts in which they have been studied.', saved: true, note: '', essayId: '', starter: true },
  { id: 'source-cognitive-load', author: 'Sweller, John', title: 'Cognitive Load During Problem Solving: Effects on Learning', year: '1988', url: 'https://doi.org/10.1207/s15516709cog1202_4', type: 'journal', publication: 'Cognitive Science', volume: '12', issue: '2', pages: '257–285', subject: 'Psychology', description: 'Examines the relationship between problem-solving demands and learning.', saved: true, note: '', essayId: '', starter: true },
  { id: 'source-thesis-guide', author: 'The Writing Center', title: 'Thesis Statements', year: '', url: 'https://writingcenter.unc.edu/tips-and-tools/thesis-statements/', type: 'website', publication: 'University of North Carolina at Chapel Hill', volume: '', issue: '', pages: '', subject: 'Writing', description: 'A university writing guide for developing and refining a focused thesis.', saved: false, note: '', essayId: '', starter: true },
]

function externalUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}

function readSources(storageKey: string): Source[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (Array.isArray(raw) && raw.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false
      const source = item as Record<string, unknown>
      return ['id', 'author', 'title', 'year', 'url', 'publication', 'volume', 'issue', 'pages', 'subject', 'description', 'note', 'essayId'].every((key) => typeof source[key] === 'string') && ['journal', 'book', 'website'].includes(String(source.type)) && typeof source.saved === 'boolean' && typeof source.starter === 'boolean'
    })) return raw as Source[]
  } catch { /* A fresh local library is available if browser storage is unavailable. */ }
  return starterSources.map((source) => ({ ...source }))
}

function authorNames(value: string, initials: boolean): string[] {
  return value.split(';').map((author) => {
    const [family, ...given] = author.trim().split(',')
    if (!given.length || !initials) return author.trim()
    return `${family.trim()}, ${given.join(' ').trim().split(/\s+/u).filter(Boolean).map((name) => `${name[0].toLocaleUpperCase()}.`).join(' ')}`
  }).filter(Boolean)
}

function citationFor(source: Source, style: CitationStyle): string {
  const names = authorNames(source.author, style !== 'MLA 9')
  const author = style === 'MLA 9' && names.length > 2 ? `${names[0]}, et al.` : names.length > 1 ? `${names.slice(0, -1).join(', ')}${names.length > 2 ? ',' : ''} ${style === 'APA 7' ? '&' : 'and'} ${names[names.length - 1]}` : names[0] || 'Unknown author'
  const year = source.year || 'n.d.'
  const url = externalUrl(source.url) || ''
  const journal = [source.publication, source.volume ? `${source.volume}${source.issue ? `(${source.issue})` : ''}` : '', source.pages].filter(Boolean).join(', ')
  if (style === 'APA 7') return `${author}${author.endsWith('.') ? '' : '.'} (${year}). ${source.title.replace(/\.$/u, '')}.${source.type === 'journal' ? journal ? ` ${journal}.` : '' : source.publication ? ` ${source.publication}.` : ''}${url ? ` ${url}` : ''}`
  if (style === 'MLA 9') return `${author}${author.endsWith('.') ? '' : '.'} ${source.type === 'book' ? `${source.title}.` : `“${source.title.replace(/\.$/u, '')}.”`}${source.publication ? ` ${source.publication},` : ''}${source.type === 'journal' && source.volume ? ` vol. ${source.volume},` : ''}${source.type === 'journal' && source.issue ? ` no. ${source.issue},` : ''} ${year}${source.type === 'journal' && source.pages ? `, pp. ${source.pages}` : ''}.${url ? ` ${url}.` : ''}`
  return `${author} (${year}) ${source.type === 'book' ? source.title : `‘${source.title}’`}${source.type === 'journal' && journal ? `, ${journal}` : source.publication ? `. ${source.publication}` : ''}.${url ? ` Available at: ${url}.` : ''}`
}

const emptySourceForm = { author: '', title: '', year: '', url: '', type: 'journal' as SourceType, publication: '', volume: '', issue: '', pages: '' }

export function ResearchPage() {
  const { essays, activeEssayId, basePath, showToast } = useStudent()
  const storageKey = `statement-studio:research:v1:${basePath}`
  const [sources, setSources] = useState<Source[]>(() => readSources(storageKey))
  const [tab, setTab] = useState<'sources' | 'citations'>('sources')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptySourceForm)
  const [formError, setFormError] = useState('')
  const [notesId, setNotesId] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ source: Source; index: number }[]>([])
  const [style, setStyle] = useState<CitationStyle>('APA 7')
  const [citationId, setCitationId] = useState(sources[0]?.id || '')
  const selectedSource = sources.find((source) => source.id === citationId) || sources[0]
  const filteredSources = sources.filter((source) => (!savedOnly || source.saved) && (filter === 'all' || (filter === 'mine' ? !source.starter : source.type === filter)) && `${source.title} ${source.author} ${source.publication} ${source.subject}`.toLowerCase().includes(query.toLowerCase().trim()))

  function persist(next: Source[]) {
    setSources(next)
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch { showToast('Your changes are available here, but browser storage could not save them.') }
  }

  function changeSource(id: string, patch: Partial<Source>) {
    persist(sources.map((source) => source.id === id ? { ...source, ...patch } : source))
  }

  function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const urlInput = form.url.trim()
    const url = /^10\.\d{4,9}\/\S+$/iu.test(urlInput) ? `https://doi.org/${urlInput}` : urlInput
    if (!form.title.trim() || !form.author.trim()) { setFormError('Add the title and author, or the name of the organization.'); return }
    if (url && !externalUrl(url)) { setFormError('Use a complete http or https link, or a DOI beginning with 10.'); return }
    if (form.year && (!/^\d{4}$/u.test(form.year) || Number(form.year) < 1000 || Number(form.year) > new Date().getFullYear() + 1)) { setFormError('Enter a four-digit publication year, or leave it blank if no date is supplied.'); return }
    const source: Source = { ...form, id: crypto.randomUUID(), author: form.author.trim(), title: form.title.trim(), url, subject: 'My research', description: 'Source details entered by you. Check the original before citing.', saved: true, note: '', essayId: activeEssayId || '', starter: false }
    persist([source, ...sources]); setCitationId(source.id); setShowForm(false); setForm(emptySourceForm); setFormError(''); showToast('Source added to your library.')
  }

  function removeSource(source: Source) {
    const index = sources.findIndex((item) => item.id === source.id)
    setRemoved((current) => [...current, { source, index }]); persist(sources.filter((item) => item.id !== source.id))
  }

  function undoRemove() {
    const last = removed[removed.length - 1]
    if (!last) return
    const next = [...sources]; next.splice(Math.min(last.index, next.length), 0, last.source); persist(next); setRemoved((current) => current.slice(0, -1)); showToast('Source restored.')
  }

  async function copyCitation(source: Source) {
    try { await navigator.clipboard.writeText(citationFor(source, style)); showToast('Citation preview copied. Check its details before submitting.') } catch { showToast('Clipboard access is unavailable. Select and copy the citation preview instead.') }
  }

  function switchResearchTab(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'sources' : event.key === 'End' ? 'citations' : tab === 'sources' ? 'citations' : 'sources'
    setTab(next)
    event.currentTarget.querySelector<HTMLButtonElement>(`#st-${next}-tab`)?.focus()
  }

  return (
    <div className="st-research">
      <PageHeading eyebrow="IDEAS BEGIN WITH CURIOSITY" title="Make room for better research." description="Keep your sources, notes, and references together. A little less searching, a little more thinking." actions={<Button variant="primary" onClick={() => { setShowForm(!showForm); setFormError('') }}><Icon name={showForm ? 'close' : 'plus'} size={17} />{showForm ? 'Close form' : 'Add a source'}</Button>} />
      <div className="st-research-banner"><span className="st-research-banner-icon"><Icon name="book" size={29} /></span><div><span className="st-learning-overline">YOUR RESEARCH, CONNECTED</span><h2>A source is a starting point.<br />Your thinking makes it an argument.</h2><p>Read critically. Capture what matters. Keep track of where it came from.</p></div><div className="st-research-mini-stack" aria-hidden="true"><span>READ</span><span>QUESTION</span><span>CONNECT <Icon name="arrowUpRight" size={16} /></span></div></div>
      {showForm && <section className="st-source-form-card" aria-labelledby="st-add-source-heading"><div className="st-research-section-heading"><div><h2 id="st-add-source-heading">Add to your reading list</h2><p>Use the original publication’s details. Nothing is fetched or verified automatically.</p></div></div><form onSubmit={addSource} className="st-source-form"><label>Source type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SourceType })}><option value="journal">Journal article</option><option value="book">Book</option><option value="website">Website</option></select></label><label>Author or organization<input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Family, Given; Family, Given" maxLength={1000} /></label><label className="st-source-form-wide">Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The exact title of the source" maxLength={2000} /></label><label>Publication year <span>optional</span><input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="2024" inputMode="numeric" maxLength={4} /></label><label>{form.type === 'book' ? 'Publisher' : form.type === 'website' ? 'Website or institution' : 'Journal name'} <span>optional</span><input value={form.publication} onChange={(event) => setForm({ ...form, publication: event.target.value })} maxLength={500} /></label><label className="st-source-form-wide">URL or DOI <span>optional</span><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://… or 10.…" maxLength={2000} /></label>{form.type === 'journal' && <div className="st-source-journal-fields"><label>Volume<input value={form.volume} onChange={(event) => setForm({ ...form, volume: event.target.value })} maxLength={30} /></label><label>Issue<input value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} maxLength={30} /></label><label>Pages<input value={form.pages} onChange={(event) => setForm({ ...form, pages: event.target.value })} placeholder="12–24" maxLength={50} /></label></div>}{formError && <p className="st-source-form-error" role="alert">{formError}</p>}<div className="st-source-form-actions"><p>For multiple authors, separate names with a semicolon.</p><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button><Button variant="primary" type="submit">Save source <Icon name="check" size={16} /></Button></div></form></section>}
      <div className="st-research-tabs" role="tablist" aria-label="Research workspace" onKeyDown={switchResearchTab}><button id="st-sources-tab" type="button" role="tab" tabIndex={tab === 'sources' ? 0 : -1} aria-selected={tab === 'sources'} aria-controls="st-sources-panel" onClick={() => setTab('sources')}><Icon name="book" size={17} /> Source library <span>{sources.length}</span></button><button id="st-citations-tab" type="button" role="tab" tabIndex={tab === 'citations' ? 0 : -1} aria-selected={tab === 'citations'} aria-controls="st-citations-panel" onClick={() => setTab('citations')}><Icon name="quote" size={17} /> Citation builder</button></div>
      {tab === 'sources' ? <section id="st-sources-panel" role="tabpanel" aria-labelledby="st-sources-tab"><div className="st-source-toolbar"><label className="st-source-search"><Icon name="search" size={18} /><span className="st-visually-hidden">Search your sources</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, authors, or journals…" /></label><label className="st-source-type-filter"><span className="st-visually-hidden">Filter source type</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All source types</option><option value="journal">Journal articles</option><option value="book">Books</option><option value="website">Websites</option><option value="mine">Added by me</option></select></label><button type="button" className={`st-source-saved-filter ${savedOnly ? 'is-active' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Icon name="bookmark" size={17} />Saved only</button></div><div className="st-source-list-heading"><span>{filteredSources.length} {filteredSources.length === 1 ? 'source' : 'sources'} in view</span><span>Starter references are examples, not recommendations for your essay.</span></div><div className="st-source-list">{filteredSources.map((source) => <article className="st-source-card" key={source.id}><div className={`st-source-type-icon st-source-type-${source.type}`}><Icon name={source.type === 'website' ? 'globe' : source.type === 'book' ? 'book' : 'file'} size={25} /></div><div className="st-source-content"><div className="st-source-meta"><span>{source.type === 'journal' ? 'JOURNAL ARTICLE' : source.type === 'book' ? 'BOOK' : 'WEB RESOURCE'}</span><i>·</i><span>{source.year || 'No date'}</span><Badge tone="neutral">{source.starter ? 'Starter source' : 'Added by you'}</Badge></div><h3>{source.title}</h3><p className="st-source-author">{source.author.split(';').length > 2 ? `${source.author.split(';')[0]} et al.` : source.author}{source.publication && <span> · {source.publication}</span>}</p><p className="st-source-description">{source.description}</p><div className="st-source-actions">{externalUrl(source.url) && <a href={externalUrl(source.url)!} target="_blank" rel="noreferrer">View original <Icon name="arrowUpRight" size={14} /></a>}<button type="button" onClick={() => { setCitationId(source.id); setTab('citations') }}><Icon name="quote" size={14} /> Cite source</button><button type="button" aria-expanded={notesId === source.id} onClick={() => setNotesId(notesId === source.id ? null : source.id)}><Icon name="pen" size={14} />{source.note ? 'Edit note' : 'Add a note'}</button></div>{notesId === source.id && <div className="st-source-notes"><label>What matters for your argument?<textarea rows={3} value={source.note} onChange={(event) => changeSource(source.id, { note: event.target.value })} placeholder="Capture an idea, limitation, or question in your own words. Add a page number for any quotation." maxLength={10000} /></label><div><label>Connect to an essay<select value={essays.some((essay) => essay.id === source.essayId) ? source.essayId : ''} onChange={(event) => changeSource(source.id, { essayId: event.target.value })}><option value="">Keep in my library</option>{essays.map((essay) => <option key={essay.id} value={essay.id}>{essay.title || 'Untitled essay'}</option>)}</select></label>{essays.some((essay) => essay.id === source.essayId) && <Link to={`${basePath}/editor/${source.essayId}`}>Open essay <Icon name="arrowUpRight" size={14} /></Link>}</div><small>Notes save in this browser tab. They are not added to the essay automatically.</small></div>}</div><div className="st-source-controls"><button type="button" className={`st-icon-button ${source.saved ? 'st-source-is-saved' : ''}`} aria-label={source.saved ? `Unsave ${source.title}` : `Save ${source.title}`} aria-pressed={source.saved} onClick={() => { changeSource(source.id, { saved: !source.saved }); showToast(source.saved ? 'Source removed from saved items.' : 'Source saved.') }}><Icon name="bookmark" size={19} /></button><button type="button" className="st-source-remove" onClick={() => removeSource(source)} aria-label={`Remove ${source.title}`}><Icon name="close" size={16} /></button></div></article>)}</div>{!filteredSources.length && <div className="st-research-empty"><Icon name="search" size={30} /><h3>{sources.length ? 'No sources match just yet.' : 'A new reading list starts here.'}</h3><p>{sources.length ? 'Try a different search or source filter.' : 'Add a source you want to explore and keep your notes alongside it.'}</p><Button variant="secondary" onClick={() => { if (sources.length) { setQuery(''); setFilter('all'); setSavedOnly(false) } else setShowForm(true) }}>{sources.length ? 'Clear filters' : 'Add my first source'}</Button></div>}</section> : <section className="st-citation-layout" id="st-citations-panel" role="tabpanel" aria-labelledby="st-citations-tab"><div className="st-learning-card st-citation-builder"><span className="st-learning-overline">THE DETAILS MATTER</span><h2>Give good ideas their credit.</h2><p>Build a reference from the details in your library.</p><label>Choose a source<select value={selectedSource?.id || ''} onChange={(event) => setCitationId(event.target.value)}>{sources.length ? sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>) : <option value="">Add a source first</option>}</select></label><fieldset className="st-citation-styles"><legend>Citation style</legend>{(['APA 7', 'MLA 9', 'Harvard'] as const).map((value) => <label key={value} className={style === value ? 'is-active' : ''}><input type="radio" name="citation-style" checked={style === value} onChange={() => setStyle(value)} />{value}</label>)}</fieldset><div className="st-citation-preview-head"><span>REFERENCE PREVIEW</span><Badge tone="amber">Check before submitting</Badge></div><div className="st-citation-preview" aria-live="polite">{selectedSource ? citationFor(selectedSource, style) : 'Choose or add a source to preview its reference.'}</div><Button variant="primary" disabled={!selectedSource} onClick={() => { if (selectedSource) void copyCitation(selectedSource) }}><Icon name="copy" size={16} /> Copy citation</Button><p className="st-citation-caveat">This local preview uses the metadata you entered. Check capitalization, italics, missing details, and your institution’s guide. Harvard conventions vary.</p></div><aside className="st-citation-guide"><span className="st-learning-small-icon"><Icon name="quote" size={24} /></span><h3>A citation is more than a finishing touch.</h3><p>It lets a reader follow your evidence, understand its context, and explore the conversation you are joining.</p><ol><li><span>01</span>Check the original source, not just its search result.</li><li><span>02</span>Record page numbers when you take notes.</li><li><span>03</span>Keep your paraphrase distinct from direct quotations.</li></ol><div><Icon name="lightbulb" size={18} /><p>Different sources need different details. Complete the metadata before copying your reference.</p></div></aside></section>}
      {removed.length > 0 && <div className="st-source-undo" role="status"><span>Removed “{removed[removed.length - 1].source.title}” from this library.</span><button type="button" onClick={undoRemove}><Icon name="undo" size={15} /> Undo</button></div>}
      <div className="st-research-local-note"><Icon name="link" size={15} /><p>Sources and notes are stored in this tab for this visit. Export or copy anything you want to keep.</p></div>
    </div>
  )
}
