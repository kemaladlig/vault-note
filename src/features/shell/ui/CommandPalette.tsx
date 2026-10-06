import {
  Cloud,
  FileText,
  LayoutTemplate,
  Lock,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'

import { Kbd } from '@/components/ui/kbd'
import { activeNotes, filterNotes, matchInfo } from '@/features/notes/search'
import { sortNotes } from '@/features/notes/sort'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useTemplateStore } from '@/features/notes/store/templateStore'
import { Highlight } from '@/features/notes/ui/Highlight'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { useExitMotion } from '@/shared/exitMotion'
import { useT } from '@/shared/i18n'
import { useMediaQuery } from '@/shared/useMediaQuery'
import { relativeTime } from '@/shared/time'
import { useThemeStore } from '@/shared/theme'
import { toast } from '@/shared/toast'

import { useShellStore } from '../store/shellStore'

interface Command {
  id: string
  label: string
  hint?: string
  /** Marks a keyboard-shortcut hint; hidden on touch, where it is meaningless. */
  shortcut?: boolean
  /** Optional secondary line (e.g. the match snippet for a note hit). */
  detail?: ReactNode
  /** Optional rich label (e.g. a highlighted title). */
  labelNode?: ReactNode
  icon: ReactNode
  group: string
  run: () => void
}

const MAX_NOTES = 6

/** Ctrl/Cmd+K palette: quick actions plus note jump. Stays mounted through its exit animation. */
export function CommandPalette() {
  const open = useShellStore((s) => s.commandOpen)
  const setOpen = useShellStore((s) => s.setCommandOpen)
  const { mounted, closing } = useExitMotion(open)
  if (!mounted) return null
  return <Palette closing={closing} onClose={() => setOpen(false)} />
}

function Palette({ onClose, closing = false }: { onClose: () => void; closing?: boolean }) {
  const t = useT()
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const panelMode = useShellStore((s) => s.panelMode)
  const cyclePanels = useShellStore((s) => s.cyclePanels)

  const notes = useNotesStore((s) => s.notes)
  const select = useNotesStore((s) => s.select)
  const create = useNotesStore((s) => s.create)
  const setQuery = useNotesStore((s) => s.setQuery)
  const sortBy = useNotesStore((s) => s.sortBy)
  const sortDir = useNotesStore((s) => s.sortDir)

  const lock = useVaultStore((s) => s.lock)
  const sync = useSyncStore((s) => s.sync)
  const setMode = useThemeStore((s) => s.setMode)
  const setTemplatePickerOpen = useShellStore((s) => s.setTemplatePickerOpen)
  const templates = useTemplateStore((s) => s.templates)

  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  // Keep the input instant; the full-body scan runs on the deferred value.
  const deferredTerm = useDeferredValue(term)
  // Touch devices have no keyboard; drop the shortcut-only hints.
  const coarse = useMediaQuery('(pointer: coarse)')

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'new',
        label: t('shell.newNote'),
        hint: t('shell.palette.newNoteHint'),
        icon: <Plus />,
        group: t('shell.palette.groupActions'),
        run: () => {
          onClose()
          create().then(
            () => setListOpen(false),
            (err) => toast(err instanceof Error ? err.message : t('notes.editor.createFailed'), 'error'),
          )
        },
      },
      {
        id: 'settings',
        label: t('shell.settings'),
        icon: <Settings />,
        group: t('shell.palette.groupActions'),
        run: () => {
          onClose()
          setSettingsOpen(true)
        },
      },
      ...(templates.length > 0
        ? [
            {
              id: 'new-from-template',
              label: t('templates.newFromTemplate'),
              icon: <LayoutTemplate />,
              group: t('shell.palette.groupActions'),
              run: () => {
                onClose()
                setTemplatePickerOpen(true)
              },
            } satisfies Command,
          ]
        : []),
      {
        id: 'panels',
        label: t(
          panelMode === 'full'
            ? 'shell.panels.hideNav'
            : panelMode === 'list'
              ? 'shell.panels.hideList'
              : 'shell.panels.show',
        ),
        hint: t('shell.panels.hint'),
        shortcut: true,
        icon:
          panelMode === 'editor' ? (
            <PanelLeftOpen />
          ) : panelMode === 'list' ? (
            <PanelLeft />
          ) : (
            <PanelLeftClose />
          ),
        group: t('shell.palette.groupActions'),
        run: () => {
          cyclePanels()
          onClose()
        },
      },
      {
        id: 'sync',
        label: t('shell.syncAria'),
        icon: <Cloud />,
        group: t('shell.palette.groupActions'),
        run: () => {
          onClose()
          void sync()
        },
      },
      {
        id: 'theme-light',
        label: t('shell.theme.light'),
        icon: <Sun />,
        group: t('shell.palette.groupActions'),
        run: () => {
          setMode('light')
          onClose()
        },
      },
      {
        id: 'theme-dark',
        label: t('shell.theme.dark'),
        icon: <Moon />,
        group: t('shell.palette.groupActions'),
        run: () => {
          setMode('dark')
          onClose()
        },
      },
      {
        id: 'theme-system',
        label: t('shell.theme.system'),
        icon: <Monitor />,
        group: t('shell.palette.groupActions'),
        run: () => {
          setMode('system')
          onClose()
        },
      },
      {
        id: 'lock',
        label: t('shell.lock'),
        icon: <Lock />,
        group: t('shell.palette.groupActions'),
        run: () => {
          onClose()
          lock()
        },
      },
    ],
    [create, cyclePanels, lock, onClose, panelMode, setListOpen, setMode, setSettingsOpen, setTemplatePickerOpen, sync, t, templates.length],
  )

  const needle = term.trim().toLocaleLowerCase('tr')

  const items = useMemo<Command[]>(() => {
    const matchingCommands = commands.filter(
      (command) => !needle || command.label.toLocaleLowerCase('tr').includes(needle),
    )
    const baseNotes = activeNotes(notes)
    // With a query, keep relevance ranking; when idle, show the user's list order.
    const orderedNotes = deferredTerm.trim()
      ? filterNotes(baseNotes, deferredTerm)
      : sortNotes(baseNotes, sortBy, sortDir)
    const matchingNotes = orderedNotes
      .slice(0, MAX_NOTES)
      .map<Command>((note) => {
        const title = note.title || t('common.untitled')
        const info = deferredTerm.trim() ? matchInfo(note, deferredTerm) : null
        return {
          id: `note:${note.id}`,
          label: title,
          labelNode: <Highlight text={title} query={deferredTerm} />,
          detail: info?.snippet ? <Highlight text={info.snippet} query={deferredTerm} /> : undefined,
          hint: relativeTime(note.updatedAt),
          icon: <FileText />,
          group: t('shell.palette.groupNotes'),
          run: () => {
            if (term.trim()) setQuery(term.trim())
            select(note.id)
            setListOpen(false)
            onClose()
          },
        }
      })
    return [...matchingCommands, ...matchingNotes]
  }, [commands, deferredTerm, needle, notes, onClose, select, setListOpen, setQuery, sortBy, sortDir, term, t])

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0))

  function runActive() {
    items[activeIndex]?.run()
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-3 pt-[7vh] sm:p-4 sm:pt-[12vh]',
        closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.palette.aria')}
        className={cn(
          'w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-pop',
          closing ? 'animate-pop-out' : 'animate-pop-in',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            aria-label={t('shell.palette.searchLabel')}
            placeholder={t('shell.palette.placeholder')}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setTerm(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive(Math.min(activeIndex + 1, items.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive(Math.max(activeIndex - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                runActive()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
          />
          {term && (
            <button
              type="button"
              aria-label={t('shell.search.clear')}
              title={t('shell.search.clear')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setTerm('')
                setActive(0)
              }}
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-2 sm:max-h-[52vh]">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('shell.palette.noResults')}
            </p>
          ) : (
            items.map((item, index) => {
              const showHeader = index === 0 || items[index - 1].group !== item.group
              const isActive = index === activeIndex
              return (
                <div key={item.id}>
                  {showHeader && (
                    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseMove={() => setActive(index)}
                    onClick={() => item.run()}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md transition-[background-color,color,box-shadow]',
                        isActive
                          ? 'bg-surface text-accent-foreground shadow-e1'
                          : 'text-muted-foreground',
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.labelNode ?? item.label}</span>
                      {item.detail && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {item.hint && !(item.shortcut && coarse) && (
                      <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
