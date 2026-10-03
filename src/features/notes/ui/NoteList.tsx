import { cn } from '@/lib/utils'

import type { DecryptedNote } from '../model'

interface NoteListProps {
  notes: DecryptedNote[]
  selectedId?: string
  onSelect: (id: string) => void
}

function formatUpdated(ts: number): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(ts)
}

/** First non-empty line, trimmed — used as the sidebar preview. */
function preview(body: string): string {
  return body.split('\n').find((line) => line.trim().length > 0)?.trim() ?? ''
}

export function NoteList({ notes, selectedId, onSelect }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Henüz not yok.</p>
  }
  return (
    <ul className="divide-y">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            onClick={() => onSelect(note.id)}
            aria-current={note.id === selectedId}
            className={cn(
              'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted',
              note.id === selectedId && 'bg-accent',
            )}
          >
            <span className="block truncate text-sm font-medium">
              {note.title || 'Başlıksız'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {preview(note.body) || formatUpdated(note.updatedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
