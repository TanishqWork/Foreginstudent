import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Dialog } from './Dialog'
import { pathways, plans } from '../homepage.data'

/** The homepage keeps excluded product flows explicit without collecting data. */
export default function HomeDialogs() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const panel = searchParams.get('panel')

  function dismiss() {
    const next = new URLSearchParams(searchParams)
    for (const key of ['panel', 'plan', 'pathway']) next.delete(key)
    navigate({
      pathname: location.pathname,
      search: next.size ? `?${next.toString()}` : '',
      hash: location.hash,
    }, { replace: true, preventScrollReset: true })
  }

  const returnButton = (
    <button className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-control bg-accent px-6 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none" type="button" onClick={dismiss}>
      Return to the homepage
    </button>
  )

  if (panel === 'outcomes') {
    return (
      <Dialog
        key={panel}
        title="Outcomes gallery layout preview."
        eyebrow="Private preview"
        size="wide"
        onDismiss={dismiss}
      >
        <p className="mb-6 text-sm leading-relaxed text-slate">
          No verified offer documents are included in this preview. The examples
          below demonstrate the gallery layout only. Statement review does not
          guarantee admission, funding, or scholarship selection.
        </p>
        <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <figure key={index} className="m-0 min-w-0">
              <div className="flex min-h-56 flex-col justify-center gap-5 rounded-card border border-line bg-white px-6 py-9 text-ink shadow-soft">
                <strong className="text-sm tracking-[0.12em]">FICTIONAL EXAMPLE</strong>
                <p className="m-0">Sample admission document</p>
                <small className="text-xs leading-relaxed text-muted">No applicant data is included in this preview.</small>
              </div>
              <figcaption className="mt-2 text-xs text-muted">Synthetic layout placeholder</figcaption>
            </figure>
          ))}
        </div>
        {returnButton}
      </Dialog>
    )
  }

  if (panel === 'checkout') {
    const planId = searchParams.get('plan')
    const plan = plans.find((item) => item.id === planId && item.id !== 'free')

    return (
      <Dialog
        key={panel}
        title={plan?.title ?? 'Assessment access'}
        eyebrow="Package preview"
        size="checkout"
        onDismiss={dismiss}
      >
        {plan && (
          <>
            <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-line pb-6">
              <p className="m-0 text-sm">One-time payment · shown for reference</p>
              <strong className="text-4xl tracking-tight text-ink">{plan.price}</strong>
            </div>
            <p className="mb-6 rounded-card bg-parchment p-5 text-sm text-ink">{plan.description}</p>
          </>
        )}
        <p className="mb-6">Purchases are not available yet. No payment details are collected here.</p>
        {returnButton}
      </Dialog>
    )
  }

  if (panel === 'assessment') {
    const selectedPathway = pathways.find((pathway) => pathway.id === searchParams.get('pathway'))
    return (
      <Dialog
        key={panel}
        title="Your first read starts here."
        eyebrow="Statement assessment"
        onDismiss={dismiss}
      >
        {selectedPathway && <p className="mb-6 rounded-card bg-parchment p-4 text-sm text-ink"><strong>Selected pathway:</strong> {selectedPathway.title}</p>}
        <p className="mb-6">
          Draft assessments are not available yet. You can explore the sample
          assessment on the homepage while the review service is being prepared.
        </p>
        {returnButton}
      </Dialog>
    )
  }

  if (panel === 'account') {
    return (
      <Dialog
        key={panel}
        title="Account access is coming soon."
        eyebrow="Statement Studio"
        onDismiss={dismiss}
      >
        <p className="mb-6">Sign-in and saved reports are not available yet.</p>
        {returnButton}
      </Dialog>
    )
  }

  if (panel === 'privacy') {
    return (
      <Dialog
        key={panel}
        title="Your work remains yours."
        eyebrow="Privacy and standards"
        onDismiss={dismiss}
      >
        <p className="mb-6">
          This homepage does not collect statements, account credentials, or
          payment details. Assessments, account saving, and purchases are not
          enabled.
        </p>
        <p className="mb-6">
          The sample assessment and gallery documents are illustrative. Writing
          guidance does not predict admission or guarantee funding.
        </p>
        {returnButton}
      </Dialog>
    )
  }

  return null
}
