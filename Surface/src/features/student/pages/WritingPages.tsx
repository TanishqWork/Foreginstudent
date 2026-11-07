import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useStudent } from '../StudentContext'
import { Icon } from '../ui'
import './WritingPages.css'

const essayTypes = [
  { type: 'Argumentative essay', icon: 'message', title: 'Make a compelling case', description: 'Take a position. Give your reader a reason to see it your way.' },
  { type: 'Literary analysis', icon: 'book', title: 'Look a little closer', description: 'Explore how a text creates meaning, one detail at a time.' },
  { type: 'Research essay', icon: 'search', title: 'Follow a good question', description: 'Bring sources into conversation and find your own perspective.' },
]

function makeStarter(type: string) {
  if (type === 'Literary analysis') return 'The question I am exploring\n[What detail, tension, or pattern in the text interests you?]\n\nMy working interpretation\n[What might this reveal about the text as a whole?]\n\nA passage to examine\n[Add a short quotation and explain how its language supports your reading.]\n\nWhy this reading matters\n[What does your interpretation help a reader notice?]'
  if (type === 'Research essay') return 'My research question\n[Write a focused question that your essay can explore.]\n\nWhat the sources suggest\n[Introduce one useful finding, with its source.]\n\nWhere I see a connection or tension\n[Explain how another perspective changes or complicates the picture.]\n\nMy working answer\n[State your own provisional answer and what still needs investigation.]'
  return 'My working claim\n[What do you want your reader to understand or believe?]\n\nA reason to take it seriously\n[Develop one reason and connect it to specific evidence.]\n\nAnother perspective\n[Consider a thoughtful objection. What can you learn from it?]\n\nWhy it matters\n[Return to your claim and explain what is at stake.]'
}

export function NewEssayPage() {
  const { createEssay, updateEssay, basePath } = useStudent()
  const navigate = useNavigate()
  const nextHeadingRef = useRef<HTMLHeadingElement>(null)
  const creatingRef = useRef(false)
  const [step, setStep] = useState(1)
  const [briefError, setBriefError] = useState('')
  const [startingPoint, setStartingPoint] = useState<'blank' | 'guided'>('blank')
  const [form, setForm] = useState({ title: '', subject: '', type: 'Argumentative essay', targetWords: 1000, prompt: '' })

  function continueToOutline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.title.trim()) {
      setBriefError('Give your essay a working title. You can change it as your idea grows.')
      event.currentTarget.querySelector<HTMLInputElement>('input')?.focus()
      return
    }
    setBriefError('')
    setStep(2)
    requestAnimationFrame(() => {
      nextHeadingRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function beginWriting() {
    if (creatingRef.current) return
    creatingRef.current = true
    const id = createEssay({ ...form, title: form.title.trim(), prompt: form.prompt.trim() })
    if (startingPoint === 'guided') updateEssay(id, { content: makeStarter(form.type) })
    navigate(`${basePath}/editor/${id}`)
  }

  return (
    <div className="st-new-essay-page">
      <Link className="st-writing-back" to={basePath}><Icon name="arrowLeft" /> Back to your dashboard</Link>
      <header className="st-writing-page-heading">
        <p className="st-writing-eyebrow">A LITTLE DIRECTION. A LOT OF POSSIBILITY.</p>
        <h1>A fresh page for your next idea.</h1>
        <p>Tell us what you’re working on. We’ll help you find a place to start.</p>
      </header>

      <ol className="st-writing-steps" aria-label="Create an essay">
        <li className={step === 1 ? 'is-current' : 'is-done'} aria-current={step === 1 ? 'step' : undefined}><span>{step > 1 ? <Icon name="check" /> : '01'}</span><div><strong>The brief</strong><small>Give your essay a direction</small></div></li>
        <li className={step === 2 ? 'is-current' : ''} aria-current={step === 2 ? 'step' : undefined}><span>02</span><div><strong>Your starting point</strong><small>A clean page or a little structure</small></div></li>
      </ol>

      <div className="st-new-essay-layout">
        {step === 1 ? (
          <form className="st-writing-brief" onSubmit={continueToOutline}>
            <div className="st-writing-section-title"><span className="st-writing-section-icon"><Icon name="file" /></span><div><h2>What are you writing?</h2><p>A working title is more than enough.</p></div></div>
            {briefError && <p className="st-writing-form-error" role="alert">{briefError}</p>}
            <label className="st-writing-field"><span>Essay title</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. The stories cities tell about themselves" maxLength={140} required /></label>
            <div className="st-writing-field-row">
              <label className="st-writing-field"><span>Subject</span><select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required><option value="" disabled>Select a subject</option>{['English literature', 'History', 'Social sciences', 'Natural sciences', 'Business', 'Arts & humanities', 'Other'].map((subject) => <option key={subject}>{subject}</option>)}</select></label>
              <label className="st-writing-field"><span>Target word count</span><div className="st-writing-number"><input type="number" value={form.targetWords} onChange={(event) => setForm({ ...form, targetWords: Number(event.target.value) })} min={150} max={20000} step={50} required /><small>words</small></div></label>
            </div>
            <fieldset className="st-writing-type-fieldset"><legend>Choose your essay’s shape</legend><div className="st-writing-type-cards">{essayTypes.map((option) => <button key={option.type} type="button" className={form.type === option.type ? 'is-selected' : ''} aria-pressed={form.type === option.type} onClick={() => setForm({ ...form, type: option.type })}><span className="st-writing-type-icon"><Icon name={option.icon} /></span><span><strong>{option.title}</strong><small>{option.description}</small></span><span className="st-writing-radio-mark">{form.type === option.type && <Icon name="check" />}</span></button>)}</div></fieldset>
            <label className="st-writing-field st-writing-prompt-field"><span>Assignment prompt <em>Optional</em></span><textarea value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} rows={4} placeholder="Paste the assignment, a question you’re exploring, or any instructions from your teacher…" /><small>Your brief will stay close by while you write.</small></label>
            <footer className="st-writing-form-footer"><span><Icon name="checkCircle" /> Your ideas, your own words.</span><button className="st-btn st-btn-primary" type="submit">Find my starting point <Icon name="arrowRight" /></button></footer>
          </form>
        ) : (
          <section className="st-writing-brief st-writing-starting-point" aria-labelledby="starting-point-heading">
            <div className="st-writing-section-title"><span className="st-writing-section-icon"><Icon name="pen" /></span><div><h2 ref={nextHeadingRef} tabIndex={-1} id="starting-point-heading">How would you like to begin?</h2><p>There’s no right first draft. Just a first step.</p></div></div>
            <div className="st-writing-assignment-summary"><small>YOUR NEXT ESSAY</small><h3>{form.title}</h3><p>{form.subject} <span>·</span> {form.type} <span>·</span> {form.targetWords.toLocaleString()} words</p>{form.prompt && <blockquote>{form.prompt}</blockquote>}</div>
            <div className="st-writing-start-options">
              <button type="button" aria-pressed={startingPoint === 'blank'} className={startingPoint === 'blank' ? 'is-selected' : ''} onClick={() => setStartingPoint('blank')}><Icon name="file" /><strong>A fresh, clean page</strong><span>Follow your thought wherever it takes you.</span><i>{startingPoint === 'blank' && <Icon name="check" />}</i></button>
              <button type="button" aria-pressed={startingPoint === 'guided'} className={startingPoint === 'guided' ? 'is-selected' : ''} onClick={() => setStartingPoint('guided')}><Icon name="list" /><strong>A gentle starting structure</strong><span>Four guiding prompts to help your ideas take shape.</span><i>{startingPoint === 'guided' && <Icon name="check" />}</i></button>
            </div>
            {startingPoint === 'guided' && <div className="st-writing-outline-preview"><span><Icon name="lightbulb" /> A scaffold, never a script</span><p>{form.type === 'Research essay' ? 'Your question → the sources → a connection → your working answer' : form.type === 'Literary analysis' ? 'Your question → an interpretation → a close reading → why it matters' : 'Your claim → a supporting reason → another perspective → why it matters'}</p><small>Make it yours. You can move, change, or remove any part.</small></div>}
            <footer className="st-writing-form-footer"><button className="st-btn st-btn-ghost" type="button" onClick={() => setStep(1)}><Icon name="arrowLeft" /> Back to the brief</button><button className="st-btn st-btn-primary" type="button" onClick={beginWriting}>Open my writing desk <Icon name="arrowRight" /></button></footer>
          </section>
        )}

        <aside className="st-writing-start-aside">
          <div className="st-writing-encouragement"><span className="st-writing-asterisk" aria-hidden="true">✳</span><small>GOOD WRITING STARTS SOMEWHERE.</small><h2>You don’t need the perfect first sentence.</h2><p>You just need something worth thinking about. The rest comes one revision at a time.</p><div className="st-writing-pencil-line" aria-hidden="true" /><span className="st-writing-aside-signature">A little progress is still progress.</span></div>
          <div className="st-writing-promise"><Icon name="graduation" /><div><strong>A thinking partner, not a shortcut.</strong><p>Build your argument, question your choices, and grow a voice that sounds like you.</p></div></div>
        </aside>
      </div>
    </div>
  )
}

type Selection = { essayId: string; start: number; end: number; text: string }
type TutorMessage = { id: number; role: 'student' | 'guide'; text: string }
const lenses = [
  { id: 'claim', title: 'Make your claim clearer', icon: 'target', copy: 'What is the one idea you want your reader to take away? Try naming both your position and the reason behind it.' },
  { id: 'evidence', title: 'Let your evidence do more', icon: 'quote', copy: 'After each example, ask “What does this show?” Explain the connection between the detail you chose and the point you are making.' },
  { id: 'connection', title: 'Connect the next thought', icon: 'link', copy: 'How does this paragraph build on the one before it? Name the relationship: a reason, a contrast, a consequence, or a complication.' },
]

export function EditorPage() {
  const { essays, activeEssayId, updateEssay, setActiveEssayId, showToast, basePath, storageAvailable } = useStudent()
  const { essayId } = useParams()
  const essay = essays.find((item) => item.id === (essayId || activeEssayId))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messageCounter = useRef(0)
  const [focusMode, setFocusMode] = useState(false)
  const [panelTab, setPanelTab] = useState<'tutor' | 'outline'>('tutor')
  const [activeLens, setActiveLens] = useState('claim')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [undoHistory, setUndoHistory] = useState<{ essayId: string; entries: string[] }>({ essayId: '', entries: [] })
  const [question, setQuestion] = useState('')
  const [conversation, setConversation] = useState<{ essayId: string; messages: TutorMessage[] }>({ essayId: '', messages: [] })
  const [showScaffold, setShowScaffold] = useState(false)
  const wordCount = essay?.content.trim() ? essay.content.trim().split(/\s+/u).length : 0
  const selectedText = selection && selection.essayId === essay?.id ? selection.text : ''
  const history = undoHistory.essayId === essay?.id ? undoHistory.entries : []
  const paragraphs = essay?.content.split(/\n\s*\n/u).map((text) => text.trim()).filter(Boolean) || []
  const currentLens = lenses.find((lens) => lens.id === activeLens) || lenses[0]
  const messages = conversation.essayId === essay?.id ? conversation.messages : []
  const currentEssayId = essay?.id

  useEffect(() => {
    if (currentEssayId && activeEssayId !== currentEssayId) setActiveEssayId(currentEssayId)
  }, [currentEssayId, activeEssayId, setActiveEssayId])

  function changeContent(content: string) {
    if (!essay || content === essay.content) return
    setUndoHistory((current) => ({ essayId: essay.id, entries: [...(current.essayId === essay.id ? current.entries : []), essay.content].slice(-30) }))
    updateEssay(essay.id, { content, status: 'draft', feedbackScore: undefined })
    if (activeEssayId !== essay.id) setActiveEssayId(essay.id)
  }

  function selectText(start: number, end: number) {
    if (!essay) return
    const text = essay.content.slice(start, end)
    setSelection(text.trim() ? { essayId: essay.id, start, end, text } : null)
  }

  function selectPassage(text: string) {
    if (!essay) return
    const start = essay.content.indexOf(text)
    if (start < 0) return
    selectText(start, start + text.length)
    const editor = textareaRef.current
    editor?.focus()
    editor?.setSelectionRange(start, start + text.length)
    if (editor && essay.content.length) editor.scrollTop = (start / essay.content.length) * editor.scrollHeight
  }

  function addGuideMessage(text: string) {
    if (!essay) return
    messageCounter.current += 1
    const nextMessage: TutorMessage = { id: messageCounter.current, role: 'guide', text }
    setConversation((current) => ({ essayId: essay.id, messages: [...(current.essayId === essay.id ? current.messages : []), nextMessage].slice(-8) }))
  }

  function askTutor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question.trim() || !essay) return
    const asked = question.trim()
    messageCounter.current += 1
    const studentMessage: TutorMessage = { id: messageCounter.current, role: 'student', text: asked }
    const lower = asked.toLowerCase()
    const answer = /source|evidence|quote|citation/u.test(lower) ? lenses[1].copy : /paragraph|connect|structure|outline/u.test(lower) ? lenses[2].copy : /start|stuck|begin/u.test(lower) ? 'Try writing the sentence “What I am really trying to say is…” and finish it in your own words. You can remove the opening later. For now, let it help you find the idea.' : 'Try saying your idea aloud to someone who has not read the assignment. What would they need to know, and what might they question? Use that conversation to choose your next revision.'
    messageCounter.current += 1
    const guideMessage: TutorMessage = { id: messageCounter.current, role: 'guide', text: answer }
    setConversation((current) => ({ essayId: essay.id, messages: [...(current.essayId === essay.id ? current.messages : []), studentMessage, guideMessage].slice(-8) }))
    setQuestion('')
  }

  function insertStarter() {
    if (!essay) return
    const starter = makeStarter(essay.type)
    changeContent(essay.content.trim() ? `${essay.content}\n\n${starter}` : starter)
    showToast('Starting structure added. Change any part to make it yours.')
    textareaRef.current?.focus()
  }

  function applyScaffold() {
    if (!essay || !selection || selection.essayId !== essay.id || essay.content.slice(selection.start, selection.end) !== selection.text) {
      showToast('Select the sentence you want to work on first.')
      return
    }
    changeContent(`${essay.content.slice(0, selection.start)}[My specific claim], because [the reason my reader should consider it].${essay.content.slice(selection.end)}`)
    setSelection(null)
    setShowScaffold(false)
    showToast('Scaffold inserted. Add your own claim and reason, or use Undo.')
    textareaRef.current?.focus()
  }

  function undo() {
    if (!essay || !history.length) return
    updateEssay(essay.id, { content: history[history.length - 1], status: 'draft', feedbackScore: undefined })
    setUndoHistory({ essayId: essay.id, entries: history.slice(0, -1) })
    setSelection(null)
    textareaRef.current?.focus()
  }

  function editorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      setFocusMode(false)
      setPanelTab('tutor')
      addGuideMessage(selectedText ? 'Read this passage once for its claim and once for its evidence. Where does it ask the reader to make a connection that you could explain more clearly?' : 'Choose one paragraph, then ask what job it does for your argument. If it is doing several jobs, try separating its ideas.')
    }
  }

  if (!essay) return <section className="st-writing-not-found"><span><Icon name="file" /></span><h1>Find your next fresh page.</h1><p>This draft isn’t available. Start a new essay or choose one from your dashboard.</p><Link className="st-btn st-btn-primary" to={`${basePath}/new`}>Start an essay <Icon name="plus" /></Link><Link className="st-writing-back" to={basePath}>Back to dashboard</Link></section>

  return (
    <div className={`st-editor-page${focusMode ? ' st-editor-focus' : ''}`}>
      <header className="st-editor-heading"><div><Link className="st-writing-back" to={basePath}><Icon name="arrowLeft" /> Your writing desk</Link><div className="st-editor-title-row"><input aria-label="Essay title" value={essay.title} onChange={(event) => updateEssay(essay.id, { title: event.target.value, status: 'draft', feedbackScore: undefined })} placeholder="Untitled essay" maxLength={140} /><span className="st-editor-draft-badge">{essay.status === 'reviewed' ? 'Reviewed' : essay.status === 'complete' ? 'Complete' : 'Draft'}</span></div><p><span>{essay.subject}</span><span>·</span><span>{essay.type}</span></p></div><Link className="st-btn st-btn-primary" to={`${basePath}/feedback?essay=${essay.id}`} onClick={() => setActiveEssayId(essay.id)}><Icon name="sparkles" /> Review my draft <Icon name="arrowRight" /></Link></header>

      <div className="st-editor-grid">
        <section className="st-editor-workspace" aria-label="Essay editor">
          <div className="st-editor-toolbar"><div className="st-editor-toolbar-left"><span className="st-editor-serif-label">Aa <small>Essay</small></span><span className="st-editor-toolbar-divider" /><button className="st-icon-button" type="button" aria-label="Undo last edit" title="Undo last edit" onClick={undo} disabled={!history.length}><Icon name="undo" /></button><button className="st-editor-tool" type="button" onClick={() => { setPanelTab('outline'); setFocusMode(false) }}><Icon name="list" /> Outline</button></div><button className={`st-editor-tool${focusMode ? ' is-active' : ''}`} type="button" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}><Icon name="layout" /><span>{focusMode ? 'Leave focus' : 'Focus mode'}</span></button></div>
          {essay.prompt && <details className="st-editor-assignment"><summary><Icon name="file" /><span>Your assignment brief</span><Icon name="chevronDown" /></summary><p>{essay.prompt}</p></details>}
          <div className="st-editor-paper"><div className="st-editor-paper-overline"><span>YOUR IDEAS BELONG HERE</span><span aria-hidden="true">✦</span></div><h2>{essay.title || 'Untitled essay'}</h2><textarea ref={textareaRef} aria-label="Essay draft" value={essay.content} onChange={(event) => changeContent(event.target.value)} onSelect={(event) => selectText(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)} onKeyDown={editorKeyDown} placeholder="There’s an idea here worth exploring. Start with the part you know, even if it isn’t the beginning…" spellCheck /><div className="st-editor-paper-footer"><span className="st-editor-paper-rule" /><Icon name="pen" /><span className="st-editor-paper-rule" /></div></div>
          <footer className="st-editor-status"><span className="st-editor-saved" title={new Date(essay.updatedAt).toLocaleString()}><Icon name={storageAvailable ? 'checkCircle' : 'help'} /> {storageAvailable ? 'Saved in this tab' : 'Storage unavailable'}</span><div><span><strong>{wordCount.toLocaleString()}</strong> / {essay.targetWords.toLocaleString()} words</span><span className="st-editor-status-dot">·</span><span>{wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : 0} min read</span></div></footer>
        </section>

        {!focusMode && <aside className="st-editor-tutor" aria-label="Writing companion"><div className="st-editor-tutor-tabs" role="tablist" aria-label="Writing tools" onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'tutor' : event.key === 'End' ? 'outline' : panelTab === 'tutor' ? 'outline' : 'tutor'; setPanelTab(next); document.getElementById(`writing-${next}-tab`)?.focus() } }}><button type="button" role="tab" id="writing-tutor-tab" tabIndex={panelTab === 'tutor' ? 0 : -1} aria-selected={panelTab === 'tutor'} aria-controls="writing-tutor-panel" onClick={() => setPanelTab('tutor')}><Icon name="sparkles" /> Writing tutor</button><button type="button" role="tab" id="writing-outline-tab" tabIndex={panelTab === 'outline' ? 0 : -1} aria-selected={panelTab === 'outline'} aria-controls="writing-outline-panel" onClick={() => setPanelTab('outline')}><Icon name="list" /> Outline</button></div>
          {panelTab === 'tutor' ? <div className="st-editor-tutor-content" role="tabpanel" id="writing-tutor-panel" aria-labelledby="writing-tutor-tab">
            <div className="st-tutor-intro"><div className="st-tutor-avatar"><Icon name="sparkles" /></div><span className="st-tutor-sample-label">SAMPLE GUIDANCE</span><h2>Good writing is<br />good thinking.</h2><p>Let’s make room for yours. Select a passage or explore a question below.</p></div>
            {selectedText ? <div className="st-tutor-selected"><div><span><Icon name="quote" /> YOUR SELECTED PASSAGE</span><button className="st-icon-button" type="button" aria-label="Clear selected passage" onClick={() => { setSelection(null); setShowScaffold(false) }}><Icon name="close" /></button></div><blockquote>{selectedText}</blockquote><div className="st-tutor-selection-actions"><button type="button" onClick={() => addGuideMessage('What is this passage doing for your essay: making a claim, offering evidence, interpreting it, or connecting ideas? Name its job, then check whether its words do that job clearly.')}>Explore its purpose <Icon name="arrowUpRight" /></button><button type="button" onClick={() => setShowScaffold(!showScaffold)}>Try a thesis scaffold <Icon name="pen" /></button></div></div> : <div className="st-tutor-select-tip"><Icon name="lightbulb" /><p><strong>A closer look can help.</strong> Highlight a sentence in your draft to explore its purpose.</p></div>}
            {showScaffold && selectedText && <div className="st-tutor-scaffold"><strong>A starting shape for your own idea</strong><p>“[My specific claim], because [the reason my reader should consider it].”</p><small>This replaces your selected passage with a scaffold. Fill it with your own thinking; Undo is always available.</small><button type="button" className="st-btn st-btn-secondary" onClick={applyScaffold}>Insert this scaffold <Icon name="plus" /></button></div>}
            <div className="st-tutor-lenses"><div className="st-tutor-section-heading"><h3>One small move forward</h3><span>3 writing lenses</span></div>{lenses.map((lens) => <button className={activeLens === lens.id ? 'is-active' : ''} key={lens.id} type="button" aria-expanded={activeLens === lens.id} onClick={() => setActiveLens(lens.id)}><span className="st-tutor-lens-icon"><Icon name={lens.icon} /></span><span><strong>{lens.title}</strong>{activeLens === lens.id && <small>{lens.copy}</small>}</span><Icon name="chevronRight" /></button>)}<button className="st-tutor-try-lens" type="button" onClick={() => { if (paragraphs.length) selectPassage(paragraphs[0]); addGuideMessage(currentLens.copy) }}>Try this with my opening <Icon name="arrowRight" /></button></div>
            {!essay.content.trim() && <button className="st-tutor-starter" type="button" onClick={insertStarter}><Icon name="list" /><span><strong>A little help getting started?</strong><small>Insert four prompts to write into.</small></span><Icon name="plus" /></button>}
            {!!messages.length && <div className="st-tutor-conversation" aria-live="polite" aria-relevant="additions">{messages.map((message) => <div key={message.id} className={`st-tutor-message is-${message.role}`}><span>{message.role === 'student' ? 'You' : 'Sample writing guide'}</span><p>{message.text}</p></div>)}</div>}
            <form className="st-tutor-question" onSubmit={askTutor}><label htmlFor="writing-tutor-question">Something on your mind?</label><div><input id="writing-tutor-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How can I strengthen my argument?" maxLength={500} /><button type="submit" aria-label="Explore your writing question" disabled={!question.trim()}><Icon name="arrowRight" /></button></div><small>Sample prompts for reflection, in your own words.</small></form>
            <Link className="st-tutor-lesson" to={`${basePath}/structure`}><span><Icon name="graduation" /></span><div><small>BUILD THE SKILL</small><strong>From a topic to a thesis</strong><p>A little clarity goes a long way.</p></div><Icon name="arrowUpRight" /></Link>
          </div> : <div className="st-editor-outline-content" role="tabpanel" id="writing-outline-panel" aria-labelledby="writing-outline-tab"><div className="st-tutor-intro"><div className="st-tutor-avatar"><Icon name="list" /></div><span className="st-tutor-sample-label">THE BIG PICTURE</span><h2>Give each thought<br />a place.</h2><p>Your paragraphs, at a glance. Select one to return to that part of your draft.</p></div>{paragraphs.length ? <ol className="st-editor-paragraph-list">{paragraphs.map((paragraph, index) => <li key={`${index}-${paragraph.slice(0, 20)}`}><button type="button" onClick={() => selectPassage(paragraph)}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{index === 0 ? 'OPENING' : index === paragraphs.length - 1 && paragraphs.length > 1 ? 'LATEST THOUGHT' : 'DEVELOPING YOUR IDEAS'}</small><p>{paragraph.slice(0, 135)}{paragraph.length > 135 ? '…' : ''}</p><em>{paragraph.split(/\s+/u).length} words</em></div><Icon name="arrowUpRight" /></button></li>)}</ol> : <div className="st-editor-outline-empty"><Icon name="file" /><h3>Every argument starts with an idea.</h3><p>Write a paragraph, or use a few guiding prompts to find your way in.</p></div>}<button type="button" className="st-btn st-btn-secondary st-writing-full-button" onClick={insertStarter}><Icon name="plus" /> {paragraphs.length ? 'Add a planning scaffold' : 'Insert a starting structure'}</button><Link className="st-editor-outline-help" to={`${basePath}/structure`}>Explore essay structure <Icon name="arrowRight" /></Link></div>}
          <div className="st-editor-tutor-bottom"><Icon name="bookmark" /><span>Your voice comes first. Always.</span><Link to={`${basePath}/research`} aria-label="Open the research library"><Icon name="arrowUpRight" /></Link></div>
        </aside>}
      </div>
    </div>
  )
}
