import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStudent } from '../StudentContext'
import './JourneyPages.css'

type JourneyIconName = 'arrow' | 'back' | 'check' | 'pen' | 'book' | 'search' | 'spark' | 'target' | 'file' | 'clock'

function JourneyIcon({ name, size = 20 }: { name: JourneyIconName; size?: number }) {
  const paths: Record<JourneyIconName, string> = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    back: 'M19 12H5m6-6-6 6 6 6',
    check: 'm5 12 4 4L19 6',
    pen: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
    book: 'M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2V4Z',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    spark: 'm12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z',
    target: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    file: 'M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8M8 17h5',
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

const priorities: { label: string; detail: string; icon: JourneyIconName }[] = [
  { label: 'Get started with confidence', detail: 'Turn a blank page into a first step.', icon: 'pen' },
  { label: 'Build a stronger argument', detail: 'Give your ideas a clear throughline.', icon: 'target' },
  { label: 'Plan my essay structure', detail: 'Find the right place for every idea.', icon: 'file' },
  { label: 'Write with more clarity', detail: 'Say what you mean, in your own voice.', icon: 'spark' },
  { label: 'Find trustworthy sources', detail: 'Support your thinking with evidence.', icon: 'search' },
  { label: 'Make revisions count', detail: 'Know what to work on next.', icon: 'book' },
]

const steps = ['A little about you', 'What you’re working on', 'Your starting plan']

export function OnboardingPage() {
  const { profile, updateProfile, showToast, basePath } = useStudent()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)
  const [level, setLevel] = useState(profile.level)
  const [discipline, setDiscipline] = useState(profile.discipline)
  const [goals, setGoals] = useState<string[]>(profile.goals)
  const [error, setError] = useState('')

  const finish = (skip = false) => {
    updateProfile({
      name: (skip ? profile.name : name).trim() || 'Student',
      level: (skip ? profile.level : level) || 'Undergraduate',
      discipline: (skip ? profile.discipline : discipline) || 'Exploring my subject',
      goals: skip ? (profile.goals.length ? profile.goals : ['Get started with confidence']) : goals,
      onboarded: true,
    })
    showToast(skip ? 'Your workspace is ready. You can personalize it any time.' : 'Your next chapter starts here. Welcome to your workspace.')
    navigate(basePath)
  }

  const next = () => {
    if (step === 0 && (!name.trim() || !level || !discipline)) {
      setError('Add your name, study level, and subject so we can shape your starting plan.')
      return
    }
    if (step === 1 && goals.length === 0) {
      setError('Choose at least one priority. There’s no wrong place to start.')
      return
    }
    setError('')
    if (step === 2) finish()
    else setStep(step + 1)
  }

  return (
    <div className="st-journey st-onboarding">
      <div className="st-onboarding-top"><span className="st-journey-eyebrow">A WORKSPACE THAT FEELS LIKE YOURS</span><button className="st-journey-text-button" onClick={() => finish(true)}>Set up later <JourneyIcon name="arrow" size={16} /></button></div>
      <div className="st-onboarding-layout">
        <aside className="st-onboarding-story">
          <span className="st-journey-flower" aria-hidden="true">✳</span>
          <h1>Your ideas.<br />A little more<br /><em>possibility.</em></h1>
          <p>You don’t need to have it all figured out. Let’s find a starting point that feels right for you.</p>
          <div className="st-onboarding-quote"><div className="st-onboarding-quote-mark" aria-hidden="true">“</div><p>Good writing starts with a thought worth exploring.</p><span>WE’LL HELP YOU TAKE IT FROM THERE.</span></div>
          <div className="st-onboarding-support"><JourneyIcon name="book" /><span>Your pace. Your voice.<br /><strong>Room to learn as you go.</strong></span></div>
        </aside>
        <section className="st-onboarding-panel" aria-labelledby="onboarding-step-title">
          <ol className="st-onboarding-steps" aria-label="Setup progress">
            {steps.map((label, index) => <li key={label} className={`${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <JourneyIcon name="check" size={14} /> : `0${index + 1}`}</span><b>{label}</b></li>)}
          </ol>
          <div className="st-onboarding-step-body" key={step}>
            <span className="st-journey-eyebrow">STEP 0{step + 1} OF 03</span>
            <h2 id="onboarding-step-title">{step === 0 ? 'First, let’s meet.' : step === 1 ? 'What would help you most?' : `A good place to start, ${name.trim().split(' ')[0] || 'you'}.`}</h2>
            <p className="st-journey-description">{step === 0 ? 'A few small details to make this space more useful to you.' : step === 1 ? 'Choose the things you’d like to work on. You can change your mind later.' : 'Here’s a gentle starting plan shaped around your choices. Take it one step at a time.'}</p>
            {step === 0 && <div className="st-onboarding-fields">
              <label>What should we call you?<input autoComplete="given-name" value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder="Your first name" aria-invalid={Boolean(error && !name.trim())} /></label>
              <div className="st-onboarding-field-pair"><label>Where are you in your studies?<select value={level} onChange={event => setLevel(event.target.value)} aria-invalid={Boolean(error && !level)}><option value="">Choose your level</option>{['High school', 'Undergraduate', 'Postgraduate', 'Doctoral student', 'Independent learner'].map(value => <option key={value}>{value}</option>)}{level && !['High school', 'Undergraduate', 'Postgraduate', 'Doctoral student', 'Independent learner'].includes(level) && <option>{level}</option>}</select></label><label>What’s your subject?<select value={discipline} onChange={event => setDiscipline(event.target.value)} aria-invalid={Boolean(error && !discipline)}><option value="">Choose your subject</option>{['Arts & humanities', 'Business & management', 'Social sciences', 'Science & engineering', 'Health & medicine', 'Law & public policy', 'Exploring my subject'].map(value => <option key={value}>{value}</option>)}{discipline && !['Arts & humanities', 'Business & management', 'Social sciences', 'Science & engineering', 'Health & medicine', 'Law & public policy', 'Exploring my subject'].includes(discipline) && <option>{discipline}</option>}</select></label></div>
              <div className="st-onboarding-note"><JourneyIcon name="spark" size={19} /><p>These details help shape your suggestions. There’s no test, and no perfect answer.</p></div>
            </div>}
            {step === 1 && <div className="st-priority-grid" role="group" aria-label="Your writing priorities">{priorities.map(priority => {
              const selected = goals.includes(priority.label)
              return <button key={priority.label} className={`st-priority-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => setGoals(selected ? goals.filter(goal => goal !== priority.label) : [...goals, priority.label])}><span className="st-priority-icon"><JourneyIcon name={priority.icon} /></span><span><strong>{priority.label}</strong><small>{priority.detail}</small></span><span className="st-priority-check">{selected && <JourneyIcon name="check" size={13} />}</span></button>
            })}</div>}
            {step === 2 && <div className="st-onboarding-plan">
              <div className="st-plan-profile"><div className="st-plan-avatar">{name.trim().slice(0, 1).toUpperCase() || 'S'}</div><div><strong>{name.trim()}</strong><span>{level} · {discipline}</span></div><button className="st-journey-text-button" onClick={() => setStep(0)}>Edit</button></div>
              <div className="st-plan-goals">{goals.map(goal => <span key={goal}>{goal}</span>)}</div>
              <span className="st-journey-eyebrow st-plan-caption">YOUR SUGGESTED FIRST STEPS</span>
              <ol className="st-plan-list"><li><span>01</span><div><strong>Bring one idea to the page</strong><p>Start a draft in {discipline === 'Exploring my subject' ? 'a subject that interests you' : discipline.toLowerCase()}. A rough thought is enough.</p></div></li><li><span>02</span><div><strong>{goals.includes('Find trustworthy sources') ? 'Build a reliable evidence base' : goals.includes('Write with more clarity') ? 'Give your ideas a clear shape' : 'Make a little room for structure'}</strong><p>{goals.includes('Find trustworthy sources') ? 'Use the research space to collect sources and notes that support your thinking.' : 'Explore the structure guide and decide what each part of your essay needs to do.'}</p></div></li><li><span>03</span><div><strong>Return with a fresh perspective</strong><p>Read your draft, make one useful revision, and keep the parts that sound like you.</p></div></li></ol>
              <p className="st-plan-disclaimer">Suggested guidance based on your choices, not an assessment of your writing.</p>
            </div>}
          </div>
          <div className="st-onboarding-footer">{error && <p className="st-journey-error" role="alert">{error}</p>}<div><button className="st-btn st-btn-ghost" onClick={() => { setStep(Math.max(0, step - 1)); setError('') }} disabled={step === 0}><JourneyIcon name="back" size={17} /> Back</button><span>{step === 2 ? 'Ready when you are.' : 'A minute now. A space that fits you.'}</span><button className="st-btn st-btn-primary" onClick={next}>{step === 2 ? 'Enter my workspace' : 'Continue'}<JourneyIcon name="arrow" size={17} /></button></div></div>
        </section>
      </div>
    </div>
  )
}

const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/u).length : 0
const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Recently' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}

function ExampleProgressChart() {
  const gradientId = useId()
  return <div className="st-example-chart"><div className="st-example-chart-heading"><div><strong>Small steps add up.</strong><p>An example of a steady writing week</p></div><span>ILLUSTRATIVE EXAMPLE</span></div><svg viewBox="0 0 620 190" role="img" aria-label="Illustrative writing rhythm across a week. This is an example, not your activity history."><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs><path className="st-chart-grid" d="M30 25H600M30 75H600M30 125H600M30 175H600" /><path d="M35 146C80 146 85 98 125 105S185 151 220 125 270 78 315 85 365 108 410 61 465 94 505 53 550 67 595 20V175H35Z" fill={`url(#${gradientId})`} /><path d="M35 146C80 146 85 98 125 105S185 151 220 125 270 78 315 85 365 108 410 61 465 94 505 53 550 67 595 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />{[[35, 146], [125, 105], [220, 125], [315, 85], [410, 61], [505, 53], [595, 20]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" fill="var(--st-surface, white)" stroke="currentColor" strokeWidth="2" />)}</svg><div className="st-chart-days">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><p className="st-chart-disclaimer">Example only. Your current draft word counts are shown below; this chart does not track your activity.</p></div>
}

export function HistoryPage() {
  const { essays, setActiveEssayId, updateEssay, showToast, basePath, completedLessons } = useStudent()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'essays' | 'progress'>('essays')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated')
  const filteredEssays = essays.filter(essay => (status === 'all' || essay.status === status) && `${essay.title} ${essay.subject} ${essay.type}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf())
  const totalWords = essays.reduce((total, essay) => total + countWords(essay.content), 0)
  const completeCount = essays.filter(essay => essay.status === 'complete').length
  const reviewedCount = essays.filter(essay => essay.status === 'reviewed' || essay.status === 'complete').length
  const openEssay = (id: string) => { setActiveEssayId(id); navigate(`${basePath}/editor/${id}`) }

  return <div className="st-journey st-history">
    <header className="st-journey-page-heading"><div><span className="st-journey-eyebrow">YOUR WRITING JOURNEY</span><h1>A place for every draft.</h1><p>Ideas in progress, lessons along the way. It all belongs here.</p></div><button className="st-btn st-btn-primary" onClick={() => navigate(`${basePath}/new`)}><span aria-hidden="true">＋</span> New essay</button></header>
    <div className="st-history-snapshot"><div><span className="st-history-stat-icon"><JourneyIcon name="file" /></span><div><strong>{essays.length.toLocaleString()}</strong><span>Essays in your workspace</span></div></div><div><span className="st-history-stat-icon green"><JourneyIcon name="pen" /></span><div><strong>{totalWords.toLocaleString()}</strong><span>Words in current drafts</span></div></div><div><span className="st-history-stat-icon amber"><JourneyIcon name="check" /></span><div><strong>{completeCount.toLocaleString()}</strong><span>Marked complete by you</span></div></div><p>YOUR LOCAL<br />WORKSPACE SNAPSHOT</p></div>
    <div className="st-history-tabs" role="tablist" aria-label="Writing history views"><button id="essays-tab" role="tab" aria-selected={tab === 'essays'} aria-controls="essays-panel" className={tab === 'essays' ? 'is-active' : ''} onClick={() => setTab('essays')}><JourneyIcon name="file" size={17} /> My essays <span>{essays.length}</span></button><button id="progress-tab" role="tab" aria-selected={tab === 'progress'} aria-controls="progress-panel" className={tab === 'progress' ? 'is-active' : ''} onClick={() => setTab('progress')}><JourneyIcon name="target" size={17} /> Writing progress</button></div>
    {tab === 'essays' ? <section id="essays-panel" role="tabpanel" aria-labelledby="essays-tab" className="st-history-collection">
      <div className="st-history-toolbar"><label className="st-history-search"><JourneyIcon name="search" size={18} /><input type="search" placeholder="Find an essay…" aria-label="Search essays by title, subject, or type" value={search} onChange={event => setSearch(event.target.value)} /></label><div><label className="st-history-select"><span className="st-sr-only">Filter by status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="complete">Complete</option></select></label><label className="st-history-select"><span className="st-sr-only">Sort essays</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="title">Title A–Z</option></select></label></div></div>
      <div className="st-history-list-heading"><span>ESSAY</span><span>DRAFT LENGTH</span><span>LAST UPDATED</span><span>STATUS</span><span /></div>
      <div className="st-history-essay-list">{filteredEssays.map(essay => {
        const wordCount = countWords(essay.content)
        const progress = essay.targetWords > 0 ? Math.min(100, wordCount / essay.targetWords * 100) : 0
        return <article key={essay.id} className="st-history-essay-row"><div className="st-history-essay-name"><span className={`st-history-document ${essay.status === 'complete' ? 'is-complete' : ''}`}><JourneyIcon name="file" size={22} /></span><div><button onClick={() => openEssay(essay.id)}>{essay.title || 'Untitled essay'}</button><p>{essay.subject || 'Your subject'}<span>·</span>{essay.type || 'Essay'}</p></div></div><div className="st-history-word-count"><strong>{wordCount.toLocaleString()} <span>/ {essay.targetWords > 0 ? essay.targetWords.toLocaleString() : '—'} words</span></strong><div aria-hidden="true"><i style={{ width: `${progress}%` }} /></div></div><div className="st-history-updated"><JourneyIcon name="clock" size={14} /><time dateTime={essay.updatedAt}>{formatDate(essay.updatedAt)}</time></div><span className={`st-history-status ${essay.status}`}>{essay.status === 'complete' && <JourneyIcon name="check" size={11} />}{essay.status === 'draft' ? 'Draft' : essay.status === 'reviewed' ? 'Reviewed' : 'Complete'}</span><div className="st-history-row-actions">{essay.status !== 'complete' && <button className="st-history-complete-button" title="Mark essay complete" aria-label={`Mark ${essay.title || 'untitled essay'} complete`} onClick={() => { updateEssay(essay.id, { status: 'complete' }); showToast('Essay marked complete. You can still open and edit it.') }}><JourneyIcon name="check" size={17} /></button>}<button className="st-history-open-button" aria-label={`Open ${essay.title || 'untitled essay'}`} onClick={() => openEssay(essay.id)}><JourneyIcon name="arrow" size={18} /></button></div></article>
      })}</div>
      {!filteredEssays.length && <div className="st-history-empty"><span><JourneyIcon name={search || status !== 'all' ? 'search' : 'pen'} size={28} /></span><h2>{essays.length ? 'A fresh search might help.' : 'Your first draft belongs here.'}</h2><p>{essays.length ? 'No essays match these filters. Try another title or see all your drafts.' : 'Start with a question, a prompt, or an idea you want to explore.'}</p><button className="st-btn st-btn-secondary" onClick={() => essays.length ? (setSearch(''), setStatus('all')) : navigate(`${basePath}/new`)}>{essays.length ? 'Clear filters' : 'Start an essay'}<JourneyIcon name="arrow" size={16} /></button></div>}
      <div className="st-history-list-footer"><span>{filteredEssays.length} of {essays.length} {essays.length === 1 ? 'essay' : 'essays'}</span><p>Your drafts stay editable, even when you mark them complete.</p></div>
    </section> : <section id="progress-panel" role="tabpanel" aria-labelledby="progress-tab" className="st-history-progress">
      <div className="st-progress-main"><ExampleProgressChart /><div className="st-progress-draft-card"><div className="st-progress-card-heading"><h2>Where your drafts are now</h2><span>CURRENT WORD COUNTS</span></div>{essays.length ? essays.slice().sort((a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf()).map(essay => <button className="st-progress-draft" key={essay.id} onClick={() => openEssay(essay.id)}><span><strong>{essay.title || 'Untitled essay'}</strong><small>{countWords(essay.content).toLocaleString()} words{essay.targetWords > 0 ? ` of a ${essay.targetWords.toLocaleString()}-word target` : ''}</small></span><i aria-hidden="true"><b style={{ width: `${essay.targetWords > 0 ? Math.min(100, countWords(essay.content) / essay.targetWords * 100) : 0}%` }} /></i><JourneyIcon name="arrow" size={17} /></button>) : <p className="st-progress-no-drafts">Start a draft to see its word count here. A few sentences are a good beginning.</p>}<p className="st-progress-footnote">Length is a planning guide, not a measure of writing quality.</p></div></div>
      <aside className="st-progress-side"><div className="st-progress-reflection"><span className="st-journey-flower" aria-hidden="true">✳</span><span className="st-journey-eyebrow">PROGRESS HAS MANY SHAPES</span><h2>A clearer idea counts, too.</h2><p>Writing isn’t a straight line. Finding a useful source, rethinking a paragraph, or knowing what to cut can all move your work forward.</p><button className="st-journey-text-button" onClick={() => navigate(`${basePath}/structure`)}>Find your next small step <JourneyIcon name="arrow" size={17} /></button></div><div className="st-progress-milestones"><h3>From your workspace</h3><div><span><JourneyIcon name="book" size={18} /> Lessons marked done</span><strong>{completedLessons.length}</strong></div><div><span><JourneyIcon name="spark" size={18} /> Reviewed or complete</span><strong>{reviewedCount}</strong></div><p>These counts reflect saved workspace actions, not measured skill improvement.</p></div></aside>
    </section>}
    <div className="st-history-bottom-note"><JourneyIcon name="book" size={18} /><p>Some days you write. Some days you work out what you think. Both are part of the process.</p></div>
  </div>
}
