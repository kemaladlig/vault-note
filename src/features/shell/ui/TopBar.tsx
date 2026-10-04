import {
  Cloud,
  CloudOff,
  Download,
  Lock,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Spinner } from '@/components/ui/spinner'
import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'
import { promptInstall, useCanInstall } from '@/shared/pwaInstall'
import { useThemeStore } from '@/shared/theme'

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

  const syncStatus = useSyncStore((s) => s.status)
  const configured = useSyncStore((s) => s.configured)
  const syncError = useSyncStore((s) => s.error)
  const sync = useSyncStore((s) => s.sync)
  const disconnect = useSyncStore((s) => s.disconnect)

  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const canInstall = useCanInstall()

  const syncing = syncStatus === 'syncing'

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
    await create()
    setListOpen(false)
  }

  const syncIcon = syncing ? (
    <Spinner />
  ) : syncError ? (
    <CloudOff className="size-4 text-destructive" />
  ) : (
    <Cloud className="size-4" />
  )

  const syncTitle = syncError ?? (configured ? t('shell.syncNow') : t('shell.syncNoClient'))

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 px-3 md:px-4">
      <div className="group/dock flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 p-1 pr-2 shadow-e1 backdrop-blur-md transition-all duration-200 animate-fade-in hover:shadow-e2 focus-within:border-primary/40 focus-within:shadow-e2 focus-within:ring-4 focus-within:ring-primary/10 max-sm:border-transparent max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:backdrop-blur-none lg:max-w-xl">
        <div className="flex min-w-0 items-center gap-2 pl-0.5">
          <VaultNoteIcon className="size-8 shrink-0 shadow-e1" />
          <span className="hidden text-[15px] font-semibold tracking-tight md:block">
            Vault<span className="text-primary">Note</span>
          </span>
        </div>
        <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border/70 md:block" />
        <div className="group/search relative hidden min-w-0 flex-1 sm:block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
          <Input
            value={query}
            placeholder={t('shell.search.placeholder')}
            aria-label={t('shell.search.label')}
            className="h-9 rounded-full border-transparent bg-transparent pl-9 pr-16 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            aria-label={t('shell.openPalette')}
            onClick={() => setCommandOpen(true)}
            className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
          >
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </button>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
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
          className="hidden gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 shadow-e1 backdrop-blur-sm transition-all hover:shadow-e2 sm:inline-flex"
          aria-label={t('shell.syncAria')}
          title={syncTitle}
          disabled={!configured || syncing}
          onClick={() => void sync()}
        >
          {syncIcon}
          <span className="hidden md:inline">{t('shell.sync')}</span>
          <span
            aria-hidden
            className={cn(
              'hidden size-1.5 rounded-full md:block',
              syncing ? 'animate-pulse bg-primary' : syncError ? 'bg-destructive' : 'bg-success/70',
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
          onClick={lock}
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
    </header>
  )
}
