import { History, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/shared/i18n'
import { relativeTime } from '@/shared/time'

import type { DecryptedNote, NoteContent } from '../model'
import { useNotesStore } from '../store/notesStore'
import type { NoteRevision } from '../store/noteRepo'

interface NoteHistoryProps {
  note: DecryptedNote
  /** Handed title/body/tags only; the editor keeps the note's current notebook/pin/archive. */
  onRestore: (content: Pick<NoteContent, 'title' | 'body' | 'tags'>) => void
}

/** Collapsible, device-only version history for the open note. */
export function NoteHistory({ note, onRestore }: NoteHistoryProps) {
  const t = useT()
  const listRevisions = useNotesStore((s) => s.listRevisions)
  const [loaded, setLoaded] = useState<{ id: string; revisions: NoteRevision[] } | null>(null)
  const [selected, setSelected] = useState<NoteRevision | null>(null)

  useEffect(() => {
    let active = true
    void listRevisions(note.id).then((rows) => {
      if (active) setLoaded({ id: note.id, revisions: rows })
    })
    return () => {
      active = false
    }
  }, [listRevisions, note.id])

  // A load for a previous note must not flash while the current one is still resolving.
  const revisions = loaded && loaded.id === note.id ? loaded.revisions : null

  return (
    <aside
      aria-label={t('notes.editor.history')}
      className="max-h-60 shrink-0 animate-fade-in overflow-y-auto border-t border-border/70 bg-muted/20 px-3 py-2"
    >
      {revisions === null ? (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      ) : revisions.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{t('notes.history.empty')}</p>
      ) : (
        <ul className="space-y-0.5">
          {revisions.map((revision) => (
            <li key={revision.version}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => setSelected(revision)}
              >
                <History className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {t('notes.history.version', { n: revision.version })}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {relativeTime(revision.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? t('notes.history.version', { n: selected.version }) : ''}
        description={selected ? relativeTime(selected.updatedAt) : undefined}
        icon={<History />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              {t('common.cancel')}
            </Button>
            {selected && (
              <Button
                onClick={() => {
                  onRestore({ title: selected.title, body: selected.body, tags: selected.tags })
                  setSelected(null)
                }}
              >
                <RotateCcw />
                {t('notes.history.restore')}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {selected.title.trim() || t('common.untitled')}
            </p>
            {selected.tags.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selected.tags.map((tag) => `#${tag}`).join(' ')}
              </p>
            )}
            <pre className="max-h-64 overflow-y-auto rounded-xl bg-muted/50 p-3 text-sm whitespace-pre-wrap">
              {selected.body}
            </pre>
          </div>
        )}
      </Modal>
    </aside>
  )
}
