import { Archive, ArchiveRestore, Download, Eye, FolderInput, History, LayoutTemplate, Link2, MoreVertical, PenLine, Pin, Search, SlidersHorizontal, Tags, Trash2, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { Popover } from '@/components/ui/popover'
import { useT } from '@/shared/i18n'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/time'
import { toast } from '@/shared/toast'

import { downloadNoteMarkdown } from '../export'
import { backlinksFor, buildLinkIndex, resolveLinks, resolveTarget } from '../links'
import type { DecryptedNote, NoteContent } from '../model'
import { countWords } from '../stats'
import { useNotesStore } from '../store/notesStore'
import { useTemplateStore } from '../store/templateStore'
import type { CodeEditorHandle, LinkTarget } from './CodeEditor'
import { EditorToolbar } from './EditorToolbar'
import { MoveNoteDialog } from './MoveNoteDialog'
import { NoteHistory } from './NoteHistory'
import { PromptDialog } from './PromptDialog'
import { SearchBar } from './SearchBar'

// CodeMirror is the heaviest dependency; load it only when a note is opened.
const CodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))
// marked + DOMPurify only load when the user actually opens the preview.
const MarkdownPreview = lazy(() =>
  import('./MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })),
)

const SAVE_DELAY_MS = 500

const TOOLS_KEY = 'vaultnote.toolsOpen'

/** Header tools start open on desktop, closed on small screens; then the choice sticks. */
function readToolsOpen(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (raw === 'open') return true
    if (raw === 'closed') return false
  } catch {
    return true
  }
  return window.matchMedia('(min-width: 768px)').matches
}

interface NoteEditorProps {
  note: DecryptedNote
  /** Pre-fills and opens in-note search (used when opening from a search hit). */
  initialSearch?: string
}

interface TagEditorProps {
  tags: string[]
  tagInput: string
  setTagInput: (value: string) => void
  onTagInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}

/** Tag list plus the entry field; shared by the desktop and mobile tag popovers. */
function TagEditor({
  tags,
  tagInput,
  setTagInput,
  onTagInputKeyDown,
  onAddTag,
  onRemoveTag,
  inputRef,
}: TagEditorProps) {
  const t = useT()
  return (
    <div className="space-y-2.5 p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {t('notes.editor.tags')}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
          >
            #{tag}
            <button
              type="button"
              aria-label={t('notes.editor.removeTag', { tag })}
              className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
              onClick={() => onRemoveTag(tag)}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={tagInput}
          aria-label={t('notes.editor.addTag')}
          placeholder={tags.length > 0 ? t('notes.editor.addTagShort') : t('notes.editor.addTag') + '…'}
          className="h-9 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={onTagInputKeyDown}
          onBlur={onAddTag}
        />
      </div>
    </div>
  )
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').trim()
}

/** Single-note editor: encrypted save is debounced, then flushed on unmount. */
export function NoteEditor({ note, initialSearch }: NoteEditorProps) {
  const t = useT()
  const update = useNotesStore((s) => s.update)
  const remove = useNotesStore((s) => s.remove)
  const togglePin = useNotesStore((s) => s.togglePin)
  const setArchived = useNotesStore((s) => s.setArchived)
  const moveToFolder = useNotesStore((s) => s.moveToFolder)
  const notes = useNotesStore((s) => s.notes)
  const select = useNotesStore((s) => s.select)
  const createTemplate = useTemplateStore((s) => s.create)

  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [tags, setTags] = useState(note.tags)
  const [tagInput, setTagInput] = useState('')
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearch))
  const [term, setTerm] = useState(initialSearch ?? '')
  const [matchCount, setMatchCount] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(readToolsOpen)

  const editorRef = useRef<CodeEditorHandle>(null)
  const tagFieldRef = useRef<HTMLInputElement>(null)
  const draft = useRef<NoteContent>({
    title: note.title,
    body: note.body,
    tags: note.tags,
    pinned: note.pinned,
    folderId: note.folderId,
    archived: note.archived,
  })
  const timer = useRef<number | undefined>(undefined)
  /** True while edits are unsaved — gates the unmount flush so an untouched note is never rewritten. */
  const pending = useRef(false)
  /** Version last reflected here; a different one on the prop means a remote revision arrived. */
  const appliedVersion = useRef(note.version)

  function scheduleSave() {
    pending.current = true
    setDirty(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      pending.current = false
      void update(note.id, draft.current).then((saved) => {
        if (saved) appliedVersion.current = saved.version
        setDirty(false)
      })
    }, SAVE_DELAY_MS)
  }

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    setTagInput('')
    if (!tag || tags.includes(tag)) return
    setTags((current) => {
      const next = [...current, tag]
      draft.current.tags = next
      scheduleSave()
      return next
    })
  }

  function removeTag(tag: string) {
    setTags((current) => {
      const next = current.filter((item) => item !== tag)
      draft.current.tags = next
      scheduleSave()
      return next
    })
  }

  function onTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    } else if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  function applyTerm(value: string) {
    setTerm(value)
    editorRef.current?.setQuery(value)
  }

  function closeSearch() {
    setSearchOpen(false)
    setTerm('')
    setMatchCount(0)
    editorRef.current?.setQuery('')
  }

  function toggleTools() {
    setToolsOpen((value) => {
      const next = !value
      try {
        localStorage.setItem(TOOLS_KEY, next ? 'open' : 'closed')
      } catch {
        /* storage unavailable — the choice just lasts this session */
      }
      return next
    })
  }

  // Flush genuinely unsaved edits when switching notes or leaving the screen.
  useEffect(() => {
    const pendingTimer = timer
    const pendingDraft = draft
    return () => {
      window.clearTimeout(pendingTimer.current)
      // Never rewrite an untouched note: a spurious save would bump updatedAt and,
      // under last-write-wins, clobber a real edit made on another device.
      if (pending.current) {
        pending.current = false
        void update(note.id, pendingDraft.current)
      }
    }
  }, [note.id, update])

  // Apply a newer revision pulled by a background sync — but never while the user is typing.
  useEffect(() => {
    if (note.version === appliedVersion.current || pending.current) return
    appliedVersion.current = note.version
    setTitle(note.title)
    setBody(note.body)
    setTags(note.tags)
    draft.current = {
      title: note.title,
      body: note.body,
      tags: note.tags,
      pinned: note.pinned,
      folderId: note.folderId,
      archived: note.archived,
    }
    editorRef.current?.setValue(note.body)
  }, [note.version, note.title, note.body, note.tags, note.pinned, note.folderId, note.archived])

  // Focus the tag field when the popover opens, so adding a tag is one click away.
  useEffect(() => {
    if (tagsOpen) tagFieldRef.current?.focus()
  }, [tagsOpen])

  // Keep the sealed organizational fields aligned with the store, so a pending text save
  // can never roll back a pin / move / archive made from elsewhere.
  useEffect(() => {
    draft.current.pinned = note.pinned
    draft.current.folderId = note.folderId
    draft.current.archived = note.archived
  })

  const linkIndex = useMemo(() => buildLinkIndex(notes), [notes])
  const linkTargets = useMemo<LinkTarget[]>(
    () =>
      notes
        .filter((item) => item.id !== note.id && !item.deleted && item.title.trim())
        .map((item) => ({ label: item.title.trim(), insert: `${item.title.trim()}]]` })),
    [notes, note.id],
  )
  // Backlinks come from other notes' saved bodies; the panel updates after each save.
  const backlinks = useMemo(
    () => backlinksFor(note, notes, linkIndex),
    [note, notes, linkIndex],
  )
  // Broken links follow the live body so they appear as the user types.
  const brokenLinks = useMemo(
    () => resolveLinks(body, linkIndex).filter((link) => !link.note),
    [body, linkIndex],
  )
  const linkCount = backlinks.length + brokenLinks.length
  const resolveTargetId = useCallback(
    (target: string) => resolveTarget(target, linkIndex)?.id,
    [linkIndex],
  )

  const menuItems: MenuItem[] = [
    {
      label: t('notes.editor.exportMd'),
      icon: <Download />,
      onSelect: () => {
        downloadNoteMarkdown({ ...note, title, tags })
        toast(t('notes.editor.downloaded'), 'success')
      },
    },
    { type: 'separator' },
    {
      label: note.archived ? t('notes.list.unarchive') : t('notes.list.archive'),
      icon: note.archived ? <ArchiveRestore /> : <Archive />,
      onSelect: () =>
        void setArchived(note.id, !note.archived).then(() =>
          toast(
            t(note.archived ? 'notes.list.unarchived' : 'notes.list.archived'),
            'success',
          ),
        ),
    },
    {
      label: t('notes.editor.moveToFolder'),
      icon: <FolderInput />,
      onSelect: () => setMoveOpen(true),
    },
    {
      label: t('templates.save'),
      icon: <LayoutTemplate />,
      onSelect: () => setTemplateOpen(true),
    },
    { type: 'separator' },
    {
      label: t('common.delete'),
      icon: <Trash2 />,
      destructive: true,
      onSelect: () => setConfirmDelete(true),
    },
  ]

  // The phone header has room for two buttons, not six: the desktop tool row
  // (search, pin, links, history) moves into the overflow menu there.
  const mobileMenuItems: MenuItem[] = [
    {
      label: preview ? t('notes.editor.edit') : t('notes.editor.preview'),
      icon: preview ? <PenLine /> : <Eye />,
      onSelect: () => setPreview((value) => !value),
    },
    {
      label: note.pinned ? t('notes.list.unpin') : t('notes.list.pin'),
      icon: <Pin />,
      selected: note.pinned,
      onSelect: () => void togglePin(note.id),
    },
    { label: t('notes.editor.links'), icon: <Link2 />, onSelect: () => setLinksOpen(true) },
    { label: t('notes.editor.history'), icon: <History />, onSelect: () => setHistoryOpen(true) },
    { type: 'separator' },
    ...menuItems,
  ]

  return (
    <div className="flex h-full flex-col animate-slide-up">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/70 px-2">
        <Input
          value={title}
          placeholder={t('common.untitled')}
          className="min-w-0 flex-1 border-none bg-transparent text-[17px] font-semibold tracking-tight shadow-none focus-visible:ring-0"
          onChange={(event) => {
            setTitle(event.target.value)
            draft.current.title = event.target.value
            scheduleSave()
          }}
        />
        <span
          aria-live="polite"
          className={cn(
            'hidden shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground transition-opacity duration-[var(--duration-base)] sm:flex',
            dirty ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('notes.editor.saving')}
        </span>

        {/* Primary view switch + overflow live here on mobile; the full tool
            row (pin, links, history) needs more width than a phone header has. */}
        <div className="hidden shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5 md:flex [&_button:hover]:bg-surface [&_button:hover]:shadow-e1">
          <Popover
            open={tagsOpen}
            onOpenChange={setTagsOpen}
            label={t('notes.editor.tags')}
            className="w-64 max-sm:fixed max-sm:inset-x-4 max-sm:top-36 max-sm:w-auto"
            anchor={
              <span className="relative">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('notes.editor.tags')}
                  aria-haspopup="dialog"
                  aria-expanded={tagsOpen}
                  onClick={() => setTagsOpen((value) => !value)}
                >
                  <Tags />
                </Button>
                {tags.length > 0 && (
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {tags.length}
                  </span>
                )}
              </span>
            }
          >
            <TagEditor
              tags={tags}
              tagInput={tagInput}
              setTagInput={setTagInput}
              onTagInputKeyDown={onTagKeyDown}
              onAddTag={() => addTag(tagInput)}
              onRemoveTag={removeTag}
              inputRef={tagFieldRef}
            />
          </Popover>

          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={preview ? t('notes.editor.edit') : t('notes.editor.preview')}
            title={preview ? t('notes.editor.edit') : t('notes.editor.preview')}
            aria-pressed={preview}
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? <PenLine /> : <Eye />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('notes.editor.searchInNote')}
            disabled={preview}
            onClick={() => setSearchOpen(true)}
          >
            <Search />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('notes.editor.tools')}
            title={t('notes.editor.tools')}
            aria-expanded={toolsOpen}
            onClick={toggleTools}
          >
            <SlidersHorizontal className={cn(toolsOpen && 'text-primary')} />
          </Button>
          <span
            aria-hidden={!toolsOpen}
            className={cn(
              'grid transition-[grid-template-columns,opacity] duration-[var(--duration-base)] ease-[var(--ease-emphasized)]',
              toolsOpen ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
            )}
          >
            <span className="flex min-w-0 items-center gap-0.5 overflow-hidden">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={note.pinned ? t('notes.list.unpin') : t('notes.list.pin')}
                title={note.pinned ? t('notes.list.unpin') : t('notes.list.pin')}
                tabIndex={toolsOpen ? undefined : -1}
                onClick={() => void togglePin(note.id)}
              >
                <Pin className={cn(note.pinned && 'fill-primary text-primary')} />
              </Button>
              <span className="relative">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('notes.editor.links')}
                  title={t('notes.editor.links')}
                  aria-pressed={linksOpen}
                  tabIndex={toolsOpen ? undefined : -1}
                  onClick={() => setLinksOpen((value) => !value)}
                >
                  <Link2 className={cn(linksOpen && 'text-primary')} />
                </Button>
                {linkCount > 0 && (
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {linkCount}
                  </span>
                )}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('notes.editor.history')}
                title={t('notes.editor.history')}
                aria-pressed={historyOpen}
                tabIndex={toolsOpen ? undefined : -1}
                onClick={() => setHistoryOpen((value) => !value)}
              >
                <History className={cn(historyOpen && 'text-primary')} />
              </Button>
            </span>
          </span>
          <Menu label={t('notes.editor.more')} icon={<MoreVertical />} items={menuItems} />
        </div>

        {/* Mobile: tags + preview/edit, everything else one tap deeper. */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5 md:hidden [&_button:hover]:bg-surface [&_button:hover]:shadow-e1">
          <Popover
            open={tagsOpen}
            onOpenChange={setTagsOpen}
            label={t('notes.editor.tags')}
            className="fixed inset-x-4 top-24 w-auto"
            anchor={
              <span className="relative">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('notes.editor.tags')}
                  aria-haspopup="dialog"
                  aria-expanded={tagsOpen}
                  onClick={() => setTagsOpen((value) => !value)}
                >
                  <Tags />
                </Button>
                {tags.length > 0 && (
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {tags.length}
                  </span>
                )}
              </span>
            }
          >
            <TagEditor
              tags={tags}
              tagInput={tagInput}
              setTagInput={setTagInput}
              onTagInputKeyDown={onTagKeyDown}
              onAddTag={() => addTag(tagInput)}
              onRemoveTag={removeTag}
              inputRef={tagFieldRef}
            />
          </Popover>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('notes.editor.searchInNote')}
            title={t('notes.editor.searchInNote')}
            onClick={() => setSearchOpen(true)}
          >
            <Search />
          </Button>
          <Menu label={t('notes.editor.more')} icon={<MoreVertical />} items={mobileMenuItems} />
        </div>
      </header>

      {searchOpen && !preview && (
        <SearchBar
          term={term}
          matchCount={matchCount}
          onTermChange={applyTerm}
          onNext={() => editorRef.current?.findNext()}
          onPrevious={() => editorRef.current?.findPrevious()}
          onClose={closeSearch}
        />
      )}

      {preview ? (
        <Suspense fallback={<div className="min-h-0 flex-1" />}>
          {body.trim() ? (
            <MarkdownPreview
              className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
              source={body}
              resolveLink={resolveTargetId}
              onOpenNote={(id) => void select(id)}
            />
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t('notes.editor.emptyPreview')}
            </p>
          )}
        </Suspense>
      ) : (
        <Suspense fallback={<div className="min-h-0 flex-1" />}>
          <CodeEditor
            ref={editorRef}
            key={note.id}
            className="min-h-0 flex-1 overflow-auto"
            value={body}
            initialQuery={term || undefined}
            linkTargets={linkTargets}
            onMatchCount={setMatchCount}
            onRequestSearch={() => setSearchOpen(true)}
            onChange={(next) => {
              setBody(next)
              draft.current.body = next
              scheduleSave()
            }}
          />
        </Suspense>
      )}

      <EditorToolbar
        formattingEnabled={!preview}
        onFormat={(action) => editorRef.current?.format(action)}
      />

      {linksOpen && (
        <aside
          aria-label={t('notes.editor.links')}
          className="max-h-60 shrink-0 animate-fade-in overflow-y-auto border-t border-border/70 bg-muted/20 px-3 py-2"
        >
          {linkCount === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              {t('notes.editor.linksEmpty')}
            </p>
          ) : (
            <div className="space-y-3">
              {backlinks.length > 0 && (
                <section>
                  <p className="px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {t('notes.links.backlinks')} · {backlinks.length}
                  </p>
                  <ul className="space-y-0.5">
                    {backlinks.map((entry) => (
                      <li key={entry.note.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                          onClick={() => void select(entry.note.id)}
                        >
                          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            {entry.note.title.trim() || t('common.untitled')}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {relativeTime(entry.note.updatedAt)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {brokenLinks.length > 0 && (
                <section>
                  <p className="px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {t('notes.links.broken')} · {brokenLinks.length}
                  </p>
                  <ul className="space-y-0.5">
                    {brokenLinks.map((link, index) => (
                      <li
                        key={`${link.target}:${index}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                        title={t('notes.links.unresolvedHint')}
                      >
                        <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          [[{link.target}]]
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {t('notes.links.unresolvedHint')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </aside>
      )}

      {historyOpen && (
        <NoteHistory
          note={note}
          onRestore={(content) => {
            void update(note.id, {
              ...content,
              pinned: note.pinned,
              folderId: note.folderId,
              archived: note.archived,
            }).then(() => toast(t('notes.history.restored'), 'success'))
          }}
        />
      )}

      <footer className="flex shrink-0 items-center justify-end border-t border-border/70 px-4 py-1.5 text-[11px] text-muted-foreground tabular-nums">
        {t('notes.editor.stats', { words: countWords(body), chars: body.length })}
      </footer>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('notes.editor.deleteTitle')}
        description={t('notes.editor.deleteDesc')}
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                void remove(note.id).then(() => toast(t('notes.editor.deleted'), 'success'))
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <MoveNoteDialog
        open={moveOpen}
        currentFolderId={note.folderId}
        onSelect={(folderId) =>
          void moveToFolder(note.id, folderId).then(() => toast(t('notes.list.moved'), 'success'))
        }
        onClose={() => setMoveOpen(false)}
      />

      <PromptDialog
        open={templateOpen}
        title={t('templates.save')}
        description={t('templates.saveDesc')}
        placeholder={t('templates.namePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={(name) => {
          void createTemplate({ name, title, body, tags, folderId: note.folderId }).then(() =>
            toast(t('templates.saved'), 'success'),
          )
        }}
        onClose={() => setTemplateOpen(false)}
      />
    </div>
  )
}
