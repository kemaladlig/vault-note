import { Cloud, CloudOff, Loader2, Lock } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'
import { relativeTime } from '@/shared/time'

/**
 * Sidebar footer: sync as a quiet state, not a button in the bar. One row
 * carries the last-sync line (click = sync now) and the vault lock. Errors
 * and conflicts color the row; everything else stays muted until read.
 */
export function VaultStatusRow() {
  const t = useT()
  const lock = useVaultStore((s) => s.lock)

  const status = useSyncStore((s) => s.status)
  const configured = useSyncStore((s) => s.configured)
  const connected = useSyncStore((s) => s.connected)
  const syncError = useSyncStore((s) => s.error)
  const pending = useSyncStore((s) => s.pending)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const lastConflicts = useSyncStore((s) => s.lastConflicts)
  const sync = useSyncStore((s) => s.sync)

  const [confirmLock, setConfirmLock] = useState(false)
  const syncing = status === 'syncing'

  const label = syncing
    ? t('sync.syncing')
    : syncError
      ? t('shell.syncFailed')
      : lastConflicts > 0
        ? t('shell.syncConflictCount', { n: lastConflicts })
        : pending > 0
          ? t('shell.syncPending', { n: pending })
          : !configured
            ? t('shell.syncNoClient')
            : !connected
              ? t('shell.syncOff')
              : lastSyncedAt
                ? t('settings.syncLast', { time: relativeTime(lastSyncedAt) })
                : t('settings.syncNever')

  const tone = syncError || lastConflicts > 0
    ? 'text-destructive'
    : !configured || !connected
      ? 'text-muted-foreground/70'
      : pending > 0
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-success'

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={!configured || syncing}
        aria-label={t('shell.syncAria')}
        aria-busy={syncing}
        title={syncError ?? t('shell.syncNow')}
        onClick={() => void sync()}
        className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:hover:bg-transparent"
      >
        {syncing ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : syncError || !configured || !connected ? (
          <CloudOff className={cn('size-3.5 shrink-0', tone)} />
        ) : (
          <Cloud className={cn('size-3.5 shrink-0', tone)} />
        )}
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        aria-label={t('shell.lock')}
        title={t('shell.lock')}
        aria-haspopup="dialog"
        onClick={() => setConfirmLock(true)}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Lock className="size-3.5" />
      </button>

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
    </div>
  )
}
