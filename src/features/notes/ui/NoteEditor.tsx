import { Search, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { DecryptedNote, NoteContent } from '../model'
import { useNotesStore } from '../store/notesStore'
import type { CodeEditorHandle } from './CodeEditor'
import { SearchBar } from './SearchBar'

// CodeMirror is the heaviest dependency; load it only when a note is opened.
const CodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))

const SAVE_DELAY_MS = 500

interface NoteEditorProps {
  note: DecryptedNote
  /** Pre-fills and opens in-note search (used when opening from a global search hit). */
  initialSearch?: string
}

/** Single-note editor: encrypted save is debounced, then flushed on unmount. */
export function NoteEditor({ note, initialSearch }: NoteEditorProps) {
  const update = useNotesStore((s) => s.update)
  const remove = useNotesStore((s) => s.remove)

  const [title, setTitle] = useState(note.title)
  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearch))
  const [term, setTerm] = useState(initialSearch ?? '')
  const [matchCount, setMatchCount] = useState(0)

  const editorRef = useRef<CodeEditorHandle>(null)
  const draft = useRef<NoteContent>({ title: note.title, body: note.body, tags: note.tags })
  const timer = useRef<number | undefined>(undefined)

  function scheduleSave() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void update(note.id, draft.current)
    }, SAVE_DELAY_MS)
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

  // Flush unsaved edits when switching notes or leaving the screen.
  // Aliasing the refs keeps the linter happy: these are mutable timer/draft holders, not DOM nodes.
  useEffect(() => {
    const pendingTimer = timer
    const pendingDraft = draft
    return () => {
      window.clearTimeout(pendingTimer.current)
      void update(note.id, pendingDraft.current)
    }
  }, [note.id, update])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b p-2">
        <Input
          value={title}
          placeholder="Başlıksız"
          className="border-none bg-transparent text-base font-medium shadow-none focus-visible:ring-0"
          onChange={(e) => {
            setTitle(e.target.value)
            draft.current.title = e.target.value
            scheduleSave()
          }}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Notta ara"
          onClick={() => setSearchOpen(true)}
        >
          <Search />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Notu sil"
          onClick={() => void remove(note.id)}
        >
          <Trash2 />
        </Button>
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
    </div>
  )
}
