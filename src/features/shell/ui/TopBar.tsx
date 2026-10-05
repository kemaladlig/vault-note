import {
  Cloud,
  CloudOff,
  Download,
  Lock,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'
import { promptInstall, useCanInstall } from '@/shared/pwaInstall'
import { relativeTime } from '@/shared/time'
import { useThemeStore } from '@/shared/theme'
import { toast } from '@/shared/toast'

import { useShellStore } from '../store/shellStore'

/** Floating command bar over the gradient shell: brand, search, sync, primary action. */
export function TopBar() {
  const t = useT()
  const lock = useVaultStore((s) => s.lock)

  const query = useNotesStore((s) => s.query)
  const setQuery = useNotesStore((s) => s.setQuery)
  const create = useNotesStore((s) => s.create)

  const setCommandOpen = useShellStore((s) => s.setCommandOpen)
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const panelsHidden = useShellStore((s) => s.panelsHidden)
  const togglePanels = useShellStore((s) => s.togglePanels)

  const syncStatus = useSyncStore((s) => s.status)
  const configured = useSyncStore((s) => s.configured)
  const syncError = useSyncStore((s) => s.error)
  const pending = useSyncStore((s) => s.pending)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const lastConflicts = useSyncStore((s) => s.lastConflicts)
  const sync = useSyncStore((s) => s.sync)
  const disconnect = useSyncStore((s) => s.disconnect)

  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const canInstall = useCanInstall()

  const [confirmLock, setConfirmLock] = useState(false)

  const syncing = syncStatus === 'syncing'
  const searchInputRef = useRef<HTMLInputElement>(null)

  const menuItems: MenuItem[] = [
    ...(canInstall
      ? ([
          { label: t('shell.install'), icon: <Download />, onSelect: () => void promptInstall() },
          { type: 'separator' },
        ] satisfies MenuItem[])
      : []),
    { label: t('shell.settings'), icon: <Settings />, onSelect: () => setSettingsOpen(true) },
    { type: 'separator' },
    {
      label: t('shell.theme.system'),
      icon: <Monitor />,
      selected: mode === 'system',
      onSelect: () => setMode('system'),
    },
    {
      label: t('shell.theme.light'),
      icon: <Sun />,
      selected: mode === 'light',
      onSelect: () => setMode('light'),
    },
    {
      label: t('shell.theme.dark'),
      icon: <Moon />,
      selected: mode === 'dark',
      onSelect: () => setMode('dark'),
    },
    { type: 'separator' },
    { label: t('shell.disconnect'), icon: <CloudOff />, onSelect: disconnect },
  ]

  async function onNewNote() {
    try {
      await create()
      setListOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('notes.editor.createFailed'), 'error')
    }
  }

  const syncIcon = syncing ? (
    <Spinner />
  ) : syncError ? (
    <CloudOff className="size-4 text-destructive" />
  ) : (
    <Cloud className="size-4" />
  )

  const syncTitle = syncError
    ?? (lastConflicts > 0 ? t('sync.conflict', { n: lastConflicts }) : undefined)
    ?? (pending > 0 ? t('sync.pending', { n: pending }) : undefined)
    ?? (configured
      ? (lastSyncedAt ? t('settings.syncLast', { time: relativeTime(lastSyncedAt) }) : t('shell.syncNow'))
      : t('shell.syncNoClient'))

  return (
    <header className="relative z-30 grid h-14 shrink-0 grid-cols-[1fr_auto] items-center gap-2 px-3 sm:grid-cols-[1fr_minmax(0,36rem)_1fr] sm:gap-4 md:px-4">
      {/* Left: brand, then the panel toggle next to the surface it controls. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-2 pl-0.5">
          <VaultNoteIcon className="size-8 shrink-0 shadow-e1" />
          <span className="hidden text-[15px] font-semibold tracking-tight md:block">
            Vault<span className="text-primary">Note</span>
          </span>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-1 hidden bg-transparent text-muted-foreground hover:bg-surface/70 md:inline-flex"
          aria-label={t(panelsHidden ? 'shell.panels.show' : 'shell.panels.hide')}
          title={t(panelsHidden ? 'shell.panels.show' : 'shell.panels.hide') + ' (Ctrl+B)'}
          aria-pressed={!panelsHidden}
          onClick={togglePanels}
        >
          {panelsHidden ? <PanelLeftOpen /> : <PanelLeftClose />}
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
          size="icon-sm"
          variant="ghost"
          className="bg-surface/70 backdrop-blur-sm sm:hidden"
          aria-label={t('shell.search')}
          onClick={() => setCommandOpen(true)}
        >
          <Search />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="hidden gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 shadow-e1 backdrop-blur-sm transition-shadow hover:shadow-e2 sm:inline-flex"
          aria-label={t('shell.syncAria')}
          title={syncTitle}
          disabled={!configured || syncing}
          onClick={() => void sync()}
        >
          {syncIcon}
          <span className="hidden md:inline">{t('shell.sync')}{pending > 0 ? ` · ${pending}` : ''}</span>
          <span
            aria-hidden
            className={cn(
              'hidden size-1.5 rounded-full md:block',
              syncing ? 'animate-pulse bg-primary' : syncError || lastConflicts > 0 ? 'bg-destructive' : pending > 0 ? 'bg-amber-500' : 'bg-success/70',
            )}
          />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="bg-surface/70 backdrop-blur-sm sm:hidden"
          aria-label={t('shell.syncAria')}
          title={syncTitle}
          disabled={!configured || syncing}
          onClick={() => void sync()}
        >
          {syncIcon}
        </Button>

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

        {canInstall && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="bg-surface/70 text-primary backdrop-blur-sm hover:bg-surface"
            aria-label={t('shell.install')}
            title={t('shell.install')}
            onClick={() => void promptInstall()}
          >
            <Download />
          </Button>
        )}

        <Button
          size="icon-sm"
          variant="ghost"
          className="bg-transparent text-muted-foreground hover:bg-surface/70"
          aria-label={t('shell.lock')}
          title={t('shell.lock')}
          aria-haspopup="dialog"
          onClick={() => setConfirmLock(true)}
        >
          <Lock />
        </Button>

        <Menu
          label={t('shell.appMenu')}
          icon={<Settings />}
          align="end"
          items={menuItems}
          triggerClassName="text-muted-foreground hover:bg-surface/70"
        />
      </div>

      <Modal
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        title={t('shell.lockTitle')}
        description={t('shell.lockDesc')}
        icon={<Lock />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLock(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                setConfirmLock(false)
                lock()
              }}
            >
              {t('shell.lock')}
            </Button>
          </>
        }
      />
    </header>
  )
}
