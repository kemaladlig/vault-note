import type { DecryptedNote } from './model'

/** Turkish-aware, case-insensitive haystack for one note (title + body + tags). */
export function noteHaystack(note: DecryptedNote): string {
  return `${note.title}\n${note.body}\n${note.tags.join(' ')}`.toLocaleLowerCase('tr')
}

/** Global search across all notes. Decrypted bodies are already in memory. */
export function filterNotes(notes: DecryptedNote[], query: string): DecryptedNote[] {
  const needle = query.trim().toLocaleLowerCase('tr')
  if (!needle) return notes
  return notes.filter((note) => noteHaystack(note).includes(needle))
}
