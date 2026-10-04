import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { db } from '@/shared/db'
import { t } from '@/shared/i18n'
import { now } from '@/shared/time'
import { toast } from '@/shared/toast'

import {
  getAccessToken,
  getAccessTokenSilent,
  hasSession,
  isAuthConfigured,
  restoreSession,
  signOut,
} from '../auth/googleAuth'
import { downloadBootstrap, uploadBootstrap } from '../bootstrap'
import { createGoogleDriveClient } from '../drive/googleDrive'
import { syncNotes } from '../engine'
import { syncFolders } from '../folders'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useFolderStore } from '@/features/notes/store/folderStore'

type SyncStatus = 'idle' | 'syncing' | 'error'

export interface SyncOptions {
  /** When false, never opens the OAuth popup — used by background/auto sync. */
  interactive?: boolean
}

interface SyncState {
  status: SyncStatus
  lastSyncedAt?: number
  error?: string
  configured: boolean
  /** Manifest `modifiedTime` from the last sync; lets idle polls skip work. */
  manifestModifiedTime?: string
  /** Local rows not yet pushed to Drive (notes + notebook tree counts as 1). */
  pending: number
  lastPulled: number
  lastPushed: number
  /** Notes where the Drive version overwrote an unsynced local edit (LWW). */
  lastConflicts: number
  /** Notebook tree pulled while it had local edits (whole-doc LWW, local lost). */
  folderConflict: boolean
  sync: (options?: SyncOptions) => Promise<void>
  refreshPending: () => Promise<void>
  /** New-device setup: pull the vault header from Drive and adopt it locally. */
  restore: () => Promise<boolean>
  disconnect: () => void
}

function drive(interactive: boolean) {
  // Background sync must stay silent end to end: the token getter itself refuses to
  // prompt, so an expiry mid-sync no-ops quietly instead of tripping the popup blocker.
  return createGoogleDriveClient(interactive ? getAccessToken : getAccessTokenSilent)
}

async function countPending(): Promise<number> {
  try {
    const dirtyNotes = await db.notes.where('dirty').equals(1).count()
    const folderDirty = useFolderStore.getState().dirty ? 1 : 0
    return dirtyNotes + folderDirty
  } catch {
    return 0
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  configured: isAuthConfigured(),
  pending: 0,
  lastPulled: 0,
  lastPushed: 0,
  lastConflicts: 0,
  folderConflict: false,

  refreshPending: async () => {
    set({ pending: await countPending() })
  },

  sync: async (options) => {
    const interactive = options?.interactive ?? true
    // Background sync must never open the OAuth popup: proceed only with a live session or a
    // silent restore. The interactive path below is allowed to prompt.
    if (!interactive && !hasSession() && !(await restoreSession())) return

    const { dek, header, settings } = useVaultStore.getState()
    if (!dek || !header || !settings) throw new Error('Önce vault kilidini aç.')

    set({ status: 'syncing', error: undefined })
    try {
      const client = drive(interactive)
      // Idempotent: makes the vault discoverable from a new device.
      await uploadBootstrap(client, {
        header,
        settings: {
          mode: settings.mode,
          deviceId: settings.deviceId,
          createdAt: settings.createdAt,
        },
      })
      const result = await syncNotes({
        drive: client,
        dek,
        manifestModifiedTime: get().manifestModifiedTime,
      })
      // Only re-read (and re-decrypt) when something was actually pulled in.
      if (result.pulled > 0 && useVaultStore.getState().dek) {
        await useNotesStore.getState().reload()
      }

      // Sync the notebook tree as a separate sealed doc (only once it has been loaded).
      const folders = useFolderStore.getState()
      const folderDirtyBefore = folders.dirty
      let folderConflict = false
      if (folders.loaded) {
        const folderResult = await syncFolders({
          drive: client,
          dek,
          folders: folders.folders,
          updatedAt: folders.updatedAt,
          modifiedTime: folders.modifiedTime,
          dirty: folders.dirty,
        })
        if (folderResult.pulled) {
          await useFolderStore
            .getState()
            .adopt(folderResult.folders, folderResult.updatedAt, folderResult.modifiedTime)
          // Whole-doc LWW: a pulled tree overwrote unsynced local notebook edits.
          if (folderDirtyBefore) folderConflict = true
        } else if (folderResult.pushed) {
          await useFolderStore
            .getState()
            .markSynced(folderResult.updatedAt, folderResult.modifiedTime)
        }
      }

      const conflictCount = result.conflicts.length + (folderConflict ? 1 : 0)
      set({
        status: 'idle',
        lastSyncedAt: now(),
        manifestModifiedTime: result.manifestModifiedTime,
        pending: await countPending(),
        lastPulled: result.pulled,
        lastPushed: result.pushed,
        lastConflicts: conflictCount,
        folderConflict,
      })

      // Conflicts always notify (even background polls), because local work was lost.
      if (conflictCount > 0) {
        toast(t('sync.conflict', { n: conflictCount }), 'error')
      } else if (interactive && (result.pulled > 0 || result.pushed > 0)) {
        toast(t('sync.summary', { pulled: result.pulled, pushed: result.pushed }), 'success')
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : undefined
      set({ status: 'error', error: detail ?? t('sync.failedTitle'), pending: await countPending() })
      // A user-triggered sync should say why it failed; background polls stay quiet (the error
      // is still stored and surfaced in Settings).
      if (interactive) toast(`${t('sync.failedTitle')} ${t('sync.failedHint')}`, 'error')
    }
  },

  restore: async () => {
    set({ status: 'syncing', error: undefined })
    try {
      const bootstrap = await downloadBootstrap(drive(true))
      if (!bootstrap) {
        set({ status: 'idle' })
        return false
      }
      await useVaultStore.getState().restore(bootstrap.header, bootstrap.settings.mode)
      set({ status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Geri yükleme başarısız' })
      return false
    }
  },

  disconnect: () => {
    signOut()
    set({ status: 'idle', lastSyncedAt: undefined, error: undefined, manifestModifiedTime: undefined, pending: 0, lastPulled: 0, lastPushed: 0, lastConflicts: 0, folderConflict: false })
  },
}))
