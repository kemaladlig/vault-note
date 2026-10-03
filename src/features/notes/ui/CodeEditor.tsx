import { markdown } from '@codemirror/lang-markdown'
import {
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  SearchQuery,
  search,
  setSearchQuery,
} from '@codemirror/search'
import { EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface CodeEditorHandle {
  /** Set the active search term ('' clears it) and jump to the first match. */
  setQuery: (term: string) => void
  findNext: () => void
  findPrevious: () => void
  /** Replace the whole document without notifying `onChange` (remote revision). */
  setValue: (text: string) => void
}

interface CodeEditorProps {
  /** Initial document. Change notes by remounting via `key`. */
  value: string
  onChange: (value: string) => void
  /** Reported whenever the match count changes for the active query. */
  onMatchCount?: (count: number) => void
  /** Fired on Mod-F so the host can open its own search bar. */
  onRequestSearch?: () => void
  /** Applied once on mount (the host seeds this from its global search). */
  initialQuery?: string
  className?: string
}

/** CodeMirror theme wired to design tokens; also styles search matches. */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: '1rem',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.75', padding: '0 4px' },
  // CodeMirror draws its own cursor; its default is black and vanishes on dark.
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-foreground)',
    borderLeftWidth: '2px',
  },
  '.cm-content': { caretColor: 'var(--color-foreground)' },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--color-primary) 22%, transparent)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--search-highlight)',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--search-highlight-active)',
  },
})

function countMatches(state: EditorState, query: SearchQuery): number {
  let count = 0
  const cursor = query.getCursor(state)
  while (!cursor.next().done) count++
  return count
}

/**
 * Thin React wrapper around CodeMirror 6. Created once per mount; `value` is not synced back
 * to avoid clobbering the cursor while typing. Search is driven imperatively through the ref.
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, onMatchCount, onRequestSearch, initialQuery, className },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialDoc = useRef(value)
  const initialQueryRef = useRef(initialQuery)
  const changeRef = useRef(onChange)
  const matchRef = useRef(onMatchCount)
  const requestRef = useRef(onRequestSearch)
  // True while we dispatch a programmatic doc change, so it is not reported as a user edit.
  const applying = useRef(false)

  useEffect(() => {
    changeRef.current = onChange
    matchRef.current = onMatchCount
    requestRef.current = onRequestSearch
  })

  useImperativeHandle(ref, () => ({
    setQuery: (term) => {
      const view = viewRef.current
      if (!view) return
      const query = new SearchQuery({ search: term, caseSensitive: false })
      view.dispatch({ effects: setSearchQuery.of(query) })
      matchRef.current?.(term ? countMatches(view.state, query) : 0)
      if (term) cmFindNext(view)
    },
    findNext: () => {
      if (viewRef.current) cmFindNext(viewRef.current)
    },
    findPrevious: () => {
      if (viewRef.current) cmFindPrevious(viewRef.current)
    },
    setValue: (text) => {
      const view = viewRef.current
      if (!view || view.state.doc.toString() === text) return
      applying.current = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      applying.current = false
    },
  }))

  useEffect(() => {
    if (!host.current) return
    const extensions: Extension[] = [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      theme,
      search(),
      // Own Mod-F beats basicSetup's searchKeymap so we can drive our own UI.
      Prec.high(
        keymap.of([{ key: 'Mod-f', run: () => (requestRef.current?.(), true) }]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applying.current) changeRef.current(update.state.doc.toString())
      }),
    ]
    const view = new EditorView({
      state: EditorState.create({ doc: initialDoc.current, extensions }),
      parent: host.current,
    })
    viewRef.current = view
    if (initialQueryRef.current) {
      const query = new SearchQuery({ search: initialQueryRef.current, caseSensitive: false })
      view.dispatch({ effects: setSearchQuery.of(query) })
      matchRef.current?.(countMatches(view.state, query))
      cmFindNext(view)
    }
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  return <div ref={host} className={className} />
})
