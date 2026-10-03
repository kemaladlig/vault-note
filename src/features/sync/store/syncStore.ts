import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { now } from '@/shared/time'

import { getAccessToken, hasSession, isAuthConfigured, signOut } from '../auth/googleAuth'
import { downloadBootstrap, uploadBootstrap } from '../bootstrap'
import { createGoogleDriveClient } from '../drive/googleDrive'
import { syncNotes } from '../engine'

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
  sync: (options?: SyncOptions) => Promise<void>
  /** New-device setup: pull the vault header from Drive and adopt it locally. */
  restore: () => Promise<boolean>
  disconnect: () => void
}

function drive() {
  return createGoogleDriveClient(getAccessToken)
}

export const useSyncStore = create<SyncState>((set) => ({
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
      await syncNotes({ drive: client, dek })
      set({ status: 'idle', lastSyncedAt: now() })
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
    set({ status: 'idle', lastSyncedAt: undefined, error: undefined })
  },
}))
