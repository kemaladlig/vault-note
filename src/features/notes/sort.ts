import type { DecryptedNote } from './model'

/** Sort keys for the note list. Date fields keep the date grouping; `title` goes flat. */
export type SortField = 'updatedAt' | 'createdAt' | 'title'
export type SortDir = 'asc' | 'desc'

export const DEFAULT_SORT_FIELD: SortField = 'updatedAt'
export const DEFAULT_SORT_DIR: SortDir = 'desc'

/** Sensible direction when a field is first picked: dates newest-first, titles A→Z. */
export function defaultDirFor(field: SortField): SortDir {
  return field === 'title' ? 'asc' : 'desc'
}

/**
 * Sort a note list by field/direction. Stable, and title comparison is Turkish-collated.
 * The caller keeps pinned notes grouped; this only orders within whatever it is given.
 */
export function sortNotes(
  notes: DecryptedNote[],
  field: SortField,
  dir: SortDir,
): DecryptedNote[] {
  const factor = dir === 'asc' ? 1 : -1
  const sorted = [...notes]
  if (field === 'title') {
    sorted.sort(
      (a, b) => factor * a.title.trim().localeCompare(b.title.trim(), 'tr', { sensitivity: 'base' }),
    )
    return sorted
  }
  sorted.sort((a, b) => factor * (a[field] - b[field]))
  return sorted
}

/** The date bucket to group by, or `null` when the sort is title-based (flat list). */
export function groupFieldFor(field: SortField): 'updatedAt' | 'createdAt' | null {
  return field === 'title' ? null : field
}
