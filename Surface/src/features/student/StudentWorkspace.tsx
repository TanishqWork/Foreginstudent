import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../account/auth-context'
import { StudentProvider, useStudent } from './StudentContext'
import { countWords, formatDate } from './data'
import { Badge, Button, Icon, PageHeading } from './ui'
import { NewEssayPage, EditorPage } from './pages/WritingPages'
import { StructurePage, FeedbackPage, ResearchPage } from './pages/LearningPages'
import { OnboardingPage, HistoryPage } from './pages/JourneyPages'
import AssessmentPage from '../assessment/AssessmentPage'
import CompleteReportPage from '../complete-report/CompleteReportPage'
import './student.css'

const navigation = [
  { path: '', label: 'Overview', icon: 'home', group: 'workspace' },
  { path: '/history', label: 'My essays', icon: 'file', group: 'workspace' },
  { path: '/structure', label: 'Learn to write', icon: 'book', group: 'workspace' },
  { path: '/feedback', label: 'Writing feedback', icon: 'sparkles', group: 'workspace' },
  { path: '/research', label: 'Research & citations', icon: 'bookmark', group: 'workspace' },
  { path: '/assessment', label: 'Free assessment', icon: 'checkCircle', group: 'tools' },
  { path: '/complete-report', label: 'Complete report', icon: 'file', group: 'tools' },
  { path: '/history?view=progress', label: 'My progress', icon: 'chart', group: 'tools' },
]

function PaperArtwork() {
  return <div className="st-paper-art" aria-hidden="true"><span className="st-art-orbit st-art-orbit-one"/><span className="st-art-orbit st-art-orbit-two"/><div className="st-art-paper st-art-paper-back"/><div className="st-art-paper"><span className="st-art-label">YOUR NEXT CHAPTER</span><div className="st-art-title">Ideas worth<br/>putting into words.</div><i/><i/><i/><b/><i/><i/><span className="st-art-check"><Icon name="check" size={20}/></span></div><span className="st-art-spark"><Icon name="sparkles" size={25}/></span><span className="st-art-note"><Icon name="pen" size={15}/> One paragraph at a time</span></div>
}

function OverviewPage() {
  const { profile, essays, activeEssayId, basePath, completedLessons, setActiveEssayId } = useStudent()
  const essay = essays.find((item) => item.id === activeEssayId) ?? essays[0]
  const words = essays.reduce((total, item) => total + countWords(item.content), 0)
  const progress = essay ? Math.min(100, Math.round(countWords(essay.content) / essay.targetWords * 100)) : 0
  return <div className="st-overview st-enter">
    <PageHeading eyebrow="YOUR SPACE TO GROW" title={`Welcome back, ${profile.name || 'writer'}.`} description="Good writing is a practice. You don’t have to figure it out alone." actions={<Link className="st-btn st-btn-primary" to={`${basePath}/new`}><Icon name="plus" size={18}/>New essay</Link>}/>
    <section className="st-welcome-card"><div className="st-welcome-content"><Badge tone="violet"><span className="st-dot"/>A little clarity goes a long way</Badge><h2>Your ideas.<br/><em>A little more confidence.</em></h2><p>A thoughtful space to develop your argument, find your voice, and make your next draft a little stronger.</p><Link className="st-btn st-btn-dark" to={essay ? `${basePath}/editor/${essay.id}` : `${basePath}/new`}>Let’s keep writing<Icon name="arrowRight" size={18}/></Link><span className="st-welcome-footnote"><Icon name="checkCircle" size={15}/>Your words stay yours. Always.</span></div><PaperArtwork/></section>
    <div className="st-overview-grid"><div className="st-overview-main">
      <section className="st-section"><div className="st-section-heading"><div><span className="st-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>A work in progress is a good thing.</h2></div><Link to={`${basePath}/history`} className="st-text-link">All essays<Icon name="arrowRight" size={16}/></Link></div>
        {essay && <article className="st-current-essay"><div className="st-current-essay-top"><span className="st-document-icon"><Icon name="file" size={25}/></span><Badge tone="violet">{essay.status === 'complete' ? 'Completed' : 'In progress'}</Badge></div><span className="st-eyebrow">{essay.subject} <span aria-hidden="true">/</span> {essay.type}</span><h3><Link to={`${basePath}/editor/${essay.id}`}>{essay.title}</Link></h3><p>{essay.content ? essay.content.slice(0, 152) + '…' : 'Your next idea starts with a first sentence.'}</p><div className="st-essay-progress"><div><span>{countWords(essay.content).toLocaleString()} <small>/ {essay.targetWords.toLocaleString()} words</small></span><strong>{progress}%</strong></div><span className="st-progress-track"><i style={{ width: `${progress}%` }}/></span></div><footer><span><Icon name="clock" size={14}/>Updated {formatDate(essay.updatedAt)}</span><Link className="st-btn st-btn-secondary" to={`${basePath}/editor/${essay.id}`}>Continue writing<Icon name="arrowRight" size={16}/></Link></footer></article>}
      </section>
      <section className="st-section"><div className="st-section-heading"><div><span className="st-eyebrow">SMALL LESSONS. LASTING SKILLS.</span><h2>Build confidence, one skill at a time.</h2></div><Link to={`${basePath}/structure`} className="st-text-link">Explore lessons<Icon name="arrowRight" size={16}/></Link></div><div className="st-lesson-cards"><Link to={`${basePath}/structure?lesson=thesis`} className="st-lesson-card"><span className="st-lesson-symbol st-lavender"><Icon name="target" size={23}/></span><div><span className="st-eyebrow">STRUCTURE · 5 MIN</span><h3>A thesis with a point of view</h3><p>Turn a broad topic into a clear, arguable idea.</p></div><Icon name="arrowUpRight" size={19}/></Link><Link to={`${basePath}/structure?lesson=evidence`} className="st-lesson-card"><span className="st-lesson-symbol st-sage"><Icon name="quote" size={23}/></span><div><span className="st-eyebrow">ARGUMENT · 4 MIN</span><h3>Let your evidence do more</h3><p>Connect what a source says to what you mean.</p></div><Icon name="arrowUpRight" size={19}/></Link></div></section>
      <section className="st-recent-section"><div className="st-section-heading"><h2>Your other ideas</h2><span className="st-muted">Room for every draft</span></div>{essays.filter((item) => item.id !== essay?.id).slice(0, 2).map((item) => <Link onClick={() => setActiveEssayId(item.id)} key={item.id} className="st-recent-row" to={`${basePath}/editor/${item.id}`}><span className="st-small-file"><Icon name="file" size={19}/></span><div><strong>{item.title}</strong><span>{item.subject} · {formatDate(item.updatedAt)}</span></div><Badge tone={item.status === 'complete' ? 'green' : 'neutral'}>{item.status === 'complete' ? 'Complete' : 'Ready to revisit'}</Badge><Icon name="chevronRight" size={17}/></Link>)}</section>
    </div><aside className="st-overview-aside">
      <section className="st-focus-card"><div className="st-card-kicker"><span className="st-sparkle-tile"><Icon name="sparkles" size={19}/></span><span>YOUR NEXT SMALL STEP</span></div><h3>Make your argument<br/>a little clearer.</h3><p>Try reading your thesis aloud. Does it tell your reader what you believe—and why it matters?</p><Link to={`${basePath}/structure?lesson=thesis`} className="st-text-link">Explore thesis statements<Icon name="arrowRight" size={16}/></Link><div className="st-focus-illustration" aria-hidden="true"><span>Topic</span><i/><strong>Your point of view<Icon name="sparkles" size={14}/></strong></div></section>
      <section className="st-milestones"><div className="st-section-heading"><h3>Your writing, so far</h3><Icon name="chart" size={18}/></div><p className="st-muted">A snapshot of this workspace</p><div className="st-mini-stats"><div><strong>{essays.length}</strong><span>essays started</span></div><div><strong>{words.toLocaleString()}</strong><span>words on the page</span></div><div><strong>{completedLessons.length}</strong><span>lessons completed</span></div></div><Link className="st-text-link" to={`${basePath}/history?view=progress`}>See your progress<Icon name="arrowRight" size={16}/></Link></section>
      {!profile.onboarded && <Link className="st-make-yours" to={`${basePath}/onboarding`}><span className="st-small-file"><Icon name="graduation" size={22}/></span><div><strong>Make this space yours</strong><span>Tell us how you like to learn.</span></div><Icon name="arrowUpRight" size={17}/></Link>}
    </aside></div>
    <p className="st-bottom-note"><Icon name="globe" size={16}/>Different backgrounds. Different voices. All belong here.</p>
  </div>
}

function WorkspaceShell({ demo }: { demo: boolean }) {
  const { basePath, profile, essays, activeEssayId, showToast, storageAvailable } = useStudent()
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const menuOpen = openMenuKey === location.key
  const [search, setSearch] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const editor = location.pathname.includes('/editor/')
  const currentTitle = editor ? 'Essay workspace' : location.pathname.includes('/new') ? 'New essay' : location.pathname.includes('/onboarding') ? 'A space for you' : navigation.find((item) => item.path && location.pathname.endsWith(item.path))?.label ?? 'Your workspace'
  const filteredEssays = essays.filter((essay) => `${essay.title} ${essay.subject}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        dialogRef.current?.showModal()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape') setOpenMenuKey(null)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  async function handleLogout() {
    try {
      if (session && !demo) await logout()
      try { sessionStorage.removeItem(`statement-studio:student:v1:${session?.user.id ?? 'sample'}`) } catch { /* Storage may be disabled. */ }
      navigate('/')
    } catch { showToast('We couldn’t sign you out. Please try again.') }
  }

  return <div className={`st-app ${editor ? 'st-editor-view' : ''}`}>
    <a href="#student-main" className="st-skip">Skip to content</a>
    {menuOpen && <button className="st-mobile-scrim" aria-label="Close navigation" onClick={() => setOpenMenuKey(null)}/>}
    <aside className={`st-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Student workspace navigation">
      <Link className="st-brand" to={demo ? basePath : `${basePath}/assessment`}><span className="st-brand-mark"><Icon name="pen" size={22}/></span><span>statement<span className="st-brand-light">studio</span><small>YOUR WRITING COMPANION</small></span></Link>
      {demo && <Link className="st-sidebar-new st-btn st-btn-primary" to={`${basePath}/new`}><Icon name="plus" size={18}/>Start a new essay</Link>}
      <nav aria-label="Workspace">
        {demo && <><span className="st-nav-label">WORKSPACE</span>{navigation.filter((item) => item.group === 'workspace').map((item) => <NavLink end={!item.path} key={item.path} to={`${basePath}${item.path}`} className={({ isActive }) => `st-nav-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpenMenuKey(null)}><Icon name={item.icon}/>{item.label}{!item.path && <span className="st-nav-current-dot"/>}</NavLink>)}<Link to={`${basePath}/editor/${activeEssayId}`} className={`st-nav-link ${editor ? 'is-active' : ''}`}><Icon name="pen"/>Writing workspace</Link></>}
        <span className={`st-nav-label${demo ? ' st-nav-tools' : ''}`}>{demo ? 'GROW AT YOUR PACE' : 'ASSESSMENT'}</span>
        {navigation.filter((item) => item.group === 'tools' && (demo ? item.path !== '/complete-report' : item.path === '/assessment' || item.path === '/complete-report')).map((item) => <NavLink key={item.path} to={`${basePath}${item.path}`} className={({ isActive }) => `st-nav-link ${isActive && !item.path.includes('?') ? 'is-active' : ''}`} onClick={() => setOpenMenuKey(null)}><Icon name={item.icon}/>{item.label}</NavLink>)}
      </nav>
      <div className="st-sidebar-bottom">
        {demo && <div className="st-sidebar-support"><span><Icon name="lightbulb" size={18}/></span><strong>You don’t need perfect English to have a great idea.</strong><Link to={`${basePath}/structure`}>Let’s build on it<Icon name="arrowRight" size={14}/></Link></div>}
        {demo ? <Link className="st-profile" to={`${basePath}/onboarding`}><span className="st-avatar">{(profile.name || 'W').slice(0, 1).toUpperCase()}</span><span><strong>{profile.name || 'Your workspace'}</strong><small>{profile.level} student</small></span><Icon name="settings" size={17}/></Link> : <div className="st-profile"><span className="st-avatar">{(profile.name || 'W').slice(0, 1).toUpperCase()}</span><span><strong>{profile.name || 'Your account'}</strong><small>Signed in</small></span></div>}
        <button className="st-signout" onClick={() => void handleLogout()}><Icon name="logout" size={16}/>{demo ? 'Leave sample workspace' : 'Sign out'}</button>
      </div>
    </aside>
    <div className="st-app-body"><header className="st-topbar"><div className="st-topbar-left"><button className="st-icon-button st-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setOpenMenuKey(menuOpen ? null : location.key)}><Icon name={menuOpen ? 'close' : 'menu'}/></button><span className="st-breadcrumb">My workspace<Icon name="chevronRight" size={13}/><strong>{currentTitle}</strong></span></div><div className="st-topbar-actions"><button className="st-search-trigger" onClick={() => { dialogRef.current?.showModal(); searchInputRef.current?.focus() }}><Icon name="search" size={17}/><span>Find an essay or a lesson</span><kbd>Ctrl K</kbd></button><Link className="st-help-link" to={`${basePath}/structure`} aria-label="Writing help"><Icon name="help" size={20}/></Link><Link className="st-top-avatar" to={`${basePath}/onboarding`} aria-label="Your learning preferences">{(profile.name || 'W')[0].toUpperCase()}</Link></div></header>
      <div className="st-workspace-notice"><span className="st-dot"/>{demo ? 'Explore the sample workspace' : 'Your student workspace'}<span className="st-notice-divider"/>{storageAvailable ? 'Drafts stay in this browser tab. Tutor examples are illustrative.' : 'Browser storage is unavailable. Keep this tab open to retain changes.'}{demo && <Link to="/account">Sign in<Icon name="arrowUpRight" size={12}/></Link>}</div>
      <main id="student-main" className={`st-main ${editor ? 'st-main-editor' : ''}`} tabIndex={-1}><Routes>
        <Route index element={demo ? <OverviewPage/> : <Navigate to={`${basePath}/assessment`} replace/>}/><Route path="new" element={<NewEssayPage/>}/><Route path="editor/:essayId" element={<EditorPage/>}/><Route path="structure" element={<StructurePage/>}/><Route path="lessons" element={<Navigate to={`${basePath}/structure`} replace/>}/><Route path="feedback" element={<FeedbackPage/>}/><Route path="feedback/:essayId" element={<FeedbackPage/>}/><Route path="research" element={<ResearchPage/>}/><Route path="history" element={<HistoryPage/>}/><Route path="onboarding" element={<OnboardingPage/>}/><Route path="assessment" element={<div className="st-embedded-assessment"><AssessmentPage embedded/></div>}/><Route path="complete-report" element={<CompleteReportPage/>}/><Route path="*" element={<Navigate to={basePath} replace/>}/>
      </Routes></main>
    </div>
    <dialog ref={dialogRef} className="st-command-dialog" aria-labelledby="st-search-heading" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}><div className="st-command-head"><Icon name="search"/><input ref={searchInputRef} aria-label="Search essays and lessons" placeholder="Find your next idea…" value={search} onChange={(event) => setSearch(event.target.value)}/><button className="st-icon-button" aria-label="Close search" onClick={() => dialogRef.current?.close()}><Icon name="close" size={18}/></button></div><h2 id="st-search-heading">Your essays</h2><div className="st-search-results">{filteredEssays.length ? filteredEssays.map((essay) => <button key={essay.id} onClick={() => { dialogRef.current?.close(); navigate(`${basePath}/editor/${essay.id}`) }}><Icon name="file"/><span><strong>{essay.title}</strong><small>{essay.subject}</small></span><Icon name="arrowUpRight" size={16}/></button>) : <p>No matching essays. Try another word or start a new draft.</p>}<button onClick={() => { dialogRef.current?.close(); navigate(`${basePath}/structure`) }}><Icon name="book"/><span><strong>Explore writing lessons</strong><small>Thesis statements, evidence, and essay structure</small></span><Icon name="arrowRight" size={16}/></button></div><footer><Button variant="ghost" onClick={() => { dialogRef.current?.close(); navigate(`${basePath}/new`) }}><Icon name="plus" size={16}/>Start a new essay</Button><kbd>Esc to close</kbd></footer></dialog>
  </div>
}

export default function StudentWorkspace({ demo = false }: { demo?: boolean }) {
  const { session, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (!demo && loading) return <div className="st-auth-state"><span className="st-loader"/><p>Opening your writing space…</p></div>
  if (!demo && !session && error) return <div className="st-auth-state"><h1>Let’s reconnect.</h1><p>We couldn’t check your session.</p><button className="st-btn st-btn-primary" onClick={() => void refresh()}>Try again</button></div>
  if (!demo && !session) return <Navigate to={`/account?next=${encodeURIComponent(location.pathname + location.search)}`} replace/>
  const name = demo ? 'Maya' : (session?.user.email.split('@')[0].split(/[._-]/u)[0] || 'Writer').replace(/^./u, (value) => value.toUpperCase())
  const identity = demo ? 'sample' : session!.user.id
  return <StudentProvider key={identity} identity={identity} name={name} basePath={demo ? '/workspace' : '/dashboard'}><WorkspaceShell demo={demo}/></StudentProvider>
}
