import { Link } from 'react-router'
import { ui } from '../ui'

const findings = [
  { title: 'Evidence that holds', quote: 'I cleaned routine referral records, verified missing entries with nurses, and presented the pattern at the district quality meeting.', explanation: 'Specific actions make the applicant’s role easy to verify.', border: 'before:bg-positive' },
  { title: 'Where confidence drops', quote: 'The program’s rigorous curriculum and global community make it the ideal place for my goals.', explanation: 'This line could be sent to almost any school. Name the training, faculty, or practicum that changes the applicant’s next step.', border: 'before:bg-coral' },
] as const

export default function HeroSection() {
  return (
    <>
      <div className="relative isolate mx-auto mt-[18px] grid min-h-[calc(100svh_-_94px)] w-[calc(100%_-_34px)] max-w-[1400px] grid-cols-[minmax(0,.92fr)_minmax(470px,1.08fr)] items-center gap-[clamp(54px,6vw,94px)] overflow-hidden rounded-[34px] border border-accent/10 bg-[radial-gradient(circle_at_88%_14%,rgba(255,255,255,.9),transparent_25rem),radial-gradient(circle_at_42%_115%,rgba(191,234,217,.6),transparent_29rem),linear-gradient(135deg,#eef0ff_0%,#dce2ff_48%,#f4f2ff_100%)] px-[clamp(28px,5vw,74px)] py-[clamp(68px,6.5vw,102px)] min-[941px]:max-[1360px]:grid-cols-[minmax(0,.9fr)_minmax(430px,1.1fr)] min-[941px]:max-[1360px]:gap-[34px] min-[941px]:max-[1360px]:p-12 max-[940px]:min-h-0 max-[940px]:grid-cols-1 max-[720px]:mt-[9px] max-[720px]:w-[calc(100%_-_18px)] max-[720px]:gap-[38px] max-[720px]:rounded-[25px] max-[720px]:px-5 max-[720px]:pt-[52px] max-[720px]:pb-[26px]">
        <div className="relative z-10 min-w-0">
          <p className={`${ui.overline} mb-6 flex items-center gap-2.5 text-[#404451] max-[720px]:text-[.72rem]`}>
            <span className="size-2 shrink-0 rounded-full bg-coral shadow-[0_0_0_5px_rgba(255,115,88,.13)]" aria-hidden="true" />
            Graduate admissions statement assessment
          </p>
          <h1 className="mb-7 max-w-[790px] font-display text-[clamp(4rem,6.1vw,6.8rem)] font-normal leading-[.91] tracking-[-.045em] text-balance text-navy min-[941px]:max-[1360px]:mb-5 min-[941px]:max-[1360px]:text-[clamp(3.7rem,5.5vw,4.75rem)] max-[940px]:text-[clamp(4rem,10vw,6.5rem)] max-[720px]:text-[clamp(3.25rem,14vw,4.7rem)] max-[720px]:leading-[.92]">Find the sentence that makes an admissions reader hesitate.</h1>
          <p className="mb-8 max-w-[680px] text-[clamp(1.05rem,1.25vw,1.2rem)] leading-[1.68] text-[#454957] min-[941px]:max-[1360px]:mb-[22px] max-[720px]:text-[1.02rem]">Paste your draft and the exact program prompt. Statement Studio marks the evidence that holds, the gaps a reader will notice, and the first revision to make.</p>
          <div className="mb-6 flex flex-wrap items-center gap-6 max-[720px]:grid max-[720px]:gap-3">
            <Link className={`${ui.button} ${ui.primary} min-h-[58px] px-[27px] max-[720px]:min-h-[52px]`} to="/assessment">Review my draft free <span aria-hidden="true">↗</span></Link>
            <Link className={`${ui.textLink} max-[720px]:justify-self-center`} to="/sample-report">Open a sample report</Link>
          </div>
          <div className="mb-[22px] flex flex-wrap gap-2 max-[720px]:grid" aria-label="Free assessment details">
            {['No account required', 'First findings in about 3 seconds', 'Writing quality, not admission odds'].map((detail) => (
              <span className="inline-flex min-h-[30px] items-center rounded-full border border-navy/10 bg-white/60 px-[11px] py-1 text-[.8rem] font-bold text-[#4c505e] before:mr-[7px] before:size-1.5 before:shrink-0 before:rounded-full before:bg-positive before:content-[''] max-[720px]:text-[.78rem]" key={detail}>{detail}</span>
            ))}
          </div>
          <p className="max-w-[650px] text-[.84rem] leading-[1.62] text-[#555967]"><strong className="text-ink">The free read is specific.</strong> You will see one strong line, the weakness creating the most doubt, and the next change to make.</p>
        </div>
        <aside className={`${ui.anchor} min-w-0 rotate-[1.2deg] overflow-hidden rounded-[27px] border border-navy/10 bg-white/95 shadow-[0_42px_100px_rgba(38,42,72,.18)] transition duration-300 hover:-translate-y-1.5 hover:rotate-0 max-[940px]:max-w-[760px] max-[720px]:rotate-0 max-[720px]:rounded-[21px] motion-reduce:transform-none motion-reduce:transition-none`} id="sample-report" tabIndex={-1} aria-label="Sample assessment extract">
          <div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-navy/10 bg-[#f6f6f8] px-5 max-[720px]:px-3.5">
            <span className="flex gap-[5px]" aria-hidden="true"><i className="size-[7px] rounded-full bg-coral" /><i className="size-[7px] rounded-full bg-[#c9cbd2]" /><i className="size-[7px] rounded-full bg-[#c9cbd2]" /></span>
            <strong className="text-center text-[.75rem] leading-tight font-bold text-[#555967]">Committee read · sample</strong>
            <em className="justify-self-end text-[.76rem] font-extrabold tracking-[.08em] text-positive uppercase not-italic">Private</em>
          </div>
          <div className="flex items-start justify-between gap-4 px-7 pt-[25px] pb-[19px] max-[720px]:px-[18px] max-[720px]:pt-5">
            <div><span className={`${ui.overline} text-accent-dark`}>MPH statement of purpose</span><h2 className="mt-[7px] text-[clamp(1.4rem,2vw,2rem)] font-semibold leading-[1.12] tracking-[-.03em] max-[720px]:text-[1.35rem]">Strong evidence. Generic program fit.</h2></div>
            <span className="shrink-0 rounded-full bg-navy px-2.5 py-[7px] text-[.8rem] font-bold text-white" aria-label="Illustrative writing quality score: 82 out of 100">82 / 100</span>
          </div>
          <div className="grid gap-[11px] px-7 pb-2 max-[720px]:px-[18px]">
            {findings.map((finding) => (
              <div className={`relative rounded-2xl border border-navy/10 bg-[#fafafd] py-[18px] pr-[19px] pl-[21px] before:absolute before:inset-y-[15px] before:left-0 before:w-[3px] before:rounded-full before:content-[''] ${finding.border}`} key={finding.title}>
                <span className="text-[.76rem] font-extrabold tracking-[.1em] text-[#555967] uppercase">{finding.title}</span>
                <blockquote className="mt-2 mb-[7px] font-display text-[1.02rem] leading-[1.38] text-[#20222a]">“{finding.quote}”</blockquote>
                <p className="text-[.82rem] leading-normal text-[#555967]">{finding.explanation}</p>
              </div>
            ))}
          </div>
          <div className="px-7 pt-3.5 pb-2 max-[720px]:px-[18px]">
            {[{ label: 'Evidence', score: 92, width: 'w-[92%]' }, { label: 'Program fit', score: 58, width: 'w-[58%]' }].map((criterion) => (
              <div className="grid grid-cols-[minmax(80px,1fr)_minmax(82px,1.3fr)_28px] items-center gap-2.5 py-[7px] text-[.78rem]" key={criterion.label}>
                <span>{criterion.label}</span><span className="h-[5px] overflow-hidden rounded-full bg-[#e9e9ef]" aria-hidden="true"><span className={`block h-full rounded-full bg-linear-to-r from-accent to-[#9aa5ff] ${criterion.width}`} /></span><span className="text-[.8rem] font-bold">{criterion.score}</span>
              </div>
            ))}
          </div>
          <div className="mx-7 mt-[13px] mb-[27px] rounded-xl border border-accent/15 bg-[#eeefff] p-4 max-[720px]:mx-[18px]">
            <span className="text-[.76rem] font-bold tracking-[.1em] text-accent-dark uppercase">First revision</span><p className="mt-[5px] text-[.82rem] leading-relaxed text-[#383c49]">Replace the generic fit paragraph with one program resource and the exact skill it would add.</p>
          </div>
        </aside>
      </div>
      <div className="mx-auto mt-3.5 w-[calc(100%_-_34px)] max-w-[1400px] overflow-hidden rounded-[22px] bg-navy bg-[radial-gradient(circle_at_88%_0%,rgba(87,88,232,.28),transparent_26rem)] max-[720px]:mt-[9px] max-[720px]:w-[calc(100%_-_18px)] max-[720px]:rounded-[19px]">
        <div className="grid min-h-36 grid-cols-[minmax(190px,.54fr)_minmax(0,1.46fr)] items-center gap-[42px] px-[clamp(28px,5vw,72px)] py-[30px] max-[940px]:grid-cols-1 max-[940px]:gap-[22px] max-[720px]:px-[22px] max-[720px]:py-[26px]">
          <div className="border-r border-white/15 pr-[34px] max-[940px]:border-r-0 max-[940px]:border-b max-[940px]:pr-0 max-[940px]:pb-[18px]"><span className="block text-[.95rem] font-bold text-white">Mentorship outcomes include</span><small className="mt-[5px] block text-[.78rem] text-white/75">Complete applicant profiles shaped each result.</small></div>
          <div className="grid grid-cols-5 items-center justify-between gap-[26px] max-[720px]:grid-cols-2 max-[720px]:gap-x-[22px] max-[720px]:gap-y-[15px]" aria-label="Universities in the supplied mentorship outcomes">
            {['Stanford', 'Harvard', 'Johns Hopkins', 'Columbia', 'Cambridge'].map((school) => <strong className="font-display text-[clamp(1.05rem,1.6vw,1.45rem)] font-normal text-white/90 max-[720px]:last:col-span-2" key={school}>{school}</strong>)}
          </div>
        </div>
      </div>
    </>
  )
}
