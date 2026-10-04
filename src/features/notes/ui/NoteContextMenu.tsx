import {
  Archive,
  ArchiveRestore,
  Columns2,
  FolderInput,
  NotebookPen,
  Pin,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'
import { useExitMotion } from '@/shared/exitMotion'

import type { DecryptedNote, NotesView } from '../model'

export interface NoteMenuAnchor {
  x: number
  y: number
}

interface NoteContextMenuProps {
  note: DecryptedNote | null
  anchor: NoteMenuAnchor | null
  view: NotesView
  onClose: () => void
  onOpen: (id: string) => void
  onTogglePin?: (id: string) => void
  onArchive?: (id: string, archived: boolean) => void
  onOpenBeside?: (id: string) => void
  onRestore?: (id: string) => void
  onDestroy?: (id: string) => void
  /** Move to trash (soft delete). */
  onRemove?: (id: string) => void
  /** Open the notebook picker. */
  onMove?: (id: string) => void
}

interface Item {
  label: string
  icon: ReactNode
  destructive?: boolean
  onSelect: () => void
}

/**
 * Long-press / right-click menu for a note row. Touch opens a bottom sheet
 * (thumb-friendly, safe-area aware); desktop opens a small cursor-anchored
 * popover. One item list drives both panels.
 */
export function NoteContextMenu({
  note,
  anchor,
  view,
  onClose,
  onOpen,
  onTogglePin,
  onArchive,
  onOpenBeside,
  onRestore,
  onDestroy,
  onRemove,
  onMove,
}: NoteContextMenuProps) {
  const t = useT()
  const open = note !== null
  const { mounted, closing } = useExitMotion(open)
  const panelRef = useRef<HTMLDivElement>(null)
  const sheetFirstRef = useRef<HTMLButtonElement>(null)
  const openedAt = useRef(0)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useEffect(() => {
    if (open) openedAt.current = Date.now()
  }, [open ])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    function onMove() {
      if (Date.now() - openedAt.current > 150) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, onClose])

  // Clamp the desktop popover to the viewport once its size is known.
  useLayoutEffect(() => {
    if (!open || !anchor) {
      setStyle({ visibility: 'hidden' })
      return
    }
    const node = panelRef.current
    if (!node) return
    const w = node.offsetWidth
    const h = node.offsetHeight
    const openUp = anchor.y + h + 12 > window.innerHeight && anchor.y - h - 12 > 0
    setStyle({
      top: openUp ? Math.max(anchor.y - h - 6, 8) : Math.min(anchor.y, window.innerHeight - h - 8),
      left: Math.min(Math.max(anchor.x, 8), window.innerWidth - w - 8),
      visibility: 'visible',
    })
  }, [open, anchor, note?.id])

  useEffect(() => {
    if (open) sheetFirstRef.current?.focus()
  }, [open ])

  if (!mounted || !note) return null

  const title = note.title.trim() || t('common.untitled')
  const items: Item[] = [{ label: t('notes.list.open'), icon: <NotebookPen />, onSelect: () => onOpen(note.id) }]

  if (view === 'trash') {
    if (onRestore) items.push({ label: t('notes.list.restore'), icon: <RotateCcw />, onSelect: () => onRestore(note.id) })
    if (onDestroy)
      items.push({ label: t('notes.list.destroy'), icon: <Trash2 />, destructive: true, onSelect: () => onDestroy(note.id) })
  } else if (view === 'archive') {
    if (onArchive)
      items.push({ label: t('notes.list.unarchive'), icon: <ArchiveRestore />, onSelect: () => onArchive(note.id, false) })
    if (onMove) items.push({ label: t('notes.editor.moveToFolder'), icon: <FolderInput />, onSelect: () => onMove(note.id) })
    if (onRemove) items.push({ label: t('notes.list.delete'), icon: <Trash2 />, onSelect: () => onRemove(note.id) })
    if (onDestroy)
      items.push({ label: t('notes.list.destroy'), icon: <Trash2 />, destructive: true, onSelect: () => onDestroy(note.id) })
  } else {
    const canSplit =
      typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches
    if (onTogglePin)
      items.push({
        label: note.pinned ? t('notes.list.unpin') : t('notes.list.pin'),
        icon: <Pin />,
        onSelect: () => onTogglePin(note.id),
      })
    if (onOpenBeside && canSplit)
      items.push({ label: t('notes.list.openBeside'), icon: <Columns2 />, onSelect: () => onOpenBeside(note.id) })
    if (onArchive)
      items.push({ label: t('notes.list.archive'), icon: <Archive />, onSelect: () => onArchive(note.id, true) })
    if (onMove) items.push({ label: t('notes.editor.moveToFolder'), icon: <FolderInput />, onSelect: () => onMove(note.id) })
    if (onRemove) items.push({ label: t('notes.list.delete'), icon: <Trash2 />, onSelect: () => onRemove(note.id) })
  }

  function choose(item: Item) {
    onClose()
    item.onSelect()
  }

  function renderItems(firstRef?: React.Ref<HTMLButtonElement>) {
    return items.map((item, index) => (
      <button
        key={item.label}
        ref={index === 0 ? firstRef : undefined}
        type="button"
        role="menuitem"
        onClick={() => choose(item)}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted active:bg-muted',
          item.destructive && 'text-destructive hover:bg-destructive/10 active:bg-destructive/10',
        )}
      >
        <span className={cn('grid size-5 shrink-0 place-items-center [&_svg]:size-4', !item.destructive && 'text-muted-foreground')}>
          {item.icon}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
      </button>
    ))
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div aria-hidden onClick={onClose} className={closing ? 'absolute inset-0 animate-fade-out bg-[var(--scrim)]' : 'absolute inset-0 animate-fade-in bg-[var(--scrim)]'} />
      {/* Mobile: bottom sheet */}
      <div
        role="menu"
        aria-label={t('notes.sidebar.itemOptions', { name: title })}
        className={cn(
          'absolute right-2 left-2 rounded-2xl border border-border/70 bg-popover p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] text-popover-foreground shadow-pop md:hidden',
          closing ? 'animate-toast-out' : 'animate-slide-up',
        )}
        style={{ bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <p className="truncate px-3 pt-1.5 pb-2 text-xs font-medium text-muted-foreground">{title}</p>
        <div className="space-y-0.5">{renderItems(sheetFirstRef)}</div>
      </div>
      {/* Desktop: cursor-anchored popover */}
      <div
        ref={panelRef}
        role="menu"
        aria-label={t('notes.sidebar.itemOptions', { name: title })}
        style={anchor ? style : { visibility: 'hidden' }}
        className={cn(
          'absolute hidden min-w-60 overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-pop md:block',
          closing ? 'pointer-events-none animate-pop-out' : 'animate-pop-in',
        )}
      >
        {renderItems()}
      </div>
    </div>,
    document.body,
  )
}
