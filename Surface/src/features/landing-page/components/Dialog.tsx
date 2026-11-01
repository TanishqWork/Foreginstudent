import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'

interface DialogProps {
  title: string
  eyebrow: string
  size?: 'default' | 'wide' | 'checkout'
  children: ReactNode
  onDismiss: () => void
}

/** Native modal semantics provide focus containment and inert page content. */
export function Dialog({
  title,
  eyebrow,
  size = 'default',
  children,
  onDismiss,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const widthClass = {
    default: 'max-w-[580px]',
    wide: 'max-w-[1120px]',
    checkout: 'max-w-[660px]',
  }[size]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement
    const hadScrollLock = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    dialog.showModal()

    return () => {
      dialog.close()
      if (!hadScrollLock) document.body.classList.remove('overflow-hidden')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    if (outside) onDismiss()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-auto overscroll-contain rounded-panel border-0 bg-canvas p-6 font-sans text-base leading-relaxed text-slate shadow-card backdrop:bg-navy/65 backdrop:backdrop-blur-sm sm:p-9 ${widthClass}`}
      aria-labelledby={titleId}
      data-home-dialog
      onClick={dismissFromBackdrop}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    >
      <button
        className="absolute top-2 right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-2xl text-ink transition-colors hover:bg-parchment focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
        type="button"
        aria-label="Close dialog"
        onClick={onDismiss}
      >
        ×
      </button>
      <p className="mb-4 pr-8 text-[0.68rem] font-bold tracking-[0.17em] text-accent-dark uppercase">{eyebrow}</p>
      <h2 id={titleId} className="mb-6 pr-4 font-display text-3xl leading-tight font-normal tracking-[-0.035em] text-ink sm:text-4xl">{title}</h2>
      {children}
    </dialog>
  )
}
