import { Archive, ArchiveRestore, Columns2, Pin, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { useT, type MessageKey } from '@/shared/i18n'
import { bucketOf, relativeTimeShort, shortDate, type DateBucket } from '@/shared/time'

import type { DecryptedNote, NotesView } from '../model'
import { matchInfo } from '../search'
import { Highlight } from './Highlight'
import { NoteContextMenu, type NoteMenuAnchor } from './NoteContextMenu'

interface NoteListProps {
  notes: DecryptedNote[]
  selectedId?: string
  onSelect: (id: string) => void
  query?: string
  view: NotesView
  /** Show a pinned section above the date groups (main view only). */
  groupPinned?: boolean
  /** Group under date headers. `false` renders one flat list (e.g. title sort). */
  grouped?: boolean
  /** Which timestamp the date buckets use. */
  dateField?: 'updatedAt' | 'createdAt'
  onTogglePin?: (id: string) => void
  onArchive?: (id: string, archived: boolean) => void
  onOpenBeside?: (id: string) => void
  onRestore?: (id: string) => void
  onDestroy?: (id: string) => void
  onRemove?: (id: string) => void
  onMove?: (id: string) => void
}

const GROUP_LABELS: Record<DateBucket, MessageKey> = {
  today: 'notes.group.today',
  yesterday: 'notes.group.yesterday',
  week: 'notes.group.week',
  older: 'notes.group.older',
}
const GROUP_ORDER: DateBucket[] = ['today', 'yesterday', 'week', 'older']

/** Rows past this index all share the last delay so long lists never feel slow. */
const STAGGER_LAST = 7

function staggerDelay(index: number): string {
  return `calc(var(--stagger-step) * ${Math.min(index, STAGGER_LAST)})`
}

function preview(body: string): string {
  // Rows show a single line, so the first non-empty line is all a row needs.
  const text = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (!text) return ''
  // A body line can be a giant paragraph; the row must not build DOM for all of it.
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

interface NoteGroup {
  key: DateBucket
  items: DecryptedNote[]
}

function groupByDate(notes: DecryptedNote[], field: 'updatedAt' | 'createdAt'): NoteGroup[] {
  const map = new Map<DateBucket, DecryptedNote[]>()
  for (const note of notes) {
    const key = bucketOf(note[field])
    const list = map.get(key)
    if (list) list.push(note)
    else map.set(key, [note])
  }
  return GROUP_ORDER.filter((key) => map.has(key)).map((key) => ({ key, items: map.get(key)! }))
}

function RowAction({
  label,
  onClick,
  children,
  destructive,
  className,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  destructive?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-[var(--duration-fast)] hover:scale-110 hover:bg-surface hover:text-foreground hover:shadow-e1 active:scale-95',
        destructive && 'hover:text-destructive',
        className,
      )}
    >
      {children}
    </button>
  )
}

function NoteRow({
  note,
  active,
  query,
  view,
  onSelect,
  onTogglePin,
  onArchive,
  onOpenBeside,
  onRestore,
  onDestroy,
  onMenu,
  staggerIndex,
}: {
  note: DecryptedNote
  active: boolean
  query: string
  view: NotesView
  onSelect: (id: string) => void
  onTogglePin?: (id: string) => void
  onArchive?: (id: string, archived: boolean) => void
  onOpenBeside?: (id: string) => void
  onRestore?: (id: string) => void
  onDestroy?: (id: string) => void
  onMenu: (note: DecryptedNote, anchor: NoteMenuAnchor | null) => void
  /** Row position for the entrance stagger; capped by staggerDelay(). */
  staggerIndex: number
}) {
  const t = useT()
  const info = query.trim() ? matchInfo(note, query) : null
  const bodyPreview = info ? info.snippet : preview(note.body)
  const alwaysShowActions = view === 'trash' || view === 'archive'
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function clearTimer() {
    window.clearTimeout(timer.current)
    timer.current = undefined
    start.current = null
  }

  function handleTouchStart(event: React.TouchEvent) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    start.current = { x: touch.clientX, y: touch.clientY }
    fired.current = false
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      fired.current = true
      start.current = null
      try {
        navigator.vibrate?.(12)
      } catch {
        /* haptics unavailable — the menu still opens */
      }
      onMenu(note, { x: touch.clientX, y: touch.clientY })
    }, 450)
  }

  function handleTouchMove(event: React.TouchEvent) {
    const origin = start.current
    if (!origin || event.touches.length !== 1) return
    const touch = event.touches[0]
    if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > 10) clearTimer()
  }

  return (
    <li className="group relative animate-slide-in-left" style={{ animationDelay: staggerDelay(staggerIndex) }}>
      <button
        type="button"
        onClick={(event) => {
          if (fired.current) {
            fired.current = false
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onSelect(note.id)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={clearTimer}
        onTouchCancel={clearTimer}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          window.clearTimeout(timer.current)
          if (fired.current) return
          onMenu(note, { x: event.clientX, y: event.clientY })
        }}
        aria-current={active}
        style={{ WebkitTouchCallout: 'none' }}
        className={cn(
          'w-full rounded-xl px-3 py-2.5 pr-20 text-left select-none transition-[background-color,color,box-shadow] duration-[var(--duration-base)] md:pr-25',
          active
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/60 hover:shadow-e1',
        )}
      >
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {note.title ? <Highlight text={note.title} query={query} /> : t('common.untitled')}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {bucketOf(note.updatedAt) === 'older'
              ? shortDate(note.updatedAt)
              : relativeTimeShort(note.updatedAt)}
          </span>
        </span>
        {/* One preview line, always reserved: every row is exactly two lines
            tall, whether the note has one paragraph, many, or none. */}
        <span
          aria-hidden={!bodyPreview}
          className={cn(
            'mt-0.5 text-xs leading-relaxed',
            bodyPreview ? 'line-clamp-1 text-muted-foreground' : 'invisible',
          )}
        >
          {bodyPreview ? <Highlight text={bodyPreview} query={query} /> : '\u00A0'}
        </span>
        {note.tags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground"
              >
                #<Highlight text={tag} query={query} />
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-[11px] text-muted-foreground/60">+{note.tags.length - 3}</span>
            )}
          </span>
        )}
      </button>

      <div
        className={cn(
          'absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-lg bg-surface shadow-e1 backdrop-blur-sm transition-[opacity,transform] duration-[var(--duration-base)]',
          alwaysShowActions
            ? 'opacity-100'
            : active
              ? 'opacity-100'
              : 'md:translate-x-1 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100 md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100',
        )}
      >
        {view === 'trash' ? (
          <>
            {onRestore && (
              <RowAction label={t('notes.list.restore')} onClick={() => onRestore(note.id)}>
                <RotateCcw className="size-4" />
              </RowAction>
            )}
            {onDestroy && (
              <RowAction label={t('notes.list.destroy')} destructive onClick={() => onDestroy(note.id)}>
                <Trash2 className="size-4" />
              </RowAction>
            )}
          </>
        ) : view === 'archive' ? (
          <>
            {onArchive && (
              <RowAction label={t('notes.list.unarchive')} onClick={() => onArchive(note.id, false)}>
                <ArchiveRestore className="size-4" />
              </RowAction>
            )}
            {onDestroy && (
              <RowAction label={t('notes.list.destroy')} destructive onClick={() => onDestroy(note.id)}>
                <Trash2 className="size-4" />
              </RowAction>
            )}
          </>
        ) : (
          <>
            {onOpenBeside && (
              <RowAction
                label={t('notes.list.openBeside')}
                className="hidden md:grid"
                onClick={() => onOpenBeside(note.id)}
              >
                <Columns2 className="size-4" />
              </RowAction>
            )}
            {onTogglePin && (
              <RowAction label={note.pinned ? t('notes.list.unpin') : t('notes.list.pin')} onClick={() => onTogglePin(note.id)}>
                <Pin className={cn('size-4', note.pinned && 'fill-primary text-primary')} />
              </RowAction>
            )}
            {onArchive && (
              <RowAction label={t('notes.list.archive')} onClick={() => onArchive(note.id, true)}>
                <Archive className="size-4" />
              </RowAction>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 bg-surface/90 px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase backdrop-blur">
      {children}
    </h2>
  )
}

export function NoteList({
  notes,
  selectedId,
  onSelect,
  query = '',
  view,
  groupPinned,
  grouped = true,
  dateField = 'updatedAt',
  onTogglePin,
  onArchive,
  onOpenBeside,
  onRestore,
  onDestroy,
  onRemove,
  onMove,
}: NoteListProps) {
  const t = useT()
  const pinned = groupPinned ? notes.filter((note) => note.pinned) : []
  const rest = groupPinned ? notes.filter((note) => !note.pinned) : notes
  const groups = useMemo(
    () => (grouped ? groupByDate(rest, dateField) : []),
    [grouped, rest, dateField],
  )
  const [menuNote, setMenuNote] = useState<DecryptedNote | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<NoteMenuAnchor | null>(null)

  function openMenu(note: DecryptedNote, anchor: NoteMenuAnchor | null) {
    setMenuNote(note)
    setMenuAnchor(anchor)
  }

  function closeMenu() {
    setMenuNote(null)
    setMenuAnchor(null)
  }

  if (notes.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground animate-fade-in">
        {t('notes.list.empty')}
      </p>
    )
  }

  const rowProps = { query, view, onSelect, onTogglePin, onArchive, onOpenBeside, onRestore, onDestroy, onMenu: openMenu }
  // Stagger index runs across all sections so the cascade reads as one continuous list.
  let shown = 0

  return (
    <div className="animate-fade-in px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {pinned.length > 0 && (
        <section className="mb-1">
          <GroupHeader>{t('notes.view.pinned')}</GroupHeader>
          <ul className="space-y-1">
            {pinned.map((note) => (
              <NoteRow key={note.id} note={note} active={note.id === selectedId} staggerIndex={shown++} {...rowProps} />
            ))}
          </ul>
        </section>
      )}
      {grouped ? (
        groups.map((group) => (
          <section key={group.key} className="mb-1">
            <GroupHeader>{t(GROUP_LABELS[group.key])}</GroupHeader>
            <ul className="space-y-1">
              {group.items.map((note) => (
                <NoteRow key={note.id} note={note} active={note.id === selectedId} staggerIndex={shown++} {...rowProps} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <ul className="space-y-1">
          {rest.map((note) => (
            <NoteRow key={note.id} note={note} active={note.id === selectedId} staggerIndex={shown++} {...rowProps} />
          ))}
        </ul>
      )}
      <NoteContextMenu
        note={menuNote}
        anchor={menuAnchor}
        view={view}
        onClose={closeMenu}
        onOpen={(id) => onSelect(id)}
        onTogglePin={onTogglePin}
        onArchive={onArchive}
        onOpenBeside={onOpenBeside}
        onRestore={onRestore}
        onDestroy={onDestroy}
        onRemove={onRemove}
        onMove={onMove}
      />
    </div>
  )
}
