import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListTodo,
  Minus,
  Plus,
  Quote,
  Type,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  EDITOR_DELTA_MAX,
  EDITOR_DELTA_MIN,
  EDITOR_LINES,
  EDITOR_WIDTHS,
  useEditorPrefsStore,
} from '@/shared/editorPrefs'
import { useT, type MessageKey } from '@/shared/i18n'

import type { EditorFormat, SelectionRect } from './CodeEditor'

/** Toolbar registry: one entry per Markdown action, no conditionals at render. */
const FORMATS: ReadonlyArray<{
  id: EditorFormat
  labelKey: MessageKey
  icon: typeof Bold
}> = [
  { id: 'bold', labelKey: 'notes.editor.format.bold', icon: Bold },
  { id: 'italic', labelKey: 'notes.editor.format.italic', icon: Italic },
  { id: 'heading', labelKey: 'notes.editor.format.heading', icon: Heading2 },
  { id: 'list', labelKey: 'notes.editor.format.list', icon: List },
  { id: 'task', labelKey: 'notes.editor.format.task', icon: ListTodo },
  { id: 'quote', labelKey: 'notes.editor.format.quote', icon: Quote },
  { id: 'code', labelKey: 'notes.editor.format.code', icon: Code },
  { id: 'link', labelKey: 'notes.editor.format.link', icon: Link2 },
]

/** One Markdown action; shared by the fixed bar (thumb targets) and the bubble (compact). */
function FormatButton({
  id,
  labelKey,
  icon: Icon,
  active,
  disabled,
  compact = false,
  onFormat,
}: {
  id: EditorFormat
  labelKey: MessageKey
  icon: typeof Bold
  active: boolean
  disabled?: boolean
  compact?: boolean
  onFormat: (action: EditorFormat) => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      aria-label={t(labelKey)}
      title={t(labelKey)}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onFormat(id)}
      className={cn(
        'grid shrink-0 place-items-center rounded-lg transition-[background-color,color,transform] duration-[var(--duration-fast)] active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        compact ? 'size-8' : 'size-10',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={compact ? 'size-4' : 'size-[18px]'} />
    </button>
  )
}

/** Text-appearance menu: editor size delta (live) + line spacing. Opens upward. */
export function TextPrefsMenu({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const delta = useEditorPrefsStore((s) => s.delta)
  const line = useEditorPrefsStore((s) => s.line)
  const width = useEditorPrefsStore((s) => s.width)
  const stepDelta = useEditorPrefsStore((s) => s.stepDelta)
  const setLine = useEditorPrefsStore((s) => s.setLine)
  const setWidth = useEditorPrefsStore((s) => s.setWidth)
  const [open, setOpen] = useState(false)
  const customized = delta !== 0 || line !== 'normal' || width !== 'reading'

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      // The pill sits near the top of the pane; the mobile bottom bar opens upward.
      side={compact ? 'below' : 'above'}
      align="end"
      label={t('notes.editor.textPrefs')}
      className="w-64 p-3"
      anchor={
        <span className="relative shrink-0">
          <button
            type="button"
            aria-label={t('notes.editor.textPrefs')}
            title={t('notes.editor.textPrefs')}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              'grid place-items-center rounded-lg transition-[background-color,color,transform] duration-[var(--duration-fast)] active:scale-95',
              compact ? 'size-8' : 'size-10',
              open || customized
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Type className={compact ? 'size-4' : 'size-[18px]'} />
          </button>
          {customized && !open && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
            />
          )}
        </span>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t('notes.editor.textSize')}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('notes.editor.decreaseText')}
              disabled={delta <= EDITOR_DELTA_MIN}
              onClick={() => stepDelta(-1)}
            >
              <Minus />
            </Button>
            <span className="min-w-0 flex-1 text-center text-xs font-medium tabular-nums">
              {delta === 0 ? t('notes.editor.defaultSize') : `${delta > 0 ? '+' : ''}${delta}`}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('notes.editor.increaseText')}
              disabled={delta >= EDITOR_DELTA_MAX}
              onClick={() => stepDelta(1)}
            >
              <Plus />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t('notes.editor.lineHeight')}
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
            {EDITOR_LINES.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                aria-pressed={line === id}
                onClick={() => setLine(id)}
                className={cn(
                  'rounded-lg px-2 py-1.5 transition-colors',
                  line === id
                    ? 'bg-background shadow-e1'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t('notes.editor.textWidth')}
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
            {EDITOR_WIDTHS.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                aria-pressed={width === id}
                onClick={() => setWidth(id)}
                className={cn(
                  'rounded-lg px-2 py-1.5 transition-colors',
                  width === id
                    ? 'bg-background shadow-e1'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Popover>
  )
}

/**
 * Single-line Markdown bar for small screens: the thumb-reachable strip above the
 * footer (horizontal scroll, safe touch targets). On `md` and up the fixed bar is
 * replaced by the selection bubble below; only transform/opacity animate.
 */
export function EditorToolbar({
  formattingEnabled,
  activeFormats,
  onFormat,
}: {
  formattingEnabled: boolean
  /** Formats active at the caret; a pressed button both looks and reads as toggled. */
  activeFormats: ReadonlySet<EditorFormat>
  onFormat: (action: EditorFormat) => void
}) {
  const t = useT()

  return (
    <div
      role="toolbar"
      aria-label={t('notes.editor.formatBar')}
      className="shrink-0 border-t border-border/70 bg-surface animate-slide-up"
    >
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-2 py-1">
        {FORMATS.map((format) => (
          <FormatButton
            key={format.id}
            {...format}
            active={formattingEnabled && activeFormats.has(format.id)}
            disabled={!formattingEnabled}
            onFormat={onFormat}
          />
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border/70" />
        <TextPrefsMenu />
      </div>
    </div>
  )
}

/**
 * Desktop Markdown toolbar (selection-anchored, Notion-style): floats over the
 * selected text where the fixed bottom bar used to be. `mousedown` is suppressed
 * so the click never blurs CodeMirror or collapses the selection.
 */
export function SelectionFormatBubble({
  rect,
  activeFormats,
  onFormat,
}: {
  rect: SelectionRect
  activeFormats: ReadonlySet<EditorFormat>
  onFormat: (action: EditorFormat) => void
}) {
  const t = useT()
  const above = rect.top > 72
  // Keep the bubble fully on screen when the selection sits near a viewport edge.
  const half = 168
  const left = Math.min(Math.max((rect.left + rect.right) / 2, half), window.innerWidth - half)
  return createPortal(
    <div
      role="toolbar"
      aria-label={t('notes.editor.formatBar')}
      onMouseDown={(event) => event.preventDefault()}
      style={{ top: above ? rect.top - 8 : rect.bottom + 8, left }}
      className={cn(
        'fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-border/70 bg-surface p-1 shadow-e2 animate-pop-in',
        above && '-translate-y-full',
      )}
    >
      {FORMATS.map((format) => (
        <FormatButton
          key={format.id}
          {...format}
          compact
          active={activeFormats.has(format.id)}
          onFormat={onFormat}
        />
      ))}
    </div>,
    document.body,
  )
}
