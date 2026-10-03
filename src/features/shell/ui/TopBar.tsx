import {
  Cloud,
  CloudOff,
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
import { useThemeStore } from '@/shared/theme'

import { useShellStore } from '../store/shellStore'

/** Floating command bar over the gradient shell: brand, search, sync, primary action. */
export function TopBar() {
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

  const syncing = syncStatus === 'syncing'

  const menuItems: MenuItem[] = [
    { label: 'Ayarlar', icon: <Settings />, onSelect: () => setSettingsOpen(true) },
    { type: 'separator' },
    {
      label: 'Sistem teması',
      icon: <Monitor />,
      selected: mode === 'system',
      onSelect: () => setMode('system'),
    },
    { label: 'Açık tema', icon: <Sun />, selected: mode === 'light', onSelect: () => setMode('light') },
    { label: 'Koyu tema', icon: <Moon />, selected: mode === 'dark', onSelect: () => setMode('dark') },
    { type: 'separator' },
    { label: 'Drive bağlantısını kes', icon: <CloudOff />, onSelect: disconnect },
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

  const syncTitle = syncError ?? (configured ? 'Senkronize et' : 'Google istemci kimliği ayarlı değil')

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 px-3 md:px-4">
      <div className="flex items-center gap-2.5 pr-1 animate-slide-in-left">
        <VaultNoteIcon className="size-8 shadow-e1" />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:block">
          Vault<span className="text-primary">Note</span>
        </span>
      </div>

      <div className="group/search relative mx-1 hidden min-w-0 flex-1 sm:block lg:max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
        <Input
          value={query}
          placeholder="Notlarda ara…"
          aria-label="Tüm notlarda ara"
          className="h-9 rounded-full border-transparent bg-surface/80 shadow-e1 pr-20 pl-9 backdrop-blur-sm transition-all duration-200 hover:shadow-e2 focus-visible:border-primary/40 focus-visible:bg-surface focus-visible:shadow-e2 focus-visible:ring-4 focus-visible:ring-primary/10"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          aria-label="Komut paletini aç"
          onClick={() => setCommandOpen(true)}
          className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
        >
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          className="bg-surface/70 backdrop-blur-sm sm:hidden"
          aria-label="Ara"
          onClick={() => setCommandOpen(true)}
        >
          <Search />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="hidden gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 shadow-e1 backdrop-blur-sm transition-all hover:shadow-e2 sm:inline-flex"
          aria-label="Drive ile senkronize et"
          title={syncTitle}
          disabled={!configured || syncing}
          onClick={() => void sync()}
        >
          {syncIcon}
          <span className="hidden md:inline">Senkronize</span>
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
          aria-label="Drive ile senkronize et"
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
          aria-label="Yeni not"
          onClick={() => void onNewNote()}
        >
          <Plus className="size-4" />
          <span className="hidden md:inline">Yeni not</span>
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          className="bg-transparent text-muted-foreground hover:bg-surface/70"
          aria-label="Kilitle"
          title="Kilitle"
          onClick={lock}
        >
          <Lock />
        </Button>

        <Menu
          label="Uygulama menüsü"
          icon={<Settings />}
          align="end"
          items={menuItems}
          triggerClassName="text-muted-foreground hover:bg-surface/70"
        />
      </div>
    </header>
  )
}
