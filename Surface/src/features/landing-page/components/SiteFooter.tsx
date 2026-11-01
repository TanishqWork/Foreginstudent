import { Link } from 'react-router'

const footerLinkClasses = 'text-[.84rem] font-semibold text-[#d4d6df] no-underline transition-colors hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent'

export default function SiteFooter() {
  return (
    <footer className="bg-navy bg-[radial-gradient(circle_at_8%_0%,rgba(87,88,232,.1),transparent_24rem)] font-sans text-white">
      <div className="mx-auto grid min-h-[150px] w-[min(1320px,calc(100%-64px))] grid-cols-1 items-center gap-5 py-[34px] max-[720px]:w-[calc(100%-32px)] min-[1181px]:grid-cols-[1fr_auto_auto] min-[1181px]:gap-10 min-[1181px]:py-0">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-lilac/50 text-[.76rem] font-extrabold tracking-[-.04em] text-white shadow-[inset_0_0_0_4px_rgba(184,192,255,.08)]" aria-hidden="true">SS</span>
          <span className="grid">
            <strong className="text-base font-bold">Statement Studio</strong>
            <small className="text-[.84rem] text-[#d4d6df]">Graduate admissions assessment system</small>
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Footer navigation">
          <Link className={footerLinkClasses} to="/#methodology">Methodology</Link>
          <Link className={footerLinkClasses} to="/?panel=privacy">Privacy and standards</Link>
          <Link className={footerLinkClasses} to="/#pricing">Pricing</Link>
          <Link className={footerLinkClasses} to="/?panel=account">Access my account</Link>
        </nav>
        <p className="m-0 text-[.84rem] text-[#d4d6df]">Writing guidance only. No admission guarantee.</p>
      </div>
    </footer>
  )
}
