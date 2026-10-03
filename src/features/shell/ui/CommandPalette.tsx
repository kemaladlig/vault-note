import {
  Cloud,
  FileText,
  Lock,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Kbd } from '@/components/ui/kbd'
import { activeNotes, filterNotes, matchInfo } from '@/features/notes/search'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { Highlight } from '@/features/notes/ui/Highlight'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/time'
import { useThemeStore } from '@/shared/theme'

import { useShellStore } from '../store/shellStore'

interface Command {
  id: string
  label: string
  hint?: string
  /** Optional secondary line (e.g. the match snippet for a note hit). */
  detail?: ReactNode
  /** Optional rich label (e.g. a highlighted title). */
  labelNode?: ReactNode
  icon: ReactNode
  group: string
  run: () => void
}

const MAX_NOTES = 6

/** Ctrl/Cmd+K palette: quick actions plus note jump. Mounted only while open. */
export function CommandPalette() {
  const open = useShellStore((s) => s.commandOpen)
  const setOpen = useShellStore((s) => s.setCommandOpen)
  if (!open) return null
  return <Palette onClose={() => setOpen(false)} />
}

function Palette({ onClose }: { onClose: () => void }) {
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)

  const notes = useNotesStore((s) => s.notes)
  const select = useNotesStore((s) => s.select)
  const create = useNotesStore((s) => s.create)
  const setQuery = useNotesStore((s) => s.setQuery)

  const lock = useVaultStore((s) => s.lock)
  const sync = useSyncStore((s) => s.sync)
  const setMode = useThemeStore((s) => s.setMode)

  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'new',
        label: 'Yeni not',
        hint: 'Not oluştur',
        icon: <Plus />,
        group: 'Eylemler',
        run: () => {
          onClose()
          void create().then(() => setListOpen(false))
        },
      },
      {
        id: 'settings',
        label: 'Ayarlar',
        icon: <Settings />,
        group: 'Eylemler',
        run: () => {
          onClose()
          setSettingsOpen(true)
        },
      },
      {
        id: 'sync',
        label: 'Drive ile senkronize et',
        icon: <Cloud />,
        group: 'Eylemler',
        run: () => {
          onClose()
          void sync()
        },
      },
      {
        id: 'theme-light',
        label: 'Açık tema',
        icon: <Sun />,
        group: 'Eylemler',
        run: () => {
          setMode('light')
          onClose()
        },
      },
      {
        id: 'theme-dark',
        label: 'Koyu tema',
        icon: <Moon />,
        group: 'Eylemler',
        run: () => {
          setMode('dark')
          onClose()
        },
      },
      {
        id: 'theme-system',
        label: 'Sistem teması',
        icon: <Monitor />,
        group: 'Eylemler',
        run: () => {
          setMode('system')
          onClose()
        },
      },
      {
        id: 'lock',
        label: 'Kilitle',
        icon: <Lock />,
        group: 'Eylemler',
        run: () => {
          onClose()
          lock()
        },
      },
    ],
    [create, lock, onClose, setListOpen, setMode, setSettingsOpen, sync],
  )

  const needle = term.trim().toLocaleLowerCase('tr')

  const items = useMemo<Command[]>(() => {
    const matchingCommands = commands.filter(
      (command) => !needle || command.label.toLocaleLowerCase('tr').includes(needle),
    )
    const matchingNotes = filterNotes(activeNotes(notes), term)
      .slice(0, MAX_NOTES)
      .map<Command>((note) => {
        const title = note.title || 'Başlıksız'
        const info = matchInfo(note, term)
        return {
          id: `note:${note.id}`,
          label: title,
          labelNode: <Highlight text={title} query={term} />,
          detail: info?.snippet ? <Highlight text={info.snippet} query={term} /> : undefined,
          hint: relativeTime(note.updatedAt),
          icon: <FileText />,
          group: 'Notlar',
          run: () => {
            if (term.trim()) setQuery(term.trim())
            select(note.id)
            setListOpen(false)
            onClose()
          },
        }
      })
    return [...matchingCommands, ...matchingNotes]
  }, [commands, needle, notes, onClose, select, setListOpen, setQuery, term])

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0))

  function runActive() {
    items[activeIndex]?.run()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-3 pt-[7vh] animate-fade-in sm:p-4 sm:pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-pop animate-pop-in"
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            aria-label="Komut ara"
            placeholder="Ara veya komut çalıştır…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
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
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-2 sm:max-h-[52vh]">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Sonuç yok.</p>
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
                        'grid size-7 shrink-0 place-items-center rounded-md transition-all',
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
                    {item.hint && (
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
