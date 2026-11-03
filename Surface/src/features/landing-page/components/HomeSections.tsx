import { Link } from 'react-router'
import { applicantStories, pathways, plans, reviewSteps, testimonials } from '../homepage.data'
import { ui } from '../ui'

function SectionHeading({ number, overline, title, description, className = '' }: {
  number: string
  overline: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <>
      <div className="text-[.8rem] font-bold tracking-[.15em] text-accent-dark max-[940px]:hidden" aria-hidden="true">{number}</div>
      <div className={`mt-6 max-w-[950px] max-[940px]:mt-0 ${className}`}>
        <p className={`${ui.overline} mb-[18px] text-accent-dark`}>{overline}</p>
        <h2 className={`${ui.heading} mb-5`}>{title}</h2>
        {description && <p className="max-w-[720px] leading-relaxed text-slate">{description}</p>}
      </div>
    </>
  )
}

const proofCard = 'flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-line p-[clamp(26px,3vw,38px)] shadow-[0_16px_46px_rgba(17,19,27,.055)] max-[720px]:min-h-[380px] max-[720px]:rounded-[20px]'
const proofTitle = 'mt-[38px] mb-3.5 max-w-[440px] font-display text-[clamp(1.75rem,2.5vw,2.6rem)] font-normal leading-[1.04] tracking-[-.025em] max-[720px]:text-[2rem]'

export function ProductProofSection() {
  return (
    <section className={`${ui.shell} ${ui.section} grid grid-cols-[66px_minmax(0,1fr)] items-start gap-[38px] max-[940px]:grid-cols-1`}>
      <SectionHeading number="01" overline="The product earns the next click" title="A first read that shows its work." className="[&_h2]:max-w-[900px] [&_h2]:text-[clamp(3rem,5.8vw,6rem)] [&_h2]:leading-[.96]" />
      <div className="col-start-2 mt-8 grid grid-cols-[1.08fr_.92fr_.92fr] gap-4 max-[1180px]:grid-cols-2 max-[940px]:col-start-1 max-[720px]:mt-[22px] max-[720px]:grid-cols-1 max-[720px]:gap-3">
        <article className={`${proofCard} ${ui.darkPanel} max-[1180px]:col-span-2 max-[720px]:col-span-1`}>
          <span className="text-[.76rem] font-extrabold tracking-[.12em] text-mint uppercase">01 · Reader confidence</span>
          <h3 className={proofTitle}>See the exact line that earns trust.</h3>
          <p className="mb-8 text-[.94rem] leading-[1.65] text-white/85">Strong actions, numbers, methods, and consequences are tied back to the applicant’s own sentences.</p>
          <div className="mt-auto rounded-[15px] border border-white/15 bg-white/8 p-[19px] text-[.88rem] leading-[1.62] text-white/90"><mark className="rounded bg-mint/25 px-[3px] py-0.5 text-white">I compared referral delays across three districts</mark> and found that transport time, not facility response, explained most missed targets.</div>
        </article>
        <article className={`${proofCard} bg-white`}>
          <span className="text-[.76rem] font-extrabold tracking-[.12em] text-[#505462] uppercase">02 · Evidence gap</span>
          <h3 className={proofTitle}>Find the claim the draft has not proved.</h3>
          <p className="mb-8 text-[.94rem] leading-[1.65] text-[#555967]">The report separates stated traits from evidence a committee can inspect.</p>
          <div className="mt-auto grid grid-cols-[1fr_auto] items-center gap-2.5">
            <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-[#ececf2]" aria-hidden="true"><div className="h-full w-[72%] rounded-full bg-linear-to-r from-accent to-[#9da7ff]" /></div>
            <b className="text-[.8rem]">Leadership claim</b><span className="text-right text-[.8rem] font-bold text-danger">One example needed</span>
          </div>
        </article>
        <article className={`${proofCard} border-accent/15 bg-sand bg-[radial-gradient(circle_at_110%_-10%,rgba(255,255,255,.9),transparent_15rem)]`}>
          <span className="text-[.76rem] font-extrabold tracking-[.12em] text-[#505462] uppercase">03 · Next revision</span>
          <h3 className={proofTitle}>Leave with a decision, not a vague score.</h3>
          <p className="mb-8 text-[.94rem] leading-[1.65] text-[#555967]">The first change is ranked by its likely effect on clarity, fit, or evidence.</p>
          <ol className="mt-auto grid gap-2">
            <li className="grid grid-cols-[46px_1fr] items-center gap-3 rounded-[13px] bg-white/75 p-3"><b className="text-[.76rem] text-accent-dark uppercase">Now</b><span className="text-[.84rem] leading-[1.45] text-[#3f4350]">Replace transferable program praise.</span></li>
            <li className="grid grid-cols-[46px_1fr] items-center gap-3 rounded-[13px] bg-white/75 p-3"><b className="text-[.76rem] text-accent-dark uppercase">Then</b><span className="text-[.84rem] leading-[1.45] text-[#3f4350]">Add the practicum and the skill it supplies.</span></li>
          </ol>
        </article>
      </div>
    </section>
  )
}

export function PathwaysSection() {
  return (
    <section className={`${ui.shell} ${ui.section} ${ui.anchor} grid grid-cols-[66px_.72fr_1.28fr] items-start gap-[38px] max-[1180px]:grid-cols-[44px_.85fr_1.15fr] max-[940px]:grid-cols-1`} id="pathways" tabIndex={-1}>
      <SectionHeading number="02" overline="Specialist pathways" title="One platform, different admissions standards." description="Each pathway changes the intake questions, review priorities, score labels, and report language." />
      <div className="border-t border-line">
        {pathways.map((pathway) => (
          <Link className={`${ui.focus} grid min-h-[104px] grid-cols-[42px_1fr_auto] items-center gap-[18px] border-b border-line px-3.5 py-6 text-left no-underline transition-all duration-200 hover:rounded-2xl hover:bg-parchment hover:px-[22px] max-[720px]:grid-cols-[32px_1fr] max-[720px]:px-1 max-[720px]:py-5 motion-reduce:transition-none`} to={`/assessment?pathway=${pathway.id}`} key={pathway.id}>
            <span className="font-bold text-accent-dark" aria-hidden="true">{pathway.index}</span>
            <span><strong className="block text-base font-bold">{pathway.title}</strong><small className="mt-[5px] block text-[.84rem] leading-normal text-slate">{pathway.description}</small></span>
            <span className="text-[.8rem] font-bold text-accent-dark max-[720px]:col-start-2">Open pathway</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function MethodSection() {
  return (
    <section className={`${ui.section} ${ui.darkPanel} ${ui.anchor}`} id="methodology" tabIndex={-1}>
      <div className={ui.shell}>
        <span className="text-[.8rem] font-bold tracking-[.15em] text-accent-soft" aria-hidden="true">03</span>
        <div className="mt-6 max-w-[950px]"><p className={`${ui.overline} mb-[18px] text-accent-soft`}>How the assessment works</p><h2 className={ui.heading}>The assessment follows a formal review sequence.</h2></div>
        <ol className="mt-14 grid grid-cols-4 border-t border-white/15 max-[1080px]:grid-cols-2 max-[720px]:grid-cols-1">
          {reviewSteps.map((step, index) => (
            <li className="min-h-[260px] border-r border-white/15 px-7 pt-[34px] pb-7 first:pl-0 last:border-r-0 max-[1080px]:border-b max-[720px]:min-h-0 max-[720px]:border-r-0 max-[720px]:px-0" key={step.title}>
              <span className="text-[.8rem] tracking-[.12em] text-mint" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-[42px] mb-3 font-display text-xl font-normal leading-tight tracking-[-.02em] max-[720px]:mt-5">{step.title}</h3>
              <p className="text-[.83rem] leading-[1.65] text-white/70">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function FounderSection() {
  return (
    <section className={`${ui.shell} ${ui.section} grid grid-cols-[minmax(320px,.85fr)_minmax(0,1.15fr)] items-center gap-[clamp(54px,8vw,120px)] max-[760px]:grid-cols-1`}>
      <div className="min-h-[520px] overflow-hidden rounded-[32px] bg-[#d9d8e4] shadow-[0_34px_80px_rgba(17,19,27,.14)] max-[760px]:min-h-[420px]"><img src={`${import.meta.env.BASE_URL}assets/framework-leadership.webp`} alt="Dr Banda Khalifa" className="h-full min-h-[520px] w-full object-cover object-[center_18%] max-[760px]:max-h-[560px] max-[760px]:min-h-[420px]" loading="lazy" decoding="async" width="900" height="1125" /></div>
      <div>
        <p className={`${ui.overline} mb-[18px] text-accent-dark`}>Framework leadership</p><h2 className={`${ui.heading} mb-6`}>Built with practitioner and admissions mentoring experience.</h2>
        <p className="mb-4 leading-[1.65] text-slate">Dr Banda Khalifa is a physician scientist, epidemiologist, global health expert, graduate admissions mentor, and Johns Hopkins trained public health and business professional.</p>
        <p className="mb-4 leading-[1.65] text-slate">The assessment framework reflects years of reviewing graduate applications and helping applicants strengthen evidence, fit, purpose, and narrative coherence.</p>
        <Link className={ui.textLink} to="/methodology">Read the methodology</Link>
      </div>
    </section>
  )
}

const testimonialCard = 'rounded-3xl border border-navy/10 bg-white shadow-[0_22px_64px_rgba(17,19,27,.065)] max-[720px]:rounded-[18px]'
const attribution = 'relative z-10 grid gap-1 text-base [&_span]:text-[.86rem] [&_span]:text-slate'

export function OutcomesSection() {
  return (
    <section className={`${ui.section} border-y border-navy/10 bg-[radial-gradient(circle_at_92%_2%,rgba(87,88,232,.11),transparent_30rem),linear-gradient(180deg,#f0eff8_0%,#f8f7f3_100%)]`} aria-labelledby="testimonial-heading">
      <div className={ui.shell}>
        <div className="mb-[52px] grid grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)] items-end gap-[clamp(36px,6vw,92px)] max-[900px]:grid-cols-1">
          <div><p className={`${ui.overline} mb-[18px] text-accent-dark`}>Statement review outcomes</p><h2 className="mt-1.5 max-w-[900px] font-display text-[clamp(2.25rem,5vw,4.8rem)] font-normal leading-[.98] tracking-[-.035em]" id="testimonial-heading">The statement is only one part of the application. It still has to make the case.</h2></div>
          <p className="text-[1.02rem] leading-[1.75] text-slate">These applicants worked with Dr Banda Khalifa on personal statements, application strategy, or both. Outcomes reflect each applicant’s complete profile and do not guarantee admission.</p>
        </div>
        <div className="grid grid-cols-[1.18fr_.82fr] items-stretch gap-6 max-[900px]:grid-cols-1">
          <article className={`${testimonialCard} relative flex min-h-[520px] flex-col justify-between overflow-hidden p-[clamp(34px,5vw,64px)] after:absolute after:-right-[90px] after:-bottom-20 after:size-60 after:rounded-full after:bg-[radial-gradient(circle,rgba(87,88,232,.15),transparent_68%)] after:content-[''] max-[900px]:min-h-0`}>
            <div className="mb-9 text-[7rem] leading-[.65] font-bold text-accent" aria-hidden="true">“</div>
            <blockquote className="max-w-[760px] text-[clamp(1.7rem,3vw,3.15rem)] leading-[1.12] tracking-[-.035em]">Dr. Banda helped shape my personal statement, optimize my CV, choose the right schools, and prepare for interviews.</blockquote>
            <div className="relative z-10 mt-[46px] mb-[30px] grid gap-1.5 border-l-[3px] border-accent pl-[18px]"><strong className="text-[1.02rem]">Admitted to Stanford, Johns Hopkins, and the University of Chicago</strong><span className="text-[.9rem] text-slate">PhD pathway</span></div>
            <footer className={attribution}><strong>Armand Jamal</strong><span>PhD student in epidemiology, University of Chicago</span></footer>
          </article>
          <div className="grid gap-6">
            {testimonials.map((testimonial) => (
              <article className={`${testimonialCard} flex min-h-[248px] flex-col justify-between p-[34px]`} key={testimonial.name}>
                <blockquote className="mb-[26px] text-[1.1rem] leading-[1.6]">“{testimonial.quote}”</blockquote>
                <div className="mb-6 flex flex-wrap gap-2">{testimonial.schools.map((school) => <span className="rounded-full bg-parchment px-2.5 py-[7px] text-[.8rem] font-bold text-accent-dark" key={school}>{school}</span>)}</div>
                <footer className={attribution}><strong>{testimonial.name}</strong><span>{testimonial.role}</span></footer>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-[18px] grid grid-cols-3 gap-[18px] max-[900px]:grid-cols-1">
          {applicantStories.map((story) => <article className={`${testimonialCard} p-7`} key={story.name}><p className="mb-6 text-base leading-[1.65]">“{story.quote}”</p><footer className={attribution}><strong>{story.name}</strong><span>{story.role}</span></footer></article>)}
        </div>
        <div className={`${ui.darkPanel} mt-14 grid grid-cols-[1.05fr_.95fr] items-center gap-11 rounded-[30px] p-[clamp(36px,6vw,68px)] shadow-[0_28px_70px_rgba(11,22,40,.16)] max-[900px]:grid-cols-1 max-[720px]:rounded-[22px]`}>
          <div>
            <p className={`${ui.overline} mb-[18px] text-[#c5cbff]`}>Applicant outcomes</p><h3 className="mt-1.5 mb-4 font-display text-[clamp(1.8rem,3.4vw,3.3rem)] font-normal leading-[1.05] tracking-[-.025em]">Real statements. Selective admissions. Documented outcomes.</h3>
            <p className="mb-4 max-w-[620px] leading-[1.7] text-white/80">Explore the supplied outcomes gallery layout. Admission and scholarship documents are fictional placeholders in this preview.</p>
            <div className="mb-5 flex flex-wrap gap-2" aria-label="Outcome highlights">
              {['Harvard presidential scholarship', 'Fully funded PhD offers', 'Cambridge scholarship', 'MPH/MBA admissions'].map((highlight) => <span className="rounded-full border border-white/20 px-3 py-1.5 text-[.78rem] text-white/90" key={highlight}>{highlight}</span>)}
            </div>
            <div className="flex flex-wrap items-center gap-4"><Link className={`${ui.button} min-h-13 bg-white px-6 text-ink hover:bg-parchment`} to="/?panel=outcomes">View selected outcomes</Link><small className="max-w-[260px] text-[.78rem] leading-normal text-white/80">Gallery preview. No university affiliation or endorsement.</small></div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl bg-white/15" aria-label="Selected outcomes">
            {[['Ivy League and Oxbridge', 'Admissions and major scholarships'], ['Fully funded doctoral offers', 'Public health and epidemiology'], ['Combined degree admissions', 'MPH/MBA and related programs']].map(([title, description], index) => (
              <article className="grid grid-cols-[32px_1fr] gap-3 bg-[#090a0f]/50 px-6 py-[22px]" key={title}><span className="text-[.78rem] text-accent-soft">{String(index + 1).padStart(2, '0')}</span><div><strong className="block text-base">{title}</strong><small className="mt-1 block text-[.8rem] text-white/80">{description}</small></div></article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function PricingSection() {
  return (
    <section className={`${ui.shell} ${ui.section} ${ui.anchor} grid grid-cols-[66px_.78fr_1.22fr] items-start gap-x-[38px] gap-y-4 max-[1180px]:grid-cols-[44px_.85fr_1.15fr] max-[940px]:grid-cols-1`} id="pricing" tabIndex={-1}>
      <SectionHeading number="04" overline="Assessment access" title="Professional review options for one draft or a complete application cycle." />
      <div className="border-t border-line">
        {plans.map((plan) => {
          const recommended = plan.id === 'cycle'
          return (
            <Link className={`${ui.focus} grid w-full grid-cols-[1fr_auto] items-center gap-[30px] border-b border-line px-2 py-[26px] text-left no-underline transition-all duration-200 hover:px-[18px] motion-reduce:transition-none ${recommended ? 'my-2.5 rounded-[22px] border-0 bg-navy bg-[radial-gradient(circle_at_92%_0%,rgba(87,88,232,.5),transparent_17rem)] px-5 py-[30px] text-white shadow-soft hover:bg-navy-soft' : 'hover:bg-parchment'}`} to={plan.id === 'free' ? '/assessment' : `/?panel=checkout&plan=${plan.id}`} key={plan.id}>
              <span>
                {recommended && <b className="mb-2 inline-block rounded-full bg-accent px-2 py-[5px] text-[.8rem] font-bold tracking-[.1em] text-white uppercase">Recommended</b>}
                <strong className="block text-[1.05rem] font-bold">{plan.title}</strong>
                <small className={`mt-1.5 block text-[.84rem] leading-normal ${recommended ? 'text-white/75' : 'text-slate'}`}>{plan.description}</small>
                <span className={`mt-2.5 inline-block text-[.8rem] font-extrabold ${recommended ? 'text-accent-soft' : 'text-accent-dark'}`}>{plan.action} <span aria-hidden="true">→</span></span>
              </span>
              <span className="text-right text-[1.8rem] font-semibold tracking-[-.04em]">{plan.id === 'complete' && <small className="mb-1 block text-[.76rem] font-bold tracking-[.08em] text-danger uppercase">Founding price</small>}{plan.price}</span>
            </Link>
          )
        })}
      </div>
      <p className="col-start-3 mt-4 text-[.84rem] leading-[1.6] text-[#555967] max-[940px]:col-start-1">Planned one-time pricing. Assessments, paid reports, and checkout are not available in this homepage preview.</p>
    </section>
  )
}

export function ClosingSection() {
  return (
    <section className={`${ui.darkPanel} py-[clamp(86px,10vw,132px)]`}>
      <div className={`${ui.shell} grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-[72px] gap-y-6 max-[760px]:grid-cols-1`}>
        <div><p className={`${ui.overline} mb-[18px] text-mint`}>Start with the draft you have</p><h2 className="max-w-[900px] font-display text-[clamp(2.8rem,5.4vw,5.6rem)] font-normal leading-[1.06] tracking-[-.025em]">Give the committee fewer reasons to hesitate.</h2></div>
        <Link className={`${ui.button} min-h-13 bg-white px-6 text-ink hover:bg-parchment max-[760px]:justify-self-start`} to="/assessment">Review my draft free</Link>
      </div>
    </section>
  )
}
