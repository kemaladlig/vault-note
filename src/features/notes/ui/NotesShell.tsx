import {
  Archive,
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Clock,
  Menu as MenuIcon,
  Pin,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { useShellStore } from '@/features/shell/store/shellStore'
import { cn } from '@/lib/utils'
import { folderSubtree } from '@/shared/folders'
import { useT, type MessageKey } from '@/shared/i18n'
import { toast } from '@/shared/toast'

import type { NotesView } from '../model'
import { selectNotes } from '../search'
import { groupFieldFor, sortNotes } from '../sort'
import { useFolderStore } from '../store/folderStore'
import { useNotesStore } from '../store/notesStore'
import { NoteEditor } from './NoteEditor'
import { MoveNoteDialog } from './MoveNoteDialog'
import { NoteList } from './NoteList'
import { SidebarNav } from './SidebarNav'
import { TabBar } from './TabBar'

const VIEW_LABELS: Record<NotesView, MessageKey> = {
  all: 'notes.view.all',
  pinned: 'notes.view.pinned',
  archive: 'notes.view.archive',
  trash: 'notes.view.trash',
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
  const t = useT()
  if (hasNotes) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center animate-fade-in">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-e1">
          <SearchX className="size-7" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">{t('notes.empty.searchTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('notes.empty.searchDesc')}</p>
        </div>
        <Button variant="outline" onClick={onClear}>
          {t('notes.empty.clearFilters')}
        </Button>
      </div>
    )
  }

  const message: Record<NotesView, MessageKey> = {
    all: 'notes.empty.allMsg',
    pinned: 'notes.empty.pinnedMsg',
    archive: 'notes.empty.archiveMsg',
    trash: 'notes.empty.trashMsg',
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
          {view === 'all' ? t('notes.empty.allTitle') : t(VIEW_LABELS[view])}
        </p>
        <p className="text-sm text-muted-foreground">{t(message[view])}</p>
      </div>
      {view === 'all' && (
        <Button size="lg" variant="cta" onClick={onCreate}>
          <Plus />
          {t('notes.empty.createButton')}
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
  const t = useT()
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const loading = useNotesStore((s) => s.loading)
  const view = useNotesStore((s) => s.view)
  const folderId = useNotesStore((s) => s.folderId)
  const query = useNotesStore((s) => s.query)
  const tagFilter = useNotesStore((s) => s.tagFilter)
  const sortBy = useNotesStore((s) => s.sortBy)
  const sortDir = useNotesStore((s) => s.sortDir)
  const chooseSort = useNotesStore((s) => s.chooseSort)
  const setSort = useNotesStore((s) => s.setSort)
  const load = useNotesStore((s) => s.load)
  const create = useNotesStore((s) => s.create)
  const select = useNotesStore((s) => s.select)
  const setQuery = useNotesStore((s) => s.setQuery)
  const setTagFilter = useNotesStore((s) => s.setTagFilter)
  const togglePin = useNotesStore((s) => s.togglePin)
  const setArchived = useNotesStore((s) => s.setArchived)
  const remove = useNotesStore((s) => s.remove)
  const moveToFolder = useNotesStore((s) => s.moveToFolder)
  const restore = useNotesStore((s) => s.restore)
  const destroy = useNotesStore((s) => s.destroy)
  const emptyTrash = useNotesStore((s) => s.emptyTrash)

  const folders = useFolderStore((s) => s.folders)
  const loadFolders = useFolderStore((s) => s.load)

  const listOpen = useShellStore((s) => s.listOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const navOpen = useShellStore((s) => s.navOpen)
  const setNavOpen = useShellStore((s) => s.setNavOpen)
  const panelMode = useShellStore((s) => s.panelMode)
  const splitId = useShellStore((s) => s.splitId)
  const setSplitId = useShellStore((s) => s.setSplitId)

  const [pendingDestroy, setPendingDestroy] = useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)

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

  // Typing stays instant (the input is the store query); the expensive
  // full-body scan runs on the deferred value so keystrokes never block.
  const deferredQuery = useDeferredValue(query)
  const filtered = useMemo(
    () => selectNotes(notes, { query: deferredQuery, tag: tagFilter, view, folderIds }),
    [notes, deferredQuery, tagFilter, view, folderIds],
  )
  const sorted = useMemo(
    () => sortNotes(filtered, sortBy, sortDir),
    [filtered, sortBy, sortDir],
  )
  const groupField = groupFieldFor(sortBy)
  const selected = notes.find((note) => note.id === selectedId)
  const splitNote = notes.find((note) => note.id === splitId && note.id !== selectedId)
  const filtering = query.trim().length > 0 || Boolean(tagFilter)
  // Mobile: with no note selected (empty view, closed tabs…) the list is always the surface.
  const showList = listOpen || !selected

  const scopeName = folderId
    ? (folders.find((folder) => folder.id === folderId)?.name ?? t(VIEW_LABELS.all))
    : t(VIEW_LABELS[view])

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

  const sortItems: MenuItem[] = [
    {
      label: t('notes.sort.updated'),
      icon: <Clock />,
      selected: sortBy === 'updatedAt',
      onSelect: () => chooseSort('updatedAt'),
    },
    {
      label: t('notes.sort.created'),
      icon: <CalendarDays />,
      selected: sortBy === 'createdAt',
      onSelect: () => chooseSort('createdAt'),
    },
    {
      label: t('notes.sort.title'),
      icon: <ArrowDownAZ />,
      selected: sortBy === 'title',
      onSelect: () => chooseSort('title'),
    },
    { type: 'separator' },
    {
      label: t('notes.sort.asc'),
      icon: <ArrowUp />,
      selected: sortDir === 'asc',
      onSelect: () => setSort(sortBy, 'asc'),
    },
    {
      label: t('notes.sort.desc'),
      icon: <ArrowDown />,
      selected: sortDir === 'desc',
      onSelect: () => setSort(sortBy, 'desc'),
    },
  ]

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
        aria-label={t('notes.shell.nav')}
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex w-[min(280px,85vw)] shrink-0 flex-col border-r border-border/70 bg-sidebar shadow-e3 transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-emphasized)]',
          'xl:relative xl:w-[280px] xl:translate-x-0 xl:shadow-none',
          navOpen ? 'translate-x-0' : '-translate-x-full',
          // Material exit: the layout slot collapses in one frame (base
          // `absolute` returns) while the pane fades out on its slide — the
          // dissolve reads as "leaving", not as a sheet floating over content.
          panelMode !== 'full' && 'xl:absolute xl:-translate-x-full xl:opacity-0 xl:pointer-events-none xl:shadow-e3',
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-3 xl:hidden">
          <span className="text-[15px] font-semibold tracking-tight">
            Vault<span className="text-primary">Note</span>
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('notes.shell.closeMenu')}
            onClick={() => setNavOpen(false)}
          >
            <X />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </div>
      </aside>

      <aside
        data-pane="list"
        data-visible={showList}
        className={cn(
          'w-full shrink-0 flex-col bg-surface transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-emphasized)] md:w-80 xl:w-[340px]',
          // The list uses the same Material exit as the nav — fade out while
          // sliding left under it (lower z). Below md the two are still
          // discrete surfaces, so the collapse rules only bite from md up.
          panelMode === 'editor'
            ? showList
              ? 'flex md:absolute md:inset-y-0 md:left-0 md:z-20 md:-translate-x-full md:opacity-0 md:pointer-events-none'
              : 'hidden md:flex md:absolute md:inset-y-0 md:left-0 md:z-20 md:-translate-x-full md:opacity-0 md:pointer-events-none'
            : showList
              ? 'flex'
              : 'hidden md:flex',
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border/70 px-2.5">
          <Button
            size="icon-lg"
            variant="ghost"
            className="xl:hidden"
            aria-label={t('notes.shell.menu')}
            title={t('notes.shell.menu')}
            aria-haspopup="dialog"
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon />
          </Button>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
            {scopeName}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {filtered.length}
          </span>
          <Menu
            label={t('notes.sort.label')}
            icon={<ArrowUpDown />}
            items={sortItems}
            triggerClassName="size-7"
          />
        </header>

        {/* Mobile search: the top-bar field is desktop-only, so the list owns search below sm. */}
        <div className="shrink-0 border-b border-border/70 px-2.5 py-1.5 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder={t('shell.search.placeholder')}
              aria-label={t('shell.search.label')}
              className="h-9 rounded-full bg-muted/60 pr-8 pl-9 text-sm shadow-none"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label={t('notes.empty.clearFilters')}
                onClick={() => setQuery('')}
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {(filtering || (view === 'trash' && filtered.length > 0)) && (
          <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-sidebar/60 px-3 py-1.5 text-xs text-muted-foreground">
            {filtering ? (
              <>
                <span className="flex-1 truncate">
                  {tagFilter ? `#${tagFilter}` : ''}
                  {tagFilter && query.trim() ? ' · ' : ''}
                  {query.trim() ? `“${query.trim()}”` : ''}
                </span>
                <button
                  type="button"
                  aria-label={t('notes.empty.clearFilters')}
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
                {t('notes.shell.emptyTrash')}
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonList />
          ) : (
            <NoteList
              key={`${view}:${folderId ?? ''}:${tagFilter ?? ''}`}
              notes={sorted}
              selectedId={selectedId}
              onSelect={onSelect}
              query={deferredQuery}
              view={view}
              groupPinned={view === 'all' && !folderId}
              grouped={groupField !== null}
              dateField={groupField ?? 'updatedAt'}
              onTogglePin={(id) => void togglePin(id)}
              onArchive={(id, archived) =>
                void setArchived(id, archived).then(() =>
                  toast(t(archived ? 'notes.list.archived' : 'notes.list.unarchived'), 'success'),
                )
              }
              onOpenBeside={onOpenBeside}
              onRestore={(id) =>
                void restore(id).then(() => toast(t('notes.list.restored'), 'success'))
              }
              onDestroy={(id) => setPendingDestroy(id)}
              onRemove={(id) =>
                void remove(id).then(() => toast(t('notes.editor.deleted'), 'success'))
              }
              onMove={(id) => setMoveNoteId(id)}
            />
          )}
        </div>
      </aside>

      <section
        data-pane="editor"
        data-visible={!showList}
        className={cn(
          'min-w-0 flex-1 flex-col border-l border-border/70 bg-surface',
          showList ? 'hidden md:flex' : 'flex',
        )}
      >
        <TabBar onBack={() => setListOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                initialSearch={query.trim() || undefined}
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
                  <span className="truncate">{splitNote.title.trim() || t('common.untitled')}</span>
                </span>
                <button
                  type="button"
                  aria-label={t('notes.shell.closeSplit')}
                  title={t('notes.shell.closeSplit')}
                  onClick={() => setSplitId(undefined)}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </header>
              <div className="min-h-0 flex-1">
                <NoteEditor
                  key={splitNote.id}
                  note={splitNote}
                  initialSearch={query.trim() || undefined}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Mobile floating action: create from anywhere in the list. */}
      {showList && (
        <button
          type="button"
          aria-label={t('notes.shell.createNote')}
          onClick={() => {
            create().then(
              () => setListOpen(false),
              (err) => toast(err instanceof Error ? err.message : t('notes.editor.createFailed'), 'error'),
            )
          }}
          className="absolute right-5 bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-20 grid size-14 place-items-center rounded-2xl bg-[image:linear-gradient(180deg,var(--brand-from),var(--brand-to))] text-primary-foreground shadow-glow transition-transform duration-[var(--duration-base)] animate-pop-in hover:scale-105 active:scale-95 md:hidden"
        >
          <Plus className="size-6" />
        </button>
      )}

      <MoveNoteDialog
        open={moveNoteId !== null}
        currentFolderId={notes.find((note) => note.id === moveNoteId)?.folderId}
        onSelect={(folderId) => {
          if (moveNoteId) {
            void moveToFolder(moveNoteId, folderId).then(() =>
              toast(t('notes.list.moved'), 'success'),
            )
          }
        }}
        onClose={() => setMoveNoteId(null)}
      />

      <Modal
        open={Boolean(pendingDestroy)}
        onClose={() => setPendingDestroy(null)}
        title={t('notes.shell.destroyTitle')}
        description={t('notes.shell.destroyDesc')}
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDestroy(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDestroy) {
                  void destroy(pendingDestroy).then(() =>
                    toast(t('notes.list.destroyed'), 'success'),
                  )
                }
                setPendingDestroy(null)
              }}
            >
              {t('notes.list.destroy')}
            </Button>
          </>
        }
      />

      <Modal
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        title={t('notes.shell.emptyTrash')}
        description={t('notes.shell.emptyTrashDesc')}
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEmpty(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void emptyTrash().then(() => toast(t('notes.shell.emptyTrashDone'), 'success'))
                setConfirmEmpty(false)
              }}
            >
              {t('notes.shell.emptyTrash')}
            </Button>
          </>
        }
      />
    </div>
  )
}
