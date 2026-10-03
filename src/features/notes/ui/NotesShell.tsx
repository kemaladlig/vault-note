import { Archive, PanelLeft, Pin, Plus, SearchX, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useShellStore } from '@/features/shell/store/shellStore'
import { cn } from '@/lib/utils'
import { folderSubtree } from '@/shared/folders'

import type { NotesView } from '../model'
import { selectNotes } from '../search'
import { useFolderStore } from '../store/folderStore'
import { useNotesStore } from '../store/notesStore'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { SidebarNav } from './SidebarNav'
import { TabBar } from './TabBar'

const VIEW_LABELS: Record<NotesView, string> = {
  all: 'Notlar',
  pinned: 'Sabitlenenler',
  archive: 'Arşiv',
  trash: 'Çöp',
}

function SkeletonList() {
  return (
    <div className="animate-fade-in space-y-1.5 p-2.5" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-xl px-3 py-3">
          <div className="shimmer h-3.5 w-2/3 rounded-full" />
          <div className="shimmer h-3 w-full rounded-full opacity-70" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  view,
  hasNotes,
  onCreate,
  onClear,
}: {
  view: NotesView
  hasNotes: boolean
  onCreate: () => void
  onClear: () => void
}) {
  if (hasNotes) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center animate-fade-in">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-e1">
          <SearchX className="size-7" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Eşleşen not yok</p>
          <p className="text-sm text-muted-foreground">Arama veya filtreyi değiştir.</p>
        </div>
        <Button variant="outline" onClick={onClear}>
          Filtreleri temizle
        </Button>
      </div>
    )
  }

  const message: Record<NotesView, string> = {
    all: 'Notların uçtan uca şifrelenir ve yalnızca sende kalır.',
    pinned: 'Sabitlediğin notlar burada toplanır.',
    archive: 'Arşivlediğin notlar burada saklanır.',
    trash: 'Çöp kutusu boş.',
  }
  const icon: Record<NotesView, ReactNode> = {
    all: <Plus className="size-7" />,
    pinned: <Pin className="size-7" />,
    archive: <Archive className="size-7" />,
    trash: <Trash2 className="size-7" />,
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center animate-rise">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-e1">
        {icon[view]}
      </span>
      <div className="max-w-xs space-y-1">
        <p className="text-base font-medium">
          {view === 'all' ? 'İlk notunu oluştur' : VIEW_LABELS[view]}
        </p>
        <p className="text-sm text-muted-foreground">{message[view]}</p>
      </div>
      {view === 'all' && (
        <Button size="lg" variant="cta" onClick={onCreate}>
          <Plus />
          Bir not oluştur
        </Button>
      )}
    </div>
  )
}

/**
 * Three-pane notes surface: navigation sidebar (persistent at xl, drawer below),
 * the note list, and the editor. On mobile the list and editor swap via shell state.
 */
export function NotesShell() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const loading = useNotesStore((s) => s.loading)
  const view = useNotesStore((s) => s.view)
  const folderId = useNotesStore((s) => s.folderId)
  const query = useNotesStore((s) => s.query)
  const tagFilter = useNotesStore((s) => s.tagFilter)
  const load = useNotesStore((s) => s.load)
  const create = useNotesStore((s) => s.create)
  const select = useNotesStore((s) => s.select)
  const setQuery = useNotesStore((s) => s.setQuery)
  const setTagFilter = useNotesStore((s) => s.setTagFilter)
  const togglePin = useNotesStore((s) => s.togglePin)
  const setArchived = useNotesStore((s) => s.setArchived)
  const restore = useNotesStore((s) => s.restore)
  const destroy = useNotesStore((s) => s.destroy)
  const emptyTrash = useNotesStore((s) => s.emptyTrash)

  const folders = useFolderStore((s) => s.folders)
  const loadFolders = useFolderStore((s) => s.load)

  const listOpen = useShellStore((s) => s.listOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const navOpen = useShellStore((s) => s.navOpen)
  const setNavOpen = useShellStore((s) => s.setNavOpen)
  const splitId = useShellStore((s) => s.splitId)
  const setSplitId = useShellStore((s) => s.setSplitId)

  const [pendingDestroy, setPendingDestroy] = useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => {
    void load()
    void loadFolders()
  }, [load, loadFolders])

  useEffect(() => {
    if (!navOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen, setNavOpen])

  const folderIds = useMemo(
    () => (folderId ? folderSubtree(folders, folderId) : undefined),
    [folderId, folders],
  )

  const filtered = useMemo(
    () => selectNotes(notes, { query, tag: tagFilter, view, folderIds }),
    [notes, query, tagFilter, view, folderIds],
  )
  const selected = notes.find((note) => note.id === selectedId)
  const splitNote = notes.find((note) => note.id === splitId && note.id !== selectedId)
  const searching = query.trim().length > 0
  const filtering = searching || Boolean(tagFilter)

  const scopeName = folderId
    ? (folders.find((folder) => folder.id === folderId)?.name ?? VIEW_LABELS.all)
    : VIEW_LABELS[view]

  function onSelect(id: string) {
    select(id)
    setListOpen(false)
  }

  function onOpenBeside(id: string) {
    if (id === selectedId) return
    setSplitId(id)
  }

  function clearFilters() {
    setQuery('')
    setTagFilter(undefined)
  }

  return (
    <div className="relative flex h-full">
      {/* Scrim under the drawer (below xl). */}
      {navOpen && (
        <div
          aria-hidden
          onClick={() => setNavOpen(false)}
          className="absolute inset-0 z-30 bg-[var(--scrim)] backdrop-blur-[2px] animate-fade-in xl:hidden"
        />
      )}

      <aside
        aria-label="Gezinme"
        className={cn(
          'absolute inset-y-0 left-0 z-40 w-[280px] shrink-0 flex-col border-r border-border/70 bg-sidebar shadow-e3 transition-transform duration-300 ease-[var(--ease-emphasized)]',
          'xl:static xl:z-auto xl:translate-x-0 xl:shadow-none',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarNav onNavigate={() => setNavOpen(false)} />
      </aside>

      <aside
        className={cn(
          'w-full shrink-0 flex-col bg-surface md:w-80 xl:w-[340px]',
          listOpen ? 'flex' : 'hidden md:flex',
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border/70 px-2.5">
          <Button
            size="icon-sm"
            variant="ghost"
            className="xl:hidden"
            aria-label="Menü"
            title="Menü"
            onClick={() => setNavOpen(true)}
          >
            <PanelLeft />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
            {scopeName}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {filtered.length}
          </span>
        </header>

        {(filtering || (view === 'trash' && filtered.length > 0)) && (
          <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-sidebar/60 px-3 py-1.5 text-xs text-muted-foreground">
            {filtering ? (
              <>
                <span className="flex-1 truncate">
                  {tagFilter ? `#${tagFilter}` : ''}
                  {tagFilter && searching ? ' · ' : ''}
                  {searching ? `“${query.trim()}”` : ''}
                </span>
                <button
                  type="button"
                  aria-label="Filtreleri temizle"
                  className="rounded p-0.5 transition-colors hover:bg-muted"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmEmpty(true)}
              >
                <Trash2 className="size-3.5" />
                Çöpü boşalt
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonList />
          ) : (
            <NoteList
              notes={filtered}
              selectedId={selectedId}
              onSelect={onSelect}
              query={query}
              view={view}
              groupPinned={view === 'all' && !folderId}
              onTogglePin={(id) => void togglePin(id)}
              onArchive={(id, archived) => void setArchived(id, archived)}
              onOpenBeside={onOpenBeside}
              onRestore={(id) => void restore(id)}
              onDestroy={(id) => setPendingDestroy(id)}
            />
          )}
        </div>
      </aside>

      <section
        className={cn(
          'min-w-0 flex-1 flex-col border-l border-border/70 bg-surface',
          listOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        <TabBar />
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                initialSearch={searching ? query.trim() : undefined}
                onBack={() => setListOpen(true)}
              />
            ) : (
              <EmptyState
                view={view}
                hasNotes={filtered.length > 0}
                onCreate={() => void create()}
                onClear={clearFilters}
              />
            )}
          </div>

          {splitNote && (
            <div className="hidden min-w-0 flex-1 flex-col border-l bg-surface animate-slide-in-left md:flex">
              <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-surface-variant px-3">
                <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="truncate">{splitNote.title.trim() || 'Başlıksız'}</span>
                </span>
                <button
                  type="button"
                  aria-label="Bölmeyi kapat"
                  title="Bölmeyi kapat"
                  onClick={() => setSplitId(undefined)}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </header>
              <div className="min-h-0 flex-1">
                <NoteEditor key={splitNote.id} note={splitNote} />
              </div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={Boolean(pendingDestroy)}
        onClose={() => setPendingDestroy(null)}
        title="Kalıcı sil"
        description="Bu not bu cihazdan kalıcı olarak silinir. Bu işlem geri alınamaz."
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDestroy(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDestroy) void destroy(pendingDestroy)
                setPendingDestroy(null)
              }}
            >
              Kalıcı sil
            </Button>
          </>
        }
      />

      <Modal
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        title="Çöpü boşalt"
        description="Çöpteki tüm notlar bu cihazdan kalıcı olarak silinir."
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEmpty(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void emptyTrash()
                setConfirmEmpty(false)
              }}
            >
              Çöpü boşalt
            </Button>
          </>
        }
      />
    </div>
  )
}
