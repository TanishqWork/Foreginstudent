import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { brandLogoPath } from '../../brand'
import StatementLoader from '../shared/StatementLoader'
import { useAuth } from '../account/auth-context'
import AssessmentPage from '../assessment/AssessmentPage'
import CompleteReportPage from '../complete-report/CompleteReportPage'
import HistoryPage from '../history/HistoryPage'
import { Icon } from './ui'
import './student.css'

const navigation = [
  { path: '/assessment', label: 'Free assessment', icon: 'checkCircle' },
  { path: '/complete-report', label: 'Complete report', icon: 'file' },
  { path: '/history', label: 'History', icon: 'clock' },
] as const

function WorkspaceShell() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const currentTitle = location.pathname.includes('/complete-report') ? 'Complete report' : location.pathname.includes('/history') ? 'History' : 'Free assessment'
  const profileName = session?.user.email.split('@')[0].split(/[._-]/u)[0] || 'Account'
  const initial = profileName.slice(0, 1).toUpperCase()

  async function handleLogout() {
    try {
      if (session) await logout()
      navigate('/')
    } catch {
      navigate('/')
    }
  }

  return <div className="st-app">
    <a href="#student-main" className="st-skip">Skip to content</a>
    <aside className="st-sidebar" aria-label="Student dashboard navigation">
      <Link className="st-brand" to="/dashboard/assessment"><img className="st-brand-mark" src={brandLogoPath} alt="" width="38" height="38"/><span>statement<span className="st-brand-light">studio</span><small>YOUR ASSESSMENT DASHBOARD</small></span></Link>
      <nav aria-label="Dashboard">
        <span className="st-nav-label">ASSESSMENT</span>
        {navigation.map((item) => <NavLink key={item.path} to={`/dashboard${item.path}`} className={({ isActive }) => `st-nav-link ${isActive ? 'is-active' : ''}`}><Icon name={item.icon}/>{item.label}</NavLink>)}
      </nav>
      <div className="st-sidebar-bottom">
        <div className="st-profile"><span className="st-avatar">{initial}</span><span><strong>{profileName}</strong><small>Signed in</small></span></div>
        <button className="st-signout" onClick={() => void handleLogout()}><Icon name="logout" size={16}/>Sign out</button>
      </div>
    </aside>
    <div className="st-app-body"><header className="st-topbar"><div className="st-topbar-left"><span className="st-breadcrumb">My dashboard<Icon name="chevronRight" size={13}/><strong>{currentTitle}</strong></span></div><div className="st-topbar-actions"><Link className="st-help-link" to="/methodology" aria-label="Assessment methodology"><Icon name="help" size={20}/></Link><span className="st-top-avatar" aria-label="Your account">{initial}</span></div></header>
      <div className="st-workspace-notice"><span className="st-dot"/><span>Your student dashboard</span><span className="st-notice-divider"/><span>Free assessments and complete reports stay tied to your signed-in session.</span></div>
      <main id="student-main" className="st-main" tabIndex={-1}><Routes>
        <Route index element={<Navigate to="/dashboard/assessment" replace/>}/>
        <Route path="assessment" element={<div className="st-embedded-assessment"><AssessmentPage embedded/></div>}/>
        <Route path="complete-report" element={<CompleteReportPage/>}/>
        <Route path="history" element={<HistoryPage/>}/>
        <Route path="*" element={<Navigate to="/dashboard/assessment" replace/>}/>
      </Routes></main>
    </div>
  </div>
}

export default function StudentWorkspace() {
  const { session, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <div className="st-auth-state"><StatementLoader className="st-auth-loader"/><p>Opening your dashboard...</p></div>
  if (!session && error) return <div className="st-auth-state"><h1>Let’s reconnect.</h1><p>We couldn’t check your session.</p><button className="st-btn st-btn-primary" onClick={() => void refresh()}>Try again</button></div>
  if (!session) return <Navigate to={`/account?next=${encodeURIComponent(location.pathname + location.search)}`} replace/>
  return <WorkspaceShell/>
}
