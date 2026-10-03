import { Archive, ArchiveRestore, Columns2, Pin, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { bucketOf, relativeTime, type DateBucket } from '@/shared/time'

import type { DecryptedNote, NotesView } from '../model'
import { matchInfo } from '../search'
import { Highlight } from './Highlight'

interface NoteListProps {
  notes: DecryptedNote[]
  selectedId?: string
  onSelect: (id: string) => void
  query?: string
  view: NotesView
  /** Show a pinned section above the date groups (main view only). */
  groupPinned?: boolean
  onTogglePin?: (id: string) => void
  onArchive?: (id: string, archived: boolean) => void
  onOpenBeside?: (id: string) => void
  onRestore?: (id: string) => void
  onDestroy?: (id: string) => void
}

const GROUP_LABELS: Record<DateBucket, string> = {
  today: 'Bugün',
  yesterday: 'Dün',
  week: 'Bu hafta',
  older: 'Daha eski',
}
const GROUP_ORDER: DateBucket[] = ['today', 'yesterday', 'week', 'older']

function preview(body: string): string {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
}

interface NoteGroup {
  key: DateBucket
  items: DecryptedNote[]
}

function groupByDate(notes: DecryptedNote[]): NoteGroup[] {
  const map = new Map<DateBucket, DecryptedNote[]>()
  for (const note of notes) {
    const key = bucketOf(note.updatedAt)
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
        'grid size-7 place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:scale-110 hover:bg-surface hover:text-foreground hover:shadow-e1 active:scale-95',
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
}) {
  const info = query.trim() ? matchInfo(note, query) : null
  const bodyPreview = info ? info.snippet : preview(note.body)
  const alwaysShowActions = view === 'trash' || view === 'archive'

  return (
    <li className="group relative animate-slide-in-left">
      <button
        type="button"
        onClick={() => onSelect(note.id)}
        aria-current={active}
        className={cn(
          'w-full rounded-xl px-3 py-2.5 text-left transition-all duration-200 md:pr-24',
          active
            ? 'bg-accent text-accent-foreground shadow-e1'
            : 'hover:bg-muted/60 hover:shadow-e1',
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-primary animate-fade-in"
          />
        )}
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {note.title ? <Highlight text={note.title} query={query} /> : 'Başlıksız'}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {relativeTime(note.updatedAt)}
          </span>
        </span>
        {bodyPreview && (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
            <Highlight text={bodyPreview} query={query} />
          </span>
        )}
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
          'absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-lg bg-surface/80 backdrop-blur-sm transition-all duration-200',
          alwaysShowActions
            ? 'opacity-100'
            : active
              ? 'opacity-100'
              : 'translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100',
        )}
      >
        {view === 'trash' ? (
          <>
            {onRestore && (
              <RowAction label="Geri yükle" onClick={() => onRestore(note.id)}>
                <RotateCcw className="size-4" />
              </RowAction>
            )}
            {onDestroy && (
              <RowAction label="Kalıcı sil" destructive onClick={() => onDestroy(note.id)}>
                <Trash2 className="size-4" />
              </RowAction>
            )}
          </>
        ) : view === 'archive' ? (
          <>
            {onArchive && (
              <RowAction label="Arşivden çıkar" onClick={() => onArchive(note.id, false)}>
                <ArchiveRestore className="size-4" />
              </RowAction>
            )}
            {onDestroy && (
              <RowAction label="Kalıcı sil" destructive onClick={() => onDestroy(note.id)}>
                <Trash2 className="size-4" />
              </RowAction>
            )}
          </>
        ) : (
          <>
            {onOpenBeside && (
              <RowAction
                label="Yan tarafta aç"
                className="hidden md:grid"
                onClick={() => onOpenBeside(note.id)}
              >
                <Columns2 className="size-4" />
              </RowAction>
            )}
            {onTogglePin && (
              <RowAction label={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'} onClick={() => onTogglePin(note.id)}>
                <Pin className={cn('size-4', note.pinned && 'fill-primary text-primary')} />
              </RowAction>
            )}
            {onArchive && (
              <RowAction label="Arşivle" onClick={() => onArchive(note.id, true)}>
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
  onTogglePin,
  onArchive,
  onOpenBeside,
  onRestore,
  onDestroy,
}: NoteListProps) {
  const pinned = groupPinned ? notes.filter((note) => note.pinned) : []
  const rest = groupPinned ? notes.filter((note) => !note.pinned) : notes
  const groups = useMemo(() => groupByDate(rest), [rest])

  if (notes.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground animate-fade-in">
        Eşleşen not yok.
      </p>
    )
  }

  const rowProps = { query, view, onSelect, onTogglePin, onArchive, onOpenBeside, onRestore, onDestroy }

  return (
    <div className="animate-fade-in px-2 pb-3">
      {pinned.length > 0 && (
        <section className="mb-1">
          <GroupHeader>Sabitlenenler</GroupHeader>
          <ul className="space-y-1">
            {pinned.map((note) => (
              <NoteRow key={note.id} note={note} active={note.id === selectedId} {...rowProps} />
            ))}
          </ul>
        </section>
      )}
      {groups.map((group) => (
        <section key={group.key} className="mb-1">
          <GroupHeader>{GROUP_LABELS[group.key]}</GroupHeader>
          <ul className="space-y-1">
            {group.items.map((note) => (
              <NoteRow key={note.id} note={note} active={note.id === selectedId} {...rowProps} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
