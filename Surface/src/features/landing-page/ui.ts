// Shared Tailwind utilities keep the landing page's spacing and controls consistent.
export const ui = {
  shell: 'mx-auto w-[calc(100%_-_64px)] max-w-[1320px] max-[720px]:w-[calc(100%_-_28px)]',
  section: 'py-[clamp(90px,9vw,142px)] max-[720px]:py-[76px]',
  overline: 'text-[.76rem] font-bold uppercase tracking-[.17em]',
  heading: 'font-display text-[clamp(2rem,3.9vw,4.4rem)] font-normal leading-[1.06] tracking-[-.025em]',
  focus: 'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent',
  button: 'inline-flex items-center justify-center gap-2.5 rounded-[14px] border border-transparent text-center text-[.9rem] font-bold no-underline transition duration-200 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none',
  primary: 'bg-accent text-white shadow-[0_16px_34px_rgba(87,88,232,.24)] hover:bg-accent-dark hover:shadow-[0_20px_46px_rgba(62,63,197,.28)]',
  textLink: 'inline-flex items-center border-b border-navy/25 py-2 text-[.9rem] font-bold no-underline transition-colors hover:border-accent hover:text-accent-dark focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none',
  darkPanel: 'bg-navy bg-[radial-gradient(circle_at_82%_0%,rgba(87,88,232,.46),transparent_32rem),radial-gradient(circle_at_10%_100%,rgba(25,115,96,.22),transparent_30rem)] text-white',
  anchor: 'scroll-mt-[98px] focus:outline-none max-[720px]:scroll-mt-[92px]',
} as const
