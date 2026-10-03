/**
 * Auto-purge preference for the trash. Not sensitive, so it lives in localStorage like the
 * theme and scale preferences. `0` means "never purge automatically".
 */
const STORAGE_KEY = 'vaultnote.trashRetentionDays'
const DEFAULT_DAYS = 30

export interface TrashRetentionOption {
  days: number
  label: string
}

export const TRASH_RETENTION_OPTIONS: readonly TrashRetentionOption[] = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
  { days: 0, label: 'Asla' },
]

export const DEFAULT_TRASH_RETENTION_DAYS = DEFAULT_DAYS

/** Days a trashed note is kept before the automatic sweep removes it (`0` = never). */
export function getTrashRetentionDays(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_DAYS
  const raw = localStorage.getItem(STORAGE_KEY)
  const value = raw === null ? DEFAULT_DAYS : Number(raw)
  return TRASH_RETENTION_OPTIONS.some((option) => option.days === value) ? value : DEFAULT_DAYS
}

export function setTrashRetentionDays(days: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(days))
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A trashed note is expired once it has sat in the trash for the retention window. The delete
 * timestamp is the note's `updatedAt`: the UI never edits a trashed note, so it stays the moment
 * it was trashed (sync tombstones carry the deleting device's time).
 */
export function isTrashExpired(deletedAt: number, nowMs: number, retentionDays: number): boolean {
  if (retentionDays <= 0) return false
  return nowMs - deletedAt >= retentionDays * DAY_MS
}
