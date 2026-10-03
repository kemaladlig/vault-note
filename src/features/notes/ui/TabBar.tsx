import { Ellipsis, FileText, X, XCircle } from 'lucide-react'

import { Menu, type MenuItem } from '@/components/ui/menu'
import { useShellStore } from '@/features/shell/store/shellStore'
import { cn } from '@/lib/utils'

import { useNotesStore } from '../store/notesStore'

/**
 * Open-note tabs above the editor. Tabs size to their content and the active tab
 * joins the editor surface (its bottom edge covers the strip's border).
 */
export function TabBar() {
  const notes = useNotesStore((s) => s.notes)
  const openIds = useNotesStore((s) => s.openIds)
  const selectedId = useNotesStore((s) => s.selectedId)
  const select = useNotesStore((s) => s.select)
  const closeTab = useNotesStore((s) => s.closeTab)
  const closeAllTabs = useNotesStore((s) => s.closeAllTabs)
  const closeOtherTabs = useNotesStore((s) => s.closeOtherTabs)

  const splitId = useShellStore((s) => s.splitId)
  const setSplitId = useShellStore((s) => s.setSplitId)

  if (openIds.length === 0) return null

  const byId = new Map(notes.map((note) => [note.id, note]))

  const menuItems: MenuItem[] = [
    {
      label: 'Diğerlerini kapat',
      icon: <X />,
      disabled: openIds.length < 2 || !selectedId,
      onSelect: () => {
        if (!selectedId) return
        closeOtherTabs(selectedId)
        if (splitId && splitId !== selectedId) setSplitId(undefined)
      },
    },
    {
      label: 'Tüm sekmeleri kapat',
      icon: <XCircle />,
      onSelect: () => {
        closeAllTabs()
        setSplitId(undefined)
      },
    },
  ]

  return (
    <div className="flex h-11 shrink-0 items-stretch border-b bg-surface-variant/80 pr-1.5 pl-1.5">
      <div
        role="tablist"
        aria-label="Açık notlar"
        className="no-scrollbar flex min-w-0 flex-1 items-end gap-1 overflow-x-auto"
      >
        {openIds.map((id) => {
          const note = byId.get(id)
          const title = note?.title.trim() || 'Başlıksız'
          const active = id === selectedId
          const inSplit = id === splitId
          return (
            <div
              key={id}
              className={cn(
                'group flex h-9 max-w-45 shrink-0 items-center rounded-t-lg animate-tab-in',
                active
                  ? 'relative z-10 -mb-px border border-b-0 border-border bg-surface text-foreground shadow-[0_-2px_8px_-4px_rgb(23_31_54/0.16)]'
                  : 'text-muted-foreground hover:bg-surface/70',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={title}
                onClick={() => select(id)}
                className="flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 text-left text-sm"
              >
                {inSplit ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                ) : (
                  <FileText
                    className={cn(
                      'size-3.5 shrink-0',
                      active ? 'text-primary/70' : 'text-muted-foreground/70',
                    )}
                  />
                )}
                <span className={cn('truncate', active && 'font-medium')}>{title}</span>
              </button>
              <button
                type="button"
                aria-label={`${title} sekmesini kapat`}
                onClick={() => {
                  if (inSplit) setSplitId(undefined)
                  closeTab(id)
                }}
                className={cn(
                  'mr-1 grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
                  active
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                )}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-center">
        <span className="rounded-full bg-muted/80 px-2 text-[11px] font-medium tabular-nums text-muted-foreground">
          {openIds.length}
        </span>
        <Menu
          label="Sekme seçenekleri"
          icon={<Ellipsis className="size-4" />}
          items={menuItems}
          triggerClassName="size-7"
        />
      </div>
    </div>
  )
}
