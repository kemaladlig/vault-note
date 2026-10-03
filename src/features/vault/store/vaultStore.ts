import { create } from 'zustand'

import {
  createVault,
  randomBytes,
  rekeyVault,
  toBase64,
  unlockVault,
  type Bytes,
  type VaultHeader,
  type VaultMode,
} from '../crypto'
import { verifyBiometric } from './biometric'
import { clearDeviceKey } from './deviceKey'
import { disableQuickUnlock, enableQuickUnlock, hasQuickUnlock, quickUnlock } from './quickUnlock'
import { destroyVault, loadHeader, loadSettings, saveVault, type VaultSettings } from './vaultRepo'

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

export interface RememberOptions {
  /** undefined = leave as-is, true = enable, false = disable. */
  remember?: boolean
}

interface VaultState {
  status: VaultStatus
  header?: VaultHeader
  settings?: VaultSettings
  /** Vault Key, in memory only while unlocked. Zeroed on lock. */
  dek?: Bytes
  /** Whether this device can unlock without the passphrase. */
  quickUnlockAvailable: boolean
  init: () => Promise<void>
  create: (passphrase: string, options?: RememberOptions) => Promise<void>
  /**
   * Passwordless vault: the header is wrapped with a random passphrase we discard, and the DEK
   * is only reachable through this device's quick-unlock key. No recovery, no cross-device.
   */
  createDevice: () => Promise<void>
  unlock: (passphrase: string, options?: RememberOptions) => Promise<void>
  /** Unlock via the device-held key; no passphrase. */
  unlockWithDevice: () => Promise<void>
  /** Re-wrap the same DEK under a new passphrase. Notes are never re-encrypted. */
  changePassphrase: (current: string, next: string) => Promise<void>
  /** Adopt a vault header discovered on Drive (new-device setup). Lands in `locked`. */
  restore: (header: VaultHeader, mode: VaultMode) => Promise<void>
  /** Forget this device (disables quick unlock). */
  forgetDevice: () => Promise<void>
  lock: () => void
  reset: () => Promise<void>
}

function wipe(bytes?: Bytes): void {
  if (bytes) bytes.fill(0)
}

/** Monotonic boot token; lets a stale `init()` bail instead of clobbering live vault state. */
let initToken = 0

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'loading',
  quickUnlockAvailable: false,

  init: async () => {
    // StrictMode double-invokes effects and `reset()` re-calls this. Token the call and never
    // downgrade a session the user has already unlocked while the (async) boot read was in flight.
    const token = ++initToken
    const [header, settings, quick] = await Promise.all([
      loadHeader(),
      loadSettings(),
      hasQuickUnlock(),
    ])
    if (token !== initToken || get().status === 'unlocked') return
    set({
      header,
      settings,
      quickUnlockAvailable: quick,
      status: header && settings ? 'locked' : 'uninitialized',
    })
  },

  create: async (passphrase, options) => {
    const { header, dek } = await createVault(passphrase)
    const settings = await saveVault(header, 'passphrase')
    if (options?.remember !== false) await enableQuickUnlock(dek)
    set({ header, settings, dek, status: 'unlocked', quickUnlockAvailable: await hasQuickUnlock() })
  },

  createDevice: async () => {
    // A throwaway passphrase nobody knows: the header stays well-formed and cloud-backup-able,
    // but the only way back in is this device's quick-unlock key.
    const throwaway = toBase64(randomBytes(32))
    const { header, dek } = await createVault(throwaway)
    const settings = await saveVault(header, 'device')
    await enableQuickUnlock(dek)
    set({ header, settings, dek, status: 'unlocked', quickUnlockAvailable: true })
  },

  unlock: async (passphrase, options) => {
    const { header } = get()
    if (!header) throw new Error('Vault başlığı yok')
    const dek = await unlockVault(passphrase, header)
    if (options?.remember === true) await enableQuickUnlock(dek)
    if (options?.remember === false) await disableQuickUnlock()
    set({ dek, status: 'unlocked', quickUnlockAvailable: await hasQuickUnlock() })
  },

  unlockWithDevice: async () => {
    // Gate on the OS biometric prompt when available; throws on cancel/failure.
    await verifyBiometric('VaultNote kilidini aç')
    const dek = await quickUnlock()
    set({ dek, status: 'unlocked' })
  },

  changePassphrase: async (current, next) => {
    const { header, dek, settings } = get()
    if (!header || !dek) throw new Error('Vault kilitli')
    // Verifies the current passphrase (throws WrongPassphraseError) before re-wrapping.
    await unlockVault(current, header)
    const newHeader = await rekeyVault({ dek }, next)
    const saved = await saveVault(newHeader, settings?.mode ?? 'passphrase')
    set({ header: newHeader, settings: saved })
  },

  restore: async (header, mode) => {
    wipe(get().dek)
    // A restored vault has a different DEK than any quick-unlock was made for.
    await disableQuickUnlock()
    const settings = await saveVault(header, mode)
    set({ header, settings, dek: undefined, status: 'locked', quickUnlockAvailable: false })
  },

  forgetDevice: async () => {
    await disableQuickUnlock()
    await clearDeviceKey()
    set({ quickUnlockAvailable: false })
  },

  lock: () => {
    wipe(get().dek)
    set({ dek: undefined, status: 'locked' })
  },

  reset: async () => {
    wipe(get().dek)
    await destroyVault()
    await clearDeviceKey()
    set({
      header: undefined,
      settings: undefined,
      dek: undefined,
      quickUnlockAvailable: false,
      status: 'loading',
    })
    await get().init()
  },
}))
