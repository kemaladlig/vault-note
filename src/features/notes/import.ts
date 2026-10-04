import type { DecryptedNote } from './model'

/**
 * Import layer: turn external files into `NoteContent` the notes store can persist, and do a
 * dry-run so the user sees how many notes are new versus duplicates before anything is written.
 * No dependencies — the Markdown frontmatter we accept is deliberately small.
 */

export interface ImportCandidate {
  /** Origin file name, shown in the summary. */
  source: string
  title: string
  body: string
  tags: string[]
  folderId?: string
  pinned?: boolean
  archived?: boolean
}

export interface ImportPlan {
  total: number
  fresh: ImportCandidate[]
  duplicates: ImportCandidate[]
}

const MARKDOWN_EXT = /\.(md|markdown|mdown|txt)$/i

/**
 * 53-bit string hash (cyrb53). Good enough to spot content duplicates; not a security hash.
 * Deterministic across sessions so re-importing the same file is detected.
 */
export function contentHash(content: { title: string; body: string; tags: string[] }): string {
  const normalized = `${content.title.trim()}\n${content.body.trim()}\n${[...content.tags].sort().join(',')}`
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${4294967296 * (2097151 & h2) + (h1 >>> 0)}`
}

function baseName(source: string): string {
  return source.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
}

/** Parse a small `---` frontmatter block. Supports `title:` and `tags:` (list or comma). */
function splitFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { data: {}, body: text }
  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    data[line.slice(0, sep).trim().toLowerCase()] = line.slice(sep + 1).trim()
  }
  return { data, body: text.slice(match[0].length) }
}

function parseTags(value?: string): string[] {
  if (!value) return []
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#+/, '').trim())
    .filter(Boolean)
}

function unique(tags: string[]): string[] {
  return [...new Set(tags)]
}

/** Parse one Markdown document. Frontmatter wins; then a leading `# H1`; then the file name. */
export function parseMarkdown(source: string, text: string): ImportCandidate {
  const { data, body: afterFront } = splitFrontmatter(text)
  let body = afterFront.replace(/^\s+/, '')
  let title = data.title ?? ''

  // Use (and strip) a leading H1 as the title when frontmatter did not provide one.
  const h1 = /^#\s+(.+?)\s*\r?\n/.exec(body)
  if (!title && h1) {
    title = h1[1].trim()
    body = body.slice(h1[0].length)
  }

  // A line made only of #tags (the export format) becomes tags and is removed from the body.
  const tags = unique(parseTags(data.tags))
  const lines = body.split(/\r?\n/)
  const tagLine = lines.findIndex((line) => /^\s*#\S+(\s+#\S+)*\s*$/.test(line))
  if (tags.length === 0 && tagLine !== -1) {
    tags.push(...unique(parseTags(lines[tagLine])))
  }
  if (tags.length > 0 && tagLine !== -1) lines.splice(tagLine, 1)

  return {
    source,
    title: title || baseName(source),
    body: lines.join('\n').replace(/^\n+|\n+$/g, ''),
    tags,
  }
}

function normalizeJsonNote(raw: unknown, source: string): ImportCandidate | null {
  if (!raw || typeof raw !== 'object') return null
  const note = raw as Record<string, unknown>
  if (typeof note.title !== 'string' && typeof note.body !== 'string') return null
  return {
    source,
    title: typeof note.title === 'string' ? note.title : '',
    body: typeof note.body === 'string' ? note.body : '',
    tags: Array.isArray(note.tags) ? note.tags.filter((t): t is string => typeof t === 'string') : [],
    folderId: typeof note.folderId === 'string' ? note.folderId : undefined,
    pinned: note.pinned === true,
    archived: note.archived === true,
  }
}

/** Parse the app's own JSON export (or a bare array of note-like objects). */
export function parseJsonExport(source: string, text: string): ImportCandidate[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('invalid-json')
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { notes?: unknown }).notes)
      ? (parsed as { notes: unknown[] }).notes
      : null
  if (!list) throw new Error('invalid-json')
  return list
    .map((item) => normalizeJsonNote(item, source))
    .filter((item): item is ImportCandidate => item !== null)
}

/** Route a file to the Markdown or JSON parser by extension. */
export function parseImportFile(source: string, text: string): ImportCandidate[] {
  if (MARKDOWN_EXT.test(source)) return [parseMarkdown(source, text)]
  if (/\.json$/i.test(source)) return parseJsonExport(source, text)
  return [parseMarkdown(source, text)]
}

/** Prefer an explicit frontmatter/JSON title; fall back to the file name so nothing is lost. */
function withTitle(candidate: ImportCandidate): ImportCandidate {
  return { ...candidate, title: candidate.title.trim() || baseName(candidate.source) }
}

/**
 * Split candidates into fresh vs duplicate against the current vault (and against each other).
 * Only non-deleted notes count as existing, so a trashed note may be re-imported.
 */
export function planImport(existing: DecryptedNote[], candidates: ImportCandidate[]): ImportPlan {
  const seen = new Set(
    existing.filter((note) => !note.deleted).map((note) => contentHash(note)),
  )
  const fresh: ImportCandidate[] = []
  const duplicates: ImportCandidate[] = []
  for (const raw of candidates) {
    const candidate = withTitle(raw)
    const hash = contentHash(candidate)
    if (seen.has(hash)) duplicates.push(candidate)
    else {
      seen.add(hash)
      fresh.push(candidate)
    }
  }
  return { total: candidates.length, fresh, duplicates }
}
