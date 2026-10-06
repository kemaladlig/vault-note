import { PanelLeft, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useT } from '@/shared/i18n'
import { toast } from '@/shared/toast'

import { useShellStore } from '../store/shellStore'
import { AppMenuButton } from './AppMenuButton'

/**
 * Desktop bar: brand, panel toggle, the centered search pill and the primary
 * action. Sync, lock and settings live in the sidebar footer and the app
 * menu; mobile has no bar at all — the list header owns that surface.
 */
export function TopBar() {
  const t = useT()

  const query = useNotesStore((s) => s.query)
  const setQuery = useNotesStore((s) => s.setQuery)
  const create = useNotesStore((s) => s.create)

  const setCommandOpen = useShellStore((s) => s.setCommandOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const panelMode = useShellStore((s) => s.panelMode)
  const cyclePanels = useShellStore((s) => s.cyclePanels)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const panelLabel = t(
    panelMode === 'full'
      ? 'shell.panels.hideNav'
      : panelMode === 'list'
        ? 'shell.panels.hideList'
        : 'shell.panels.show',
  )

  async function onNewNote() {
    try {
      await create()
      setListOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('notes.editor.createFailed'), 'error')
    }
  }

  return (
    <header className="relative z-30 grid h-14 shrink-0 grid-cols-[1fr_auto] items-center gap-2 px-3 sm:grid-cols-[minmax(min-content,1fr)_minmax(0,36rem)_minmax(min-content,1fr)] sm:gap-4 md:px-4">
      {/* Left: brand, then the panel toggle next to the surface it controls. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-2 pl-0.5">
          <VaultNoteIcon className="size-8 shrink-0 shadow-e1" />
          <span className="hidden text-[15px] font-semibold tracking-tight md:block">
            Vault<span className="text-primary">Note</span>
          </span>
        </div>
        {/* One button, three states: hides the nav, then the list, then returns
            everything at once. The label always names what the next press does. */}
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-1 hidden bg-transparent text-muted-foreground hover:bg-surface/70 md:inline-flex"
          aria-label={panelLabel}
          title={`${panelLabel} (Ctrl+B)`}
          onClick={cyclePanels}
        >
          {panelMode === 'editor' ? (
            <PanelLeftOpen />
          ) : panelMode === 'list' ? (
            <PanelLeft />
          ) : (
            <PanelLeftClose />
          )}
        </Button>
      </div>

      {/* Center: the search pill owns the header's middle column, so wide
          viewports read as symmetric instead of one dead band. */}
      <div className="group/search hidden w-full items-center gap-2 rounded-full border border-border/60 bg-surface/70 p-1 shadow-e1 backdrop-blur-md transition-[border-color,box-shadow] duration-[var(--duration-base)] animate-fade-in hover:shadow-e2 focus-within:border-primary/40 focus-within:shadow-e2 focus-within:ring-4 focus-within:ring-primary/10 sm:flex">
        <Search className="ml-1.5 size-4 shrink-0 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
        <Input
          ref={searchInputRef}
          value={query}
          placeholder={t('shell.search.placeholder')}
          aria-label={t('shell.search.label')}
          className="h-9 min-w-0 flex-1 rounded-full border-transparent bg-transparent px-1 shadow-none focus-visible:border-transparent focus-visible:ring-0"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault()
              setQuery('')
            }
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label={t('shell.search.clear')}
            title={t('shell.search.clear')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('')
              searchInputRef.current?.focus()
            }}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('shell.openPalette')}
            onClick={() => setCommandOpen(true)}
            className="mr-0.5 flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
          >
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 justify-self-end">
        <Button
          size="sm"
          variant="cta"
          className="h-8 gap-1.5 px-3.5"
          aria-label={t('shell.newNote')}
          onClick={() => void onNewNote()}
        >
          <Plus className="size-4" />
          <span className="hidden md:inline">{t('shell.newNote')}</span>
        </Button>

        <AppMenuButton triggerClassName="text-muted-foreground hover:bg-surface/70" />
      </div>
    </header>
  )
}
