import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Dialog } from './Dialog'
import { plans } from '../homepage.data'

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
    const pathway = searchParams.get('pathway')
    const next = new URLSearchParams()
    if (pathway) next.set('pathway', pathway)
    return <Navigate to={{ pathname: '/assessment', search: next.size ? `?${next.toString()}` : '' }} replace />
  }

  if (panel === 'account') {
    return <Navigate to="/account" replace />
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
