import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { now } from '@/shared/time'

import { getAccessToken, hasSession, isAuthConfigured, signOut } from '../auth/googleAuth'
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
  sync: (options?: SyncOptions) => Promise<void>
  /** New-device setup: pull the vault header from Drive and adopt it locally. */
  restore: () => Promise<boolean>
  disconnect: () => void
}

function drive() {
  return createGoogleDriveClient(getAccessToken)
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  configured: isAuthConfigured(),

  sync: async (options) => {
    const interactive = options?.interactive ?? true
    if (!interactive && !hasSession()) return

    const { dek, header, settings } = useVaultStore.getState()
    if (!dek || !header || !settings) throw new Error('Önce vault kilidini aç.')

    set({ status: 'syncing', error: undefined })
    try {
      const client = drive()
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
        } else if (folderResult.pushed) {
          await useFolderStore
            .getState()
            .markSynced(folderResult.updatedAt, folderResult.modifiedTime)
        }
      }

      set({
        status: 'idle',
        lastSyncedAt: now(),
        manifestModifiedTime: result.manifestModifiedTime,
      })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Senkron başarısız' })
    }
  },

  restore: async () => {
    set({ status: 'syncing', error: undefined })
    try {
      const bootstrap = await downloadBootstrap(drive())
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
    set({ status: 'idle', lastSyncedAt: undefined, error: undefined, manifestModifiedTime: undefined })
  },
}))
