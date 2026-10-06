import { markdown } from '@codemirror/lang-markdown'
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import {
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  getSearchQuery,
  RegExpCursor,
  SearchQuery,
  search,
  setSearchQuery,
} from '@codemirror/search'
import { EditorState, Prec, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { normalizeTr } from '../search'
import { activeFormatsAt, inlineUnwrapTarget, livePreview, livePreviewTheme } from './livePreview'

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

/** Viewport-space bounds of a non-empty selection; anchors the desktop bubble toolbar. */
export interface SelectionRect {
  top: number
  bottom: number
  left: number
  right: number
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
  /** Non-empty selection bounds in viewport coords; null when empty or scrolled away. */
  onSelectionRect?: (rect: SelectionRect | null) => void
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
  '.cm-content': {
    caretColor: 'var(--color-foreground)',
    // Reading measure from index.css: flush-left so the body shares the title's
    // edge; the cap is absorbed as right padding. Wide collapses both to gutter.
    paddingLeft: '0.75rem',
    paddingRight: 'max(0.75rem, calc(100% - var(--editor-measure) - 0.75rem))',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--color-primary) 22%, transparent)',
  },
  // basicSetup ships highlightSelectionMatches with a default green wash that
  // fights our yellow search pills — disable it, search has its own marks.
  '.cm-selectionMatch': {
    backgroundColor: 'transparent',
    outline: 'none',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--search-highlight)',
    color: 'var(--search-highlight-ink)',
    outline: '1px solid var(--search-highlight-ring)',
    outlineOffset: '1px',
    borderRadius: 'calc(var(--radius) / 4)',
    fontWeight: '600',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--search-highlight-active)',
    color: 'var(--search-highlight-ink)',
    outline: '2px solid var(--search-highlight-active-ring)',
    outlineOffset: '0px',
    boxShadow: '0 1px 6px 0 color-mix(in srgb, var(--search-highlight-active-ring) 55%, transparent)',
    fontWeight: '700',
    animation: 'search-match-pop var(--duration-base) var(--ease-standard)',
  },
})

function countMatches(state: EditorState, query: SearchQuery): number {
  let count = 0
  const cursor = query.getCursor(state)
  while (!cursor.next().done) count++
  return count
}

/**
 * Our own match highlighter. CodeMirror's built-in `searchHighlighter` only
 * paints when its own search panel is open (`panel != null`), but we drive the
 * query from our custom SearchBar and never open that panel — so without this
 * nothing ever got the `.cm-searchMatch` class. Count + jump worked, the
 * yellow paint did not (only the green `selectionMatch` leftovers showed).
 */
const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' })
const searchSelectedMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

const inNoteSearchHighlighter = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof Decoration.set>
    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }
    update(update: ViewUpdate) {
      const prevQuery = getSearchQuery(update.startState)
      const nextQuery = getSearchQuery(update.state)
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        !prevQuery.eq(nextQuery)
      ) {
        this.decorations = this.build(update.view)
      }
    }
    build(view: EditorView) {
      const spec = getSearchQuery(view.state)
      if (!spec.valid || !spec.search) return Decoration.none
      const builder = new RangeSetBuilder<Decoration>()
      for (const { from, to } of view.visibleRanges) {
        const cursor = new RegExpCursor(view.state.doc, spec.search, { ignoreCase: !spec.caseSensitive }, from, to)
        while (!cursor.next().done) {
          const { from: matchFrom, to: matchTo } = cursor.value
          if (matchTo <= matchFrom) continue
          const selected = view.state.selection.ranges.some(
            (r) => r.from === matchFrom && r.to === matchTo,
          )
          builder.add(matchFrom, matchTo, selected ? searchSelectedMark : searchMatchMark)
        }
      }
      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations },
)

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
function centerSelection(view: EditorView): void {
  const head = view.state.selection.main.head
  view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center', yMargin: 80 }) })
}

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
  } else if (from === to && stripsEmptyWrap(view, from, before, after)) {
    // Handled: pressing again on the empty markers just made removes them instead of stacking.
  } else {
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    })
  }
  view.focus()
}

/**
 * With an empty selection sitting between a bare marker pair (`**|`), remove the pair —
 * an empty `****` never parses, so the tree cannot report it. The outer-neighbour guard
 * keeps an italic press inside `**|` from eating one star of the bold pair.
 */
function stripsEmptyWrap(view: EditorView, at: number, before: string, after: string): boolean {
  const open = view.state.sliceDoc(Math.max(0, at - before.length), at)
  const close = view.state.sliceDoc(at, at + after.length)
  if (open !== before || close !== after) return false
  if (view.state.sliceDoc(at - before.length - 1, at - before.length) === before.slice(-1)) return false
  if (view.state.sliceDoc(at + after.length, at + after.length + 1) === after.slice(0, 1)) return false
  view.dispatch({
    changes: [
      { from: at - before.length, to: at, insert: '' },
      { from: at, to: at + after.length, insert: '' },
    ],
    selection: { anchor: at - before.length },
  })
  return true
}

/** Strip the marker pair the selection sits inside; true when the format was removed. */
function unwrapInline(view: EditorView, format: EditorFormat): boolean {
  const target = inlineUnwrapTarget(view.state, format)
  if (!target) return false
  const { from, to, len } = target
  const shift = (pos: number): number =>
    pos <= from ? pos : pos > to ? pos - len * 2 : Math.max(from, pos - len)
  const sel = view.state.selection.main
  view.dispatch({
    changes: [
      { from, to: from + len, insert: '' },
      { from: to - len, to, insert: '' },
    ],
    selection: { anchor: shift(sel.anchor), head: shift(sel.head) },
  })
  view.focus()
  return true
}

/** Pressing an inline format inside itself strips it; everywhere else it wraps. */
function toggleInline(format: EditorFormat, before: string, after: string) {
  return (view: EditorView): void => {
    if (!unwrapInline(view, format)) toggleWrap(view, before, after)
  }
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
    if (!unwrapInline(view, 'code')) toggleWrap(view, '`', '`')
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
  bold: toggleInline('bold', '**', '**'),
  italic: toggleInline('italic', '*', '*'),
  heading: formatHeading,
  list: formatList,
  task: formatTask,
  quote: formatQuote,
  code: formatCode,
  link: toggleInline('link', '[[', ']]'),
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
    onSelectionRect,
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
  const selectionRectRef = useRef(onSelectionRect)
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
    selectionRectRef.current = onSelectionRect
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
      centerSelection(view)
    },
    findNext: () => {
      const view = viewRef.current
      if (!view) return
      cmFindNext(view)
      centerSelection(view)
    },
    findPrevious: () => {
      const view = viewRef.current
      if (!view) return
      cmFindPrevious(view)
      centerSelection(view)
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
    const reportSelection = (view: EditorView) => {
      const callback = selectionRectRef.current
      if (!callback) return
      const sel = view.state.selection.main
      const start = sel.empty ? null : view.coordsAtPos(sel.from)
      const end = sel.empty ? null : view.coordsAtPos(sel.to)
      if (!start || !end) {
        callback(null)
        return
      }
      callback({
        top: Math.min(start.top, end.top),
        bottom: Math.max(start.bottom, end.bottom),
        left: Math.min(start.left, end.left),
        right: Math.max(start.right, end.right),
      })
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
      inNoteSearchHighlighter,
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
        if (update.docChanged || update.selectionSet) {
          reportFormats(update.view)
          reportSelection(update.view)
        }
        // Scroll-only updates leave stale anchors; the bubble hides and returns with
        // the next selection. (Edits also flip viewportChanged, so guard for pure scrolls.)
        if (update.viewportChanged && !update.docChanged && !update.selectionSet) {
          selectionRectRef.current?.(null)
        }
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
        centerSelection(view)
      }
    }
    return () => {
      selectionRectRef.current?.(null)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  return <div ref={host} className={className} />
})
