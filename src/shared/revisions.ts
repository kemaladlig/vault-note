/**
 * Version-history retention preference. Not sensitive, so it lives in localStorage like the
 * theme/scale/trash preferences. `0` means "keep every revision" (no automatic pruning).
 */
const STORAGE_KEY = 'vaultnote.revisionLimit'
const DEFAULT_LIMIT = 25

import type { MessageKey } from './i18n'

export interface RevisionLimitOption {
  limit: number
  labelKey: MessageKey
  params?: Record<string, number>
}

export const REVISION_LIMIT_OPTIONS: readonly RevisionLimitOption[] = [
  { limit: 10, labelKey: 'settings.revisions.count', params: { count: 10 } },
  { limit: 25, labelKey: 'settings.revisions.count', params: { count: 25 } },
  { limit: 50, labelKey: 'settings.revisions.count', params: { count: 50 } },
  { limit: 0, labelKey: 'settings.revisions.unlimited' },
]

export const DEFAULT_REVISION_LIMIT = DEFAULT_LIMIT

/** Revisions kept per note before the oldest is pruned (`0` = unlimited). */
export function getRevisionLimit(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_LIMIT
  const raw = localStorage.getItem(STORAGE_KEY)
  const value = raw === null ? DEFAULT_LIMIT : Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_LIMIT
}

export function setRevisionLimit(limit: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(limit))
}
