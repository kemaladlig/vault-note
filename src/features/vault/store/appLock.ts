import { Capacitor } from '@capacitor/core'

/**
 * Device-local "how the app opens on this device" preference. The PIN is represented separately
 * (by its own sealed row); this stores the non-PIN choice. Never synced.
 *
 * - `none`      — open directly, no prompt (auto-opens on boot).
 * - `biometric` — native only; gate quick unlock behind the OS biometric prompt.
 */
export type AppLockMode = 'none' | 'pin' | 'biometric'

/** The persisted half of the mode: PIN is derived from `hasPinGate()`, not stored here. */
export type AppLockPref = 'none' | 'biometric'

const KEY = 'vaultnote.appLock'

export function biometricAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export function getAppLockPref(): AppLockPref {
  try {
    if (localStorage.getItem(KEY) === 'biometric' && biometricAvailable()) return 'biometric'
  } catch {
    // localStorage unavailable (private mode) — fall through to the safe default.
  }
  return 'none'
}

export function setAppLockPref(mode: AppLockPref): void {
  try {
    if (mode === 'none') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // ignore persistence failures; the in-memory store still reflects the choice this session
  }
}
