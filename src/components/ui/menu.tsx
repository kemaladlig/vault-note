import { Check } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

import { Button } from './button'

export type MenuItem =
  | {
      type?: 'item'
      label: string
      icon?: ReactNode
      onSelect: () => void
      destructive?: boolean
      disabled?: boolean
      selected?: boolean
      shortcut?: string
    }
  | { type: 'separator' }

interface MenuProps {
  label: string
  icon: ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  triggerClassName?: string
}

/**
 * Accessible dropdown portal-ed to <body>: outside-click and Esc close it, and it
 * flips/clamps at the viewport edges. Portal is required because triggers live in
 * scrolling sidebars where an absolutely positioned panel would be clipped.
 */
export function Menu({ label, icon, items, align = 'end', triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const openedAt = useRef(0)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    // Any scroll or resize detaches the panel from its trigger — close instead of drifting.
    // The click that opened the menu may itself scroll the trigger into view; ignore that.
    function onMove() {
      if (Date.now() - openedAt.current > 150) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  // Position after the panel mounts so its real size can flip the placement.
  useLayoutEffect(() => {
    if (!open) return
    const trigger = root.current?.firstElementChild
    const node = panel.current
    if (!trigger || !node) return
    const r = trigger.getBoundingClientRect()
    const w = node.offsetWidth
    const h = node.offsetHeight
    const openUp = r.bottom + h + 12 > window.innerHeight && r.top - h - 12 > 0
    const rawLeft = align === 'end' ? r.right - w : r.left
    const left = Math.min(Math.max(rawLeft, 8), window.innerWidth - w - 8)
    setStyle({
      top: openUp ? r.top - h - 6 : r.bottom + 6,
      left,
      transformOrigin: openUp ? 'bottom center' : 'top center',
      visibility: 'visible',
    })
  }, [open, align, items])

  return (
    <div ref={root} className="relative">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
        onClick={() => {
          openedAt.current = Date.now()
          setOpen((value) => !value)
        }}
      >
        {icon}
      </Button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={style}
            className={cn(
              'fixed z-[70] min-w-56 overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 shadow-pop animate-pop-in',
              style.transformOrigin === 'bottom center' && 'origin-bottom',
            )}
          >
            {items.map((item, index) =>
              item.type === 'separator' ? (
                <div key={index} className="my-1.5 h-px bg-border/80" />
              ) : (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn(
                    'group/menuitem flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
                    item.destructive && 'text-destructive hover:bg-destructive/10',
                  )}
                >
                  {item.icon && (
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center transition-transform group-hover/menuitem:scale-110',
                        item.destructive ? 'shrink-0' : 'text-muted-foreground',
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.selected && <Check className="size-4 shrink-0 text-primary" />}
                  {item.shortcut && (
                    <span className="shrink-0 text-xs text-muted-foreground">{item.shortcut}</span>
                  )}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
