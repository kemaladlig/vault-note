import {
  Archive,
  Ban,
  Bookmark,
  ChevronRight,
  FolderIcon,
  FolderInput,
  FolderPlus,
  Library,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Menu } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import {
  childFolders,
  FOLDER_COLORS,
  folderColorVar,
  folderSubtree,
  type Folder,
} from '@/shared/folders'
import { toast } from '@/shared/toast'

import type { DecryptedNote, NotesView } from '../model'
import { collectTags } from '../search'
import { useFolderStore } from '../store/folderStore'
import { useNotesStore } from '../store/notesStore'
import { useViewStore } from '../store/viewStore'
import type { SavedView } from '../views'
import { MoveFolderDialog } from './MoveFolderDialog'
import { PromptDialog } from './PromptDialog'

function countByView(notes: DecryptedNote[]): Record<NotesView, number> {
  return {
    all: notes.filter((n) => !n.deleted && !n.archived).length,
    pinned: notes.filter((n) => !n.deleted && !n.archived && n.pinned).length,
    archive: notes.filter((n) => !n.deleted && n.archived).length,
    trash: notes.filter((n) => n.deleted).length,
  }
}

/** In-folder note count, rolled up through ancestors. */
function folderCounts(folders: Folder[], notes: DecryptedNote[]): Map<string, number> {
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  const counts = new Map<string, number>()
  for (const note of notes) {
    if (note.deleted || note.archived || !note.folderId) continue
    let id: string | undefined = note.folderId
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      seen.add(id)
      counts.set(id, (counts.get(id) ?? 0) + 1)
      id = parentOf.get(id)
    }
  }
  return counts
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/90 uppercase">
      {children}
    </h2>
  )
}

/** Sidebar row: quiet hover, filled accent + growing left rail when active. */
function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        'group/nav relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-sm transition-all duration-200',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-foreground/90 hover:bg-muted hover:pl-3',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 left-0 h-4 w-0.5 origin-left rounded-r-full bg-primary transition-transform duration-200',
          active ? 'scale-x-100 animate-grow-x' : 'scale-x-0',
        )}
      />
      <span
        className={cn(
          'shrink-0 transition-transform duration-200',
          active ? 'text-accent-foreground' : 'text-muted-foreground group-hover/nav:scale-110',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 text-[11px] tabular-nums transition-colors',
            active ? 'bg-primary/15 text-accent-foreground' : 'text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

interface DialogState {
  kind: 'create' | 'child' | 'rename' | 'color' | 'move-folder' | 'save-view' | 'rename-view'
  folder?: Folder
  view?: SavedView
}

interface SidebarNavProps {
  /** Called when a scope selection happens (used to dismiss the mobile drawer). */
  onNavigate?: () => void
}

/** Sidebar scope: view shortcuts, the notebook tree and tag filters. */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const notes = useNotesStore((s) => s.notes)
  const view = useNotesStore((s) => s.view)
  const folderId = useNotesStore((s) => s.folderId)
  const tagFilter = useNotesStore((s) => s.tagFilter)
  const query = useNotesStore((s) => s.query)
  const setView = useNotesStore((s) => s.setView)
  const setFolderFilter = useNotesStore((s) => s.setFolderFilter)
  const setTagFilter = useNotesStore((s) => s.setTagFilter)

  const folders = useFolderStore((s) => s.folders)
  const createFolder = useFolderStore((s) => s.create)
  const renameFolder = useFolderStore((s) => s.rename)
  const moveFolder = useFolderStore((s) => s.move)
  const setFolderColor = useFolderStore((s) => s.setColor)
  const removeFolder = useFolderStore((s) => s.remove)

  const savedViews = useViewStore((s) => s.views)
  const loadViews = useViewStore((s) => s.load)
  const saveCurrentView = useViewStore((s) => s.saveCurrent)
  const renameView = useViewStore((s) => s.rename)
  const removeView = useViewStore((s) => s.remove)
  const applyView = useViewStore((s) => s.apply)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Folder | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overRoot, setOverRoot] = useState(false)

  useEffect(() => {
    void loadViews()
  }, [loadViews])

  /** A saved view is "active" when the current filters match it exactly. */
  function isViewActive(item: SavedView): boolean {
    return (
      item.view === view &&
      item.query === query &&
      (item.tag ?? undefined) === tagFilter &&
      (item.folderId ?? undefined) === folderId
    )
  }

  function go(fn: () => void) {
    fn()
    onNavigate?.()
  }

  function onSaveView() {
    const hasFilter =
      query.trim() !== '' || Boolean(tagFilter) || Boolean(folderId) || view !== 'all'
    if (!hasFilter) {
      toast('Önce bir arama veya filtre uygula.')
      return
    }
    setDialog({ kind: 'save-view' })
  }

  const counts = useMemo(() => countByView(notes), [notes])
  const folderCount = useMemo(() => folderCounts(folders, notes), [folders, notes])
  const tags = useMemo(() => collectTags(notes), [notes])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** A folder may be dropped onto a parent that is neither itself, its subtree, nor its current parent. */
  function canDrop(draggedId: string | null, targetParentId?: string): boolean {
    if (!draggedId || draggedId === targetParentId) return false
    const dragged = folders.find((folder) => folder.id === draggedId)
    if (!dragged || dragged.parentId === targetParentId) return false
    if (targetParentId && folderSubtree(folders, draggedId).has(targetParentId)) return false
    return true
  }

  function onDropInto(targetParentId?: string) {
    const id = dragId
    setDragId(null)
    setOverId(null)
    setOverRoot(false)
    if (id && canDrop(id, targetParentId)) void moveFolder(id, targetParentId)
  }

  function renderFolder(folder: Folder, depth: number): ReactNode {
    const children = childFolders(folders, folder.id)
    const isOpen = expanded.has(folder.id)
    const active = view === 'all' && folderId === folder.id
    const isDropTarget = overId === folder.id
    return (
      <li key={folder.id}>
        <div
          className={cn(
            'group relative rounded-lg transition-all duration-200',
            isDropTarget && 'scale-[1.01] ring-2 ring-primary/60',
            dragId === folder.id && 'opacity-50',
          )}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', folder.id)
            setDragId(folder.id)
          }}
          onDragEnd={() => {
            setDragId(null)
            setOverId(null)
            setOverRoot(false)
          }}
          onDragOver={(event) => {
            if (!canDrop(dragId, folder.id)) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'move'
            if (overId !== folder.id) setOverId(folder.id)
          }}
          onDragLeave={(event) => {
            event.stopPropagation()
            setOverId((current) => (current === folder.id ? null : current))
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDropInto(folder.id)
          }}
        >
          <button
            type="button"
            onClick={() => go(() => setFolderFilter(folder.id))}
            aria-current={active}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-8 text-left text-sm transition-all duration-200',
              active
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-foreground/90 hover:bg-muted',
            )}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
          >
            <span
              role="presentation"
              onClick={(event) => {
                if (children.length === 0) return
                event.stopPropagation()
                toggle(folder.id)
              }}
              className={cn(
                'shrink-0 rounded p-0.5 text-muted-foreground transition-transform duration-200',
                children.length === 0 && 'opacity-0',
                isOpen && 'rotate-90',
              )}
            >
              <ChevronRight className="size-3.5" />
            </span>
            <FolderIcon
              className={cn(
                'size-4 shrink-0 transition-transform duration-200',
                !folder.color && 'text-muted-foreground',
              )}
              style={folder.color ? { color: folderColorVar(folder.color) } : undefined}
            />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {(folderCount.get(folder.id) ?? 0) > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {folderCount.get(folder.id)}
              </span>
            )}
          </button>
          <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Menu
              label={`${folder.name} seçenekleri`}
              icon={<MoreHorizontal />}
              triggerClassName="size-6"
              items={[
                { label: 'Alt not defteri', icon: <FolderPlus />, onSelect: () => setDialog({ kind: 'child', folder }) },
                { label: 'Renk', icon: <Palette />, onSelect: () => setDialog({ kind: 'color', folder }) },
                { label: 'Taşı…', icon: <FolderInput />, onSelect: () => setDialog({ kind: 'move-folder', folder }) },
                { label: 'Yeniden adlandır', icon: <Pencil />, onSelect: () => setDialog({ kind: 'rename', folder }) },
                { type: 'separator' },
                { label: 'Sil', icon: <Trash2 />, destructive: true, onSelect: () => setPendingDelete(folder) },
              ]}
            />
          </div>
        </div>
        {isOpen && children.length > 0 && (
          <ul className="ml-5 space-y-0.5 border-l border-border/70 pl-1.5">
            {children.map((child) => renderFolder(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  const roots = childFolders(folders)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          <NavItem
            icon={<Library className="size-4" />}
            label="Tüm notlar"
            count={counts.all}
            active={view === 'all' && !folderId}
            onClick={() => go(() => setView('all'))}
          />
          <NavItem
            icon={<Pin className="size-4" />}
            label="Sabitlenenler"
            count={counts.pinned}
            active={view === 'pinned'}
            onClick={() => go(() => setView('pinned'))}
          />
          <NavItem
            icon={<Archive className="size-4" />}
            label="Arşiv"
            count={counts.archive}
            active={view === 'archive'}
            onClick={() => go(() => setView('archive'))}
          />
          <NavItem
            icon={<Trash2 className="size-4" />}
            label="Çöp"
            count={counts.trash}
            active={view === 'trash'}
            onClick={() => go(() => setView('trash'))}
          />
        </div>

        <section>
          <header className="group/section flex items-center justify-between pr-1">
            <SectionTitle>Akıllı görünümler</SectionTitle>
            <Button
              size="icon-xs"
              variant="ghost"
              className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-visible:opacity-100"
              aria-label="Görünümü kaydet"
              onClick={onSaveView}
            >
              <Plus />
            </Button>
          </header>
          {savedViews.length === 0 ? (
            <p className="px-2.5 py-1 text-xs leading-relaxed text-muted-foreground/90">
              Bir arama veya filtreyi kaydet, hızlı eriş.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {savedViews.map((item) => {
                const active = isViewActive(item)
                return (
                  <li key={item.id}>
                    <div className="group relative">
                      <button
                        type="button"
                        onClick={() => go(() => applyView(item.id))}
                        aria-current={active}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 pr-8 text-left text-sm transition-all duration-200',
                          active
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-foreground/90 hover:bg-muted',
                        )}
                      >
                        <Bookmark
                          className={cn(
                            'size-4 shrink-0',
                            active ? 'text-accent-foreground' : 'text-muted-foreground',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      </button>
                      <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Menu
                          label={`${item.name} seçenekleri`}
                          icon={<MoreHorizontal />}
                          triggerClassName="size-6"
                          items={[
                            {
                              label: 'Yeniden adlandır',
                              icon: <Pencil />,
                              onSelect: () => setDialog({ kind: 'rename-view', view: item }),
                            },
                            { type: 'separator' },
                            {
                              label: 'Sil',
                              icon: <Trash2 />,
                              destructive: true,
                              onSelect: () => void removeView(item.id),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section
          onDragOver={(event) => {
            if (!canDrop(dragId, undefined)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            if (!overRoot) setOverRoot(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverRoot(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            onDropInto(undefined)
          }}
          className={cn(
            'rounded-lg transition-all duration-200',
            overRoot && 'bg-accent/50 ring-2 ring-primary/40',
          )}
        >
          <header className="group/section flex items-center justify-between pr-1">
            <SectionTitle>Not defterleri</SectionTitle>
            <Button
              size="icon-xs"
              variant="ghost"
              className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-visible:opacity-100"
              aria-label="Not defteri ekle"
              onClick={() => setDialog({ kind: 'create' })}
            >
              <Plus />
            </Button>
          </header>
          {roots.length === 0 ? (
            <p className="px-2.5 py-1 text-xs leading-relaxed text-muted-foreground/90">
              Henüz not defteri yok. Sürükleyip bırakarak da düzenleyebilirsin.
            </p>
          ) : (
            <ul className="space-y-0.5">{roots.map((folder) => renderFolder(folder, 0))}</ul>
          )}
        </section>

        {tags.length > 0 && (
          <section>
            <SectionTitle>Etiketler</SectionTitle>
            <div className="flex flex-wrap gap-1.5 px-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => go(() => setTagFilter(undefined))}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 hover:scale-[1.04] active:scale-95',
                  !tagFilter
                    ? 'bg-primary text-primary-foreground shadow-e1'
                    : 'bg-surface text-muted-foreground shadow-e1 hover:text-foreground',
                )}
              >
                Tümü
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => go(() => setTagFilter(tagFilter === tag ? undefined : tag))}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 hover:scale-[1.04] active:scale-95',
                    tagFilter === tag
                      ? 'bg-primary text-primary-foreground shadow-e1'
                      : 'bg-surface text-muted-foreground shadow-e1 hover:text-foreground',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}
      </nav>

      <footer className="shrink-0 border-t border-border/70 p-2.5">
        <span className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-success" />
          Uçtan uca şifreli · yalnızca sende
        </span>
      </footer>

      <PromptDialog
        open={dialog?.kind === 'create'}
        title="Yeni not defteri"
        placeholder="Not defteri adı"
        confirmLabel="Oluştur"
        onConfirm={(name) => void createFolder(name)}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === 'child'}
        title="Alt not defteri"
        placeholder="Not defteri adı"
        confirmLabel="Oluştur"
        onConfirm={(name) => dialog?.folder && void createFolder(name, dialog.folder.id)}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === 'rename'}
        title="Yeniden adlandır"
        initialValue={dialog?.folder?.name ?? ''}
        confirmLabel="Kaydet"
        onConfirm={(name) => dialog?.folder && void renameFolder(dialog.folder.id, name)}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === 'save-view'}
        title="Görünümü kaydet"
        placeholder="Görünüm adı"
        confirmLabel="Kaydet"
        onConfirm={(name) => void saveCurrentView(name)}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === 'rename-view'}
        title="Görünümü yeniden adlandır"
        initialValue={dialog?.view?.name ?? ''}
        confirmLabel="Kaydet"
        onConfirm={(name) => dialog?.view && void renameView(dialog.view.id, name)}
        onClose={() => setDialog(null)}
      />

      <Modal
        open={dialog?.kind === 'color'}
        onClose={() => setDialog(null)}
        title="Not defteri rengi"
        description="Not defterine bir renk ver."
        icon={<Palette />}
        footer={
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Kapat
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="Renk yok"
            onClick={() => {
              if (dialog?.folder) void setFolderColor(dialog.folder.id, undefined)
              setDialog(null)
            }}
            className={cn(
              'grid size-8 place-items-center rounded-full border text-muted-foreground transition-transform duration-200 hover:scale-110',
              dialog?.folder?.color === undefined && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
            )}
          >
            <Ban className="size-4" />
          </button>
          {FOLDER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Renk ${color}`}
              onClick={() => {
                if (dialog?.folder) void setFolderColor(dialog.folder.id, color)
                setDialog(null)
              }}
              style={{ background: folderColorVar(color) }}
              className={cn(
                'size-8 rounded-full shadow-e1 transition-transform duration-200 hover:scale-110',
                dialog?.folder?.color === color && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
              )}
            />
          ))}
        </div>
      </Modal>

      <MoveFolderDialog
        open={dialog?.kind === 'move-folder'}
        folder={dialog?.folder ?? null}
        onMove={(parentId) => {
          if (dialog?.folder) void moveFolder(dialog.folder.id, parentId)
        }}
        onClose={() => setDialog(null)}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Not defterini sil"
        description="Bu not defteri ve alt defterleri silinir. İçindeki notlar üst deftere taşınır."
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void removeFolder(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Sil
            </Button>
          </>
        }
      />
    </div>
  )
}
