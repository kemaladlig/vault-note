import type { MessageKey } from '@/shared/i18n'

/**
 * Auto-lock preference: how long the app may sit in the background before it locks itself.
 * Not sensitive, so it lives in localStorage like the other device prefs — never synced.
 *
 * `0` means "lock immediately"; a negative value means "never lock automatically".
 */
const STORAGE_KEY = 'vaultnote.autoLockMinutes'
const DEFAULT_MINUTES = 1

export interface AutoLockOption {
  minutes: number
  labelKey: MessageKey
  params?: Record<string, number>
}

export const AUTO_LOCK_OPTIONS: readonly AutoLockOption[] = [
  { minutes: 0, labelKey: 'settings.autoLockImmediate' },
  { minutes: 1, labelKey: 'settings.autoLockMinutes', params: { minutes: 1 } },
  { minutes: 5, labelKey: 'settings.autoLockMinutes', params: { minutes: 5 } },
  { minutes: 15, labelKey: 'settings.autoLockMinutes', params: { minutes: 15 } },
  { minutes: -1, labelKey: 'settings.autoLockNever' },
]

export const DEFAULT_AUTO_LOCK_MINUTES = DEFAULT_MINUTES

export function getAutoLockMinutes(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_MINUTES
  const raw = localStorage.getItem(STORAGE_KEY)
  const value = raw === null ? DEFAULT_MINUTES : Number(raw)
  return AUTO_LOCK_OPTIONS.some((option) => option.minutes === value) ? value : DEFAULT_MINUTES
}

export function setAutoLockMinutes(minutes: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(minutes))
}
