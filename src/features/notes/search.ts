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
  return normOf(note).haystack
}

/**
 * Per-note normalized cache. Note objects in the store are replaced (never
 * mutated) on edit, so a WeakMap keyed by object is always fresh and GCs
 * itself when the note is replaced. This avoids re-running toLocaleLowerCase
 * over long bodies on every keystroke while typing a query.
 */
interface NormEntry {
  title: string
  tags: string[]
  body: string
  haystack: string
  /** Collapsed-whitespace body for snippets; built lazily (hits only). */
  flat?: string
  flatNorm?: string
}

const normCache = new WeakMap<DecryptedNote, NormEntry>()

function normOf(note: DecryptedNote): NormEntry {
  let entry = normCache.get(note)
  if (!entry) {
    const title = normalizeTr(note.title)
    const tags = note.tags.map(normalizeTr)
    const body = normalizeTr(note.body)
    entry = { title, tags, body, haystack: `${title}\n${body}\n${tags.join(' ')}` }
    normCache.set(note, entry)
  }
  return entry
}

function flatOf(note: DecryptedNote): { flat: string; flatNorm: string } {
  const entry = normOf(note)
  if (entry.flat === undefined || entry.flatNorm === undefined) {
    const flat = note.body.replace(/\s+/g, ' ').trim()
    entry.flat = flat
    entry.flatNorm = normalizeTr(flat)
  }
  return { flat: entry.flat, flatNorm: entry.flatNorm }
}

/** Fuzzy matching only needs the head of long bodies; exact scan covers the rest. */
const FUZZY_BODY_CHARS = 2000
/** Enough literal hits means fuzzy would only add noise (and cost) — skip it. */
const EXACT_SKIP_FUZZY = 25
/** Bound expensive fuzzy work; exact matches are still unioned in full. */
const FUZZY_LIMIT = 50

const FUSE_OPTIONS: IFuseOptions<DecryptedNote> = {
  isCaseSensitive: false,
  ignoreDiacritics: true,
  includeScore: true,
  includeMatches: false,
  minMatchCharLength: 2,
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 2, getFn: (note: DecryptedNote) => normOf(note).title },
    { name: 'tags', weight: 1.5, getFn: (note: DecryptedNote) => normOf(note).tags },
    {
      name: 'body',
      weight: 1,
      getFn: (note: DecryptedNote) => normOf(note).body.slice(0, FUZZY_BODY_CHARS),
    },
  ],
}

/** Global search across all notes. Decrypted bodies are already in memory. */
export function filterNotes(notes: DecryptedNote[], query: string): DecryptedNote[] {
  const needle = normalizeTr(query.trim())
  if (!needle) return notes
  // Single chars are noisy for fuzzy matching — plain substring is predictable.
  if (needle.length < 2) {
    return notes.filter((note) => normOf(note).haystack.includes(needle))
  }
  // Cheap exact pass first (cached normalization, one indexOf per note).
  const exact: DecryptedNote[] = []
  for (const note of notes) {
    if (normOf(note).haystack.includes(needle)) exact.push(note)
  }
  // Plenty of literal hits: fuzzy would only add noise at full cost — skip it.
  if (exact.length >= EXACT_SKIP_FUZZY) return exact
  const fuse = new Fuse(notes, { ...FUSE_OPTIONS })
  const hits = fuse.search(needle, { limit: FUZZY_LIMIT })
  const seen = new Set(hits.map((hit) => hit.item.id))
  const ranked = hits.map((hit) => hit.item)
  // Union with exact matches so Fuse can never hide a literal substring hit.
  for (const note of exact) {
    if (!seen.has(note.id)) ranked.push(note)
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
function bodySnippet(note: DecryptedNote, needle: string): string {
  const { flat, flatNorm } = flatOf(note)
  if (!flat) return ''
  const index = needle ? flatNorm.indexOf(needle) : -1
  if (index === -1) return flat.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER)
  return windowBody(flat, index, needle.length)
}

/** Locate the query in a note (title → tags → body) and produce a snippet showing the hit. */
export function matchInfo(note: DecryptedNote, query: string): MatchInfo | null {
  const needle = normalizeTr(query.trim())
  if (!needle) return null
  const norm = normOf(note)
  if (norm.title.includes(needle)) {
    return { field: 'title', snippet: bodySnippet(note, needle) }
  }
  if (norm.tags.some((tag) => tag.includes(needle))) {
    return { field: 'tags', snippet: bodySnippet(note, needle) }
  }
  const { flat, flatNorm } = flatOf(note)
  const bodyIndex = flat ? flatNorm.indexOf(needle) : -1
  if (bodyIndex !== -1) {
    return { field: 'body', snippet: windowBody(flat, bodyIndex, needle.length) }
  }
  // No literal hit: no per-note fuzzy fallback here. It cost a Fuse instance
  // per rendered row; the list falls back to the body preview instead.
  return null
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
