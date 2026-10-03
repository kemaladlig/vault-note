import { Archive, ArchiveRestore, ChevronLeft, Download, FolderInput, MoreVertical, Pin, Search, Tags, Trash2, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from '@/shared/toast'

import { downloadNoteMarkdown } from '../export'
import type { DecryptedNote, NoteContent } from '../model'
import { useNotesStore } from '../store/notesStore'
import type { CodeEditorHandle } from './CodeEditor'
import { MoveNoteDialog } from './MoveNoteDialog'
import { SearchBar } from './SearchBar'

// CodeMirror is the heaviest dependency; load it only when a note is opened.
const CodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))

const SAVE_DELAY_MS = 500

interface NoteEditorProps {
  note: DecryptedNote
  /** Pre-fills and opens in-note search (used when opening from a search hit). */
  initialSearch?: string
  /** Mobile: return to the note list. */
  onBack?: () => void
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').trim()
}

/** Single-note editor: encrypted save is debounced, then flushed on unmount. */
export function NoteEditor({ note, initialSearch, onBack }: NoteEditorProps) {
  const update = useNotesStore((s) => s.update)
  const remove = useNotesStore((s) => s.remove)
  const togglePin = useNotesStore((s) => s.togglePin)
  const setArchived = useNotesStore((s) => s.setArchived)
  const moveToFolder = useNotesStore((s) => s.moveToFolder)

  const [title, setTitle] = useState(note.title)
  const [tags, setTags] = useState(note.tags)
  const [tagInput, setTagInput] = useState('')
  const [dirty, setDirty] = useState(false)
  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearch))
  const [term, setTerm] = useState(initialSearch ?? '')
  const [matchCount, setMatchCount] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)

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

  const menuItems: MenuItem[] = [
    {
      label: 'Markdown olarak indir',
      icon: <Download />,
      onSelect: () => {
        downloadNoteMarkdown({ ...note, title, tags })
        toast('Markdown indirildi (şifresiz).', 'success')
      },
    },
    { type: 'separator' },
    {
      label: note.archived ? 'Arşivden çıkar' : 'Arşivle',
      icon: note.archived ? <ArchiveRestore /> : <Archive />,
      onSelect: () => void setArchived(note.id, !note.archived),
    },
    {
      label: 'Not defterine taşı…',
      icon: <FolderInput />,
      onSelect: () => setMoveOpen(true),
    },
    { type: 'separator' },
    {
      label: 'Sil',
      icon: <Trash2 />,
      destructive: true,
      onSelect: () => setConfirmDelete(true),
    },
  ]

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/70 px-2">
        {onBack && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="md:hidden"
            aria-label="Notlara dön"
            onClick={onBack}
          >
            <ChevronLeft />
          </Button>
        )}
        <Input
          value={title}
          placeholder="Başlıksız"
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
            'hidden shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground transition-opacity duration-200 sm:flex',
            dirty ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Kaydediliyor…
        </span>

        <Popover
          open={tagsOpen}
          onOpenChange={setTagsOpen}
          label="Etiketler"
          className="w-64"
          anchor={
            <span className="relative">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Etiketler"
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
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Etiketler
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
                    aria-label={`${tag} etiketini kaldır`}
                    className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagFieldRef}
                value={tagInput}
                aria-label="Etiket ekle"
                placeholder={tags.length > 0 ? 'Ekle…' : 'Etiket ekle…'}
                className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => addTag(tagInput)}
              />
            </div>
          </div>
        </Popover>

        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          title={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          onClick={() => void togglePin(note.id)}
        >
          <Pin className={cn(note.pinned && 'fill-primary text-primary')} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Notta ara"
          onClick={() => setSearchOpen(true)}
        >
          <Search />
        </Button>
        <Menu label="Diğer işlemler" icon={<MoreVertical />} items={menuItems} />
      </header>

      {searchOpen && (
        <SearchBar
          term={term}
          matchCount={matchCount}
          onTermChange={applyTerm}
          onNext={() => editorRef.current?.findNext()}
          onPrevious={() => editorRef.current?.findPrevious()}
          onClose={closeSearch}
        />
      )}

      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <CodeEditor
          ref={editorRef}
          key={note.id}
          className="min-h-0 flex-1 overflow-auto"
          value={note.body}
          initialQuery={initialSearch}
          onMatchCount={setMatchCount}
          onRequestSearch={() => setSearchOpen(true)}
          onChange={(body) => {
            draft.current.body = body
            scheduleSave()
          }}
        />
      </Suspense>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Notu sil"
        description="Bu not bu cihazdan silinecek. Senkronize edilmiş cihazlardan da kaldırılır."
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                void remove(note.id).then(() => toast('Not silindi.', 'success'))
              }}
            >
              Sil
            </Button>
          </>
        }
      />

      <MoveNoteDialog
        open={moveOpen}
        currentFolderId={note.folderId}
        onSelect={(folderId) => void moveToFolder(note.id, folderId)}
        onClose={() => setMoveOpen(false)}
      />
    </div>
  )
}
