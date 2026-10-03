import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

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

/** A small accessible dropdown: outside-click and Esc close it, focus stays manageable. */
export function Menu({ label, icon, items, align = 'end', triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1.5 min-w-56 origin-top rounded-xl border border-border/70 bg-popover p-1.5 shadow-pop animate-pop-in',
            align === 'end' ? 'right-0' : 'left-0',
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
        </div>
      )}
    </div>
  )
}
