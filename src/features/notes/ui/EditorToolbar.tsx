import { useState } from 'react'
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
  useEditorPrefsStore,
} from '@/shared/editorPrefs'
import { useT, type MessageKey } from '@/shared/i18n'

import type { EditorFormat } from './CodeEditor'

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

/** Text-appearance menu: editor size delta (live) + line spacing. Opens upward. */
function TextPrefsMenu() {
  const t = useT()
  const delta = useEditorPrefsStore((s) => s.delta)
  const line = useEditorPrefsStore((s) => s.line)
  const stepDelta = useEditorPrefsStore((s) => s.stepDelta)
  const setLine = useEditorPrefsStore((s) => s.setLine)
  const [open, setOpen] = useState(false)
  const customized = delta !== 0 || line !== 'normal'

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="above"
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
              'grid size-10 place-items-center rounded-lg transition-[background-color,color,transform] duration-[var(--duration-fast)] active:scale-95',
              open || customized
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Type className="size-[18px]" />
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
      </div>
    </Popover>
  )
}

/**
 * Single-line Markdown bar. On mobile it is the thumb-reachable strip above the
 * footer (horizontal scroll, safe touch targets); on desktop the same strip sits
 * under the editor. Only transform/opacity animate.
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
        {FORMATS.map(({ id, labelKey, icon: Icon }) => {
          const active = formattingEnabled && activeFormats.has(id)
          return (
            <button
              key={id}
              type="button"
              aria-label={t(labelKey)}
              title={t(labelKey)}
              aria-pressed={active}
              disabled={!formattingEnabled}
              onClick={() => onFormat(id)}
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-lg transition-[background-color,color,transform] duration-[var(--duration-fast)] active:scale-95 disabled:pointer-events-none disabled:opacity-40',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-[18px]" />
            </button>
          )
        })}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border/70" />
        <TextPrefsMenu />
      </div>
    </div>
  )
}
