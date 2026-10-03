import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The trigger element; the panel anchors to it. */
  anchor: ReactNode
  align?: 'start' | 'end'
  /** Accessible name for the panel (role="dialog"). */
  label?: string
  className?: string
  children: ReactNode
}

/**
 * Lightweight anchored popover (no portal): outside-click and Esc close it. Kept controlled so
 * callers can focus a field on open; positioning is relative to the trigger wrapper.
 */
export function Popover({
  open,
  onOpenChange,
  anchor,
  align = 'end',
  label,
  className,
  children,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={root} className="relative">
      {anchor}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute top-full z-50 mt-1.5 origin-top rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-pop animate-pop-in',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
