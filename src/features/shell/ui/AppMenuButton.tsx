import { Cloud, CloudOff, Command, Download, Lock, Monitor, Moon, Settings, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { useT } from '@/shared/i18n'
import { promptInstall, useCanInstall } from '@/shared/pwaInstall'
import { useThemeStore } from '@/shared/theme'

import { useShellStore } from '../store/shellStore'

interface AppMenuButtonProps {
  /** Trigger icon; defaults to the gear used by the desktop bar. */
  icon?: ReactNode
  triggerClassName?: string
}

/**
 * The app's overflow menu in one place: palette, install, settings, theme,
 * sync now, lock and disconnect. Shared by the desktop bar, the mobile list
 * bar and the mobile tab strip so every surface offers the same commands.
 */
export function AppMenuButton({ icon, triggerClassName }: AppMenuButtonProps) {
  const t = useT()
  const lock = useVaultStore((s) => s.lock)
  const setCommandOpen = useShellStore((s) => s.setCommandOpen)
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen)

  const configured = useSyncStore((s) => s.configured)
  const connected = useSyncStore((s) => s.connected)
  const status = useSyncStore((s) => s.status)
  const sync = useSyncStore((s) => s.sync)
  const disconnect = useSyncStore((s) => s.disconnect)

  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const canInstall = useCanInstall()
  const [confirmLock, setConfirmLock] = useState(false)
  const syncing = status === 'syncing'

  const menuItems: MenuItem[] = [
    { label: t('shell.openPalette'), icon: <Command />, onSelect: () => setCommandOpen(true) },
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
    {
      label: t('shell.syncNow'),
      icon: <Cloud />,
      disabled: !configured || syncing,
      onSelect: () => void sync(),
    },
    { label: t('shell.lock'), icon: <Lock />, onSelect: () => setConfirmLock(true) },
    { type: 'separator' },
    { label: t('shell.disconnect'), icon: <CloudOff />, onSelect: disconnect, disabled: !connected },
  ]

  return (
    <>
      <Menu
        label={t('shell.appMenu')}
        icon={icon ?? <Settings />}
        align="end"
        items={menuItems}
        triggerClassName={triggerClassName}
      />
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
    </>
  )
}
