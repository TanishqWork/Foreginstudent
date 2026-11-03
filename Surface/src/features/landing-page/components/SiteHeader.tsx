import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router'

const navigationItems = [
  { label: 'Pathways', to: '/#pathways', description: 'Choose the right review track' },
  { label: 'How it works', to: '/methodology', description: 'See how each finding is supported' },
  { label: 'Sample report', to: '/sample-report', description: 'Explore a complete assessment example' },
  { label: 'Pricing', to: '/pricing', description: 'Compare one-draft and cycle access' },
] as const

const focusClasses = 'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent'
const desktopLinkClasses = `relative py-3 text-[.84rem] font-semibold text-slate no-underline transition-colors hover:text-ink after:absolute after:inset-x-0 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform hover:after:scale-x-100 aria-[current=location]:text-accent-dark aria-[current=location]:after:scale-x-100 ${focusClasses}`
const utilityLinkClasses = `flex min-h-11 items-center justify-center rounded-[13px] border border-line bg-white/50 px-[13px] text-center text-[.78rem] font-bold text-ink no-underline transition-colors hover:bg-white ${focusClasses}`

export default function SiteHeader() {
  const location = useLocation()
  const [menuLocationKey, setMenuLocationKey] = useState<string | null>(null)
  const menuOpen = menuLocationKey === location.key
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavigationRef = useRef<HTMLElement>(null)

  const closeMenu = useCallback((restoreFocus = true) => {
    setMenuLocationKey(null)
    if (restoreFocus) menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const alreadyLocked = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    const focusFrame = window.requestAnimationFrame(() => {
      mobileNavigationRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        return
      }
      if (event.key !== 'Tab') return

      const menuButton = menuButtonRef.current
      const links = mobileNavigationRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]')
      const lastLink = links?.item(links.length - 1)
      if (!menuButton || !lastLink) return

      if (event.shiftKey && document.activeElement === menuButton) {
        event.preventDefault()
        lastLink.focus()
      } else if (!event.shiftKey && document.activeElement === lastLink) {
        event.preventDefault()
        menuButton.focus()
      }
    }

    const desktopQuery = window.matchMedia('(min-width: 1081px)')
    const handleDesktopLayout = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    desktopQuery.addEventListener('change', handleDesktopLayout)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      if (!alreadyLocked) document.body.classList.remove('overflow-hidden')
      document.removeEventListener('keydown', handleKeyDown)
      desktopQuery.removeEventListener('change', handleDesktopLayout)
    }
  }, [closeMenu, menuOpen])

  const currentSection = `${location.pathname}${location.hash}`
  const isCurrentSection = (to: string) => currentSection === to ||
    (to === '/sample-report' && location.pathname.startsWith('/sample-report/'))

  return (
    <>
      <header className="sticky top-0 z-100 grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-navy/7 bg-canvas/90 px-[clamp(15px,2.7vw,42px)] font-sans shadow-header backdrop-blur-[24px] backdrop-saturate-[145%] max-[721px]:min-h-[68px] min-[1081px]:grid-cols-[auto_1fr_auto] min-[1081px]:gap-[34px]">
        <Link
          className={`inline-flex w-fit items-center gap-[11px] text-left no-underline ${focusClasses}`}
          to="/"
          aria-label="Statement Studio home"
          onClick={() => {
            closeMenu(false)
            window.scrollTo({ top: 0 })
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/statement-lab-mark.svg`}
            alt=""
            className="size-10 shrink-0 rounded-[10px] drop-shadow-[0_8px_17px_rgba(17,19,27,.14)]"
            width="40"
            height="40"
          />
          <span className="flex flex-col leading-[1.05]">
            <span className="whitespace-nowrap text-[.98rem] font-extrabold tracking-[-.03em] text-ink max-[359px]:text-[.9rem]">Statement Studio</span>
            <span className="mt-1 hidden text-[.65rem] font-bold tracking-[.17em] text-slate uppercase min-[761px]:block">Admissions intelligence</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-[clamp(18px,2vw,32px)] justify-self-center min-[1081px]:flex" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <Link key={item.to} className={desktopLinkClasses} to={item.to} aria-current={isCurrentSection(item.to) ? 'location' : undefined}>
              {item.label}
            </Link>
          ))}
          <Link className={desktopLinkClasses} to="/account" aria-current={isCurrentSection('/account') ? 'location' : undefined}>Sign in</Link>
        </nav>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden rounded-full border border-positive/25 bg-positive/6 px-2.5 py-[7px] text-[.65rem] font-bold tracking-[.17em] whitespace-nowrap text-positive uppercase min-[1280px]:inline-flex">Private first read</span>
          <Link
            className={`hidden min-h-11 items-center justify-center rounded-control bg-accent px-[18px] text-[.9rem] font-bold tracking-[-.01em] whitespace-nowrap text-white no-underline shadow-action transition duration-200 hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-action-hover motion-reduce:transform-none motion-reduce:transition-none min-[761px]:inline-flex ${focusClasses}`}
            to="/assessment"
            onClick={() => closeMenu(false)}
          >
            Review my draft free
          </Link>
          <button
            ref={menuButtonRef}
            className={`inline-flex h-11 min-w-[88px] cursor-pointer items-center justify-center gap-2.5 rounded-full border py-0 pr-[13px] pl-[15px] transition-colors duration-200 min-[1081px]:hidden ${menuOpen ? 'border-navy bg-navy text-white shadow-[0_12px_30px_rgba(17,19,27,.2)]' : 'border-line bg-white/80 text-ink shadow-[0_8px_24px_rgba(17,19,27,.07)]'} ${focusClasses}`}
            id="menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuLocationKey(menuOpen ? null : location.key)}
          >
            <span className="text-[.8rem] font-bold tracking-[-.01em]">{menuOpen ? 'Close' : 'Menu'}</span>
            <span className="grid gap-[5px]" aria-hidden="true">
              <i className={`block h-[1.5px] w-[17px] rounded-full bg-current transition-transform duration-200 motion-reduce:transition-none ${menuOpen ? 'translate-y-[3.25px] rotate-45' : ''}`} />
              <i className={`block h-[1.5px] w-[17px] rounded-full bg-current transition-transform duration-200 motion-reduce:transition-none ${menuOpen ? '-translate-y-[3.25px] -rotate-45' : ''}`} />
            </span>
          </button>
        </div>

        <nav
          ref={mobileNavigationRef}
          className={`${menuOpen ? 'grid' : 'hidden'} absolute inset-x-2.5 top-full z-20 mt-2.5 max-h-[calc(100dvh-160px)] gap-3.5 overflow-y-auto overscroll-contain rounded-[26px] border border-accent/15 bg-[radial-gradient(circle_at_100%_0%,rgba(206,213,255,.78),transparent_18rem),linear-gradient(155deg,#fbfaf7_0%,#f1f2ff_100%)] p-5 shadow-[0_34px_90px_rgba(17,19,27,.24)] max-[420px]:gap-[11px] max-[420px]:rounded-[22px] max-[420px]:p-4 min-[1081px]:hidden`}
          id="mobile-nav"
          hidden={!menuOpen}
          aria-label="Mobile navigation"
        >
          <div className="border-b border-line px-0.5 pt-1 pb-4">
            <span className="block font-display text-[1.42rem] leading-[1.05] text-ink">Explore Statement Studio</span>
            <small className="mt-[7px] block text-[.76rem] leading-[1.45] text-slate">Graduate admissions statement assessment</small>
          </div>
          <div className="grid gap-[7px]">
            {navigationItems.map((item, index) => (
              <Link
                key={item.to}
                className={`grid min-h-16 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-[11px] rounded-2xl border border-navy/8 bg-white/70 px-[13px] py-2.5 text-left text-ink no-underline shadow-[0_7px_20px_rgba(17,19,27,.035)] transition duration-150 hover:translate-x-0.5 hover:border-accent/25 hover:bg-white aria-[current=location]:border-accent/25 aria-[current=location]:bg-white motion-reduce:transform-none motion-reduce:transition-none max-[420px]:min-h-[60px] ${focusClasses}`}
                to={item.to}
                aria-current={isCurrentSection(item.to) ? 'location' : undefined}
                onClick={() => closeMenu()}
              >
                <span className="text-[.72rem] font-extrabold tracking-[.08em] text-accent-dark">{String(index + 1).padStart(2, '0')}</span>
                <span className="grid gap-[3px]"><strong className="text-[.9rem] leading-[1.2] font-bold text-ink">{item.label}</strong><small className="text-[.72rem] leading-[1.35] font-medium text-muted">{item.description}</small></span>
                <i className="text-[.9rem] text-accent-dark not-italic" aria-hidden="true">↗</i>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link className={utilityLinkClasses} to="/pricing" onClick={() => closeMenu()}>Expert review</Link>
            <Link className={utilityLinkClasses} to="/account" aria-current={isCurrentSection('/account') ? 'location' : undefined} onClick={() => closeMenu()}>Sign in</Link>
          </div>
          <Link className={`flex min-h-[54px] items-center justify-between rounded-2xl bg-accent px-[18px] text-[.88rem] font-bold text-white no-underline shadow-action transition-colors hover:bg-accent-dark ${focusClasses}`} to="/assessment" onClick={() => closeMenu()}>
            <span>Review my draft free</span><i className="text-base not-italic" aria-hidden="true">↗</i>
          </Link>
          <p className="m-0 flex items-center justify-center gap-[7px] text-[.72rem] font-semibold text-slate"><span className="size-[7px] rounded-full bg-positive shadow-[0_0_0_4px_rgba(25,115,96,.1)]" aria-hidden="true" /> Private first read · no account required</p>
        </nav>
      </header>
      {menuOpen && createPortal(
        <button
          className="fixed inset-0 z-90 block size-full cursor-default border-0 bg-navy/30 p-0 backdrop-blur-[7px] min-[1081px]:hidden"
          id="mobile-nav-scrim"
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => closeMenu()}
        />,
        document.body,
      )}
    </>
  )
}
