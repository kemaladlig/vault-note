import { ChevronLeft, Ellipsis, FileText, X, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Menu, type MenuItem } from '@/components/ui/menu'
import { useShellStore } from '@/features/shell/store/shellStore'
import { AppMenuButton } from '@/features/shell/ui/AppMenuButton'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'
import { useMediaQuery } from '@/shared/useMediaQuery'

import { useNotesStore } from '../store/notesStore'

interface TabBarProps {
  /** Mobile: return to the note list. Renders at the head of the strip. */
  onBack?: () => void
}

/**
 * Open-note tabs above the editor. Tabs size to their content and the active tab
 * joins the editor surface (its bottom edge covers the strip's border).
 */
export function TabBar({ onBack }: TabBarProps) {
  const notes = useNotesStore((s) => s.notes)
  const openIds = useNotesStore((s) => s.openIds)
  const selectedId = useNotesStore((s) => s.selectedId)
  const select = useNotesStore((s) => s.select)
  const closeTab = useNotesStore((s) => s.closeTab)
  const closeAllTabs = useNotesStore((s) => s.closeAllTabs)
  const closeOtherTabs = useNotesStore((s) => s.closeOtherTabs)

  const splitId = useShellStore((s) => s.splitId)
  const setSplitId = useShellStore((s) => s.setSplitId)

  const t = useT()
  // From md up the top bar carries the app menu; below it the strip is the only chrome.
  const isWide = useMediaQuery('(min-width: 768px)')

  const activeRef = useRef<HTMLDivElement | null>(null)

  // Keep the active tab visible: new tabs append at the end and would otherwise
  // land outside the scrolled strip.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    activeRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [selectedId, openIds.length])

  if (openIds.length === 0) return null

  const byId = new Map(notes.map((note) => [note.id, note]))

  const menuItems: MenuItem[] = [
    {
      label: t('notes.tabs.closeOther'),
      icon: <X />,
      disabled: openIds.length < 2 || !selectedId,
      onSelect: () => {
        if (!selectedId) return
        closeOtherTabs(selectedId)
        if (splitId && splitId !== selectedId) setSplitId(undefined)
      },
    },
    {
      label: t('notes.tabs.closeAll'),
      icon: <XCircle />,
      onSelect: () => {
        closeAllTabs()
        setSplitId(undefined)
      },
    },
  ]

  return (
    <div className="flex h-11 shrink-0 items-stretch border-b bg-surface-variant/80 pr-1.5 pl-1.5">
      {/* Back sits with the tabs, not in the editor header: it reads as leaving
          the strip, the same gesture as a browser history back. */}
      {onBack && (
        <button
          type="button"
          aria-label={t('notes.editor.back')}
          title={t('notes.editor.back')}
          onClick={onBack}
          className="my-1.5 mr-1 grid size-8 shrink-0 place-items-center self-center rounded-full bg-surface/80 text-muted-foreground shadow-e1 transition-[background-color,color,transform] duration-[var(--duration-base)] hover:bg-surface hover:text-foreground active:scale-95 md:hidden"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        role="tablist"
        aria-label={t('notes.tabs.aria')}
        className="no-scrollbar flex min-w-0 flex-1 items-end gap-1 overflow-x-auto"
      >
        {openIds.map((id) => {
          const note = byId.get(id)
          const title = note?.title.trim() || t('common.untitled')
          const active = id === selectedId
          const inSplit = id === splitId
          return (
            <div
              key={id}
              ref={active ? activeRef : undefined}
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
                      active ? 'text-primary' : 'text-muted-foreground/70',
                    )}
                  />
                )}
                <span className={cn('truncate', active && 'font-medium text-primary')}>
                  {title}
                </span>
              </button>
              <button
                type="button"
                aria-label={t('notes.tabs.closeTab', { title })}
                onClick={() => {
                  if (inSplit) setSplitId(undefined)
                  closeTab(id)
                }}
                className={cn(
                  'mr-1 grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-[background-color,color,opacity] duration-[var(--duration-fast)] hover:bg-muted hover:text-foreground',
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
        {openIds.length > 1 && (
          <span className="rounded-full bg-muted/80 px-2 text-[11px] font-medium tabular-nums text-muted-foreground">
            {openIds.length}
          </span>
        )}
        <Menu
          label={t('notes.tabs.options')}
          icon={<Ellipsis className="size-4" />}
          items={menuItems}
          triggerClassName="size-7"
        />
        {!isWide && <AppMenuButton triggerClassName="size-7" />}
      </div>
    </div>
  )
}
