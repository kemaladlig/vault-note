import { markdown } from '@codemirror/lang-markdown'
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
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

import { normalizeTr } from '../search'
import { activeFormatsAt, livePreview, livePreviewTheme } from './livePreview'

export interface CodeEditorHandle {
  /** Set the active search term ('' clears it) and jump to the first match. */
  setQuery: (term: string) => void
  findNext: () => void
  findPrevious: () => void
  /** Wrap/prefix the selection with Markdown (toolbar); fires `onChange` like typing. */
  format: (action: EditorFormat) => void
  /** Replace the whole document without notifying `onChange` (remote revision). */
  setValue: (text: string) => void
}

/** Markdown actions offered by the editor toolbar (registry in EditorToolbar). */
export type EditorFormat =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'list'
  | 'task'
  | 'quote'
  | 'code'
  | 'link'

/** One `[[` autocomplete entry: `label` shows in the list, `insert` replaces the query. */
export interface LinkTarget {
  label: string
  insert: string
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
  /** Candidates offered after `[[`. Read live, so it can change while editing. */
  linkTargets?: LinkTarget[]
  /** Formats active at the selection; lets the toolbar show pressed states. */
  onActiveFormats?: (formats: EditorFormat[]) => void
  className?: string
}

/** CodeMirror theme wired to design tokens; also styles search matches. */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'calc(1rem + var(--editor-delta))',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'var(--editor-line-height)',
    padding: '0 4px',
  },
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Turkish-insensitive literal pattern for CodeMirror's regexp search. The term is
 * folded the same way as global search (`normalizeTr`), then each plain vowel /
 * consonant that has a dotted variant expands to a class so `sifre` also finds
 * `şifre` (and vice versa). Length stays 1 char -> 1 match, like the global index.
 */
function trPattern(term: string): string {
  return escapeRegExp(normalizeTr(term))
    .replaceAll('c', '[cç]')
    .replaceAll('g', '[gğ]')
    .replaceAll('i', '[iı]')
    .replaceAll('o', '[oö]')
    .replaceAll('s', '[sş]')
    .replaceAll('u', '[uü]')
}

/** Build the active query for a term, or null when the term is empty (clears). */
function queryFor(term: string): SearchQuery | null {
  if (!term) return null
  return new SearchQuery({ search: trPattern(term), caseSensitive: false, regexp: true })
}

interface LineChange {
  from: number
  to: number
  insert: string
}

/** Wrap the selection (or an empty cursor) and leave the caret around the inner text. */
function toggleWrap(view: EditorView, before: string, after: string): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length)
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    })
  }
  view.focus()
}

/**
 * Toggle a line prefix across the selected lines. When every touched line already
 * carries the marker it is removed; otherwise missing markers are added and
 * existing ones are left alone. Blank lines are never decorated.
 */
function reformatLines(
  view: EditorView,
  active: (text: string) => boolean,
  edit: (text: string, lineFrom: number) => LineChange | null,
  remove: (text: string, lineFrom: number) => LineChange | null,
): void {
  const { state } = view
  const sel = state.selection.main
  const first = state.doc.lineAt(sel.from).number
  const last = state.doc.lineAt(sel.to).number
  const rows: { from: number; text: string }[] = []
  for (let n = first; n <= last; n++) {
    const line = state.doc.line(n)
    if (!line.text.trim()) continue
    rows.push({ from: line.from, text: line.text })
  }
  if (rows.length === 0) return
  const turningOff = rows.every((row) => active(row.text))
  const changes: LineChange[] = []
  for (const row of rows) {
    const change = turningOff ? remove(row.text, row.from) : active(row.text) ? null : edit(row.text, row.from)
    if (change) changes.push(change)
  }
  if (changes.length === 0) return
  view.dispatch({ changes })
  view.focus()
}

const CHECKBOX = /^- \[[ xX]\] /

function formatHeading(view: EditorView): void {
  const marker = /^(#{1,6} )/
  reformatLines(
    view,
    (text) => marker.test(text),
    (_, lineFrom) => ({ from: lineFrom, to: lineFrom, insert: '# ' }),
    (text, lineFrom) => ({ from: lineFrom, to: lineFrom + text.match(marker)![0].length, insert: '' }),
  )
}

function formatQuote(view: EditorView): void {
  reformatLines(
    view,
    (text) => text.startsWith('> '),
    (_, lineFrom) => ({ from: lineFrom, to: lineFrom, insert: '> ' }),
    (_, lineFrom) => ({ from: lineFrom, to: lineFrom + 2, insert: '' }),
  )
}

function formatList(view: EditorView): void {
  reformatLines(
    view,
    (text) => text.startsWith('- ') || CHECKBOX.test(text),
    (_, lineFrom) => ({ from: lineFrom, to: lineFrom, insert: '- ' }),
    // Checkbox items belong to the task action — never strip them into `[ ] foo`.
    (text, lineFrom) => (CHECKBOX.test(text) ? null : { from: lineFrom, to: lineFrom + 2, insert: '' }),
  )
}

function formatTask(view: EditorView): void {
  reformatLines(
    view,
    (text) => CHECKBOX.test(text),
    (text, lineFrom) =>
      text.startsWith('- ')
        ? { from: lineFrom, to: lineFrom + 2, insert: '- [ ] ' }
        : { from: lineFrom, to: lineFrom, insert: '- [ ] ' },
    (text, lineFrom) => ({
      from: lineFrom,
      to: lineFrom + text.match(CHECKBOX)![0].length,
      insert: '',
    }),
  )
}

function formatCode(view: EditorView): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (!selected.includes('\n')) {
    toggleWrap(view, '`', '`')
    return
  }
  if (/^```[^\n]*\n[\s\S]*\n```$/.test(selected)) {
    const lines = selected.split('\n')
    lines.shift()
    lines.pop()
    const inner = lines.join('\n')
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    })
  } else {
    const insert = `\`\`\`\n${selected}\n\`\`\``
    const innerFrom = from + 4
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: innerFrom, head: innerFrom + selected.length },
    })
  }
  view.focus()
}

/** One formatter per toolbar action — no conditionals at the call site. */
const FORMATTERS: Record<EditorFormat, (view: EditorView) => void> = {
  bold: (view) => toggleWrap(view, '**', '**'),
  italic: (view) => toggleWrap(view, '*', '*'),
  heading: formatHeading,
  list: formatList,
  task: formatTask,
  quote: formatQuote,
  code: formatCode,
  link: (view) => toggleWrap(view, '[[', ']]'),
}

/**
 * Thin React wrapper around CodeMirror 6. Created once per mount; `value` is not synced back
 * to avoid clobbering the cursor while typing. Search is driven imperatively through the ref.
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    onMatchCount,
    onRequestSearch,
    initialQuery,
    linkTargets,
    onActiveFormats,
    className,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialDoc = useRef(value)
  const initialQueryRef = useRef(initialQuery)
  const changeRef = useRef(onChange)
  const matchRef = useRef(onMatchCount)
  const requestRef = useRef(onRequestSearch)
  const linkRef = useRef<LinkTarget[]>(linkTargets ?? [])
  const formatsRef = useRef(onActiveFormats)
  // Serialized active-format set; the report only fires when it actually changes.
  const formatsKey = useRef('')
  // Active in-note query; kept so the match count can be refreshed as the doc changes.
  const activeQuery = useRef<SearchQuery | null>(null)
  // True while we dispatch a programmatic doc change, so it is not reported as a user edit.
  const applying = useRef(false)

  useEffect(() => {
    changeRef.current = onChange
    matchRef.current = onMatchCount
    requestRef.current = onRequestSearch
    linkRef.current = linkTargets ?? []
    formatsRef.current = onActiveFormats
  })

  useImperativeHandle(ref, () => ({
    setQuery: (term) => {
      const view = viewRef.current
      if (!view) return
      const query = queryFor(term)
      activeQuery.current = query
      if (!query) {
        view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
        matchRef.current?.(0)
        return
      }
      view.dispatch({ effects: setSearchQuery.of(query) })
      matchRef.current?.(countMatches(view.state, query))
      cmFindNext(view)
    },
    findNext: () => {
      if (viewRef.current) cmFindNext(viewRef.current)
    },
    findPrevious: () => {
      if (viewRef.current) cmFindPrevious(viewRef.current)
    },
    format: (action) => {
      const view = viewRef.current
      if (!view) return
      FORMATTERS[action](view)
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
    // Offer `[[` note completion through CodeMirror's language-data channel, so it rides
    // basicSetup's existing autocompletion instead of adding a second one.
    const linkSource = (context: CompletionContext): CompletionResult | null => {
      const before = context.matchBefore(/\[\[[^[\]\n]*$/)
      if (!before) return null
      const targets = linkRef.current
      if (targets.length === 0) return null
      return {
        from: before.from + 2,
        options: targets.map((target) => ({
          label: target.label,
          apply: target.insert,
          type: 'text',
        })),
        validFor: /^[^[\]\n]*$/,
      }
    }
    const reportFormats = (view: EditorView) => {
      const callback = formatsRef.current
      if (!callback) return
      const list = [...activeFormatsAt(view.state)]
      const key = list.join('|')
      if (key === formatsKey.current) return
      formatsKey.current = key
      callback(list)
    }
    const extensions: Extension[] = [
      basicSetup,
      markdown(),
      EditorState.languageData.of(() => [{ autocomplete: linkSource }]),
      EditorView.lineWrapping,
      theme,
      livePreview,
      livePreviewTheme,
      search(),
      // Own Mod-F beats basicSetup's searchKeymap so we can drive our own UI.
      Prec.high(
        keymap.of([{ key: 'Mod-f', run: () => (requestRef.current?.(), true) }]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applying.current) {
          changeRef.current(update.state.doc.toString())
          if (activeQuery.current) {
            matchRef.current?.(countMatches(update.state, activeQuery.current))
          }
        }
        if (update.docChanged || update.selectionSet) reportFormats(update.view)
      }),
    ]
    const view = new EditorView({
      state: EditorState.create({ doc: initialDoc.current, extensions }),
      parent: host.current,
    })
    viewRef.current = view
    reportFormats(view)
    if (initialQueryRef.current) {
      const query = queryFor(initialQueryRef.current)
      if (query) {
        activeQuery.current = query
        view.dispatch({ effects: setSearchQuery.of(query) })
        matchRef.current?.(countMatches(view.state, query))
        cmFindNext(view)
      }
    }
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  return <div ref={host} className={className} />
})
