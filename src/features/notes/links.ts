import type { DecryptedNote } from './model'
import { normalizeTr } from './search'

/**
 * Wiki-link layer. `[[Target]]` (and `[[Target|alias]]`) inside a note body resolve
 * against the decrypted notes already in RAM — nothing new is persisted, the index is
 * derived on the fly. Resolution is by title first, then by raw id, so a link keeps
 * working across a rename only when it used an id; title links that no longer resolve
 * are surfaced as broken instead of silently disappearing.
 */

export interface WikiLink {
  /** Text before the optional `|`: a note title or id. */
  target: string
  /** Display text after `|`; falls back to the target when absent. */
  alias?: string
  /** Char offset of the `[[` in the body. */
  index: number
  /** Length of the full `[[…]]` match. */
  length: number
}

export interface LinkIndex {
  byId: Map<string, DecryptedNote>
  /** Turkish-folded, trimmed titles. First writer wins (notes arrive newest-first). */
  byTitle: Map<string, DecryptedNote>
}

export interface ResolvedLink extends WikiLink {
  /** The note this link points at, or undefined when it is broken. */
  note?: DecryptedNote
}

export interface Backlink {
  /** The note that links to the target. */
  note: DecryptedNote
  /** The specific links (there can be several per source note). */
  links: ResolvedLink[]
}

/** Pull every `[[…]]` occurrence out of a body, in document order. */
export function parseWikiLinks(body: string): WikiLink[] {
  const links: WikiLink[] = []
  const re = /\[\[([^[\]\n]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const inner = match[1]
    const pipe = inner.indexOf('|')
    const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
    const alias = pipe === -1 ? '' : inner.slice(pipe + 1).trim()
    if (!target) continue
    links.push({
      target,
      alias: alias || undefined,
      index: match.index,
      length: match[0].length,
    })
  }
  return links
}

/** Build the lookup maps used to resolve links against the current vault. */
export function buildLinkIndex(notes: DecryptedNote[]): LinkIndex {
  const byId = new Map<string, DecryptedNote>()
  const byTitle = new Map<string, DecryptedNote>()
  for (const note of notes) {
    byId.set(note.id, note)
    const title = note.title.trim()
    if (note.deleted || !title) continue
    const key = normalizeTr(title)
    if (!byTitle.has(key)) byTitle.set(key, note)
  }
  return { byId, byTitle }
}

/** Resolve a single target: title match (folded) first, then exact id. */
export function resolveTarget(target: string, index: LinkIndex): DecryptedNote | undefined {
  return index.byTitle.get(normalizeTr(target.trim())) ?? index.byId.get(target)
}

/** Resolve every link in a body; unresolved entries stay with `note` undefined. */
export function resolveLinks(body: string, index: LinkIndex): ResolvedLink[] {
  return parseWikiLinks(body).map((link) => ({ ...link, note: resolveTarget(link.target, index) }))
}

/**
 * Notes that link to `target`, with the matching links. The target's own self-links and
 * trashed notes are ignored. Pass a prebuilt `index` to reuse it across several targets.
 */
export function backlinksFor(
  target: DecryptedNote,
  notes: DecryptedNote[],
  index?: LinkIndex,
): Backlink[] {
  const idx = index ?? buildLinkIndex(notes)
  const result: Backlink[] = []
  for (const note of notes) {
    if (note.id === target.id || note.deleted) continue
    // A cheap raw scan first: most notes carry no wiki-link at all, so skip the parse for them.
    // This keeps opening a note O(linkers) instead of O(every body) on large vaults.
    if (!note.body.includes('[[')) continue
    const links = resolveLinks(note.body, idx).filter((link) => link.note?.id === target.id)
    if (links.length > 0) result.push({ note, links })
  }
  return result
}

/**
 * Rewrite `[[…]]` into ordinary Markdown links carrying a `vaultnote:` scheme, so `marked`
 * renders them and the preview can turn them into in-app navigation. `resolve` maps a
 * target to a note id (undefined = broken).
 */
export function wikiLinksToMarkdown(
  body: string,
  resolve: (target: string) => string | undefined,
): string {
  if (!body.includes('[[')) return body
  return body.replace(/\[\[([^[\]\n]+)\]\]/g, (full, inner: string) => {
    const pipe = inner.indexOf('|')
    const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
    const alias = pipe === -1 ? '' : inner.slice(pipe + 1).trim()
    if (!target) return full
    const label = alias || target
    const id = resolve(target)
    const href = id
      ? `vaultnote:note/${encodeURIComponent(id)}`
      : `vaultnote:broken/${encodeURIComponent(target)}`
    return `[${label}](${href})`
  })
}
