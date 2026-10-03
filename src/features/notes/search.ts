import Fuse, { type IFuseOptions } from 'fuse.js'

import type { DecryptedNote, NotesView } from './model'

/**
 * Turkish-folded lowercase. Length-preserving (1 char -> 1 char) so indices
 * in the normalized string still line up with the original text.
 */
export function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
}

/** Turkish-aware, case-insensitive haystack for one note (title + body + tags). */
export function noteHaystack(note: DecryptedNote): string {
  return normalizeTr(`${note.title}\n${note.body}\n${note.tags.join(' ')}`)
}

const FUSE_OPTIONS: IFuseOptions<DecryptedNote> = {
  isCaseSensitive: false,
  ignoreDiacritics: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 2, getFn: (note: DecryptedNote) => normalizeTr(note.title) },
    { name: 'tags', weight: 1.5, getFn: (note: DecryptedNote) => note.tags.map(normalizeTr) },
    { name: 'body', weight: 1, getFn: (note: DecryptedNote) => normalizeTr(note.body) },
  ],
}

/** Global search across all notes. Decrypted bodies are already in memory. */
export function filterNotes(notes: DecryptedNote[], query: string): DecryptedNote[] {
  const needle = normalizeTr(query.trim())
  if (!needle) return notes
  // Single chars are noisy for fuzzy matching — plain substring is predictable.
  if (needle.length < 2) {
    return notes.filter((note) => noteHaystack(note).includes(needle))
  }
  const fuse = new Fuse(notes, { ...FUSE_OPTIONS })
  const hits = fuse.search(needle)
  const seen = new Set(hits.map((hit) => hit.item.id))
  const ranked = hits.map((hit) => hit.item)
  // Union with exact matches so Fuse can never hide a literal substring hit.
  for (const note of notes) {
    if (!seen.has(note.id) && noteHaystack(note).includes(needle)) {
      ranked.push(note)
    }
  }
  return ranked
}

/** Keep only notes carrying an exact tag. */
export function filterByTag(notes: DecryptedNote[], tag?: string): DecryptedNote[] {
  if (!tag) return notes
  return notes.filter((note) => note.tags.includes(tag))
}

/** Which notes a sidebar scope shows, before tag/text filters. */
export function filterByView(
  notes: DecryptedNote[],
  view: NotesView,
  folderIds?: Set<string>,
): DecryptedNote[] {
  let scoped: DecryptedNote[]
  switch (view) {
    case 'trash':
      scoped = notes.filter((note) => note.deleted)
      break
    case 'archive':
      scoped = notes.filter((note) => !note.deleted && note.archived)
      break
    case 'pinned':
      scoped = notes.filter((note) => !note.deleted && !note.archived && note.pinned)
      break
    default:
      scoped = notes.filter((note) => !note.deleted && !note.archived)
  }
  if (folderIds && folderIds.size > 0) {
    scoped = scoped.filter((note) => note.folderId && folderIds.has(note.folderId))
  }
  return scoped
}

/** Where a query hit a note, plus a body excerpt centered on the hit. */
export interface MatchInfo {
  field: 'title' | 'tags' | 'body'
  /** ~120-char flattened body excerpt around the first body match (or the start). */
  snippet: string
}

const SNIPPET_BEFORE = 36
const SNIPPET_AFTER = 96

function windowBody(flat: string, matchIndex: number, matchLength: number): string {
  if (!flat) return ''
  const start = Math.max(0, matchIndex - SNIPPET_BEFORE)
  const end = Math.min(flat.length, matchIndex + matchLength + SNIPPET_AFTER)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

/** Collapse whitespace and window the body text around the first needle occurrence. */
function bodySnippet(body: string, needle: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const index = needle ? normalizeTr(flat).indexOf(needle) : -1
  if (index === -1) return flat.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER)
  return windowBody(flat, index, needle.length)
}

/** Locate the query in a note (title → tags → body) and produce a snippet showing the hit. */
export function matchInfo(note: DecryptedNote, query: string): MatchInfo | null {
  const needle = normalizeTr(query.trim())
  if (!needle) return null
  if (normalizeTr(note.title).includes(needle)) {
    return { field: 'title', snippet: bodySnippet(note.body, needle) }
  }
  if (note.tags.some((tag) => normalizeTr(tag).includes(needle))) {
    return { field: 'tags', snippet: bodySnippet(note.body, needle) }
  }
  const flatBody = note.body.replace(/\s+/g, ' ').trim()
  const bodyIndex = normalizeTr(flatBody).indexOf(needle)
  if (bodyIndex !== -1) {
    return { field: 'body', snippet: windowBody(flatBody, bodyIndex, needle.length) }
  }
  // No literal hit — ask Fuse whether this note fuzzy-matches, so the list
  // and palette still show a snippet instead of falling back to a preview.
  if (needle.length < 2) return null
  const fuse = new Fuse([note], { ...FUSE_OPTIONS })
  const hits = fuse.search(needle)
  if (hits.length === 0) return null
  const keys = new Set((hits[0].matches ?? []).map((match) => match.key))
  const field: MatchInfo['field'] = keys.has('title')
    ? 'title'
    : keys.has('tags')
      ? 'tags'
      : 'body'
  if (field !== 'body') {
    return { field, snippet: bodySnippet(note.body, '') }
  }
  const bodyMatch = (hits[0].matches ?? []).find((match) => match.key === 'body')
  const first = bodyMatch?.indices?.[0]
  if (first) {
    const [start, end] = first
    return { field, snippet: windowBody(flatBody, start, end - start + 1) }
  }
  return { field, snippet: bodySnippet(note.body, '') }
}

/** Notes that can appear in search/jump surfaces (excludes archive + trash). */
export function activeNotes(notes: DecryptedNote[]): DecryptedNote[] {
  return notes.filter((note) => !note.deleted && !note.archived)
}

/** Distinct tags across active notes, alphabetical (Turkish collation). */
export function collectTags(notes: DecryptedNote[]): string[] {
  const set = new Set<string>()
  for (const note of notes) {
    if (note.deleted || note.archived) continue
    for (const tag of note.tags) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
}

export interface NoteFilter {
  query: string
  tag?: string
  view: NotesView
  folderIds?: Set<string>
}

/** Single entry point for the sidebar: compose scope + tag filter + text query. */
export function selectNotes(notes: DecryptedNote[], filter: NoteFilter): DecryptedNote[] {
  const scoped = filterByView(notes, filter.view, filter.folderIds)
  return filterNotes(filterByTag(scoped, filter.tag), filter.query)
}
