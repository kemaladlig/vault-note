import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type EditorState } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'

import type { EditorFormat } from './CodeEditor'

/**
 * Obsidian-style live preview over the plain Markdown source: formatting renders in place
 * and syntax markers fade out until the selection touches them. The document itself is
 * never rewritten — everything here is decorations, so the stored note is still Markdown.
 */

/** Inline nodes we restyle, and the mark node that wraps them. */
const INLINE_STYLES: Record<string, { cls: string; mark: string }> = {
  StrongEmphasis: { cls: 'cm-md-strong', mark: 'StrongEmphasisMark' },
  Emphasis: { cls: 'cm-md-emph', mark: 'EmphasisMark' },
  InlineCode: { cls: 'cm-md-code', mark: 'CodeMark' },
}

const HEADING_SIZES = ['', 'cm-md-h1', 'cm-md-h2', 'cm-md-h3', 'cm-md-h3', 'cm-md-h3', 'cm-md-h3']

/** Bullet / checkbox stand-ins rendered where the marker was while unfocused. */
class GlyphWidget extends WidgetType {
  private readonly glyph: string
  private readonly cls: string
  constructor(glyph: string, cls: string) {
    super()
    this.glyph = glyph
    this.cls = cls
  }
  override eq(other: GlyphWidget) {
    return other.glyph === this.glyph && other.cls === this.cls
  }
  override toDOM() {
    const el = document.createElement('span')
    el.className = this.cls
    el.textContent = this.glyph
    return el
  }
  override ignoreEvent() {
    return false
  }
}

interface Item {
  from: number
  to: number
  deco: Decoration
}

function hide(from: number, to: number, items: Item[]) {
  if (to > from) items.push({ from, to, deco: Decoration.replace({}) })
}

function glyph(from: number, to: number, text: string, cls: string, items: Item[]) {
  items.push({ from, to, deco: Decoration.replace({ widget: new GlyphWidget(text, cls) }) })
}

const WIKILINK = /\[\[([^[\]\n]+)\]\]/g
const TASK_LINE = /^(\s*[-*+] )(\[[ xX]\])/

function decorationsFor(view: EditorView): DecorationSet {
  const { state } = view
  const doc = state.doc
  const sel = state.selection.main
  const selFromLine = doc.lineAt(sel.from).number
  const selToLine = doc.lineAt(sel.to).number
  const items: Item[] = []
  // One line decoration per line; nested nodes on the same line must not stack.
  const lineCls = new Map<number, string>()
  const line = (pos: number) => doc.lineAt(pos)
  const onLine = (pos: number) => {
    const n = line(pos).number
    return n >= selFromLine && n <= selToLine
  }
  const touched = (from: number, to: number) => sel.from <= to && sel.to >= from

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name
        const inline = INLINE_STYLES[name]
        if (inline) {
          items.push({
            from: node.from,
            to: node.to,
            deco: Decoration.mark({ class: inline.cls }),
          })
          const active = touched(node.from, node.to)
          for (const mark of node.node.getChildren(inline.mark)) {
            if (!active) hide(mark.from, mark.to, items)
          }
          return false
        }
        if (name.startsWith('ATXHeading')) {
          const cls = HEADING_SIZES[Number(name.replace('ATXHeading', '')) || 1]
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: cls }) })
          if (!onLine(node.from)) {
            for (const mark of node.node.getChildren('HeaderMark')) hide(mark.from, mark.to, items)
          }
          return false
        }
        if (name === 'Blockquote') {
          for (let n = line(node.from).number; n <= line(node.to - 1).number; n++) {
            if (!lineCls.has(n)) lineCls.set(n, 'cm-md-quote')
          }
          return true
        }
        if (name === 'QuoteMark') {
          if (!onLine(node.from)) hide(node.from, node.to, items)
          return
        }
        if (name === 'FencedCodeBlock') {
          for (let n = line(node.from).number; n <= line(node.to - 1).number; n++) {
            if (!lineCls.has(n)) lineCls.set(n, 'cm-md-codeblock')
          }
          return true
        }
        if (name === 'HorizontalRule') {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: 'cm-md-muted' }) })
          return false
        }
        if (name === 'ListItem') {
          const mark = node.node.getChild('ListMark')
          if (mark && !onLine(mark.from)) {
            const row = doc.lineAt(mark.from)
            const task = TASK_LINE.exec(row.text)
            if (task) {
              hide(mark.from, mark.to, items)
              const boxFrom = row.from + task[1].length
              const checked = task[2][1] !== ' '
              glyph(boxFrom, boxFrom + task[2].length, checked ? '☑' : '☐', 'cm-md-check', items)
            } else if (/^[-*+]$/.test(row.text.slice(mark.from - row.from, mark.to - row.from))) {
              glyph(mark.from, mark.to, '•', 'cm-md-glyph', items)
            }
          }
          return true
        }
        if (name === 'Link' || name === 'AutoLink') {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: 'cm-md-link' }) })
          if (!touched(node.from, node.to)) {
            for (const mark of node.node.getChildren('LinkMark')) hide(mark.from, mark.to, items)
            const url = node.node.getChild('URL')
            if (url && name === 'Link') hide(url.from, url.to, items)
          }
          return false
        }
      },
    })

    // Wikilinks are ours, not CommonMark — find them by pattern. Keep the target
    // editable text; only the brackets fold away when the caret is elsewhere.
    const text = state.sliceDoc(from, to)
    WIKILINK.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKILINK.exec(text))) {
      const start = from + match.index
      const end = start + match[0].length
      if (touched(start, end)) continue
      items.push({ from: start, to: start + 2, deco: Decoration.replace({}) })
      items.push({ from: end - 2, to: end, deco: Decoration.replace({}) })
      items.push({
        from: start + 2,
        to: end - 2,
        deco: Decoration.mark({ class: 'cm-md-link' }),
      })
    }
  }

  for (const [number, cls] of lineCls) {
    items.push({
      from: doc.line(number).from,
      to: doc.line(number).from,
      deco: Decoration.line({ class: cls }),
    })
  }

  // RangeSetBuilder needs strictly ordered input; marks and replaces may interleave.
  items.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  for (const item of items) builder.add(item.from, item.to, item.deco)
  return builder.finish()
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = decorationsFor(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = decorationsFor(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/** Token-driven styles for the preview decorations; lives with the plugin on purpose. */
export const livePreviewTheme = EditorView.theme({
  '.cm-md-strong': { fontWeight: '700' },
  '.cm-md-emph': { fontStyle: 'italic' },
  '.cm-md-code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.9em',
    backgroundColor: 'color-mix(in oklch, var(--color-muted) 75%, transparent)',
    borderRadius: 'calc(var(--radius) / 3)',
    padding: '0.05em 0.3em',
  },
  '.cm-md-h1': { fontSize: '1.45em', fontWeight: '650', lineHeight: '1.35' },
  '.cm-md-h2': { fontSize: '1.28em', fontWeight: '650', lineHeight: '1.4' },
  '.cm-md-h3': { fontSize: '1.13em', fontWeight: '600', lineHeight: '1.45' },
  '.cm-md-quote': {
    borderLeft: '2px solid var(--color-border)',
    paddingLeft: '0.9em',
    color: 'var(--color-muted-foreground)',
  },
  '.cm-md-codeblock': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.9em',
  },
  '.cm-md-link': {
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '0.15em',
  },
  '.cm-md-muted': { opacity: '0.45' },
  '.cm-md-glyph': { color: 'var(--color-muted-foreground)', paddingRight: '0.35em' },
  '.cm-md-check': { color: 'var(--color-muted-foreground)', paddingRight: '0.35em' },
})

/**
 * Which toolbar actions are active at the selection, so the bar can light up like the
 * text itself. Line markers come from regexes (same shapes the formatters write); inline
 * marks come from the parsed syntax tree, matching the live-preview rendering.
 */
export function activeFormatsAt(state: EditorState): Set<EditorFormat> {
  const out = new Set<EditorFormat>()
  const sel = state.selection.main
  const text = state.doc.lineAt(sel.head).text
  if (/^\s*#{1,6} /.test(text)) out.add('heading')
  if (/^\s*> /.test(text)) out.add('quote')
  if (/^\s*[-*+] \[[ xX]\] /.test(text)) out.add('task')
  else if (/^\s*([-*+]|\d+[.)]) /.test(text)) out.add('list')

  // Structural view of the tree walk — avoids depending on @lezer/common types directly.
  interface NodeChain {
    name: string
    parent: NodeChain | null
  }
  const atCursor = syntaxTree(state).resolveInner(sel.head, 1) as unknown as NodeChain | null
  for (let node = atCursor; node; node = node.parent) {
    const name = node.name
    if (name === 'StrongEmphasis') out.add('bold')
    else if (name === 'Emphasis') out.add('italic')
    else if (name === 'InlineCode') out.add('code')
    else if (name === 'Link' || name === 'AutoLink') out.add('link')
  }

  // Wikilinks are not in the CommonMark tree; light up `link` from the raw line instead.
  const offset = sel.head - state.doc.lineAt(sel.head).from
  const brackets = text.matchAll(/\[\[[^[\]\n]+\]\]/g)
  for (const match of brackets) {
    const start = match.index ?? 0
    if (offset > start && offset < start + match[0].length) out.add('link')
  }

  // A selection that already carries the wrapper counts too — the tree only proves
  // what is *parsed*, and a fully selected `**x**` is the toolbar's own toggle shape.
  const selected = state.sliceDoc(sel.from, sel.to)
  if (/^\*\*[^*].*\*\*$/.test(selected)) out.add('bold')
  if (/^\*[^*].*\*$/.test(selected)) out.add('italic')
  if (/^`.*`$/.test(selected)) out.add('code')
  if (/^\[\[[^[\]]+\]\]$/.test(selected)) out.add('link')
  return out
}
