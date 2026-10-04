import { t } from '@/shared/i18n'

import type { DecryptedNote } from './model'

/** Trigger a client-side file download. Export is plaintext — the UI must warn the user. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slug(title: string): string {
  const base = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'not'
}

export function noteToMarkdown(note: DecryptedNote): string {
  const heading = `# ${note.title || t('common.untitled')}`
  const tags = note.tags.length ? `\n\n${note.tags.map((tag) => `#${tag}`).join(' ')}` : ''
  return `${heading}${tags}\n\n${note.body}\n`
}

export function notesToMarkdown(notes: DecryptedNote[]): string {
  return notes.map(noteToMarkdown).join('\n\n---\n\n')
}

export function notesToJson(notes: DecryptedNote[]): string {
  return JSON.stringify(
    { app: 'vaultnote', version: 1, exportedAt: new Date().toISOString(), notes },
    null,
    2,
  )
}

export function downloadNoteMarkdown(note: DecryptedNote): void {
  downloadText(`${slug(note.title)}.md`, noteToMarkdown(note), 'text/markdown')
}

export function downloadAllMarkdown(notes: DecryptedNote[]): void {
  downloadText('vaultnote-notlar.md', notesToMarkdown(notes), 'text/markdown')
}

export function downloadAllJson(notes: DecryptedNote[]): void {
  downloadText('vaultnote-notlar.json', notesToJson(notes), 'application/json')
}
