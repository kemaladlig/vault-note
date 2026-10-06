import { useEffect, useId, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Accessible dialog built on the native <dialog> element: focus trap, Esc, and inert
 * background come for free. Entrance animates; respects prefers-reduced-motion globally.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // Native <dialog> focuses itself, not the first field. Move focus into
      // the dialog so PIN / form inputs open focused (and mobile keyboards up).
      requestAnimationFrame(() => {
        const target = el.querySelector<HTMLElement>(
          '[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        )
        target?.focus({ preventScroll: true })
        target?.scrollIntoView({ block: 'nearest' })
      })
    } else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      data-slot="modal"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[min(92vw,32rem)] overflow-x-hidden overflow-y-auto rounded-2xl border border-border/70 bg-popover p-0 text-popover-foreground shadow-pop',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-5">
        {(title || description) && (
          <header className="flex gap-3">
            {icon && <div className="mt-0.5 text-primary">{icon}</div>}
            <div className="space-y-1">
              {title && (
                <h2 id={titleId} className="text-lg leading-snug font-medium">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </header>
        )}
        {children}
        {footer && <footer className="flex justify-end gap-2 pt-1">{footer}</footer>}
      </div>
    </dialog>
  )
}
