import type { ButtonHTMLAttributes, ReactNode } from 'react'

const iconPaths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/></>,
  book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15"/></>,
  pen: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/><path d="M14 21h7"/></>,
  sparkles: <><path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z"/><path d="M20 2v4m-2-2h4"/></>,
  graduation: <><path d="m2 9 10-5 10 5-10 5Zm4 3v5c4 3 8 3 12 0v-5M22 9v8"/></>,
  chart: <><path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-7"/></>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  arrowLeft: <path d="M20 12H4m6-6-6 6 6 6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronRight: <path d="m9 5 7 7-7 7"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5M8 12h12"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  file: <><path d="M14 3H5v18h14V8Zm0 0v6h5M8 13h8m-8 4h6"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  link: <><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-5-5l-2 2"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3Z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/></>,
  arrowUpRight: <path d="M6 18 18 6M6 6h12v12"/>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  lightbulb: <><path d="M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9Z"/></>,
  quote: <path d="M4 7h6v7H5c0 3 2 3 3 3m6-10h6v7h-5c0 3 2 3 3 3"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>,
  undo: <path d="M3 10h11a6 6 0 0 1 0 12M3 10l6-6m-6 6 6 6"/>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
  alignLeft: <path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>,
  list: <path d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01"/>,
  bold: <path d="M6 3h7a5 5 0 0 1 0 10H6m0-10v18h8a4 4 0 0 0 0-8"/>,
  italic: <path d="M10 3h10M4 21h10M15 3 9 21"/>,
  message: <path d="M21 4H3v13h4v5l6-5h8Z"/>,
  external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
}

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] ?? iconPaths.sparkles}</svg>
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type={type} className={`st-btn st-btn-${variant} ${className}`} {...props}/>
}

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="st-page-heading"><div>{eyebrow && <p className="st-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="st-page-description">{description}</p>}</div>{actions && <div className="st-heading-actions">{actions}</div>}</header>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'violet' | 'green' | 'amber' | 'neutral' }) {
  return <span className={`st-badge st-badge-${tone}`}>{children}</span>
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="st-empty"><span className="st-empty-icon"><Icon name="file" size={30}/></span><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>
}
