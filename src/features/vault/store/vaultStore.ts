import { create } from 'zustand'

import { createVault, unlockVault, type Bytes, type VaultHeader, type VaultMode } from '../crypto'
import { destroyVault, loadHeader, loadSettings, saveVault, type VaultSettings } from './vaultRepo'

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

interface VaultState {
  status: VaultStatus
  header?: VaultHeader
  settings?: VaultSettings
  /** Vault Key, in memory only while unlocked. Zeroed on lock. */
  dek?: Bytes
  init: () => Promise<void>
  create: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  /** Adopt a vault header discovered on Drive (new-device setup). Lands in `locked`. */
  restore: (header: VaultHeader, mode: VaultMode) => Promise<void>
  lock: () => void
  reset: () => Promise<void>
}

function wipe(bytes?: Bytes): void {
  if (bytes) bytes.fill(0)
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'loading',

  init: async () => {
    set({ status: 'loading' })
    const [header, settings] = await Promise.all([loadHeader(), loadSettings()])
    set({
      header,
      settings,
      status: header && settings ? 'locked' : 'uninitialized',
    })
  },

  create: async (passphrase) => {
    const { header, dek } = await createVault(passphrase)
    const settings = await saveVault(header, 'passphrase')
    set({ header, settings, dek, status: 'unlocked' })
  },

  unlock: async (passphrase) => {
    const { header } = get()
    if (!header) throw new Error('Vault başlığı yok')
    const dek = await unlockVault(passphrase, header)
    set({ dek, status: 'unlocked' })
  },

  restore: async (header, mode) => {
    wipe(get().dek)
    const settings = await saveVault(header, mode)
    set({ header, settings, dek: undefined, status: 'locked' })
  },

  lock: () => {
    wipe(get().dek)
    set({ dek: undefined, status: 'locked' })
  },

  reset: async () => {
    wipe(get().dek)
    await destroyVault()
    set({ header: undefined, settings: undefined, dek: undefined })
    await get().init()
  },
}))
