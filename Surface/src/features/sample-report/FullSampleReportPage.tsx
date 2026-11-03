import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import SiteHeader from '../landing-page/components/SiteHeader'
import SiteFooter from '../landing-page/components/SiteFooter'
import { ui } from '../landing-page/ui'
import snapshot from './sample-report.snapshot.json'

const { report, input } = snapshot
const panel = 'rounded-card border border-line bg-white p-5 shadow-soft sm:p-7'
const smallLabel = 'text-xs font-bold tracking-[.12em] uppercase'
const tones: Record<string, string> = {
  keep: 'border-positive/25 bg-mint/40 text-positive',
  refine: 'border-accent/20 bg-parchment text-accent-dark',
  rebuild: 'border-danger/25 bg-coral/10 text-danger',
}
const sections = [
  ['report-overview', 'Overview'],
  ['report-scorecard', 'Scorecard'],
  ['report-sentences', 'Sentence lab'],
  ['report-evidence', 'Evidence'],
  ['report-paragraphs', 'Paragraphs'],
  ['report-voice', 'Voice & originality'],
  ['report-priorities', 'Priorities'],
] as const

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <progress
      className="block h-2 w-full appearance-none overflow-hidden rounded-full border-0 bg-parchment [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-parchment [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-accent"
      value={value}
      max={100}
      aria-label={label}
    >
      {value}%
    </progress>
  )
}

function ReportSection({ id, number, eyebrow, title, children }: {
  id?: string
  number: string
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="scroll-mt-40 border-t border-line py-12 sm:py-16" id={id}>
      <div className="mb-8 flex items-start gap-4 sm:gap-6">
        <span className="pt-1 text-sm font-bold tracking-widest text-accent-dark" aria-hidden="true">{number}</span>
        <div>
          <p className={`${ui.overline} mb-3 text-accent-dark`}>{eyebrow}</p>
          <h2 className="max-w-[960px] font-display text-[clamp(1.8rem,3.5vw,3.4rem)] leading-tight tracking-tight">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

function TextList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate marker:text-accent">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function SentenceLab() {
  const [filter, setFilter] = useState('all')
  const [selectedIndex, setSelectedIndex] = useState(snapshot.sentenceFindings[0].index)
  const rows = report.draft.sentenceRows
  const visible = filter === 'all' ? rows : rows.filter((row) => row.cls === filter)
  const selected = visible.find((row) => row.index === selectedIndex) ?? visible[0] ?? rows[0]
  const detailRef = useRef<HTMLElement>(null)

  function selectSentence(index: number) {
    setSelectedIndex(index)
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      detailRef.current?.focus({ preventScroll: true })
    })
  }

  return (
    <ReportSection id="report-sentences" number="04" eyebrow="Sentence lab" title="Specific sentence level findings from the submitted draft">
      <p className="mb-6 max-w-3xl text-slate">Select any sentence marker to inspect the reader’s likely interpretation and the next revision. Labels identify whether to keep, refine, or rebuild a sentence.</p>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter sentence findings">
        {['all', 'keep', 'refine', 'rebuild'].map((status) => {
          const count = status === 'all' ? rows.length : report.draft.sentenceSummary[status as keyof typeof report.draft.sentenceSummary]
          return <button className={`${ui.focus} min-h-11 cursor-pointer rounded-full border px-4 py-2 text-sm font-bold capitalize transition-colors motion-reduce:transition-none ${filter === status ? 'border-navy bg-navy text-white' : 'border-line bg-white text-slate hover:bg-parchment'}`} type="button" aria-pressed={filter === status} key={status} onClick={() => setFilter(status)}>{status} <span className="ml-1 opacity-75">{count}</span></button>
        })}
      </div>
      <p className="mb-3 text-sm text-muted" role="status">Showing {visible.length} of {rows.length} sentences.</p>
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2" aria-label="Sentence quality map">
        {visible.map((row) => <button className={`${ui.focus} flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-2 text-sm ${tones[row.cls]} ${selected.index === row.index ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : ''}`} type="button" aria-label={`Sentence ${row.index}, ${row.status}, score ${row.score} out of 100`} aria-pressed={selected.index === row.index} aria-controls="selected-sentence" key={row.index} onClick={() => selectSentence(row.index)}><strong>S{row.index}</strong><span className="text-xs">{row.status}</span><span className="text-xs font-bold">{row.score}/100</span></button>)}
      </div>
      {!visible.length && <p className="mb-7 rounded-card border border-line bg-white p-6 text-slate">No sentences in this fictional draft require rebuilding.</p>}
      {!!visible.length && <article ref={detailRef} className={`${panel} scroll-mt-40 focus:outline-none`} id="selected-sentence" tabIndex={-1} aria-labelledby="selected-sentence-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold" id="selected-sentence-heading">Sentence {selected.index} · {selected.status}</h3>
          <span className={`rounded-full border px-3 py-1 text-sm font-bold ${tones[selected.cls]}`}>{selected.score}/100</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">{selected.tags.map((tag) => <span className="rounded-full bg-parchment px-3 py-1 text-xs text-accent-dark" key={tag}>{tag}</span>)}</div>
        <blockquote className="mb-6 rounded-xl border-l-4 border-accent bg-canvas p-5 font-display text-xl leading-relaxed">“{selected.text}”</blockquote>
        <div className="grid gap-6 lg:grid-cols-3">
          {[['What works', selected.whatWorks], ['What the reader may hear', selected.readerMessage], ['Revision direction', selected.guidance]].map(([title, copy]) => <div key={title}><h4 className="mb-2 text-sm font-bold text-ink">{title}</h4><p className="text-sm leading-relaxed text-slate">{copy}</p></div>)}
        </div>
      </article>}
      <details className="mt-6 rounded-card border border-line bg-white p-5">
        <summary className={`${ui.focus} cursor-pointer text-sm font-bold`}>Read all {rows.length} sentences in draft order</summary>
        <ol className="mt-5 space-y-5">
          {rows.map((row) => <li className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 border-t border-line pt-4 text-sm" key={row.index}><span className="font-bold text-accent-dark">S{row.index}</span><div><p className="mb-2 leading-relaxed">{row.text}</p><span className="text-xs font-bold text-muted">{row.status} · {row.score}/100</span></div></li>)}
        </ol>
      </details>
    </ReportSection>
  )
}

function Scorecard() {
  return (
    <ReportSection id="report-scorecard" number="01" eyebrow="Statement assessment profile" title="Performance against the selected standard">
      <div className="mb-6 flex flex-wrap gap-2 text-xs font-bold">
        {['85 to 100 · Highly developed', '70 to 84 · Credible draft', '55 to 69 · Material gaps', 'Below 55 · Rebuild'].map((label) => <span className="rounded-full border border-line bg-white px-3 py-2 text-slate" key={label}>{label}</span>)}
      </div>
      <div className="mb-6 rounded-card bg-parchment p-5 text-sm text-slate"><strong className="mb-2 block text-ink">Criterion referenced score</strong>Each dimension is assessed against explicit behavioural anchors. Open “Why this score” to see the draft evidence, the criteria met, and the change required to move up one level.</div>
      <div className="space-y-3">
        {snapshot.categories.map((category, index) => <details className="group overflow-hidden rounded-card border border-line bg-white shadow-soft" open={index === 0} key={category.key}>
          <summary className={`${ui.focus} grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 sm:p-6`}>
            <span><strong className="block text-base font-bold">{category.label}</strong><span className="mt-1 block text-xs text-slate">{category.levelLabel} · level {category.level}/4</span></span>
            <span className="text-right"><strong className="text-2xl text-accent-dark">{category.score}<small className="text-xs font-normal text-slate">/100</small></strong><span className="mt-1 block text-xs font-bold text-accent-dark">Why this score <span aria-hidden="true">⌄</span></span></span>
          </summary>
          <div className="border-t border-line p-5 sm:p-6">
            <Meter value={category.score} label={`${category.label}: ${category.score} out of 100`} />
            <p className="mt-5 mb-4 text-sm leading-relaxed text-slate">{category.why}</p>
            <blockquote className="mb-5 rounded-xl border-l-4 border-accent bg-canvas p-4 text-sm leading-relaxed">“{category.evidence}”</blockquote>
            <div className="grid gap-6 md:grid-cols-2"><div><h3 className="mb-3 text-sm font-bold">Criteria demonstrated</h3><TextList items={category.criteriaMet.slice(0, 3).length ? category.criteriaMet.slice(0, 3) : ['No criterion is fully demonstrated yet.']} /></div><div><h3 className="mb-3 text-sm font-bold">Criteria limiting the score</h3><TextList items={category.criteriaGaps.slice(0, 3).length ? category.criteriaGaps.slice(0, 3) : ['No material gap identified.']} /></div></div>
            <div className="mt-6 rounded-xl bg-parchment p-4"><span className={`${smallLabel} text-accent-dark`}>What moves this up one level</span><p className="mt-2 text-sm font-semibold text-ink">{category.nextAction}</p></div>
          </div>
        </details>)}
      </div>
    </ReportSection>
  )
}

function CoverageAndMaturity() {
  const rows = report.draft.coverageRows
  const maturity = snapshot.maturityDimension
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <ReportSection number="02" eyebrow="Prompt coverage" title="Coverage matrix">
        <p className="mb-5 text-sm font-bold text-positive">{rows.filter((row) => row.status === 'Covered').length} covered · {rows.filter((row) => row.status === 'Partial').length} partial · {rows.filter((row) => row.status === 'Missing').length} missing</p>
        <div className="divide-y divide-line rounded-card border border-line bg-white px-5">
          {rows.map((row) => <div className="flex items-start justify-between gap-4 py-4" key={row.label}><div className="min-w-0"><h3 className="text-sm font-bold">{row.label}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{row.matched.length ? `Matched: ${row.matched.join(', ')}` : 'No clear coverage detected'}</p></div><span className="shrink-0 rounded-full bg-mint/50 px-2.5 py-1 text-xs font-bold text-positive">{row.status}</span></div>)}
        </div>
        <details className="mt-5 rounded-card border border-line bg-white p-5 text-sm"><summary className={`${ui.focus} cursor-pointer font-bold`}>Read the exact fictional program prompt</summary><p className="mt-4 leading-relaxed text-slate">{input.prompt}</p></details>
      </ReportSection>
      <ReportSection number="03" eyebrow="Professional maturity" title="Readiness for the degree">
        <div className={panel}><span className="mb-4 block text-5xl font-bold tracking-tight text-accent-dark">{maturity.score}<small className="text-base font-normal text-slate">/100</small></span><h3 className="mb-3 text-lg font-bold">{maturity.levelLabel} readiness result</h3><p className="mb-6 text-sm leading-relaxed text-slate">{maturity.why} {maturity.nextAction}</p><Meter value={maturity.score} label={`Professional maturity: ${maturity.score} out of 100`} /></div>
      </ReportSection>
    </div>
  )
}

function VoiceSection() {
  const voice = report.authenticity
  const metrics = [
    ['Applicant-specific grounding', voice.metrics.grounding],
    ['Interview defensibility', voice.metrics.defensibility],
    ['Pattern load', voice.metrics.patternLoad],
    ['Sentence variation', voice.metrics.sentenceVariation],
  ] as const
  const findings = voice.findings.filter((finding) => finding.excerpt).slice(0, 6)
  return (
    <ReportSection id="report-voice" number="07" eyebrow="Voice, grounding, and originality" title="How specific, human, and defensible the writing feels">
      <div className="mb-7 rounded-card border border-accent/20 bg-parchment p-5 sm:p-7"><strong className="mb-2 block text-lg">Writing-pattern review · Not an AI detector</strong><p className="text-sm leading-relaxed text-slate">{voice.disclaimer} {voice.methodologyNote}</p></div>
      <div className="mb-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <article className={`${panel} bg-mint/30`}><span className={`${smallLabel} text-positive`}>Overall classification</span><h3 className="mt-4 mb-4 font-display text-3xl">{voice.classificationLabel}</h3><p className="text-sm leading-relaxed text-slate">{voice.why}</p></article>
        <div className="grid gap-4 sm:grid-cols-2">{metrics.map(([label, metric]) => <article className={panel} key={label}><h3 className="mb-2 text-xs font-bold text-muted">{label}</h3><strong className="mb-2 block text-xl">{metric.label}</strong><p className="mb-4 text-xs leading-relaxed text-slate">{metric.display}</p><Meter value={Math.round(metric.value * 100)} label={`${label}: ${metric.label}`} /></article>)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">{voice.categorySummaries.slice(0, 6).map((category) => <article className={panel} key={category.key}><span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-parchment text-sm font-bold text-accent-dark">{category.count}</span><h3 className="mb-3 font-bold">{category.label}</h3><p className="text-sm leading-relaxed text-slate">{category.direction}</p></article>)}</div>
      {findings.length ? <div className="mt-6 space-y-3">{findings.map((finding, index) => <details className={panel} open={index < 2} key={finding.category}><summary className={`${ui.focus} cursor-pointer font-bold`}>{finding.label}</summary><blockquote className="mt-4 mb-3 text-sm leading-relaxed">“{finding.excerpt}”</blockquote><p className="text-sm text-slate">{finding.direction}</p></details>)}</div> : <div className="mt-6 rounded-card border border-line bg-white p-5"><h3 className="mb-2 font-bold">No sentence-level pattern requires immediate revision</h3><p className="text-sm leading-relaxed text-slate">The review found no excerpt that requires immediate revision. Continue to verify that every sentence is true, specific, and defensible.</p></div>}
    </ReportSection>
  )
}

export default function FullSampleReportPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const target = document.getElementById(window.location.hash.slice(1))
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' })
    else headingRef.current?.focus({ preventScroll: true })
  }, [])

  const limitDifference = input.wordLimit - report.draft.wordCount

  return (
    <div className="min-h-svh bg-canvas text-ink selection:bg-accent/20">
      <title>Complete fictional sample report | Statement Studio</title>
      <a className={`${ui.focus} fixed top-[-100px] left-4 z-[150] rounded-lg bg-navy px-4 py-3 text-white focus:top-4`} href="#main">Skip to report</a>
      <SiteHeader />
      <main className={`${ui.shell} pb-20 focus:outline-none`} id="main" tabIndex={-1}>
        <div className="flex flex-wrap items-center justify-between gap-4 py-8">
          <Link className={`${ui.textLink} text-accent-dark`} to="/sample-report">← Return to sample overview</Link>
          <p className="text-xs text-muted">{report.draft.wordCount} words · {report.draft.paragraphCount} paragraphs · {report.criterion.statementType} · standard v{report.criterion.version}</p>
        </div>
        <aside className="mb-7 rounded-xl border border-accent/20 bg-parchment px-5 py-4 text-sm leading-relaxed text-accent-dark" role="note"><strong>Fictional sample.</strong> This report is a precomputed illustration from the handoff’s local rules. It contains no real applicant’s writing, and the score measures writing quality rather than admission probability.</aside>
        <nav className="sticky top-[74px] z-40 -mx-1 mb-10 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-canvas/95 p-2 shadow-soft backdrop-blur-xl" aria-label="Report sections">
          {sections.map(([id, label]) => <a className={`${ui.focus} shrink-0 rounded-xl px-4 py-3 text-sm font-bold text-slate no-underline transition-colors hover:bg-parchment hover:text-accent-dark motion-reduce:transition-none`} href={`#${id}`} key={id}>{label}</a>)}
        </nav>
        <section className="grid scroll-mt-40 items-center gap-8 pb-10 lg:grid-cols-[1.2fr_.8fr]" id="report-overview">
          <div><p className={`${ui.overline} mb-5 text-accent-dark`}>Complete assessment</p><h1 className="mb-6 font-display text-[clamp(2.7rem,5.5vw,5.7rem)] leading-[1.02] tracking-[-.035em] focus:outline-none" ref={headingRef} tabIndex={-1}>{input.degree} statement assessment</h1><p className="mb-6 max-w-3xl text-slate">{snapshot.context}</p><div className="inline-grid gap-1 rounded-xl border border-line bg-white px-4 py-3"><strong className="text-sm">{report.draft.confidence}</strong><span className="text-xs text-muted">Writing quality and revision readiness</span></div></div>
          <div className={`${panel} flex flex-col items-center gap-5 sm:flex-row`}>
            <div className="relative size-36 shrink-0"><svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true"><circle className="fill-none stroke-parchment" cx="60" cy="60" r="52" strokeWidth="8" /><circle className="fill-none stroke-accent" cx="60" cy="60" r="52" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${report.displayScore} 100`} /></svg><div className="absolute inset-0 grid content-center justify-items-center"><strong className="text-5xl tracking-tight">{report.displayScore}</strong><span className="text-xs text-muted">/100</span></div></div>
            <div><span className="text-xs text-muted">Overall statement score</span><strong className="mt-2 mb-3 block text-2xl">{snapshot.readiness[0]}</strong><p className="text-xs leading-relaxed text-muted">Criterion referenced score · standard v{report.criterion.version} · {report.criterion.path} path</p></div>
          </div>
        </section>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Draft snapshot">
          {[
            ['Word count', report.draft.wordCount, `${Math.abs(limitDifference)} words ${limitDifference >= 0 ? 'below' : 'above'} limit`],
            ['Paragraphs', report.draft.paragraphCount, 'Structure reviewed individually'],
            ['Evidence examples', report.draft.evidenceCount, 'Action or outcome linked'],
            ['Prompt coverage', `${report.draft.promptCoveragePercent}%`, 'Prompt dimensions assessed'],
          ].map(([label, value, note]) => <article className={panel} key={label}><h2 className="mb-3 text-xs font-bold text-muted">{label}</h2><strong className="mb-2 block text-3xl tracking-tight">{value}</strong><p className="text-xs text-muted">{note}</p></article>)}
        </div>
        <section className="mb-10 grid gap-4 lg:grid-cols-3" aria-label="Report widgets">
          <article className={panel}><h2 className={`${smallLabel} mb-5 text-accent-dark`}>Revision opportunity</h2><div className="mb-5 flex items-end justify-between gap-4"><div><span className="block text-xs text-muted">Current score</span><strong className="text-2xl">{report.displayScore}/100</strong></div><div className="text-right"><span className="block text-xs text-muted">Revision opportunity</span><strong className="text-2xl">{report.criterion.revisionOpportunity}</strong></div></div><Meter value={snapshot.widgets.revisionOpportunityWidth} label={`Revision opportunity: ${report.criterion.revisionOpportunity}`} /><p className="mt-4 text-xs leading-relaxed text-slate">{snapshot.widgets.revisionOpportunityCopy}</p></article>
          <article className={panel}><h2 className={`${smallLabel} mb-5 text-accent-dark`}>Sentence quality mix</h2><div className="grid gap-4">{(['keep', 'refine', 'rebuild'] as const).map((status) => <div key={status}><div className="mb-2 flex justify-between text-sm"><span className="font-bold capitalize">{status}</span><span>{report.draft.sentenceSummary[status]} sentences</span></div><Meter value={snapshot.widgets.sentenceMix[status]} label={`${status}: ${report.draft.sentenceSummary[status]} sentences`} /></div>)}</div></article>
          <article className={panel}><h2 className={`${smallLabel} mb-5 text-accent-dark`}>Reader confidence risk</h2><strong className="mb-4 block text-2xl">{report.draft.readerRisk.label} writing risk</strong><Meter value={report.draft.readerRisk.score} label={`Reader confidence risk: ${report.draft.readerRisk.label}`} /><p className="mt-4 text-sm leading-relaxed text-slate">{report.draft.readerRisk.copy}</p></article>
        </section>
        <section className="mb-12 rounded-panel border border-accent/15 bg-parchment p-6 sm:p-10">
          <p className={`${ui.overline} mb-4 text-accent-dark`}>Executive assessment</p><h2 className="mb-5 font-display text-4xl leading-tight">{snapshot.executive.headline}</h2><div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><p className="leading-relaxed text-slate">{snapshot.executive.summary}</p><div className="grid gap-4"><article className="rounded-xl border-l-4 border-positive bg-white/70 p-5"><h3 className="mb-2 text-xs font-bold text-positive uppercase">Strongest dimension</h3><strong className="mb-3 block text-sm">{snapshot.executive.strongestLabel}</strong><p className="text-sm leading-relaxed text-slate">{snapshot.executive.strongestCopy}</p></article><article className="rounded-xl border-l-4 border-accent bg-white/70 p-5"><h3 className="mb-2 text-xs font-bold text-accent-dark uppercase">Highest priority</h3><strong className="mb-3 block text-sm">{snapshot.executive.priorityLabel}</strong><p className="text-sm leading-relaxed text-slate">{snapshot.executive.priorityCopy}</p></article></div></div>
        </section>
        <Scorecard />
        <CoverageAndMaturity />
        <SentenceLab />
        <ReportSection id="report-evidence" number="05" eyebrow="Evidence map" title="What the draft proves and what it only claims">
          <p className="mb-6 text-slate">The excerpts below are taken directly from the fictional statement.</p>
          <div className="grid gap-5 lg:grid-cols-3">{snapshot.evidenceCards.map((card) => <article className={panel} key={card.cls}><span className={`${smallLabel} text-accent-dark`}>{card.type}</span><h3 className="mt-4 mb-5 text-lg font-bold">{card.title}</h3><blockquote className="mb-5 border-l-4 border-accent pl-4 text-sm leading-relaxed">“{card.quote}”</blockquote><p className="text-xs leading-relaxed text-slate">{card.status}</p></article>)}</div>
        </ReportSection>
        <ReportSection id="report-paragraphs" number="06" eyebrow="Paragraph assessment" title="Contribution and quality by paragraph">
          <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Paragraph scores">{snapshot.paragraphs.map((paragraph) => <div className="rounded-xl border border-line bg-white p-4 text-center" key={paragraph.index}><span className="mb-2 block text-xs text-muted">P{paragraph.index}</span><strong className="text-2xl text-accent-dark">{paragraph.score}</strong></div>)}</div>
          <div className="space-y-3">{snapshot.paragraphs.map((paragraph) => <details className="rounded-card border border-line bg-white p-5 sm:p-6" key={paragraph.index}><summary className={`${ui.focus} grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-4`}><span><strong className="mb-2 block text-sm">{String(paragraph.index).padStart(2, '0')} · {paragraph.role}</strong><span className="block text-sm leading-relaxed text-slate">{paragraph.excerpt}</span></span><strong className="text-sm text-accent-dark">{paragraph.score}/100</strong></summary><div className="mt-5 border-t border-line pt-5"><p className="mb-4 text-sm font-bold text-positive">{paragraph.status.label}</p><TextList items={paragraph.notes} /><blockquote className="mt-5 rounded-xl bg-canvas p-5 text-sm leading-relaxed text-slate">{paragraph.text}</blockquote></div></details>)}</div>
        </ReportSection>
        <VoiceSection />
        <section className="grid gap-5 border-t border-line py-12 lg:grid-cols-3" aria-label="Writing strengths and claims">
          {[['What is compelling', snapshot.lists.compelling], ['What sounds generic', snapshot.lists.generic], ['Unsupported or weak claims', snapshot.lists.unsupported]].map(([title, items]) => <div className={panel} key={title as string}><h2 className={`${smallLabel} mb-5 text-accent-dark`}>{title}</h2><TextList items={items as string[]} /></div>)}
        </section>
        <ReportSection id="report-priorities" number="08" eyebrow="Revision priorities" title="The five changes with the highest expected impact">
          <ol className="space-y-4">{report.revisionPriorities.slice(0, 5).map((priority, index) => <li className={`${panel} grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]`} key={priority.key}><span className="text-xs font-bold text-accent-dark">{index < 2 ? 'High impact' : index < 4 ? 'Medium impact' : 'Final polish'}</span><div><h3 className="mb-3 text-lg font-bold">{priority.title}</h3><p className="text-sm leading-relaxed text-slate">{priority.why} {priority.action}</p></div></li>)}</ol>
        </ReportSection>
        <div className="grid gap-10 lg:grid-cols-2">
          <ReportSection number="09" eyebrow="Edit direction" title="Cut and expand"><div className="grid gap-5"><div className={panel}><h3 className="mb-4 text-lg font-bold">Cut</h3><TextList items={snapshot.lists.cut} /></div><div className={panel}><h3 className="mb-4 text-lg font-bold">Expand</h3><TextList items={snapshot.lists.expand} /></div></div></ReportSection>
          <ReportSection number="10" eyebrow="Final sequence" title="Revision plan"><ol className="list-decimal space-y-4 pl-6 text-sm leading-relaxed text-slate marker:font-bold marker:text-accent-dark">{report.revisionPlan.slice(0, 7).map((step) => <li className="pl-2" key={step.step}>{step.instruction}</li>)}</ol></ReportSection>
        </div>
        <section className={`${ui.darkPanel} flex flex-wrap items-center justify-between gap-7 rounded-panel p-7 sm:p-10`}><div className="max-w-3xl"><p className={`${ui.overline} mb-4 text-mint`}>Fictional sample complete</p><h2 className="mb-4 font-display text-3xl leading-tight">A clear baseline for the next revision.</h2><p className="text-sm leading-relaxed text-white/80">Draft comparison, saved reports, and expert review are not enabled in this preview. This static sample preserves the findings produced by the supplied assessment rules.</p></div><Link className={`${ui.button} min-h-12 bg-white px-6 py-3 text-ink hover:bg-parchment`} to="/sample-report">Return to sample overview</Link></section>
      </main>
      <SiteFooter />
    </div>
  )
}
