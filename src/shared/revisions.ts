/**
 * Version-history retention preference. Not sensitive, so it lives in localStorage like the
 * theme/scale/trash preferences. Each snapshot keeps a full sealed copy of the note, so the
 * options stay deliberately small (5/10/25) — `50`/unlimited was dropped to bound IndexedDB
 * growth. Unknown stored values (e.g. the removed `50`/`0`) fall back to the default.
 */
const STORAGE_KEY = 'vaultnote.revisionLimit'
const DEFAULT_LIMIT = 10

import type { MessageKey } from './i18n'

export interface RevisionLimitOption {
  limit: number
  labelKey: MessageKey
  params?: Record<string, number>
}

export const REVISION_LIMIT_OPTIONS: readonly RevisionLimitOption[] = [
  { limit: 5, labelKey: 'settings.revisions.count', params: { count: 5 } },
  { limit: 10, labelKey: 'settings.revisions.count', params: { count: 10 } },
  { limit: 25, labelKey: 'settings.revisions.count', params: { count: 25 } },
]

export const DEFAULT_REVISION_LIMIT = DEFAULT_LIMIT

/** Revisions kept per note before the oldest is pruned. Unknown values fall back to default. */
export function getRevisionLimit(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_LIMIT
  const raw = localStorage.getItem(STORAGE_KEY)
  const value = raw === null ? DEFAULT_LIMIT : Number(raw)
  return REVISION_LIMIT_OPTIONS.some((option) => option.limit === value) ? value : DEFAULT_LIMIT
}

export function setRevisionLimit(limit: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(limit))
}
