import { Cloud, Loader2, Lock, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useAutoSync } from '@/features/sync/useAutoSync'
import { useVaultStore } from '@/features/vault/store/vaultStore'

import { filterNotes } from '../search'
import { useNotesStore } from '../store/notesStore'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'

/** Two-pane notes UI: sidebar search + list, and the editor. */
export function NotesShell() {
  const { notes, selectedId, loading, load, create, select } = useNotesStore()
  const lock = useVaultStore((s) => s.lock)
  const syncStatus = useSyncStore((s) => s.status)
  const configured = useSyncStore((s) => s.configured)
  const syncError = useSyncStore((s) => s.error)
  const sync = useSyncStore((s) => s.sync)

  const [query, setQuery] = useState('')

  useAutoSync()

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => filterNotes(notes, query), [notes, query])

  const selected = notes.find((n) => n.id === selectedId)
  const syncing = syncStatus === 'syncing'
  const searching = query.trim().length > 0

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <header className="flex items-center justify-between border-b p-2">
          <span className="pl-1 text-sm font-medium">Notlar</span>
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Drive ile senkronize et"
              title={
                syncError ?? (configured ? 'Senkronize et' : 'Google istemci kimliği ayarlı değil')
              }
              disabled={!configured || syncing}
              onClick={() => void sync()}
            >
              {syncing ? <Loader2 className="animate-spin" /> : <Cloud />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Yeni not"
              onClick={() => void create()}
            >
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Kilitle" onClick={lock}>
              <Lock />
            </Button>
          </div>
        </header>
        <div className="relative border-b p-2">
          <Input
            value={query}
            placeholder="Tüm notlarda ara…"
            aria-label="Tüm notlarda ara"
            className="h-8 pr-8"
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Aramayı temizle"
              className="absolute top-1/2 right-2.5 size-6 -translate-y-1/2"
              onClick={() => setQuery('')}
            >
              <X />
            </Button>
          )}
        </div>
        {searching && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground">{filtered.length} not eşleşiyor</p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <NoteList notes={filtered} selectedId={selectedId} onSelect={select} />
          )}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            initialSearch={searching ? query.trim() : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Bir not seç ya da yeni bir tane oluştur.
          </div>
        )}
      </section>
    </div>
  )
}
