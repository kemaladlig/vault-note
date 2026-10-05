import { create } from 'zustand'

import {
  createVault,
  rekeyVault,
  unlockVault,
  type Bytes,
  type VaultHeader,
  type VaultMode,
} from '../crypto'
import { verifyBiometric } from './biometric'
import { getAppLockPref, setAppLockPref, type AppLockMode } from './appLock'
import { clearDeviceKey } from './deviceKey'
import {
  changePin as changePinGate,
  clearPin,
  clearPinState,
  hasPinGate,
  setPin,
  unlockWithPin as unlockWithPinGate,
} from './pinGate'
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
  /** Whether quick unlock is additionally gated by a device-local PIN. */
  pinSet: boolean
  /** How the app opens on this device: none (auto), pin, or biometric (native). */
  appLockMode: AppLockMode
  init: () => Promise<void>
  create: (passphrase: string, options?: RememberOptions) => Promise<void>
  unlock: (passphrase: string, options?: RememberOptions) => Promise<void>
  /** Unlock via the device-held key; no passphrase. */
  unlockWithDevice: () => Promise<void>
  /** Unlock via the device-local PIN gate. */
  unlockWithPin: (pin: string) => Promise<void>
  /** Gate quick unlock with a PIN (vault must be unlocked). */
  enablePin: (pin: string) => Promise<void>
  /** Remove the PIN after verifying it. */
  disablePin: (pin: string) => Promise<void>
  /** Replace the PIN after verifying the current one. */
  changePin: (current: string, next: string) => Promise<void>
  /** Open directly on this device, no prompt (requires no PIN). */
  setAppLockNone: () => void
  /** Gate quick unlock behind the native biometric prompt. */
  setAppLockBiometric: () => void
  /** Enable plain device quick unlock right now (vault must be unlocked). */
  enableQuickHere: () => Promise<void>
  /** Re-wrap the same DEK under a new passphrase. Notes are never re-encrypted. */
  changePassphrase: (current: string, next: string) => Promise<void>
  /**
   * Same as `changePassphrase` but without verifying the old passphrase. Only callable
   * while unlocked (DEK in RAM), i.e. after a device/PIN/biometric unlock. Safe because
   * holding the DEK already grants full read access — re-wrapping adds no new capability,
   * it just restores passphrase access on a device the user still owns.
   */
  resetPassphrase: (next: string) => Promise<void>
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
  pinSet: false,
  appLockMode: 'none',

  init: async () => {
    // StrictMode double-invokes effects and `reset()` re-calls this. Token the call and never
    // downgrade a session the user has already unlocked while the (async) boot read was in flight.
    const token = ++initToken
    const [header, settings, quick, pin] = await Promise.all([
      loadHeader(),
      loadSettings(),
      hasQuickUnlock(),
      hasPinGate(),
    ])
    if (token !== initToken || get().status === 'unlocked') return
    const locked = Boolean(header && settings)
    const appLockMode: AppLockMode = pin ? 'pin' : getAppLockPref()
    set({
      header,
      settings,
      quickUnlockAvailable: quick || pin,
      pinSet: pin,
      appLockMode,
      status: locked ? 'locked' : 'uninitialized',
    })
    // "Open directly": no gate on this device, so skip the unlock screen on a cold boot. A manual
    // lock stays locked for the session — this runs only from `init()`.
    if (locked && quick && !pin && appLockMode === 'none') {
      try {
        const dek = await quickUnlock()
        if (token === initToken && get().status === 'locked') set({ dek, status: 'unlocked' })
      } catch {
        // Device key missing/corrupt: leave the unlock screen up.
      }
    }
  },

  create: async (passphrase, options) => {
    const { header, dek } = await createVault(passphrase)
    const settings = await saveVault(header, 'passphrase')
    if (options?.remember !== false) await enableQuickUnlock(dek)
    set({
      header,
      settings,
      dek,
      status: 'unlocked',
      quickUnlockAvailable: await hasQuickUnlock(),
      pinSet: false,
      appLockMode: getAppLockPref(),
    })
  },

  unlock: async (passphrase, options) => {
    const { header } = get()
    if (!header) throw new Error('Vault başlığı yok')
    const dek = await unlockVault(passphrase, header)
    if (options?.remember === true) await enableQuickUnlock(dek)
    if (options?.remember === false) await disableQuickUnlock()
    const [quick, pin] = await Promise.all([hasQuickUnlock(), hasPinGate()])
    set({
      dek,
      status: 'unlocked',
      quickUnlockAvailable: quick || pin,
      pinSet: pin,
      appLockMode: pin ? 'pin' : getAppLockPref(),
    })
  },

  unlockWithDevice: async () => {
    // Gate on the OS biometric prompt only when the device is set to biometric; "open directly"
    // must not prompt.
    if (get().appLockMode === 'biometric') await verifyBiometric('VaultNote kilidini aç')
    const dek = await quickUnlock()
    set({ dek, status: 'unlocked' })
  },

  unlockWithPin: async (pin) => {
    const dek = await unlockWithPinGate(pin)
    set({ dek, status: 'unlocked' })
  },

  enablePin: async (pin) => {
    const { dek } = get()
    if (!dek) throw new Error('Vault kilitli')
    await setPin(pin, dek)
    set({ pinSet: true, quickUnlockAvailable: true, appLockMode: 'pin' })
  },

  disablePin: async (pin) => {
    await clearPin(pin)
    const [quick, pinStill] = await Promise.all([hasQuickUnlock(), hasPinGate()])
    set({
      quickUnlockAvailable: quick || pinStill,
      pinSet: pinStill,
      appLockMode: pinStill ? 'pin' : getAppLockPref(),
    })
  },

  changePin: async (current, next) => {
    await changePinGate(current, next)
  },

  setAppLockNone: () => {
    setAppLockPref('none')
    set({ appLockMode: 'none' })
  },

  setAppLockBiometric: () => {
    setAppLockPref('biometric')
    set({ appLockMode: 'biometric' })
  },

  enableQuickHere: async () => {
    const { dek } = get()
    if (!dek) throw new Error('Vault kilitli')
    await enableQuickUnlock(dek)
    set({ quickUnlockAvailable: true })
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

  resetPassphrase: async (next) => {
    const { header, dek, settings } = get()
    if (!header || !dek) throw new Error('Vault kilitli')
    const newHeader = await rekeyVault({ dek }, next)
    const saved = await saveVault(newHeader, settings?.mode ?? 'passphrase')
    set({ header: newHeader, settings: saved })
  },

  restore: async (header, mode) => {
    wipe(get().dek)
    // A restored vault has a different DEK than any quick-unlock was made for.
    await disableQuickUnlock()
    await clearPinState()
    const settings = await saveVault(header, mode)
    set({
      header,
      settings,
      dek: undefined,
      status: 'locked',
      quickUnlockAvailable: false,
      pinSet: false,
      appLockMode: 'none',
    })
  },

  forgetDevice: async () => {
    await disableQuickUnlock()
    await clearPinState()
    await clearDeviceKey()
    setAppLockPref('none')
    set({ quickUnlockAvailable: false, pinSet: false, appLockMode: 'none' })
  },

  lock: () => {
    wipe(get().dek)
    set({ dek: undefined, status: 'locked' })
  },

  reset: async () => {
    wipe(get().dek)
    await destroyVault()
    await clearDeviceKey()
    await clearPinState()
    set({
      header: undefined,
      settings: undefined,
      dek: undefined,
      quickUnlockAvailable: false,
      pinSet: false,
      status: 'loading',
    })
    await get().init()
  },
}))
